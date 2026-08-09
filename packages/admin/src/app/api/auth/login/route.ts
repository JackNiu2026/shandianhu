import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@lightning-tiger/server/src/db/client";
import { SESSION_MAX_AGE, setAuthCookie } from "@/lib/auth";
import { getLoginThrottleKey } from "@/lib/login-throttle";
import { loginSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
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
    const attempts = loginAttempts.get(clientKey);
    if (attempts && attempts.count >= MAX_ATTEMPTS && Date.now() - attempts.lastAttempt < WINDOW_MS) {
      return NextResponse.json({ error: "Too many login attempts" }, { status: 429 });
    }
    if (attempts && Date.now() - attempts.lastAttempt >= WINDOW_MS) loginAttempts.delete(clientKey);

    const adminUser = await prisma.adminUser.findUnique({ where: { email: result.data.username } });
    const isValid = adminUser && await bcrypt.compare(result.data.password, adminUser.passwordHash);
    if (!isValid || !adminUser) {
      const current = loginAttempts.get(clientKey);
      loginAttempts.set(clientKey, { count: (current?.count || 0) + 1, lastAttempt: Date.now() });
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    loginAttempts.delete(clientKey);
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await prisma.adminSession.create({
      data: {
        adminUserId: adminUser.id,
        tokenHash,
        expiresAt: new Date(Date.now() + SESSION_MAX_AGE * 1000),
      },
    });

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
