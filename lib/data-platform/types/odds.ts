import type { ApexId, DataProviderId, ExternalRef } from "@/lib/data-platform/types/ids";

/** Market families APEX understands natively. */
export type ApexMarketType = "1x2" | "over_under" | "btts" | "other";

export type ApexOddsSelection = {
  key: string;
  label: string;
  /** Decimal odds when available. */
  decimalOdds: number | null;
  /** Implied probability before overround removal (optional). */
  impliedProbability: number | null;
};

export type ApexOddsQuote = {
  id: ApexId;
  matchId: ApexId;
  market: ApexMarketType;
  /** e.g. 2.5 for O/U */
  line: number | null;
  bookmaker: string | null;
  selections: ApexOddsSelection[];
  capturedAt: string;
  sourceProvider: DataProviderId;
  externalRefs: ExternalRef[];
};
