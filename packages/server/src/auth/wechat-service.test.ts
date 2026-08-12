import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  exchangeCodeForOpenId,
  wechatLogin,
  type WechatDatabase,
  type WechatExchangeClient,
} from "./wechat-service";

const FIXED_NOW = new Date("2026-08-11T00:00:00.000Z");
// 30 天后：2,592,000,000 毫秒
const SESSION_EXPIRES_AT = new Date(FIXED_NOW.getTime() + 30 * 24 * 60 * 60 * 1000);

/** 构造 mock exchange client，返回指定的响应体 */
function createExchange(response: Record<string, unknown>): WechatExchangeClient {
  return vi.fn().mockResolvedValue({
    json: async () => response,
  }) as unknown as WechatExchangeClient;
}

/** 构造 mock 数据库，user.upsert 返回指定 userId */
function createDatabase(userId = "user-1"): WechatDatabase {
  return {
    user: {
      upsert: vi.fn().mockResolvedValue({ id: userId }),
    },
    parentProfile: {
      upsert: vi.fn().mockResolvedValue(undefined),
    },
    authSession: {
      create: vi.fn().mockResolvedValue(undefined),
    },
  };
}

beforeEach(() => {
  process.env.WECHAT_APPID = "test-appid";
  process.env.WECHAT_SECRET = "test-secret";
});

afterEach(() => {
  delete process.env.WECHAT_APPID;
  delete process.env.WECHAT_SECRET;
});

describe("exchangeCodeForOpenId", () => {
  it("returns openid/unionid/session_key on success", async () => {
    const exchange = createExchange({
      openid: "openid-1",
      unionid: "unionid-1",
      session_key: "session-key-1",
    });

    await expect(exchangeCodeForOpenId("code-1", exchange)).resolves.toEqual({
      openid: "openid-1",
      unionid: "unionid-1",
      session_key: "session-key-1",
    });

    // 校验请求 URL 包含必要参数
    const call = (exchange as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toContain("grant_type=authorization_code");
    expect(call[0]).toContain("js_code=code-1");
    expect(call[0]).toContain("appid=test-appid");
    expect(call[1]).toEqual({ method: "GET" });
  });

  it("throws UNAUTHENTICATED when WeChat returns errcode", async () => {
    const exchange = createExchange({ errcode: 40029, errmsg: "invalid code" });

    await expect(exchangeCodeForOpenId("bad-code", exchange)).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      status: 401,
    });
  });

  it("throws UNAUTHENTICATED when openid is missing", async () => {
    const exchange = createExchange({ session_key: "session-key-1" });

    await expect(exchangeCodeForOpenId("bad-code", exchange)).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      status: 401,
    });
  });
});

describe("wechatLogin", () => {
  it("exchanges code, upserts user/profile, creates session, returns plaintext token", async () => {
    const exchange = createExchange({
      openid: "openid-1",
      unionid: "unionid-1",
      session_key: "session-key-1",
    });
    const database = createDatabase("user-1");

    const result = await wechatLogin("code-1", {
      database,
      exchange,
      now: () => FIXED_NOW,
    });

    expect(result.userId).toBe("user-1");
    expect(typeof result.token).toBe("string");
    expect(result.token.length).toBeGreaterThan(0);

    // user.upsert 按 wechatOpenId 唯一，create 携带 unionid
    expect(database.user.upsert).toHaveBeenCalledWith({
      where: { wechatOpenId: "openid-1" },
      create: { wechatOpenId: "openid-1", wechatUnionId: "unionid-1" },
      update: {},
    });

    // parentProfile.upsert 按 userId 唯一
    expect(database.parentProfile.upsert).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      create: { userId: "user-1" },
      update: {},
    });

    // authSession.create 存储的是 SHA-256 哈希，expiresAt 为 30 天后
    expect(database.authSession.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        tokenHash: createHash("sha256").update(result.token).digest("hex"),
        expiresAt: SESSION_EXPIRES_AT,
        status: "ACTIVE",
      },
    });
  });

  it("throws UNAUTHENTICATED when WeChat returns errcode", async () => {
    const exchange = createExchange({ errcode: 40029, errmsg: "invalid code" });
    const database = createDatabase("user-1");

    await expect(
      wechatLogin("bad-code", { database, exchange, now: () => FIXED_NOW }),
    ).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      status: 401,
    });

    // 失败时不应创建任何数据库记录
    expect(database.user.upsert).not.toHaveBeenCalled();
    expect(database.authSession.create).not.toHaveBeenCalled();
  });

  it("returns the same user but a new session on repeated login", async () => {
    const exchange = createExchange({
      openid: "openid-1",
      session_key: "session-key-1",
    });
    const database = createDatabase("user-1");

    const first = await wechatLogin("code-1", {
      database,
      exchange,
      now: () => FIXED_NOW,
    });
    const second = await wechatLogin("code-2", {
      database,
      exchange,
      now: () => FIXED_NOW,
    });

    // 两次登录返回同一 userId（upsert 复用）
    expect(first.userId).toBe("user-1");
    expect(second.userId).toBe("user-1");

    // 两次登录生成不同的 token（每次 randomBytes）
    expect(first.token).not.toBe(second.token);

    // user.upsert 被调用两次，authSession.create 也被调用两次（新 session）
    expect(database.user.upsert).toHaveBeenCalledTimes(2);
    expect(database.authSession.create).toHaveBeenCalledTimes(2);

    // 两次 upsert 都使用相同的 wechatOpenId
    expect(database.user.upsert).toHaveBeenNthCalledWith(1, {
      where: { wechatOpenId: "openid-1" },
      create: { wechatOpenId: "openid-1" },
      update: {},
    });
    expect(database.user.upsert).toHaveBeenNthCalledWith(2, {
      where: { wechatOpenId: "openid-1" },
      create: { wechatOpenId: "openid-1" },
      update: {},
    });
  });
});
