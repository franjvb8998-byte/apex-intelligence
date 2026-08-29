/**
 * Combo-level narrative. Cites Decision Engine leg verdicts; does not re-score them.
 */

import type { ComboAnalysis } from "@/lib/smart-combos/types";
import { formatOdds, formatSignedPct } from "@/lib/apex-opportunities/display";

function pct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "n/d";
  return `${(value * 100).toFixed(1)}%`;
}

export function explainCombo(analysis: Omit<ComboAnalysis, "explanation">): string {
  const n = analysis.legs.length;
  if (n === 0) {
    return "Add Decision Engine selections to analyse a combination.";
  }
  if (analysis.blockedReason) {
    return analysis.blockedReason;
  }

  const weakest = analysis.weakest;
  const hit = pct(analysis.adjustedApexProbability ?? analysis.independentApexProbability);
  const implied = pct(analysis.impliedProbability);
  const ev = formatSignedPct(analysis.expectedValue);
  const odds = formatOdds(analysis.combinedOdds);

  const head = `This ${n}-fold is priced at ${odds}. Implied hit rate is ${implied}; APEX (independence, correlation-adjusted) is ${hit}. EV ${ev}.`;
  const weak = weakest
    ? ` Weakest leg: ${weakest.selectionLabel} (${weakest.verdictLabel}, model ${pct(weakest.apexProbability)}).`
    : "";
  const corr = ` ${analysis.correlation.summary}`;
  const verdict = ` Verdict: ${analysis.verdict.label}. Quarter-Kelly on the accumulator is ${analysis.sizing.stakeLabel} of bankroll.`;
  return `${head}${weak}${corr}${verdict}`;
}
