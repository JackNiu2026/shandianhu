import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../db/client";

export type AdminSessionIdentity = {
  adminUserId: string;
  email: string;
  role: string;
};

type AdminUserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  role: string;
};
type AdminSessionRecord = {
  id: string;
  adminUserId: string;
  adminUser: { email: string; role: string };
};

export interface AdminSessionClient {
  adminUser: {
    findUnique(args: { where: { email?: string; id?: string } }): Promise<AdminUserRecord | null>;
    update(args: { where: { id: string }; data: { passwordHash: string } }): Promise<unknown>;
  };
  adminSession: {
    create(args: { data: { adminUserId: string; tokenHash: string; expiresAt: Date } }): Promise<unknown>;
    findFirst(args: {
      where: {
        tokenHash: string;
        status: "ACTIVE";
        revokedAt: null;
        expiresAt: { gt: Date };
      };
      include: { adminUser: true };
    }): Promise<AdminSessionRecord | null>;
    update(args: { where: { id: string }; data: { lastUsedAt: Date } }): Promise<unknown>;
    updateMany(args: {
      where: { tokenHash?: string; adminUserId?: string; status: "ACTIVE" };
      data: { status: "REVOKED"; revokedAt: Date };
    }): Promise<unknown>;
  };
  $transaction<T>(operation: (transaction: Pick<AdminSessionClient, "adminUser" | "adminSession">) => Promise<T>): Promise<T>;
}

type AdminSessionDependencies = {
  comparePassword: (password: string, passwordHash: string) => Promise<boolean>;
  hashPassword: (password: string) => Promise<string>;
  createToken: () => string;
  now: () => Date;
};

const defaultDependencies: AdminSessionDependencies = {
  comparePassword: bcrypt.compare,
  hashPassword: (password) => bcrypt.hash(password, 10),
  createToken: () => randomBytes(32).toString("base64url"),
  now: () => new Date(),
};

const defaultAdminSessionClient = prisma as unknown as AdminSessionClient;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function identityFor(user: AdminUserRecord): AdminSessionIdentity {
  return { adminUserId: user.id, email: user.email, role: user.role };
}

export async function authenticateAdminCredentials(
  email: string,
  password: string,
  client: AdminSessionClient = defaultAdminSessionClient,
  dependencies: Pick<AdminSessionDependencies, "comparePassword"> = defaultDependencies,
): Promise<AdminSessionIdentity | null> {
  const adminUser = await client.adminUser.findUnique({ where: { email } });
  if (!adminUser || !await dependencies.comparePassword(password, adminUser.passwordHash)) return null;
  return identityFor(adminUser);
}

export async function issueAdminSession(
  adminUserId: string,
  ttlSeconds: number,
  client: AdminSessionClient = defaultAdminSessionClient,
  dependencies: Pick<AdminSessionDependencies, "createToken" | "now"> = defaultDependencies,
): Promise<string> {
  const token = dependencies.createToken();
  const now = dependencies.now();
  await client.adminSession.create({
    data: {
      adminUserId,
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + ttlSeconds * 1000),
    },
  });
  return token;
}

export async function resolveAdminSession(
  token: string | undefined,
  client: AdminSessionClient = defaultAdminSessionClient,
  dependencies: Pick<AdminSessionDependencies, "now"> = defaultDependencies,
): Promise<AdminSessionIdentity | null> {
  if (!token) return null;

  const now = dependencies.now();
  const session = await client.adminSession.findFirst({
    where: {
      tokenHash: hashToken(token),
      status: "ACTIVE",
      revokedAt: null,
      expiresAt: { gt: now },
    },
    include: { adminUser: true },
  });
  if (!session) return null;

  await client.adminSession.update({ where: { id: session.id }, data: { lastUsedAt: now } });
  return {
    adminUserId: session.adminUserId,
    email: session.adminUser.email,
    role: session.adminUser.role,
  };
}

export async function revokeAdminSession(
  token: string | undefined,
  client: AdminSessionClient = defaultAdminSessionClient,
  dependencies: Pick<AdminSessionDependencies, "now"> = defaultDependencies,
): Promise<void> {
  if (!token) return;
  await client.adminSession.updateMany({
    where: { tokenHash: hashToken(token), status: "ACTIVE" },
    data: { status: "REVOKED", revokedAt: dependencies.now() },
  });
}

export type ChangeAdminPasswordResult = "UPDATED" | "CURRENT_PASSWORD_INVALID" | "NOT_FOUND";

export async function changeAdminPassword(
  adminUserId: string,
  currentPassword: string,
  newPassword: string,
  client: AdminSessionClient = defaultAdminSessionClient,
  dependencies: Pick<AdminSessionDependencies, "comparePassword" | "hashPassword" | "now"> = defaultDependencies,
): Promise<ChangeAdminPasswordResult> {
  return client.$transaction(async (transaction) => {
    const adminUser = await transaction.adminUser.findUnique({ where: { id: adminUserId } });
    if (!adminUser) return "NOT_FOUND";
    if (!await dependencies.comparePassword(currentPassword, adminUser.passwordHash)) {
      return "CURRENT_PASSWORD_INVALID";
    }

    const now = dependencies.now();
    await transaction.adminUser.update({
      where: { id: adminUserId },
      data: { passwordHash: await dependencies.hashPassword(newPassword) },
    });
    await transaction.adminSession.updateMany({
      where: { adminUserId, status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: now },
    });
    return "UPDATED";
  });
}
