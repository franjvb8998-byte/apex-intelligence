import type { ReactNode } from "react";
import { ProductShell } from "@/components/app-shell/product-shell";

/**
 * Alias for unauthenticated / internal surfaces.
 * Same chrome as ProductShell with user=null — no server auth.
 */
export function GuestShell({ children }: { children: ReactNode }) {
  return <ProductShell user={null}>{children}</ProductShell>;
}
