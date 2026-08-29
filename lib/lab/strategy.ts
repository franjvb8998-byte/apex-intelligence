/**
 * Paper filters on published Decision Engine rows.
 * Does not re-score, re-size, or invent markets.
 */

import type { ApexOpportunity } from "@/lib/apex-opportunities/types";
import type { ApexDecisionVerdictKind } from "@/lib/decision-engine/types";
import type { LabPaperResult, LabStrategySpec } from "@/lib/lab/types";

export const ALL_VERDICTS: ApexDecisionVerdictKind[] = [
  "elite_pick",
  "strong_bet",
  "lean_bet",
  "pass",
  "avoid",
];

export const STAKE_VERDICTS: ApexDecisionVerdictKind[] = [
  "elite_pick",
  "strong_bet",
  "lean_bet",
];

export const LAB_STRATEGY_PRESETS: LabStrategySpec[] = [
  {
    id: "open",
    name: "Open book",
    minScore: 0,
    minConfidence: 0,
    minEv: null,
    risk: "all",
    verdicts: ALL_VERDICTS,
  },
  {
    id: "quality",
    name: "Quality desk",
    minScore: 75,
    minConfidence: 65,
    minEv: 0,
    risk: "all",
    verdicts: ALL_VERDICTS,
  },
  {
    id: "stake",
    name: "Stake candidates",
    minScore: 0,
    minConfidence: 0,
    minEv: 0,
    risk: "all",
    verdicts: STAKE_VERDICTS,
  },
  {
    id: "low-risk",
    name: "Low risk",
    minScore: 50,
    minConfidence: 50,
    minEv: null,
    risk: "low",
    verdicts: ALL_VERDICTS,
  },
];

export const DEFAULT_LAB_STRATEGY = LAB_STRATEGY_PRESETS[0]!;

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

function finite(values: Array<number | null | undefined>): number[] {
  return values.filter((n): n is number => n != null && Number.isFinite(n));
}

export function labStrategyPasses(
  row: ApexOpportunity,
  spec: LabStrategySpec,
): boolean {
  if (row.score < spec.minScore) return false;
  if (row.confidence < spec.minConfidence) return false;
  if (spec.minEv != null) {
    if (row.expectedValue == null || !Number.isFinite(row.expectedValue)) {
      return false;
    }
    if (spec.minEv === 0) {
      if (row.expectedValue <= 0) return false;
    } else if (row.expectedValue < spec.minEv) {
      return false;
    }
  }
  if (spec.risk !== "all" && row.riskBand !== spec.risk) return false;
  if (spec.verdicts.length > 0 && !spec.verdicts.includes(row.verdict)) {
    return false;
  }
  return true;
}

export function paperLabStrategy(
  analyzed: ApexOpportunity[],
  spec: LabStrategySpec,
): LabPaperResult {
  const passed = analyzed.filter((row) => labStrategyPasses(row, spec));
  return {
    spec,
    passed,
    scanned: analyzed.length,
    selected: passed.length,
    averageScore: mean(passed.map((row) => row.score)),
    averageConfidence: mean(passed.map((row) => row.confidence)),
    averageEv: mean(finite(passed.map((row) => row.expectedValue))),
    averageKelly: mean(finite(passed.map((row) => row.kellyPct))),
    elite: passed.filter((row) => row.verdict === "elite_pick").length,
    skip: passed.filter(
      (row) => row.verdict === "avoid" || row.verdict === "pass",
    ).length,
  };
}
