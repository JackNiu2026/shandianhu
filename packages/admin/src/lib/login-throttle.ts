import type { NextRequest } from "next/server";

/**
 * Forwarded client-address headers are only trusted when the deployment's
 * proxy is explicitly trusted. Without that setting, retain a per-login
 * bucket using a direct address when the runtime provides one, or a client
 * hint as a best-effort fallback. This identifier is never used for auth.
 */
export function getLoginThrottleKey(request: NextRequest, loginIdentifier: string): string {
  if (process.env.TRUST_PROXY === "true") {
    const forwardedAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwardedAddress) return `forwarded:${forwardedAddress}:${loginIdentifier}`;
  }

  const directAddress = (request as NextRequest & { ip?: string }).ip;
  const clientHint = directAddress || request.headers.get("user-agent") || "unknown-client";
  return `direct:${clientHint}:${loginIdentifier}`;
}
