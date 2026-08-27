import type { User } from "@supabase/supabase-js";
import type { ShellUser } from "@/components/app-shell/types";
import {
  AUTHENTICATED_GET_USER_TIMEOUT_MS,
  getUserFast,
} from "@/lib/supabase/get-user-fast";
import { createClient } from "@/lib/supabase/server";

export type AuthIdentity = {
  id?: string | null;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

/**
 * Map a Supabase auth user to shell chrome.
 * Returns null when `id` is missing — never reads profile/user id blindly.
 */
export function shellUserFromAuth(
  user: AuthIdentity | User | null | undefined,
): ShellUser | null {
  if (!user) return null;
  const id = user.id?.trim();
  if (!id) return null;

  const metadata = user.user_metadata ?? {};
  const fullName =
    typeof metadata.full_name === "string" ? metadata.full_name.trim() : "";
  const name = typeof metadata.name === "string" ? metadata.name.trim() : "";
  const email = user.email?.trim() || null;

  return {
    id,
    displayName: fullName || name || email?.split("@")[0] || "Usuario",
    email,
  };
}

/**
 * Server-only helper for product pages / layouts / route handlers.
 * Client Components must never import this module.
 *
 * Prefers a validated `getUser()` identity. If that is slow but a session
 * cookie already exists, uses `session.user` so a live session is never
 * treated as logged-out.
 */
export async function getShellUser(): Promise<ShellUser | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await getUserFast(supabase, AUTHENTICATED_GET_USER_TIMEOUT_MS);

    const fromUser = shellUserFromAuth(user);
    if (fromUser) return fromUser;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    return shellUserFromAuth(session?.user ?? null);
  } catch {
    return null;
  }
}
