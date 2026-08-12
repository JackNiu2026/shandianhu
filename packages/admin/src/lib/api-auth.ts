import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  AppError,
  resolveAdminSession as resolveServerAdminSession,
  type AdminSessionIdentity,
} from "@lightning-tiger/server";
import { AUTH_COOKIE_NAME } from "./auth";

export type { AdminSessionIdentity } from "@lightning-tiger/server";

function extractToken(request: NextRequest): string | undefined {
  return request.cookies.get(AUTH_COOKIE_NAME)?.value;
}

export async function resolveAdminSession(token: string | undefined): Promise<AdminSessionIdentity | null> {
  return resolveServerAdminSession(token);
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

export async function requireAdmin(request: NextRequest): Promise<{ adminUserId: string; role: string }> {
  const auth = await authenticateAdmin(request);
  if (auth.response || !auth.adminUserId) throw new AppError("UNAUTHENTICATED", 401, "Authentication required");
  return { adminUserId: auth.adminUserId, role: auth.role };
}

export async function requireSuperadmin(request: NextRequest): Promise<{ adminUserId: string; role: string }> {
  const admin = await requireAdmin(request);
  if (admin.role !== "SUPERADMIN") throw new AppError("FORBIDDEN", 403, "Superadmin access required");
  return admin;
}

export function makeAdminContext(adminUserId: string): { adminUserId: string; requestId: string } {
  return { adminUserId, requestId: randomUUID() };
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
