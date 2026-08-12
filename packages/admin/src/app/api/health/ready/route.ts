import { NextResponse } from "next/server";
import { createRedisConnection, prisma } from "@lightning-tiger/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const redis = createRedisConnection();
  try {
    await Promise.all([prisma.$queryRaw`SELECT 1`, redis.ping()]);
    return NextResponse.json({ ok: true, database: "ready", redis: "ready" });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  } finally {
    redis.disconnect();
  }
}
