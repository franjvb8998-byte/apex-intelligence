/**
 * Empirical catalogue Elo / gap forensics on persisted seasons. Not a tuner.
 */

import { createIsolatedDrawEngine } from "@/lib/debug/calibration/draw-5b7-trace";
import {
  applyEqualizedRolePrior,
  assertProductionHybridConfigUnchanged,
  snapshotDefaultHybridConfig,
} from "@/lib/debug/calibration/experiment-5b5-ha";
import { frozenValidationConfig } from "@/lib/debug/calibration/validation-5b6-configs";
import { createCurrentCataloguePolicy } from "@/lib/debug/calibration/policies";
import { isValidOneXTwo, summarizeMetrics } from "@/lib/debug/calibration/metrics";
import { distributionSummary } from "@/lib/debug/calibration/xg-5b9-geometry";
import { lambdaRatio, totalXg } from "@/lib/debug/calibration/xg-5b9-geometry";
import {
  eloToExpectedGoalsMirrored,
  productionEloXgInputs,
} from "@/lib/debug/calibration/xg-5b9-formula";
import {
  CATALOGUE_ELO_GAP_BUCKETS,
  PLAYED_BEFORE_BUCKETS,
  SPARSE_WIN_RATE_CASES,
  type CatalogueEloGapBucket,
  type PlayedBeforeBucket,
} from "@/lib/debug/calibration/cat-5b10-shape";
import {
  assertComponentSum,
  catalogueEloFromParts,
  catalogueEloGapBucket,
  playedBeforeBucket,
  type CatalogueSideComponents,
} from "@/lib/debug/calibration/cat-5b10-formula";
import {
  CALIBRATION_AWAY_BASE,
  CALIBRATION_HOME_BASE,
  type CalibrationOutcome,
  type CalibrationRow,
  type OneXTwo,
} from "@/lib/debug/calibration/types";
import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";

export type NumericFailure = {
  fixtureId: string;
  reason: string;
};

export type SideObservation = CatalogueSideComponents & {
  fixtureId: string;
  kickoff: string;
  season: string;
  seasonRole: "HOLDOUT" | "DEVELOPMENT";
  side: "home" | "away";
  teamId: string;
  teamName: string;
};

export type MatchCatalogueTrace = {
  fixtureId: string;
  kickoff: string;
  season: string;
  seasonRole: "HOLDOUT" | "DEVELOPMENT";
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  actualOutcome: CalibrationOutcome;
  actualHomeGoals: number;
  actualAwayGoals: number;
  home: CatalogueSideComponents;
  away: CatalogueSideComponents;
  rawGap: number;
  absGap: number;
  rolePriorGap: number;
  constantGap: number;
  winRateGap: number;
  gdGap: number;
  roundingGap: number;
  lambdaHome: number;
  lambdaAway: number;
  lambdaRatio: number;
  totalXg: number;
  poisson: OneXTwo;
  hybrid: OneXTwo;
  minPlayedBefore: number;
};

