/**
 * Production/calibration current_catalogue Elo audit + exact component mirror.
 * Does not mutate production. played=0 is base_prior, not the -80 catalogue map.
 */

import { resolveEloWithProvenance } from "@/lib/match-center/from-data-platform";
import { estimateEloFromTeamId } from "@/lib/intelligence/modules/probability/elo-estimate";
import {
  CALIBRATION_AWAY_BASE,
  CALIBRATION_HOME_BASE,
} from "@/lib/debug/calibration/types";
import {
  CATALOGUE_CONSTANT_OFFSET,
  CATALOGUE_GD_CLAMP,
  CATALOGUE_GD_COEFFICIENT,
  CATALOGUE_WIN_RATE_COEFFICIENT,
  PLAYED_BEFORE_BUCKETS,
  CATALOGUE_ELO_GAP_BUCKETS,
  type PlayedBeforeBucket,
  type CatalogueEloGapBucket,
} from "@/lib/debug/calibration/cat-5b10-shape";

export const PRODUCTION_CATALOGUE_ELO_AUDIT = {
  resolver: {
    function: "resolveEloWithProvenance",
    file: "lib/match-center/from-data-platform.ts",
    calibrationWrapper: "createCurrentCataloguePolicy / productionResolve",
    calibrationWrapperFile: "lib/debug/calibration/policies.ts",
  },
  playedPositiveFormula: {
    formula:
      "Math.round(base - 80 + winRate * 220 + clamp(GF - GA, -30, +30) * 2.5)",
    constantOffset: CATALOGUE_CONSTANT_OFFSET,
    winRateCoefficient: CATALOGUE_WIN_RATE_COEFFICIENT,
    gdCoefficient: CATALOGUE_GD_COEFFICIENT,
    gdClamp: CATALOGUE_GD_CLAMP,
    rounding: "Math.round",
  },
  playedZero: {
    function: "estimateEloFromTeamId",
    file: "lib/intelligence/modules/probability/elo-estimate.ts",
    source: "base_prior",
    behavior: "returns role base unchanged; teamId is ignored; -80 is NOT applied",
  },
  roleBases: {
    home: CALIBRATION_HOME_BASE,
    away: CALIBRATION_AWAY_BASE,
    file: "lib/debug/calibration/types.ts",
    productionCallSites: "lib/match-analysis/match-analysis-service.ts uses 1580/1520",
  },
  reconstruction: {
    function: "reconstructTeamRecord",
    file: "lib/debug/calibration/reconstruct.ts",
    scope: "same competition + same season, kickoff strictly before T",
    wins: "forGoals > againstGoals only; draws are not wins",
    gd: "cumulative season sum GF - GA from prior countable fixtures",
    drawsStored: false,
    lossesStored: false,
    opponentStrengthEnters: false,
    competitionStrengthEnters: false,
    recencyEnters: false,
    sampleSizeShrinkageEnters: false,
    homeAwaySpecificHistoryEnters: false,
    note: "Current-match role selects the base (1580 vs 1520). Prior matches of either venue feed one combined record.",
  },
} as const;

export type CatalogueSideComponents = {
  playedBefore: number;
  winsBefore: number;
  gfBefore: number;
  gaBefore: number;
  gdBefore: number;
  clampedGd: number;
  winRate: number;
  roleBase: number;
  source: "base_prior" | "catalogue";
  baseContribution: number;
  constantContribution: number;
  winRateContribution: number;
  gdContribution: number;
  unrounded: number;
  roundingAdjustment: number;
  finalCatalogueElo: number;
  gdClampHit: boolean;
};

export function playedBeforeBucket(played: number): PlayedBeforeBucket {
  if (!Number.isFinite(played) || played < 0) {
    throw new Error(`Invalid playedBefore ${played}`);
  }
  if (played === 0) return "0";
  if (played === 1) return "1";
  if (played === 2) return "2";
  if (played === 3) return "3";
  if (played <= 5) return "4-5";
  if (played <= 9) return "6-9";
  if (played <= 14) return "10-14";
  if (played <= 19) return "15-19";
  if (played <= 29) return "20-29";
  return "30+";
}

