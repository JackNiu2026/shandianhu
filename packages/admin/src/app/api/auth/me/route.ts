import { NextRequest, NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await authenticateAdmin(request);
  if (auth.response) return auth.response;
  return NextResponse.json({ user: { email: auth.email, role: auth.role } });
}