export function decomposeMatchGap(
  home: CatalogueSideComponents,
  away: CatalogueSideComponents,
): {
  rawGap: number;
  rolePriorGap: number;
  constantGap: number;
  winRateGap: number;
  gdGap: number;
  roundingGap: number;
} {
  const rolePriorGap = home.roleBase - away.roleBase;
  const constantGap = home.constantContribution - away.constantContribution;
  const winRateGap = home.winRateContribution - away.winRateContribution;
  const gdGap = home.gdContribution - away.gdContribution;
  const roundingGap = home.roundingAdjustment - away.roundingAdjustment;
  const rawGap = home.finalCatalogueElo - away.finalCatalogueElo;
  const summed = rolePriorGap + constantGap + winRateGap + gdGap + roundingGap;
  if (Math.abs(summed - rawGap) > 1e-9) {
    throw new Error(`Gap component sum ${summed} !== raw gap ${rawGap}`);
  }
  return { rawGap, rolePriorGap, constantGap, winRateGap, gdGap, roundingGap };
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function snapshotCatalogueSeason(input: {
  rows: readonly CalibrationRow[];
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
}): { matches: MatchCatalogueTrace[]; sides: SideObservation[]; failures: NumericFailure[] } {
  const before = snapshotDefaultHybridConfig();
  const engine = createIsolatedDrawEngine(frozenValidationConfig("V0"));
  const policy = createCurrentCataloguePolicy();
  const matches: MatchCatalogueTrace[] = [];
  const sides: SideObservation[] = [];
  const failures: NumericFailure[] = [];
  for (const row of input.rows) {
    if (row.season !== input.season) {
      throw new Error(`Season identity mismatch: row ${row.season} vs ${input.season}`);
    }
    if (row.actualOutcome == null || row.actualHomeGoals == null || row.actualAwayGoals == null) {
      throw new Error(`Unlabeled outcome on ${row.fixtureId}`);
    }
    try {
      if (row.homePlayedBefore < 0 || row.awayPlayedBefore < 0) {
        throw new Error("playedBefore < 0");
      }
      if (row.homeWinsBefore < 0 || row.awayWinsBefore < 0) {
        throw new Error("winsBefore < 0");
      }
      if (row.homeWinsBefore > row.homePlayedBefore || row.awayWinsBefore > row.awayPlayedBefore) {
        throw new Error("winsBefore > playedBefore");
      }
      if (row.homeGfBefore < 0 || row.homeGaBefore < 0 || row.awayGfBefore < 0 || row.awayGaBefore < 0) {
        throw new Error("GF/GA < 0");
      }
      const home = catalogueEloFromParts({
        base: CALIBRATION_HOME_BASE,
        played: row.homePlayedBefore,
        wins: row.homeWinsBefore,
        goalsFor: row.homeGfBefore,
        goalsAgainst: row.homeGaBefore,
        teamId: row.homeTeamId,
      });
      const away = catalogueEloFromParts({
        base: CALIBRATION_AWAY_BASE,
        played: row.awayPlayedBefore,
        wins: row.awayWinsBefore,
        goalsFor: row.awayGfBefore,
        goalsAgainst: row.awayGaBefore,
        teamId: row.awayTeamId,
      });
      assertComponentSum(home);
      assertComponentSum(away);
      const resolvedHome = policy.resolve(row, "home");
      const resolvedAway = policy.resolve(row, "away");
      if (resolvedHome.elo !== home.finalCatalogueElo || resolvedAway.elo !== away.finalCatalogueElo) {
        throw new Error("Mirrored catalogue Elo diverged from current_catalogue policy");
      }
      const gaps = decomposeMatchGap(home, away);
      const predicted = engine.predict({
        homeElo: applyEqualizedRolePrior(home.finalCatalogueElo, "home", false),
        awayElo: applyEqualizedRolePrior(away.finalCatalogueElo, "away", false),
        homeTeamId: row.homeTeamId,
        awayTeamId: row.awayTeamId,
        matchId: row.fixtureId,
      });
      if (
        !isValidOneXTwo(predicted.oneXTwo) ||
        !isValidOneXTwo(predicted.poisson.oneXTwo) ||
        !(predicted.expectedGoals.home > 0) ||
        !(predicted.expectedGoals.away > 0)
      ) {
        throw new Error("Frozen production geometry produced invalid probabilities");
      }
      const mapped = eloToExpectedGoalsMirrored({
        ...productionEloXgInputs(),
        homeElo: home.finalCatalogueElo,
        awayElo: away.finalCatalogueElo,
      });
      if (
        mapped.lambdaHomeClamped !== predicted.expectedGoals.home ||
        mapped.lambdaAwayClamped !== predicted.expectedGoals.away
      ) {
        throw new Error("Bridge λ diverged from frozen production predict()");
      }
      const match: MatchCatalogueTrace = {
        fixtureId: row.fixtureId,
        kickoff: row.kickoff,
        season: row.season,
        seasonRole: input.role,
        homeTeamId: row.homeTeamId,
        homeTeamName: row.homeTeamName,
        awayTeamId: row.awayTeamId,
        awayTeamName: row.awayTeamName,
        actualOutcome: row.actualOutcome,
        actualHomeGoals: row.actualHomeGoals,
        actualAwayGoals: row.actualAwayGoals,
        home,
        away,
        ...gaps,
        absGap: Math.abs(gaps.rawGap),
        lambdaHome: predicted.expectedGoals.home,
        lambdaAway: predicted.expectedGoals.away,
        lambdaRatio: lambdaRatio(predicted.expectedGoals.home, predicted.expectedGoals.away),
        totalXg: totalXg(predicted.expectedGoals.home, predicted.expectedGoals.away),
        poisson: predicted.poisson.oneXTwo,
        hybrid: predicted.oneXTwo,
        minPlayedBefore: Math.min(row.homePlayedBefore, row.awayPlayedBefore),
      };
      matches.push(match);
      sides.push({
        ...home,
        fixtureId: row.fixtureId,
        kickoff: row.kickoff,
        season: row.season,
        seasonRole: input.role,
        side: "home",
        teamId: row.homeTeamId,
        teamName: row.homeTeamName,
      });
      sides.push({
        ...away,
        fixtureId: row.fixtureId,
        kickoff: row.kickoff,
        season: row.season,
        seasonRole: input.role,
        side: "away",
        teamId: row.awayTeamId,
        teamName: row.awayTeamName,
      });
    } catch (error) {
      failures.push({
        fixtureId: row.fixtureId,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  assertProductionHybridConfigUnchanged(before);
  if (DEFAULT_HYBRID_CONFIG.eloGoalScale !== 400) {
    throw new Error("Production eloGoalScale mutated");
  }
  return { matches, sides, failures };
}

export type PlayedBucketRow = {
  bucket: PlayedBeforeBucket;
  n: number;
  meanElo: number;
  medianElo: number;
  p10: number;
  p90: number;
  p95: number;
  min: number;
  max: number;
  meanAbsDevFromRoleBase: number;
  meanWinRateContribution: number;
  meanGdContribution: number;
  gdClampHitRate: number;
};

function playedBucketRows(sides: readonly SideObservation[]): PlayedBucketRow[] {
  return PLAYED_BEFORE_BUCKETS.map((bucket) => {
    const scoped = sides.filter((side) => playedBeforeBucket(side.playedBefore) === bucket);
    const elos = scoped.map((side) => side.finalCatalogueElo);
    const summary = distributionSummary(elos);
    return {
      bucket,
      n: scoped.length,
      meanElo: summary.mean,
      medianElo: summary.median,
      p10: summary.p10,
      p90: summary.p90,
      p95: summary.p95,
      min: summary.min,
      max: summary.max,
      meanAbsDevFromRoleBase: mean(
        scoped.map((side) => Math.abs(side.finalCatalogueElo - side.roleBase)),
      ),
      meanWinRateContribution: mean(scoped.map((side) => side.winRateContribution)),
      meanGdContribution: mean(scoped.map((side) => side.gdContribution)),
      gdClampHitRate:
        scoped.length === 0
          ? 0
          : scoped.filter((side) => side.gdClampHit).length / scoped.length,
    };
  });
}

export type AbsContributionSummary = {
  meanAbs: number;
  medianAbs: number;
  p90Abs: number;
  maxAbs: number;
};

function absContribution(values: readonly number[]): AbsContributionSummary {
  const abs = values.map((value) => Math.abs(value));
  const summary = distributionSummary(abs);
  return {
    meanAbs: summary.mean,
    medianAbs: summary.median,
    p90Abs: summary.p90,
    maxAbs: summary.max,
  };
}

export type ComponentAttribution = {
  roleBase: ReturnType<typeof distributionSummary>;
  constant: ReturnType<typeof distributionSummary>;
  winRate: ReturnType<typeof distributionSummary>;
  gd: ReturnType<typeof distributionSummary>;
  deviationFromRoleBase: {
    winRate: AbsContributionSummary;
    gd: AbsContributionSummary;
    constant: AbsContributionSummary;
  };
};

function componentAttribution(sides: readonly SideObservation[]): ComponentAttribution {
  return {
    roleBase: distributionSummary(sides.map((side) => side.baseContribution)),
    constant: distributionSummary(sides.map((side) => side.constantContribution)),
    winRate: distributionSummary(sides.map((side) => side.winRateContribution)),
    gd: distributionSummary(sides.map((side) => side.gdContribution)),
    deviationFromRoleBase: {
      winRate: absContribution(sides.map((side) => side.winRateContribution)),
      gd: absContribution(sides.map((side) => side.gdContribution)),
      constant: absContribution(sides.map((side) => side.constantContribution)),
    },
  };
}

export type GapDistribution = {
  meanSigned: number;
  medianSigned: number;
  meanAbs: number;
  medianAbs: number;
  p75Abs: number;
  p90Abs: number;
  p95Abs: number;
  p99Abs: number;
  maxAbs: number;
  countGe200: number;
  countGe250: number;
};

function gapDistribution(matches: readonly MatchCatalogueTrace[]): GapDistribution {
  const signed = matches.map((match) => match.rawGap);
  const abs = matches.map((match) => match.absGap);
  const absSummary = distributionSummary(abs);
  return {
    meanSigned: mean(signed),
    medianSigned: distributionSummary(signed).median,
    meanAbs: absSummary.mean,
    medianAbs: absSummary.median,
    p75Abs: absSummary.p75,
    p90Abs: absSummary.p90,
    p95Abs: absSummary.p95,
    p99Abs: absSummary.p99,
    maxAbs: absSummary.max,
    countGe200: abs.filter((value) => value >= 200).length,
    countGe250: abs.filter((value) => value >= 250).length,
  };
}

export type ExtremeGapRow = {
  bucket: CatalogueEloGapBucket;
  n: number;
  pct: number;
  meanPlayedHome: number;
  meanPlayedAway: number;
  meanMinPlayed: number;
  meanRolePriorGap: number;
  meanWinRateGap: number;
  meanGdGap: number;
  meanRawGap: number;
  meanLambdaRatio: number;
  observed: OneXTwo;
  hybrid: OneXTwo;
  logLoss: number;
  brier: number;
};

function observedRates(matches: readonly MatchCatalogueTrace[]): OneXTwo {
  const n = matches.length;
  if (n === 0) return { home: 0, draw: 0, away: 0 };
  let home = 0;
  let draw = 0;
  let away = 0;
  for (const match of matches) {
    if (match.actualOutcome === "home") home += 1;
    else if (match.actualOutcome === "draw") draw += 1;
    else away += 1;
  }
  return { home: home / n, draw: draw / n, away: away / n };
}

function extremeGapRows(matches: readonly MatchCatalogueTrace[]): ExtremeGapRow[] {
  const nSeason = matches.length;
  return CATALOGUE_ELO_GAP_BUCKETS.map((bucket) => {
    const scoped = matches.filter((match) => catalogueEloGapBucket(match.absGap) === bucket);
    const n = scoped.length;
    const observed = observedRates(scoped);
    const hybrid = {
      home: mean(scoped.map((match) => match.hybrid.home)),
      draw: mean(scoped.map((match) => match.hybrid.draw)),
      away: mean(scoped.map((match) => match.hybrid.away)),
    };
    const metrics =
      n === 0
        ? { logLoss: 0, brier: 0 }
        : summarizeMetrics(
            scoped.map((match) => ({
              predicted: match.hybrid,
              actual: match.actualOutcome,
              bucket: "10+" as const,
              policyId: "current_catalogue",
            })),
          );
    return {
      bucket,
      n,
      pct: nSeason === 0 ? 0 : n / nSeason,
      meanPlayedHome: mean(scoped.map((match) => match.home.playedBefore)),
      meanPlayedAway: mean(scoped.map((match) => match.away.playedBefore)),
      meanMinPlayed: mean(scoped.map((match) => match.minPlayedBefore)),
      meanRolePriorGap: mean(scoped.map((match) => match.rolePriorGap)),
      meanWinRateGap: mean(scoped.map((match) => match.winRateGap)),
      meanGdGap: mean(scoped.map((match) => match.gdGap)),
      meanRawGap: mean(scoped.map((match) => match.rawGap)),
      meanLambdaRatio: mean(scoped.map((match) => match.lambdaRatio)),
      observed,
      hybrid,
      logLoss: metrics.logLoss,
      brier: metrics.brier,
    };
  });
}

export type SparseVsMatureExtremes = {
  threshold: 200 | 250;
  n: number;
  minPlayed0to3: number;
  minPlayed4to9: number;
  minPlayed10plus: number;
};

function sparseVsMature(matches: readonly MatchCatalogueTrace[]): SparseVsMatureExtremes[] {
  return ([200, 250] as const).map((threshold) => {
    const scoped = matches.filter((match) => match.absGap >= threshold);
    return {
      threshold,
      n: scoped.length,
      minPlayed0to3: scoped.filter((match) => match.minPlayedBefore <= 3).length,
      minPlayed4to9: scoped.filter(
        (match) => match.minPlayedBefore >= 4 && match.minPlayedBefore <= 9,
      ).length,
      minPlayed10plus: scoped.filter((match) => match.minPlayedBefore >= 10).length,
    };
  });
}

export type GdBucketRow = {
  bucket: PlayedBeforeBucket;
  n: number;
  rawGd: ReturnType<typeof distributionSummary>;
  gdPerMatch: ReturnType<typeof distributionSummary>;
  clampedGd: ReturnType<typeof distributionSummary>;
  gdContribution: ReturnType<typeof distributionSummary>;
  pctHitPlus30: number;
  pctHitMinus30: number;
};

function gdBucketRows(sides: readonly SideObservation[]): GdBucketRow[] {
  return PLAYED_BEFORE_BUCKETS.map((bucket) => {
    const scoped = sides.filter((side) => playedBeforeBucket(side.playedBefore) === bucket);
    const perMatch = scoped.map((side) => side.gdBefore / Math.max(side.playedBefore, 1));
    return {
      bucket,
      n: scoped.length,
      rawGd: distributionSummary(scoped.map((side) => side.gdBefore)),
      gdPerMatch: distributionSummary(perMatch),
      clampedGd: distributionSummary(scoped.map((side) => side.clampedGd)),
      gdContribution: distributionSummary(scoped.map((side) => side.gdContribution)),
      pctHitPlus30:
        scoped.length === 0 ? 0 : scoped.filter((side) => side.clampedGd === 30).length / scoped.length,
      pctHitMinus30:
        scoped.length === 0 ? 0 : scoped.filter((side) => side.clampedGd === -30).length / scoped.length,
    };
  });
}

export type WinRateBucketRow = {
  bucket: PlayedBeforeBucket;
  n: number;
  winRate: ReturnType<typeof distributionSummary>;
  winRateContribution: ReturnType<typeof distributionSummary>;
};

function winRateBucketRows(sides: readonly SideObservation[]): WinRateBucketRow[] {
  return PLAYED_BEFORE_BUCKETS.map((bucket) => {
    const scoped = sides.filter((side) => playedBeforeBucket(side.playedBefore) === bucket);
    return {
      bucket,
      n: scoped.length,
      winRate: distributionSummary(scoped.map((side) => side.winRate)),
      winRateContribution: distributionSummary(scoped.map((side) => side.winRateContribution)),
    };
  });
}

export type SparseWinRateCase = {
  wins: number;
  played: number;
  gd: 0;
  homeElo: number;
  awayElo: number;
  homeMinusBase: number;
  awayMinusBase: number;
};

export function sparseWinRateSynthetics(): SparseWinRateCase[] {
  return SPARSE_WIN_RATE_CASES.map(([wins, played]) => {
    const home = catalogueEloFromParts({
      base: CALIBRATION_HOME_BASE,
      played,
      wins,
      goalsFor: 0,
      goalsAgainst: 0,
    });
    const away = catalogueEloFromParts({
      base: CALIBRATION_AWAY_BASE,
      played,
      wins,
      goalsFor: 0,
      goalsAgainst: 0,
    });
    return {
      wins,
      played,
      gd: 0,
      homeElo: home.finalCatalogueElo,
      awayElo: away.finalCatalogueElo,
      homeMinusBase: home.finalCatalogueElo - CALIBRATION_HOME_BASE,
      awayMinusBase: away.finalCatalogueElo - CALIBRATION_AWAY_BASE,
    };
  });
}

export type GapXgBridgeRow = {
  bucket: CatalogueEloGapBucket;
  n: number;
  meanRoleGap: number;
  meanWinRateGap: number;
  meanGdGap: number;
  meanRoundingGap: number;
  meanRawGap: number;
  meanLambdaRatio: number;
  meanTotalXg: number;
  meanPoissonDraw: number;
  meanHybridDraw: number;
};

function gapXgBridge(matches: readonly MatchCatalogueTrace[]): GapXgBridgeRow[] {
  return CATALOGUE_ELO_GAP_BUCKETS.map((bucket) => {
    const scoped = matches.filter((match) => catalogueEloGapBucket(match.absGap) === bucket);
    return {
      bucket,
      n: scoped.length,
      meanRoleGap: mean(scoped.map((match) => match.rolePriorGap)),
      meanWinRateGap: mean(scoped.map((match) => match.winRateGap)),
      meanGdGap: mean(scoped.map((match) => match.gdGap)),
      meanRoundingGap: mean(scoped.map((match) => match.roundingGap)),
      meanRawGap: mean(scoped.map((match) => match.rawGap)),
      meanLambdaRatio: mean(scoped.map((match) => match.lambdaRatio)),
      meanTotalXg: mean(scoped.map((match) => match.totalXg)),
      meanPoissonDraw: mean(scoped.map((match) => match.poisson.draw)),
      meanHybridDraw: mean(scoped.map((match) => match.hybrid.draw)),
    };
  });
}

export type SeasonCatalogueGeometry = {
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
  nMatches: number;
  nSides: number;
  failures: NumericFailure[];
  playedAll: PlayedBucketRow[];
  playedHome: PlayedBucketRow[];
  playedAway: PlayedBucketRow[];
  components: ComponentAttribution;
  gap: GapDistribution;
  gapComponents: {
    rolePrior: ReturnType<typeof distributionSummary>;
    constant: ReturnType<typeof distributionSummary>;
    winRate: ReturnType<typeof distributionSummary>;
    gd: ReturnType<typeof distributionSummary>;
    rounding: ReturnType<typeof distributionSummary>;
  };
  extremeGaps: ExtremeGapRow[];
  sparseVsMature: SparseVsMatureExtremes[];
  gd: GdBucketRow[];
  winRate: WinRateBucketRow[];
  bridge: GapXgBridgeRow[];
};

export function evaluateSeasonCatalogueGeometry(input: {
  rows: readonly CalibrationRow[];
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
}): {
  report: SeasonCatalogueGeometry;
  matches: MatchCatalogueTrace[];
  sides: SideObservation[];
} {
  const { matches, sides, failures } = snapshotCatalogueSeason(input);
  return {
    matches,
    sides,
    report: {
      season: input.season,
      role: input.role,
      nMatches: matches.length,
      nSides: sides.length,
      failures,
      playedAll: playedBucketRows(sides),
      playedHome: playedBucketRows(sides.filter((side) => side.side === "home")),
      playedAway: playedBucketRows(sides.filter((side) => side.side === "away")),
      components: componentAttribution(sides),
      gap: gapDistribution(matches),
      gapComponents: {
        rolePrior: distributionSummary(matches.map((match) => match.rolePriorGap)),
        constant: distributionSummary(matches.map((match) => match.constantGap)),
        winRate: distributionSummary(matches.map((match) => match.winRateGap)),
        gd: distributionSummary(matches.map((match) => match.gdGap)),
        rounding: distributionSummary(matches.map((match) => match.roundingGap)),
      },
      extremeGaps: extremeGapRows(matches),
      sparseVsMature: sparseVsMature(matches),
      gd: gdBucketRows(sides),
      winRate: winRateBucketRows(sides),
      bridge: gapXgBridge(matches),
    },
  };
}