export function catalogueEloGapBucket(absGap: number): CatalogueEloGapBucket {
  if (!Number.isFinite(absGap) || absGap < 0) {
    throw new Error(`Invalid abs Elo gap ${absGap}`);
  }
  if (absGap < 50) return "0-49";
  if (absGap < 100) return "50-99";
  if (absGap < 150) return "100-149";
  if (absGap < 200) return "150-199";
  if (absGap < 250) return "200-249";
  if (absGap < 300) return "250-299";
  return "300+";
}

export function clampCatalogueGd(gd: number): number {
  return Math.max(-CATALOGUE_GD_CLAMP, Math.min(CATALOGUE_GD_CLAMP, gd));
}

export function catalogueEloFromParts(input: {
  base: number;
  played: number;
  wins: number;
  goalsFor: number;
  goalsAgainst: number;
  teamId?: string;
}): CatalogueSideComponents {
  const playedBefore = input.played;
  const winsBefore = input.wins;
  const gfBefore = input.goalsFor;
  const gaBefore = input.goalsAgainst;
  const gdBefore = gfBefore - gaBefore;
  const clampedGd = clampCatalogueGd(gdBefore);
  const winRate = playedBefore > 0 ? winsBefore / playedBefore : 0;
  const roleBase = input.base;
  if (playedBefore <= 0) {
    const finalCatalogueElo = estimateEloFromTeamId(input.teamId ?? "unused", roleBase);
    return {
      playedBefore,
      winsBefore,
      gfBefore,
      gaBefore,
      gdBefore,
      clampedGd,
      winRate,
      roleBase,
      source: "base_prior",
      baseContribution: roleBase,
      constantContribution: 0,
      winRateContribution: 0,
      gdContribution: 0,
      unrounded: roleBase,
      roundingAdjustment: 0,
      finalCatalogueElo,
      gdClampHit: false,
    };
  }
  const baseContribution = roleBase;
  const constantContribution = CATALOGUE_CONSTANT_OFFSET;
  const winRateContribution = winRate * CATALOGUE_WIN_RATE_COEFFICIENT;
  const gdContribution = clampedGd * CATALOGUE_GD_COEFFICIENT;
  const unrounded =
    baseContribution + constantContribution + winRateContribution + gdContribution;
  const finalCatalogueElo = Math.round(unrounded);
  return {
    playedBefore,
    winsBefore,
    gfBefore,
    gaBefore,
    gdBefore,
    clampedGd,
    winRate,
    roleBase,
    source: "catalogue",
    baseContribution,
    constantContribution,
    winRateContribution,
    gdContribution,
    unrounded,
    roundingAdjustment: finalCatalogueElo - unrounded,
    finalCatalogueElo,
    gdClampHit: Math.abs(clampedGd) === CATALOGUE_GD_CLAMP,
  };
}

export function assertComponentSum(components: CatalogueSideComponents): void {
  const sum =
    components.baseContribution +
    components.constantContribution +
    components.winRateContribution +
    components.gdContribution +
    components.roundingAdjustment;
  if (Math.abs(sum - components.finalCatalogueElo) > 1e-12) {
    throw new Error(
      `Catalogue component sum ${sum} !== final Elo ${components.finalCatalogueElo}`,
    );
  }
}

export function assertMirrorsProductionCatalogue(input: {
  teamId: string;
  base: number;
  played: number;
  wins: number;
  goalsFor: number;
  goalsAgainst: number;
}): CatalogueSideComponents {
  const mirrored = catalogueEloFromParts({ ...input });
  assertComponentSum(mirrored);
  const production = resolveEloWithProvenance(
    input.played <= 0
      ? { played: input.played, wins: input.wins, goalsFor: input.goalsFor, goalsAgainst: input.goalsAgainst }
      : {
          played: input.played,
          wins: input.wins,
          goalsFor: input.goalsFor,
          goalsAgainst: input.goalsAgainst,
        },
    input.teamId,
    input.base,
  );
  if (mirrored.finalCatalogueElo !== production.elo) {
    throw new Error(
      `Debug catalogue Elo ${mirrored.finalCatalogueElo} !== production ${production.elo}`,
    );
  }
  return mirrored;
}

export { PLAYED_BEFORE_BUCKETS, CATALOGUE_ELO_GAP_BUCKETS };
