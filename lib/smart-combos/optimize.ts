/**
 * Combo Optimizer — structural edits on an analysed slip.
 * Alternatives come from the same Decision Engine scan, never invented prices.
 */

import { analyzeCombo } from "@/lib/smart-combos/analyze";
import { analyzeCorrelation } from "@/lib/smart-combos/correlation";
import { opportunityToComboLeg, pricedLegs } from "@/lib/smart-combos/legs";
import type { ApexOpportunity } from "@/lib/apex-opportunities/types";
import type {
  ComboAnalysis,
  ComboLeg,
  ComboOptimization,
  ComboSwapSuggestion,
} from "@/lib/smart-combos/types";

function hitPct(analysis: ComboAnalysis): number | null {
  const p = analysis.adjustedApexProbability ?? analysis.independentApexProbability;
  return p == null ? null : p * 100;
}

function deltaHit(from: ComboAnalysis, to: ComboAnalysis): number | null {
  const a = hitPct(from);
  const b = hitPct(to);
  if (a == null || b == null) return null;
  return b - a;
}

function unused(current: ComboLeg[], universe: ComboLeg[]): ComboLeg[] {
  const used = new Set(current.map((leg) => leg.fixtureId));
  return universe.filter((leg) => !used.has(leg.fixtureId));
}

function canSwap(current: ComboLeg[], removeId: string, add: ComboLeg): boolean {
  const next = current.filter((leg) => leg.fixtureId !== removeId);
  if (next.some((leg) => leg.fixtureId === add.fixtureId)) return false;
  const report = analyzeCorrelation([...next, add]);
  return !report.hasConflict && !report.hasDuplicate;
}

export function optimizeCombo(
  current: ComboAnalysis,
  universe: ApexOpportunity[],
): ComboOptimization {
  const suggestions: ComboSwapSuggestion[] = [];
  const weakest = current.weakest;
  const pool = unused(current.legs, pricedLegs(universe.map(opportunityToComboLeg)));

  if (weakest && current.legs.length >= 2) {
    const removed = analyzeCombo(
      current.legs.filter((leg) => leg.fixtureId !== weakest.fixtureId),
    );
    suggestions.push({
      kind: "remove",
      title: `Drop ${weakest.selectionLabel}`,
      detail: `Removes the weakest Decision Engine leg (${weakest.verdictLabel}, model ${
        weakest.apexProbability != null
          ? `${(weakest.apexProbability * 100).toFixed(0)}%`
          : "n/d"
      }).`,
      removed: weakest,
      added: null,
      analysis: removed,
      deltaHitPct: deltaHit(current, removed),
    });

    const safer = pool
      .filter((leg) => (leg.apexProbability ?? 0) > (weakest.apexProbability ?? 0))
      .filter((leg) => leg.riskScore <= weakest.riskScore)
      .filter((leg) => canSwap(current.legs, weakest.fixtureId, leg))
      .sort(
        (a, b) =>
          (b.apexProbability ?? 0) - (a.apexProbability ?? 0) ||
          a.riskScore - b.riskScore,
      )[0];
    if (safer) {
      const next = analyzeCombo(
        current.legs.map((leg) => (leg.fixtureId === weakest.fixtureId ? safer : leg)),
      );
      suggestions.push({
        kind: "safer",
        title: `Safer: ${safer.selectionLabel}`,
        detail: `Swap ${weakest.selectionLabel} for a higher-probability, lower-risk Decision Engine pick.`,
        removed: weakest,
        added: safer,
        analysis: next,
        deltaHitPct: deltaHit(current, next),
      });
    }

    const richer = pool
      .filter((leg) => (leg.expectedValue ?? -99) > (weakest.expectedValue ?? -99))
      .filter((leg) => canSwap(current.legs, weakest.fixtureId, leg))
      .sort((a, b) => (b.expectedValue ?? -99) - (a.expectedValue ?? -99))[0];
    if (richer && richer.fixtureId !== safer?.fixtureId) {
      const next = analyzeCombo(
        current.legs.map((leg) => (leg.fixtureId === weakest.fixtureId ? richer : leg)),
      );
      suggestions.push({
        kind: "higher_value",
        title: `Higher value: ${richer.selectionLabel}`,
        detail: `Swap ${weakest.selectionLabel} for a larger single-leg EV from the same scan.`,
        removed: weakest,
        added: richer,
        analysis: next,
        deltaHitPct: deltaHit(current, next),
      });
    }
  }

  return { current, suggestions };
}
