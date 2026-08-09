import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@lightning-tiger/server/src/db/client";
import { AUTH_COOKIE_NAME } from "./auth";

export type AdminSessionIdentity = {
  adminUserId: string;
  email: string;
  role: string;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function extractToken(request: NextRequest): string | undefined {
  return request.cookies.get(AUTH_COOKIE_NAME)?.value;
}

export async function resolveAdminSession(token: string | undefined): Promise<AdminSessionIdentity | null> {
  if (!token) return null;

  const session = await prisma.adminSession.findFirst({
    where: {
      tokenHash: hashToken(token),
      status: "ACTIVE",
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { adminUser: true },
  });

  if (!session) return null;

  void prisma.adminSession.update({
    where: { id: session.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    adminUserId: session.adminUserId,
    email: session.adminUser.email,
    role: session.adminUser.role,
  };
}

export async function authenticateAdmin(request: NextRequest): Promise<
  | { adminUserId: string; email: string; role: string; response: null }
  | { adminUserId: null; email: null; role: null; response: NextResponse }
> {
  const identity = await resolveAdminSession(extractToken(request));
  if (!identity) {
    return {
      adminUserId: null,
      email: null,
      role: null,
      response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    };
  }

  return { ...identity, response: null };
}

export function sessionTokenHash(token: string): string {
  return hashToken(token);
}

export function withErrorHandler<T extends (...args: never[]) => Promise<NextResponse>>(
  handler: T,
): T {
  return (async (...args: never[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error("[API Error]", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }) as T;
}
