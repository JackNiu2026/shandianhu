import { NextRequest, NextResponse } from "next/server";
import {
  authenticateAdminCredentials,
  issueAdminSession,
  RedisLoginThrottle,
} from "@lightning-tiger/server";
import { SESSION_MAX_AGE, setAuthCookie } from "@/lib/auth";
import {
  getLoginThrottleKey,
} from "@/lib/login-throttle";
import { loginSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const loginThrottle = new RedisLoginThrottle();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const result = loginSchema.safeParse(await request.json());
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message || "Invalid request" }, { status: 400 });
    }

    const loginIdentifier = result.data.username.trim().toLowerCase();
    const clientKey = getLoginThrottleKey(request, loginIdentifier);
    let allowed: boolean;
    try {
      allowed = await loginThrottle.take(clientKey, MAX_ATTEMPTS, WINDOW_MS);
    } catch (error) {
      console.error("[Login Throttle Error]", error);
      return NextResponse.json({ error: "Login temporarily unavailable" }, { status: 503 });
    }
    if (!allowed) {
      return NextResponse.json({ error: "Too many login attempts" }, { status: 429 });
    }

    const adminUser = await authenticateAdminCredentials(loginIdentifier, result.data.password);
    if (!adminUser) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    await loginThrottle.reset(clientKey);
    const token = await issueAdminSession(adminUser.adminUserId, SESSION_MAX_AGE);

    const response = NextResponse.json({
      success: true,
      user: { email: adminUser.email, role: adminUser.role },
    });
    setAuthCookie(response, token);
    return response;
  } catch (error) {
    console.error("[Login Error]", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
