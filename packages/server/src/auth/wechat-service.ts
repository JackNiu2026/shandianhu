import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";

/** Session 有效期：30 天 */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** 微信 jscode2session 返回体 */
type WechatSessionResponse = {
  openid?: string;
  unionid?: string;
  session_key?: string;
  errcode?: number;
  errmsg?: string;
};

/** code exchange 成功后的有效负载 */
export type WechatExchangeResult = {
  openid: string;
  unionid?: string;
  session_key: string;
};

/**
 * 可注入的 fetch 窄化类型，便于测试。
 * 仅要求返回能够解析 JSON 的响应体。
 */
export interface WechatExchangeClient {
  (input: string, init?: { method?: string }): Promise<{
    json: () => Promise<unknown>;
  }>;
}

/**
 * 窄化的数据库接口，仅声明微信登录所需操作。
 * 与 session-service / admin-session-service 保持一致的窄化风格。
 */
export interface WechatDatabase {
  user: {
    upsert(args: {
      where: { wechatOpenId: string };
      create: { wechatOpenId: string; wechatUnionId?: string };
      update: Record<string, never>;
    }): Promise<{ id: string }>;
  };
  parentProfile: {
    upsert(args: {
      where: { userId: string };
      create: { userId: string };
      update: Record<string, never>;
    }): Promise<unknown>;
  };
  authSession: {
    create(args: {
      data: {
        userId: string;
        tokenHash: string;
        expiresAt: Date;
        status: "ACTIVE";
      };
    }): Promise<unknown>;
  };
}

export type WechatLoginResult = { token: string; userId: string };

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const defaultExchange: WechatExchangeClient = (input, init) =>
  fetch(input, init as RequestInit);

const defaultDatabase = prisma as unknown as WechatDatabase;

/**
 * 调用微信 jscode2session 接口，用小程序临时 code 换取 openid 与 session_key。
 * appid/secret 从环境变量 WECHAT_APPID / WECHAT_SECRET 读取。
 * 微信返回 errcode 或缺少 openid 时抛 UNAUTHENTICATED。
 */
export async function exchangeCodeForOpenId(
  code: string,
  client: WechatExchangeClient = defaultExchange,
): Promise<WechatExchangeResult> {
  const appid = process.env.WECHAT_APPID;
  const secret = process.env.WECHAT_SECRET;
  if (!appid || !secret) {
    throw new AppError("INTERNAL_ERROR", 500, "WeChat credentials not configured");
  }

  const url =
    `https://api.weixin.qq.com/sns/jscode2session` +
    `?appid=${encodeURIComponent(appid)}` +
    `&secret=${encodeURIComponent(secret)}` +
    `&js_code=${encodeURIComponent(code)}` +
    `&grant_type=authorization_code`;

  const response = await client(url, { method: "GET" });
  const payload = (await response.json()) as WechatSessionResponse;

  if (payload.errcode || !payload.openid || !payload.session_key) {
    throw new AppError(
      "UNAUTHENTICATED",
      401,
      `WeChat code exchange failed: ${payload.errcode ?? "missing openid"} ${payload.errmsg ?? ""}`.trim(),
    );
  }

  return {
    openid: payload.openid,
    unionid: payload.unionid,
    session_key: payload.session_key,
  };
}

/**
 * 微信小程序登录完整流程：
 * 1. 用 code 换 openid（可选 unionid）
 * 2. upsert User（按 wechatOpenId 唯一）+ ParentProfile（按 userId 唯一）
 * 3. 生成不透明 token（randomBytes(32) base64url），仅以 SHA-256 哈希入库
 * 4. 创建 AuthSession（有效期 30 天，状态 ACTIVE）
 * 5. 返回明文 token（只返回一次）与 userId
 *
 * 依赖注入：database / exchange / now 均可替换，默认用 prisma + fetch + Date.now。
 */
export async function wechatLogin(
  code: string,
  options: {
    database?: WechatDatabase;
    exchange?: WechatExchangeClient;
    now?: () => Date;
  } = {},
): Promise<WechatLoginResult> {
  const database = options.database ?? defaultDatabase;
  const exchange = options.exchange ?? defaultExchange;
  const now = options.now ?? (() => new Date());

  const { openid, unionid } = await exchangeCodeForOpenId(code, exchange);

  const user = await database.user.upsert({
    where: { wechatOpenId: openid },
    create: {
      wechatOpenId: openid,
      ...(unionid ? { wechatUnionId: unionid } : {}),
    },
    update: {},
  });

  await database.parentProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id },
    update: {},
  });

  const token = randomBytes(32).toString("base64url");
  await database.authSession.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(now().getTime() + SESSION_TTL_MS),
      status: "ACTIVE",
    },
  });

  return { token, userId: user.id };
}
