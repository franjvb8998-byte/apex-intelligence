/**
 * Match Center data loader — Data Platform v2 (IDataProvider / ProviderFactory).
 * Default provider: MockDataProvider (APEX_DATA_PROVIDER=mock).
 */

import {
  createApiFootballDataProvider,
  createApiFootballProvider,
  createDataPlatform,
  createDataProviderFromEnv,
  getDefaultMatchId,
  readApiFootballEnv,
  RECORDED_API_FOOTBALL_FIXTURE_ID,
  type IDataProvider,
} from "@/lib/data-platform";
import { enrichMatchCenterContext } from "@/lib/match-center/enrich";
import { createMatchCenterFromApexBundle } from "@/lib/match-center/from-data-platform";
import { getMockMatchCenter } from "@/lib/match-center/mock-data";
import type { MatchCenterData } from "@/lib/match-center/types";

export type LoadMatchCenterOptions = {
  /** External / demo match id. */
  externalMatchId?: string;
  /** When true, never fall back to UI-only mock. */
  requireProvider?: boolean;
  /** Inject Data Platform provider (Dashboard shares the same instance). */
  provider?: IDataProvider;
};

/**
 * Load Match Center via the configured IDataProvider (mock by default).
 */
export async function getMatchCenterData(
  options: LoadMatchCenterOptions = {},
): Promise<MatchCenterData> {
  try {
    const provider = options.provider ?? createDataProviderFromEnv();
    const matchId = options.externalMatchId ?? getDefaultMatchId();
    const bundle = await provider.getMatch({ matchId });
    const enrichment = await enrichMatchCenterContext(provider, bundle);
    return createMatchCenterFromApexBundle(bundle, { enrichment });
  } catch (error) {
    if (options.requireProvider) throw error;
    console.error(
      "[match-center] Data provider failed; falling back to UI mock.",
      error,
    );
    return getMockMatchCenter({ status: "finished" });
  }
}

/**
 * Explicit legacy API-Football ingest path (recorded / live adapter).
 * Kept for tests and opt-in tooling — not the default app path.
 */
export async function loadMatchCenterFromApiFootball(
  options: LoadMatchCenterOptions = {},
): Promise<MatchCenterData> {
  const env = readApiFootballEnv();
  const externalMatchId =
    options.externalMatchId ??
    env.defaultFixtureId ??
    RECORDED_API_FOOTBALL_FIXTURE_ID;

  const platform = createDataPlatform({
    providers: [createApiFootballProvider()],
  });

  const { bundle } = await platform.ingestMatch({
    providerId: "api-football",
    externalMatchId,
  });

  const provider =
    options.provider ??
    createApiFootballDataProvider({ apiKey: null, env: {}, useCache: false });
  const enrichment = await enrichMatchCenterContext(provider, bundle);
  return createMatchCenterFromApexBundle(bundle, { enrichment });
}
