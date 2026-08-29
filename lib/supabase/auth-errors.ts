export type AuthErrorKey =
  | "invalidCredentials"
  | "userExists"
  | "emailNotConfirmed"
  | "samePassword"
  | "tokenExpired"
  | "rateLimit"
  | "redirectMismatch"
  | "passwordRequirements"
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

/** @deprecated Prefer getAuthErrorKey + next-intl. Kept for non-UI callers. */
export function getAuthErrorMessage(error: string): string {
  return getAuthErrorKey(error);
}
