import { createHash } from "node:crypto";
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";

type AuthSession = { id: string; userId: string };

export interface AuthSessionClient {
  authSession: {
    findFirst(args: {
      where: {
        tokenHash: string;
        status: "ACTIVE";
        revokedAt: null;
        expiresAt: { gt: Date };
      };
    }): Promise<AuthSession | null>;
    update(args: {
      where: { id: string };
      data: { lastUsedAt: Date };
    }): Promise<unknown>;
  };
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function resolveSession(
  token: string,
  client: AuthSessionClient = prisma,
): Promise<{ sessionId: string; userId: string }> {
  const session = await client.authSession.findFirst({
    where: {
      tokenHash: hashToken(token),
      status: "ACTIVE",
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!session) {
    throw new AppError("UNAUTHENTICATED", 401, "Authentication required");
  }

  await client.authSession.update({
    where: { id: session.id },
    data: { lastUsedAt: new Date() },
  });

  return { sessionId: session.id, userId: session.userId };
}
