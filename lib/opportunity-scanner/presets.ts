/**
 * Quick presets — patch existing filters and AI modes. No new ranking logic.
 */

import {
  DEFAULT_SCANNER_FILTERS,
  type ScannerFilters,
} from "@/lib/opportunity-scanner/filters";
import type { ScannerMode } from "@/lib/opportunity-scanner/modes";

export type ScannerPresetId =
  | "elite"
  | "value"
  | "low_risk"
  | "high_confidence"
  | "smart_combos"
  | "todays_best";

export type ScannerPreset = {
  id: ScannerPresetId;
  mode: ScannerMode;
  filters: ScannerFilters;
};

function base(over: Partial<ScannerFilters> = {}): ScannerFilters {
  return { ...DEFAULT_SCANNER_FILTERS, ...over };
}

export const SCANNER_PRESETS: ScannerPreset[] = [
  { id: "elite", mode: "premium", filters: base() },
  { id: "value", mode: "ranked", filters: base({ minEv: 0 }) },
  { id: "low_risk", mode: "ranked", filters: base({ risk: "low" }) },
  {
    id: "high_confidence",
    mode: "ranked",
    filters: base({ minConfidence: 70 }),
  },
  { id: "smart_combos", mode: "smart_combo", filters: base() },
  { id: "todays_best", mode: "ranked", filters: base() },
];

export function scannerPresetById(id: ScannerPresetId): ScannerPreset {
  return SCANNER_PRESETS.find((row) => row.id === id) ?? SCANNER_PRESETS[5]!;
}

function sameDeskFilters(a: ScannerFilters, b: ScannerFilters): boolean {
  return (
    a.league === b.league &&
    a.country === b.country &&
    a.market === b.market &&
    a.oddsMin === b.oddsMin &&
    a.oddsMax === b.oddsMax &&
    a.minEv === b.minEv &&
    a.minConfidence === b.minConfidence &&
    a.risk === b.risk
  );
}

export function applyScannerPreset(
  id: ScannerPresetId,
  current: ScannerFilters,
): { mode: ScannerMode; filters: ScannerFilters } {
  const preset = scannerPresetById(id);
  return {
    mode: preset.mode,
    filters: {
      ...preset.filters,
      favoriteLeaguesOnly: current.favoriteLeaguesOnly,
      favoriteTeamsOnly: current.favoriteTeamsOnly,
    },
  };
}

export function matchingScannerPreset(
  mode: ScannerMode,
  filters: ScannerFilters,
): ScannerPresetId | null {
  const hit = SCANNER_PRESETS.find(
    (preset) => preset.mode === mode && sameDeskFilters(preset.filters, filters),
  );
  return hit?.id ?? null;
}
