import type { ScannerFilters } from "@/lib/opportunity-scanner/filters";
import type { ScannerMode } from "@/lib/opportunity-scanner/modes";
import type { ScannerRankingKind } from "@/lib/opportunity-scanner/ranking";

export const RANKING_EMPTY: Record<ScannerRankingKind, string> = {
  top10: "top10",
  value: "value",
  confidence: "confidence",
  longshots: "longshots",
};

export const RANKING_EMPTY_QUIET = "quiet";

export const MODE_EMPTY: Record<ScannerMode, string> = {
  ranked: "ranked",
  conservative: "conservative",
  value_hunter: "value_hunter",
  high_odds: "high_odds",
  smart_combo: "smart_combo",
  underdogs: "underdogs",
  premium: "premium",
};

export type ScannerEmptyTitleKey =
  | `mode.${ScannerMode}`
  | "filteredByRisk"
  | "filteredByConfidence"
  | "filteredByEv";

export type ScannerEmptyCopyKeys = {
  titleKey: ScannerEmptyTitleKey;
  descriptionKey: "description";
};

export function scannerFilterEmptyCopy(
  mode: ScannerMode,
  filters?: ScannerFilters,
): ScannerEmptyCopyKeys {
  let titleKey: ScannerEmptyTitleKey = `mode.${mode}`;
  if (filters) {
    if (filters.risk !== "all") {
      titleKey = "filteredByRisk";
    } else if (filters.minConfidence > 0) {
      titleKey = "filteredByConfidence";
    } else if (filters.minEv != null) {
      titleKey = "filteredByEv";
    }
  }
  return {
    titleKey,
    descriptionKey: "description",
  };
}
