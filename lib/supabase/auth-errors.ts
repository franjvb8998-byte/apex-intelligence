export type AuthErrorKey =
  | "invalidCredentials"
  | "userExists"
  | "emailNotConfirmed"
  | "samePassword"
  | "tokenExpired"
  | "rateLimit"
  | "redirectMismatch"
  | "passwordRequirements"
  | "network"
  | "configuration"
  | "generic";

export function getAuthErrorKey(error: string): AuthErrorKey {
  const normalized = error.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "invalidCredentials";
  }
  if (normalized.includes("user already registered")) {
    return "userExists";
  }
  if (normalized.includes("email not confirmed")) {
    return "emailNotConfirmed";
  }
  if (
    normalized.includes("different from the old password") ||
    normalized.includes("same password")
  ) {
    return "samePassword";
  }
  if (
    normalized.includes("session missing") ||
    normalized.includes("invalid token") ||
    normalized.includes("token has expired") ||
    normalized.includes("otp_expired")
  ) {
    return "tokenExpired";
  }
  if (
    normalized.includes("rate limit") ||
    normalized.includes("for security purposes") ||
    normalized.includes("over_email_send_rate_limit")
  ) {
    return "rateLimit";
  }
  if (
    normalized.includes("redirect_to") ||
    normalized.includes("redirect uri mismatch")
  ) {
    return "redirectMismatch";
  }
  if (normalized.includes("password")) {
    return "passwordRequirements";
  }
  return "generic";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

export function getAuthFailureKey(error: unknown): AuthErrorKey {
  if (typeof error === "string") {
    return getAuthErrorKey(error);
  }
  if (!isRecord(error)) {
    return "generic";
  }

  const name = typeof error.name === "string" ? error.name : "";
  const message = typeof error.message === "string" ? error.message : "";
  const code = typeof error.code === "string" ? error.code.toLowerCase() : "";
  const combined = `${name} ${code} ${message}`.toLowerCase();

  if (
    code.includes("invalid_login") ||
    code.includes("invalid_credentials") ||
    combined.includes("invalid login credentials")
  ) {
    return "invalidCredentials";
  }
  if (
    combined.includes("failed to fetch") ||
    combined.includes("networkerror") ||
    combined.includes("load failed")
  ) {
    return "network";
  }
  if (combined.includes("missing environment variable: next_public_supabase")) {
    return "configuration";
  }
  if (message) {
    return getAuthErrorKey(message);
  }
  return "generic";
}

/** @deprecated Prefer getAuthErrorKey + next-intl. Kept for non-UI callers. */
export function getAuthErrorMessage(error: string): string {
  return getAuthErrorKey(error);
}
