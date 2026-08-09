import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import {
  getLoginThrottleKey,
  pruneLoginAttempts,
  type LoginAttempt,
} from "../lib/login-throttle";
import { middleware } from "../middleware";

describe("admin authentication boundaries", () => {
  it("allows login with a stale session cookie so it can be replaced", () => {
    const request = new NextRequest("http://localhost:3000/login", {
      headers: { cookie: "admin-session=expired-or-revoked" },
    });

    const response = middleware(request);

    expect(response.headers.get("location")).toBeNull();
  });

  it("isolates untrusted-proxy attempts without accepting forwarded headers", () => {
    const previousTrustProxy = process.env.TRUST_PROXY;
    delete process.env.TRUST_PROXY;

    const firstRequest = new NextRequest("http://localhost:3000/api/auth/login", {
      headers: { "user-agent": "test-client", "x-forwarded-for": "198.51.100.1" },
    });
    const secondRequest = new NextRequest("http://localhost:3000/api/auth/login", {
      headers: { "user-agent": "test-client", "x-forwarded-for": "203.0.113.2" },
    });

    expect(getLoginThrottleKey(firstRequest, "first@example.com"))
      .toBe(getLoginThrottleKey(secondRequest, "first@example.com"));
    expect(getLoginThrottleKey(firstRequest, "first@example.com"))
      .not.toBe(getLoginThrottleKey(firstRequest, "second@example.com"));

    process.env.TRUST_PROXY = "true";
    expect(getLoginThrottleKey(firstRequest, "first@example.com"))
      .not.toBe(getLoginThrottleKey(secondRequest, "first@example.com"));

    if (previousTrustProxy === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = previousTrustProxy;
  });

  it("evicts expired and oldest login attempts to bound memory", () => {
    const attempts = new Map<string, LoginAttempt>([
      ["expired", { count: 1, lastAttempt: 0 }],
      ["oldest", { count: 1, lastAttempt: 80 }],
      ["middle", { count: 1, lastAttempt: 90 }],
      ["newest", { count: 1, lastAttempt: 100 }],
    ]);

    pruneLoginAttempts(attempts, 120, 50, 2);

    expect([...attempts.keys()]).toEqual(["middle", "newest"]);
    expect(attempts.size).toBeLessThanOrEqual(2);
  });
});
