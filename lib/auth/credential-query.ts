/**
 * Auth forms must never put secrets in the URL. Native GET is the HTML default
 * when client JS has not hydrated, so credential query keys are stripped in
 * the request proxy and forms declare method="post" without a page POST action.
 */

import { sanitizeNextPath } from "@/lib/auth/password-recovery";

export const AUTH_CREDENTIAL_QUERY_KEYS = [
  "password",
  "email",
  "confirmPassword",
] as const;

export function stripCredentialQueryParams(searchParams: URLSearchParams): boolean {
  let stripped = false;
  for (const key of AUTH_CREDENTIAL_QUERY_KEYS) {
    if (searchParams.has(key)) {
      searchParams.delete(key);
      stripped = true;
    }
  }
  return stripped;
}

export function sanitizeAuthQueryParams(searchParams: URLSearchParams): boolean {
  const stripped = stripCredentialQueryParams(searchParams);
  const rawRedirect = searchParams.get("redirect");
  if (rawRedirect == null) return stripped;
  const safe = sanitizeNextPath(rawRedirect, "");
  if (!safe) {
    searchParams.delete("redirect");
    return true;
  }
  if (safe !== rawRedirect) {
    searchParams.set("redirect", safe);
    return true;
  }
  return stripped;
}
