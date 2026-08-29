import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell/app-shell";
import type { ShellUser } from "@/components/app-shell/types";

export type ProductShellProps = {
  children: ReactNode;
  /** Resolved by the Server Component / layout that owns auth — never fetched here. */
  user?: ShellUser | null;
  /** Full-bleed content (wide data tables). */
  flush?: boolean;
};

/**
 * Product chrome — server-agnostic.
 * Does not import next/headers, Supabase server, or any RSC-only APIs.
 */
export function ProductShell({
  children,
  user = null,
  flush = false,
}: ProductShellProps) {
  return (
    <AppShell user={user} flush={flush}>
      {children}
    </AppShell>
  );
}
