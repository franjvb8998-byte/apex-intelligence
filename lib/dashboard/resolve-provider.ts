/**
 * Dashboard provider resolution (Sprint 7).
 * API_FOOTBALL_KEY / API_KEY present → api-football
 * Otherwise → mock (never breaks the UI).
 */

import {
  createApiFootballDataProvider,
  createMockDataProvider,
  type IDataProvider,
} from "@/lib/data-platform";
import { dataModeOf, hasFootballApiKey } from "@/lib/repositories";
import type {
  DashboardDataMode,
  DashboardProviderKind,
} from "@/lib/dashboard/types";

export { hasFootballApiKey };

export type DashboardProviderResolveOptions = {
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  /** Inject provider (tests). */
  provider?: IDataProvider;
};

export type ResolvedDashboardProvider = {
  provider: IDataProvider;
  kind: DashboardProviderKind;
  dataMode: DashboardDataMode;
  hasApiKey: boolean;
  displayName: string;
};

/**
 * Exclusive Data Platform selection for the Dashboard.
 */
export function resolveDashboardProvider(
  options: DashboardProviderResolveOptions = {},
): ResolvedDashboardProvider {
  if (options.provider) {
    const kind: DashboardProviderKind =
      options.provider.id === "api-football" ? "api-football" : "mock";
    const dataMode = resolveDataMode(options.provider, kind);
    return {
      provider: options.provider,
      kind,
      dataMode,
      hasApiKey: kind === "api-football" && dataMode === "live",
      displayName: options.provider.displayName,
    };
  }

  const env = options.env ?? process.env;
  const hasKey = hasFootballApiKey(env);

  if (hasKey) {
    const provider = createApiFootballDataProvider({
      env,
      enrichMatch: false,
      fallback: "error",
    });
    return {
      provider,
      kind: "api-football",
      dataMode: resolveDataMode(provider, "api-football"),
      hasApiKey: true,
      displayName: provider.displayName,
    };
  }

  const provider = createMockDataProvider();
  return {
    provider,
    kind: "mock",
    dataMode: "mock",
    hasApiKey: false,
    displayName: provider.displayName,
  };
}

function resolveDataMode(
  provider: IDataProvider,
  kind: DashboardProviderKind,
): DashboardDataMode {
  if (kind === "mock") return "mock";
  const mode = dataModeOf(provider);
  return mode === "mock" ? "live" : mode;
}
