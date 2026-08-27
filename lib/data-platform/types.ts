/**
 * Data Platform v2 — provider-agnostic types.
 * Consumers depend on these (and ApexMatchBundle), never on vendor SDKs.
 */

import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";

/** Selectable providers via env / factory. */
export type DataProviderKind = "mock" | "api-football";

export type DataProviderMatchQuery = {
  /** External or demo match id (provider interprets). */
  matchId: string;
};

export type DataProviderFixturesQuery = {
  date?: string;
  leagueId?: string;
  season?: string;
  limit?: number;
};

/**
 * Canonical match snapshot returned by every IDataProvider.
 * Alias kept for v2 docs; identical to ApexMatchBundle.
 */
export type DataProviderMatch = ApexMatchBundle;

export type DataProviderConfig = {
  /** Active provider kind (default: mock). */
  provider: DataProviderKind;
  /** Optional default match id for demos. */
  defaultMatchId?: string;
};
