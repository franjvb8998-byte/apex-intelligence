export type {
  ScannerExplanation,
} from "@/lib/opportunity-scanner/explain";
export { explainOpportunity } from "@/lib/opportunity-scanner/explain";

export type { ScannerFilters } from "@/lib/opportunity-scanner/filters";
export {
  DEFAULT_SCANNER_FILTERS,
  filterScanner,
  scannerPassesFilters,
  teamOptions,
} from "@/lib/opportunity-scanner/filters";

export type { ScannerMode } from "@/lib/opportunity-scanner/modes";
export { SCANNER_MODES, applyScannerMode } from "@/lib/opportunity-scanner/modes";

export type {
  ScannerRecommendation,
} from "@/lib/opportunity-scanner/recommend";
export {
  isStrongOrElite,
  scannerRecommendation,
} from "@/lib/opportunity-scanner/recommend";

export type {
  ScannerDeskStats,
  ScannerRankingBoard,
  ScannerRankingKind,
} from "@/lib/opportunity-scanner/ranking";
export {
  buildScannerRankings,
  scannerDeskStats,
} from "@/lib/opportunity-scanner/ranking";

export type { ScannerFavorites } from "@/lib/opportunity-scanner/favorites";
export {
  SCANNER_FAVORITES_KEY,
  parseScannerFavorites,
  serializeScannerFavorites,
  toggleFavoriteName,
} from "@/lib/opportunity-scanner/favorites";

export type { ScannerBriefing, ScannerInsight } from "@/lib/opportunity-scanner/briefing";
export {
  buildScannerBriefing,
  buildScannerInsight,
} from "@/lib/opportunity-scanner/briefing";

export type { ScannerDeskStatus, ScannerStatusReason } from "@/lib/opportunity-scanner/status";
export {
  scannerDeskStatus,
  scannerDropReason,
} from "@/lib/opportunity-scanner/status";

export type { ScannerPreset, ScannerPresetId } from "@/lib/opportunity-scanner/presets";
export {
  SCANNER_PRESETS,
  applyScannerPreset,
  matchingScannerPreset,
  scannerPresetById,
} from "@/lib/opportunity-scanner/presets";

export {
  MODE_EMPTY,
  RANKING_EMPTY,
  RANKING_EMPTY_QUIET,
  scannerFilterEmptyCopy,
} from "@/lib/opportunity-scanner/copy";
export type {
  ScannerEmptyCopyKeys,
  ScannerEmptyTitleKey,
} from "@/lib/opportunity-scanner/copy";

export { countryFromLeague, countryOptions } from "@/lib/opportunity-scanner/country";
export { loadOpportunityScanner } from "@/lib/opportunity-scanner/load";
