/**
 * Shared shell types — no "use client", no server imports.
 */

export type ShellUser = {
  /** Supabase auth user id. Present only after a verified session/user. */
  id?: string;
  displayName: string;
  email?: string | null;
};
