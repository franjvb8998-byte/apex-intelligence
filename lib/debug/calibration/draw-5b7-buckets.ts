/**
 * Deterministic 5B.7 forensic buckets. Characterization only.
 */

import type { CalibrationOutcome } from "@/lib/debug/calibration/types";
import {
  ELO_GAP_BUCKETS,
  SCORELINE_GROUPS,
  TOTAL_XG_BUCKETS,
  XG_DIFF_BUCKETS,
  type EloGapBucket,
  type ForensicConfidenceBand,
  type ScorelineGroup,
  type TotalXgBucket,
  type XgDiffBucket,
} from "@/lib/debug/calibration/draw-5b7-shape";

export function eloGapBucket(absEloGap: number): EloGapBucket {
  if (!Number.isFinite(absEloGap) || absEloGap < 0) {
    throw new Error(`Invalid abs Elo gap ${absEloGap}`);
  }
  if (absEloGap < 50) return "0-49";
  if (absEloGap < 100) return "50-99";
  if (absEloGap < 150) return "100-149";
  if (absEloGap < 200) return "150-199";
  if (absEloGap < 250) return "200-249";
  return "250+";
}

export function xgDiffBucket(absXgDiff: number): XgDiffBucket {
  if (!Number.isFinite(absXgDiff) || absXgDiff < 0) {
    throw new Error(`Invalid |xG diff| ${absXgDiff}`);
  }
  if (absXgDiff < 0.25) return "<0.25";
  if (absXgDiff < 0.5) return "0.25-0.49";
  if (absXgDiff < 1) return "0.50-0.99";
  if (absXgDiff < 1.5) return "1.00-1.49";
  return "1.50+";
}

export function totalXgBucket(xgTotal: number): TotalXgBucket {
  if (!Number.isFinite(xgTotal) || xgTotal < 0) {
    throw new Error(`Invalid xG total ${xgTotal}`);
  }
  if (xgTotal < 2) return "<2.0";
  if (xgTotal < 2.5) return "2.0-2.49";
  if (xgTotal < 3) return "2.5-2.99";
  if (xgTotal < 3.5) return "3.0-3.49";
  return "3.5+";
}

export function scorelineGroup(input: {
  actualOutcome: CalibrationOutcome | null;
  actualHomeGoals: number | null;
  actualAwayGoals: number | null;
}): ScorelineGroup | "non_draw" {
  if (input.actualOutcome !== "draw") return "non_draw";
  const home = input.actualHomeGoals;
  const away = input.actualAwayGoals;
  if (
    home == null ||
    away == null ||
    !Number.isFinite(home) ||
    !Number.isFinite(away) ||
    home !== away
  ) {
    return "other_draw";
  }
  if (home === 0) return "0-0";
  if (home === 1) return "1-1";
  if (home === 2) return "2-2";
  if (home === 3) return "3-3";
  return "4-4+";
}

export function assertBucketCataloguesFrozen(): void {
  if (ELO_GAP_BUCKETS.length !== 6) throw new Error("Elo-gap buckets mutated");
  if (XG_DIFF_BUCKETS.length !== 5) throw new Error("xG-diff buckets mutated");
  if (TOTAL_XG_BUCKETS.length !== 5) throw new Error("total-xG buckets mutated");
  if (SCORELINE_GROUPS.length !== 6) throw new Error("scoreline groups mutated");
}

export function isForensicConfidenceBand(
  band: string,
): band is ForensicConfidenceBand {
  return band === "low" || band === "medium" || band === "high";
}
