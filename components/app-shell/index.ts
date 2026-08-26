/**
 * Client-safe app-shell barrel.
 * ProductShell is server-agnostic (user prop only).
 * Never import `@/lib/auth/get-shell-user` or `@/lib/supabase/server` from client code.
 */

export { AppShell, type AppShellProps } from "@/components/app-shell/app-shell";
export {
  ProductShell,
  type ProductShellProps,
} from "@/components/app-shell/product-shell";
export { GuestShell } from "@/components/app-shell/guest-shell";
export { Breadcrumbs } from "@/components/app-shell/breadcrumbs";
export { AppSidebar, ProfileMenu } from "@/components/app-shell/sidebar";
export type { ShellUser } from "@/components/app-shell/types";
export {
  CommandPalette,
  GlobalSearch,
  NotificationsPanel,
} from "@/components/app-shell/chrome";
export { PageTransition } from "@/components/app-shell/page-transition";
export {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/app-shell/states";
