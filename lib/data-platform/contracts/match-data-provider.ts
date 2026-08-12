import type { DataProviderId } from "@/lib/data-platform/types/ids";
import type { ProviderRawEnvelope } from "@/lib/data-platform/types/provider";

export type FetchMatchQuery = {
  externalMatchId: string;
};

export type FetchFixturesQuery = {
  /** ISO date YYYY-MM-DD or range — provider interprets. */
  date?: string;
  leagueExternalId?: string;
  limit?: number;
};

/**
 * Port every external football data vendor must implement.
 *
 * Rules:
 * - Return raw envelopes only — never Apex* types.
 * - No HTTP required in v0: adapters may serve fixtures from in-memory mocks.
 * - Adding a provider = new adapter + mapper registration; Intelligence Core unchanged.
 */
export interface MatchDataProvider {
  readonly id: DataProviderId;
  readonly displayName: string;

  /** Fetch a single match payload (fixture + optional events/odds/lineups). */
  fetchMatch(query: FetchMatchQuery): Promise<ProviderRawEnvelope>;

  /** Optional list endpoint for ingestion jobs. */
  fetchFixtures?(query: FetchFixturesQuery): Promise<ProviderRawEnvelope[]>;

  /**
   * Health / capability probe.
   * TODO(http): ping vendor status endpoints when clients are wired.
   */
  capabilities(): ProviderCapabilities;
}

export type ProviderCapabilities = {
  matches: boolean;
  events: boolean;
  lineups: boolean;
  odds: boolean;
  live: boolean;
  /** True when this adapter uses mock/fixture data only. */
  mockOnly: boolean;
};
