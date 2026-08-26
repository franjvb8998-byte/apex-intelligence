import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell/app-shell";
import type { ShellUser } from "@/components/app-shell/types";

export type ProductShellProps = {
  children: ReactNode;
  /** Resolved by the Server Component / layout that owns auth — never fetched here. */
  user?: ShellUser | null;
};

/**
 * Product chrome — server-agnostic.
 * Does not import next/headers, Supabase server, or any RSC-only APIs.
 */
export function ProductShell({
  children,
  user = null,
}: ProductShellProps) {
  return <AppShell user={user}>{children}</AppShell>;
}
