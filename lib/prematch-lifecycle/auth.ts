import { createHash, timingSafeEqual } from "node:crypto";
import { readPrematchLifecycleCronSecret } from "@/lib/prematch-lifecycle/config";

export type PrematchLifecycleAuthResult =
  | { ok: true }
  | { ok: false; status: 401; code: "unauthorized" };

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function timingSafeSecretEqual(left: string, right: string): boolean {
  const hashedLeft = sha256(left);
  const hashedRight = sha256(right);
  return timingSafeEqual(hashedLeft, hashedRight);
}

export function presentedBearerSecret(
  request: Request,
): string | null {
  const header =
    request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(\S+)\s*$/i);
  return match?.[1] ?? null;
}

/**
 * Fail closed when the server secret is missing or the bearer token
 * does not match. User session cookies are ignored on purpose.
 */
export function authorizePrematchLifecycleRequest(
  request: Request,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): PrematchLifecycleAuthResult {
  const expected = readPrematchLifecycleCronSecret(env);
  const presented = presentedBearerSecret(request);
  if (!expected || !presented || !timingSafeSecretEqual(presented, expected)) {
    return { ok: false, status: 401, code: "unauthorized" };
  }
  return { ok: true };
}
