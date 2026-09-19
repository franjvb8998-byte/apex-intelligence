/**
 * Debug-only C0–C7 catalogue input-geometry formulas.
 * Does not mutate production resolveEloWithProvenance / PE.
 */

import { createCurrentCataloguePolicy } from "@/lib/debug/calibration/policies";
import { catalogueEloFromParts } from "@/lib/debug/calibration/cat-5b10-formula";
import {
  CATALOGUE_CONSTANT_OFFSET,
  CATALOGUE_GD_CLAMP,
  CATALOGUE_GD_COEFFICIENT,
  CATALOGUE_WIN_RATE_COEFFICIENT,
} from "@/lib/debug/calibration/cat-5b10-shape";
import {
  GD_RATE_CLAMP,
  GD_RATE_COEFFICIENT,
  INPUT_GEOMETRY_SHRINKAGE_K,
  NON_CANDIDATE_GD_RATE_LABEL,
  armSpec,
  type InputGeometryArmId,
} from "@/lib/debug/calibration/ig-5b11-shape";
import type { CalibrationRow } from "@/lib/debug/calibration/types";

export type SideEloParts = {
  played: number;
  wins: number;
  goalsFor: number;
  goalsAgainst: number;
};

export function gdRateContribution(goalsFor: number, goalsAgainst: number, played: number): number {
  const rate = (goalsFor - goalsAgainst) / Math.max(played, 1);
  const clamped = Math.max(-GD_RATE_CLAMP, Math.min(GD_RATE_CLAMP, rate));
  return clamped * GD_RATE_COEFFICIENT;
}

export function cumulativeGdContribution(goalsFor: number, goalsAgainst: number): number {
  const gd = goalsFor - goalsAgainst;
  const clamped = Math.max(-CATALOGUE_GD_CLAMP, Math.min(CATALOGUE_GD_CLAMP, gd));
  return clamped * CATALOGUE_GD_COEFFICIENT;
}

export function unroundedCatalogueTarget(input: {
  base: number;
  played: number;
  wins: number;
  goalsFor: number;
  goalsAgainst: number;
  gdMode: "cumulative" | "rate";
}): number {
  if (input.played <= 0) return input.base;
  const winRate = input.wins / input.played;
  const gdTerm =
    input.gdMode === "rate"
      ? gdRateContribution(input.goalsFor, input.goalsAgainst, input.played)
      : cumulativeGdContribution(input.goalsFor, input.goalsAgainst);
  return (
    input.base +
    CATALOGUE_CONSTANT_OFFSET +
    winRate * CATALOGUE_WIN_RATE_COEFFICIENT +
    gdTerm
  );
}

export function applyShrinkage(input: {
  base: number;
  played: number;
  raw: number;
  shrinkage: boolean;
}): number {
  if (input.played <= 0) return input.base;
  if (!input.shrinkage) return Math.round(input.raw);
  const w = input.played / (input.played + INPUT_GEOMETRY_SHRINKAGE_K);
  return Math.round(input.base + w * (input.raw - input.base));
}

export function resolveInputGeometryElo(input: {
  armId: InputGeometryArmId;
  side: "home" | "away";
  played: number;
  wins: number;
  goalsFor: number;
  goalsAgainst: number;
}): number {
  const spec = armSpec(input.armId);
  const base = input.side === "home" ? spec.homeBase : spec.awayBase;
  if (input.played <= 0) return base;
  if (!spec.shrinkage && spec.gdMode === "cumulative") {
    return catalogueEloFromParts({
      base,
      played: input.played,
      wins: input.wins,
      goalsFor: input.goalsFor,
      goalsAgainst: input.goalsAgainst,
    }).finalCatalogueElo;
  }
  const raw = unroundedCatalogueTarget({
    base,
    played: input.played,
    wins: input.wins,
    goalsFor: input.goalsFor,
    goalsAgainst: input.goalsAgainst,
    gdMode: spec.gdMode,
  });
  return applyShrinkage({
    base,
    played: input.played,
    raw,
    shrinkage: spec.shrinkage,
  });
}

export function resolveMatchElos(
  armId: InputGeometryArmId,
  row: CalibrationRow,
): { homeElo: number; awayElo: number } {
  return {
    homeElo: resolveInputGeometryElo({
      armId,
      side: "home",
      played: row.homePlayedBefore,
      wins: row.homeWinsBefore,
      goalsFor: row.homeGfBefore,
      goalsAgainst: row.homeGaBefore,
    }),
    awayElo: resolveInputGeometryElo({
      armId,
      side: "away",
      played: row.awayPlayedBefore,
      wins: row.awayWinsBefore,
      goalsFor: row.awayGfBefore,
      goalsAgainst: row.awayGaBefore,
    }),
  };
}

export function assertC0MirrorsCurrentCatalogue(row: CalibrationRow): void {
  const policy = createCurrentCataloguePolicy();
  const mirrored = resolveMatchElos("C0", row);
  const home = policy.resolve(row, "home").elo;
  const away = policy.resolve(row, "away").elo;
  if (mirrored.homeElo !== home || mirrored.awayElo !== away) {
    throw new Error(
      `C0 diverged from current_catalogue on ${row.fixtureId}: ${mirrored.homeElo}/${mirrored.awayElo} vs ${home}/${away}`,
    );
  }
}

export function assertC1OnlyEqualizesRoleBases(input: SideEloParts): void {
  const homeC0 = resolveInputGeometryElo({ armId: "C0", side: "home", ...input });
  const awayC0 = resolveInputGeometryElo({ armId: "C0", side: "away", ...input });
  const homeC1 = resolveInputGeometryElo({ armId: "C1", side: "home", ...input });
  const awayC1 = resolveInputGeometryElo({ armId: "C1", side: "away", ...input });
  const expectedHome = catalogueEloFromParts({
    base: 1550,
    played: input.played,
    wins: input.wins,
    goalsFor: input.goalsFor,
    goalsAgainst: input.goalsAgainst,
  }).finalCatalogueElo;
  const expectedAway = catalogueEloFromParts({
    base: 1550,
    played: input.played,
    wins: input.wins,
    goalsFor: input.goalsFor,
    goalsAgainst: input.goalsAgainst,
  }).finalCatalogueElo;
  if (homeC1 !== expectedHome || awayC1 !== expectedAway) {
    throw new Error("C1 is not catalogue formula with 1550/1550");
  }
  if (input.played <= 0) {
    if (homeC0 !== 1580 || awayC0 !== 1520 || homeC1 !== 1550 || awayC1 !== 1550) {
      throw new Error("Played=0 role bases diverged");
    }
  }
}

export { NON_CANDIDATE_GD_RATE_LABEL };
