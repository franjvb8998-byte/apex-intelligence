import type { User } from "@supabase/supabase-js";

export const AUTH_GET_USER_TIMEOUT_MS = 700;

type AuthGetUserResult = {
  data: { user: User | null };
  error: { message: string } | null;
};

type AuthGetUserClient = {
  auth: {
    getUser: () => Promise<AuthGetUserResult>;
  };
};

const AUTH_TIMEOUT_RESULT: AuthGetUserResult = {
  data: { user: null },
  error: { message: "auth-timeout" },
};

/**
 * `getUser()` with a hard cap so Auth retries (AuthRetryableFetchError)
 * cannot block the response for ~30s per call.
 */
export async function getUserFast(
  supabase: AuthGetUserClient,
  timeoutMs = AUTH_GET_USER_TIMEOUT_MS,
): Promise<AuthGetUserResult> {
  return Promise.race([
    supabase.auth.getUser().catch(() => AUTH_TIMEOUT_RESULT),
    new Promise<AuthGetUserResult>((resolve) => {
      setTimeout(() => resolve(AUTH_TIMEOUT_RESULT), timeoutMs);
    }),
  ]);
}
