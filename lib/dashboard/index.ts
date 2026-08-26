export type {
  DashboardData,
  DashboardDataMode,
  DashboardLeagueSummary,
  DashboardMatchStatus,
  DashboardMatchSummary,
  DashboardProviderKind,
  DashboardSystemStatus,
  DashboardTeamSummary,
} from "@/lib/dashboard/types";

export {
  getDashboardData,
  type LoadDashboardOptions,
} from "@/lib/dashboard/load";

export {
  resolveDashboardProvider,
  hasFootballApiKey,
  type DashboardProviderResolveOptions,
  type ResolvedDashboardProvider,
} from "@/lib/dashboard/resolve-provider";
