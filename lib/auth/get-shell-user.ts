import type { ShellUser } from "@/components/app-shell/types";
import { getUserFast } from "@/lib/supabase/get-user-fast";
import { createClient } from "@/lib/supabase/server";

/**
 * Server-only helper for product pages / layouts / route handlers.
 * Client Components must never import this module.
 */
export async function getShellUser(): Promise<ShellUser | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await getUserFast(supabase);
    if (!user) return null;
    const displayName =
      (user.user_metadata?.full_name as string | undefined)?.trim() ||
      user.email?.split("@")[0] ||
      "Usuario";
    return { displayName, email: user.email };
  } catch {
    return null;
  }
}
