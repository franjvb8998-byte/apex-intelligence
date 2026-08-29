/**
 * Combo Builder — construct a slip from today's Decision Engine scan.
 */

import { analyzeCombo } from "@/lib/smart-combos/analyze";
import { analyzeCorrelation } from "@/lib/smart-combos/correlation";
import { opportunityToComboLeg, pricedLegs } from "@/lib/smart-combos/legs";
import { combinedDecimalOdds } from "@/lib/smart-combos/pricing";
import type { ApexOpportunity } from "@/lib/apex-opportunities/types";
import type {
  ComboBuildResult,
  ComboBuildSpec,
  ComboLeg,
  ComboRiskProfile,
} from "@/lib/smart-combos/types";

function passesProfile(leg: ComboLeg, profile: ComboRiskProfile): boolean {
  if (profile === "conservative") {
    return (
      leg.confidence >= 55 &&
      leg.score >= 60 &&
      leg.riskBand !== "high" &&
      (leg.apexProbability ?? 0) >= 0.48
    );
  }
  if (profile === "balanced") {
    return leg.confidence >= 45 && leg.score >= 52;
  }
  return leg.score >= 42;
}

function rankLeg(leg: ComboLeg, profile: ComboRiskProfile): number {
  if (profile === "conservative") {
    return (leg.apexProbability ?? 0) * 100 + (100 - leg.riskScore) * 0.15;
  }
  if (profile === "balanced") {
    return (leg.expectedValue ?? -1) * 100 + leg.score * 0.05;
  }
  return leg.score + (leg.decimalOdds ?? 1) * 2;
}

function rhoOk(
  existing: ComboLeg[],
  candidate: ComboLeg,
  profile: ComboRiskProfile,
): boolean {
  const next = [...existing, candidate];
  const report = analyzeCorrelation(next);
  if (report.hasConflict || report.hasDuplicate) return false;
  if (profile === "conservative") return report.maxRho < 0.25;
  if (profile === "balanced") return report.maxRho < 0.45;
  return true;
}

export function buildCombo(
  universe: ApexOpportunity[],
  spec: ComboBuildSpec,
): ComboBuildResult {
  const leagues = spec.leagues?.filter(Boolean) ?? [];
  const pool = pricedLegs(
    universe
      .filter((row) => (leagues.length === 0 ? true : leagues.includes(row.leagueName)))
      .filter(() => (spec.markets?.length ? spec.markets.includes("1x2") : true))
      .filter((row) => (spec.requirePositiveEv ? (row.expectedValue ?? 0) > 0 : true))
      .map(opportunityToComboLeg),
  )
    .filter((leg) => passesProfile(leg, spec.riskProfile))
    .sort((a, b) => rankLeg(b, spec.riskProfile) - rankLeg(a, spec.riskProfile));

  const picked: ComboLeg[] = [];
  for (const candidate of pool) {
    if (picked.length >= spec.legCount) break;
    if (picked.some((leg) => leg.fixtureId === candidate.fixtureId)) continue;
    if (!rhoOk(picked, candidate, spec.riskProfile)) continue;
    picked.push(candidate);
  }

  if (picked.length < spec.legCount) {
    return {
      ok: false,
      spec,
      partial: picked,
      reason:
        pool.length < spec.legCount
          ? `Need ${spec.legCount} priced Decision Engine selections; only ${pool.length} pass this profile.`
          : `Could not assemble ${spec.legCount} uncorrelated legs under this risk profile.`,
    };
  }

  let analysis = analyzeCombo(picked);
  if (spec.oddsMin != null && (analysis.combinedOdds ?? 0) < spec.oddsMin) {
    return {
      ok: false,
      spec,
      partial: picked,
      reason: `Combined odds ${analysis.combinedOdds?.toFixed(2) ?? "n/d"} sit below the ${spec.oddsMin.toFixed(2)} floor.`,
    };
  }
  if (spec.oddsMax != null && (analysis.combinedOdds ?? Infinity) > spec.oddsMax) {
    const tighter = tryLowerOdds(picked, pool, spec);
    if (!tighter) {
      return {
        ok: false,
        spec,
        partial: picked,
        reason: `Combined odds ${analysis.combinedOdds?.toFixed(2) ?? "n/d"} sit above the ${spec.oddsMax.toFixed(2)} ceiling.`,
      };
    }
    analysis = tighter;
  }

  return { ok: true, spec, analysis };
}

function tryLowerOdds(
  picked: ComboLeg[],
  pool: ComboLeg[],
  spec: ComboBuildSpec,
): ReturnType<typeof analyzeCombo> | null {
  const used = new Set(picked.map((leg) => leg.fixtureId));
  const replacements = pool
    .filter((leg) => !used.has(leg.fixtureId))
    .sort((a, b) => (a.decimalOdds ?? 99) - (b.decimalOdds ?? 99));
  const weakestOdds = [...picked].sort(
    (a, b) => (b.decimalOdds ?? 0) - (a.decimalOdds ?? 0),
  )[0];
  if (!weakestOdds) return null;
  for (const alt of replacements) {
    const next = picked.map((leg) =>
      leg.fixtureId === weakestOdds.fixtureId ? alt : leg,
    );
    if (!rhoOk(next.filter((leg) => leg.fixtureId !== alt.fixtureId), alt, spec.riskProfile)) {
      continue;
    }
    const odds = combinedDecimalOdds(next);
    if (odds != null && spec.oddsMax != null && odds <= spec.oddsMax) {
      return analyzeCombo(next);
    }
  }
  return null;
}
