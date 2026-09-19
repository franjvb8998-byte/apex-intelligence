/**
 * Debug-only catalogue-input counterfactuals. Isolated. Not production candidates.
 */

import { createIsolatedDrawEngine } from "@/lib/debug/calibration/draw-5b7-trace";
import {
  assertProductionHybridConfigUnchanged,
  snapshotDefaultHybridConfig,
} from "@/lib/debug/calibration/experiment-5b5-ha";
import { frozenValidationConfig } from "@/lib/debug/calibration/validation-5b6-configs";
import { createDefaultEloPolicies } from "@/lib/debug/calibration/policies";
import { isValidOneXTwo } from "@/lib/debug/calibration/metrics";
import { rowEvidenceBucket } from "@/lib/debug/calibration/reconstruct";
import { distributionSummary } from "@/lib/debug/calibration/xg-5b9-geometry";
import { lambdaRatio } from "@/lib/debug/calibration/xg-5b9-geometry";
import {
  R0_AWAY_BASE,
  R0_HOME_BASE,
  R1_EQUAL_BASE,
} from "@/lib/debug/calibration/cat-5b10-shape";
import { catalogueEloFromParts } from "@/lib/debug/calibration/cat-5b10-formula";
import type { SideObservation } from "@/lib/debug/calibration/cat-5b10-evaluate";
import type { CalibrationRow, EloPolicyId, EvidenceBucket } from "@/lib/debug/calibration/types";

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export type RoleBaseSummary = {
  variant: "R0" | "R1";
  homeBase: number;
  awayBase: number;
  meanSignedGap: number;
  meanAbsGap: number;
  p90AbsGap: number;
  p95AbsGap: number;
  countGe200: number;
  countGe250: number;
  meanLambdaRatio: number;
  poissonDraw: number;
  hybridDraw: number;
};

function summarizeRoleVariant(
  variant: "R0" | "R1",
  homeBase: number,
  awayBase: number,
  rows: readonly CalibrationRow[],
): RoleBaseSummary {
  const before = snapshotDefaultHybridConfig();
  const engine = createIsolatedDrawEngine(frozenValidationConfig("V0"));
  const absGaps: number[] = [];
  const signed: number[] = [];
  const ratios: number[] = [];
  const poissonDraws: number[] = [];
  const hybridDraws: number[] = [];
  for (const row of rows) {
    const home = catalogueEloFromParts({
      base: homeBase,
      played: row.homePlayedBefore,
      wins: row.homeWinsBefore,
      goalsFor: row.homeGfBefore,
      goalsAgainst: row.homeGaBefore,
      teamId: row.homeTeamId,
    });
    const away = catalogueEloFromParts({
      base: awayBase,
      played: row.awayPlayedBefore,
      wins: row.awayWinsBefore,
      goalsFor: row.awayGfBefore,
      goalsAgainst: row.awayGaBefore,
      teamId: row.awayTeamId,
    });
    const gap = home.finalCatalogueElo - away.finalCatalogueElo;
    signed.push(gap);
    absGaps.push(Math.abs(gap));
    const predicted = engine.predict({
      homeElo: home.finalCatalogueElo,
      awayElo: away.finalCatalogueElo,
      homeTeamId: row.homeTeamId,
      awayTeamId: row.awayTeamId,
      matchId: row.fixtureId,
    });
    if (!isValidOneXTwo(predicted.oneXTwo) || !isValidOneXTwo(predicted.poisson.oneXTwo)) {
      throw new Error(`${variant} geometry invalid on ${row.fixtureId}`);
    }
    ratios.push(lambdaRatio(predicted.expectedGoals.home, predicted.expectedGoals.away));
    poissonDraws.push(predicted.poisson.oneXTwo.draw);
    hybridDraws.push(predicted.oneXTwo.draw);
  }
  assertProductionHybridConfigUnchanged(before);
  const absSummary = distributionSummary(absGaps);
  return {
    variant,
    homeBase,
    awayBase,
    meanSignedGap: mean(signed),
    meanAbsGap: absSummary.mean,
    p90AbsGap: absSummary.p90,
    p95AbsGap: absSummary.p95,
    countGe200: absGaps.filter((value) => value >= 200).length,
    countGe250: absGaps.filter((value) => value >= 250).length,
    meanLambdaRatio: mean(ratios),
    poissonDraw: mean(poissonDraws),
    hybridDraw: mean(hybridDraws),
  };
}

export function evaluateRoleBaseCounterfactual(input: {
  rows: readonly CalibrationRow[];
}): { R0: RoleBaseSummary; R1: RoleBaseSummary } {
  return {
    R0: summarizeRoleVariant("R0", R0_HOME_BASE, R0_AWAY_BASE, input.rows),
    R1: summarizeRoleVariant("R1", R1_EQUAL_BASE, R1_EQUAL_BASE, input.rows),
  };
}

export type GdScaleDiagnostics = {
  nSidesPlayedPositive: number;
  corrCumulativeGdVsPlayed: number;
  corrGdPerMatchVsPlayed: number;
  corrGdContributionVsPlayed: number;
  corrCumulativeVsPerMatch: number;
  meanAbsCumulativeGd: number;
  meanAbsGdPerMatch: number;
  meanAbsGdContribution: number;
};

function pearson(xs: readonly number[], ys: readonly number[]): number {
  if (xs.length < 2 || xs.length !== ys.length) return 0;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < xs.length; i += 1) {
    const a = xs[i]! - mx;
    const b = ys[i]! - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num / den;
}

export function gdScaleDiagnostics(sides: readonly SideObservation[]): GdScaleDiagnostics {
  const scoped = sides.filter((side) => side.playedBefore > 0);
  const played = scoped.map((side) => side.playedBefore);
  const cumulative = scoped.map((side) => side.gdBefore);
  const perMatch = scoped.map((side) => side.gdBefore / side.playedBefore);
  const contribution = scoped.map((side) => side.gdContribution);
  return {
    nSidesPlayedPositive: scoped.length,
    corrCumulativeGdVsPlayed: pearson(cumulative.map(Math.abs), played),
    corrGdPerMatchVsPlayed: pearson(perMatch.map(Math.abs), played),
    corrGdContributionVsPlayed: pearson(contribution.map(Math.abs), played),
    corrCumulativeVsPerMatch: pearson(cumulative, perMatch),
    meanAbsCumulativeGd: mean(cumulative.map(Math.abs)),
    meanAbsGdPerMatch: mean(perMatch.map(Math.abs)),
    meanAbsGdContribution: mean(contribution.map(Math.abs)),
  };
}

export type ShrinkageBucketRow = {
  policyId: EloPolicyId;
  evidenceBucket: EvidenceBucket;
  n: number;
  meanAbsGap: number;
  p90AbsGap: number;
  maxAbsGap: number;
  countGe200: number;
  meanLambdaRatio: number;
  p90LambdaRatio: number;
};

export function evaluateShrinkageCharacterization(input: {
  rows: readonly CalibrationRow[];
}): ShrinkageBucketRow[] {
  const before = snapshotDefaultHybridConfig();
  const engine = createIsolatedDrawEngine(frozenValidationConfig("V0"));
  const policies = createDefaultEloPolicies();
  const out: ShrinkageBucketRow[] = [];
  for (const policy of policies) {
    const byBucket = new Map<EvidenceBucket, { gaps: number[]; ratios: number[] }>();
    for (const row of input.rows) {
      const bucket = rowEvidenceBucket(row);
      const home = policy.resolve(row, "home").elo;
      const away = policy.resolve(row, "away").elo;
      const predicted = engine.predict({
        homeElo: home,
        awayElo: away,
        homeTeamId: row.homeTeamId,
        awayTeamId: row.awayTeamId,
        matchId: row.fixtureId,
      });
      if (!isValidOneXTwo(predicted.oneXTwo)) {
        throw new Error(`Shrinkage policy ${policy.id} invalid 1X2 on ${row.fixtureId}`);
      }
      const entry = byBucket.get(bucket) ?? { gaps: [], ratios: [] };
      entry.gaps.push(Math.abs(home - away));
      entry.ratios.push(lambdaRatio(predicted.expectedGoals.home, predicted.expectedGoals.away));
      byBucket.set(bucket, entry);
    }
    for (const evidenceBucket of ["0", "1-3", "4-9", "10+"] as const) {
      const entry = byBucket.get(evidenceBucket) ?? { gaps: [], ratios: [] };
      const gapSummary = distributionSummary(entry.gaps);
      const ratioSummary = distributionSummary(entry.ratios);
      out.push({
        policyId: policy.id,
        evidenceBucket,
        n: entry.gaps.length,
        meanAbsGap: gapSummary.mean,
        p90AbsGap: gapSummary.p90,
        maxAbsGap: gapSummary.max,
        countGe200: entry.gaps.filter((value) => value >= 200).length,
        meanLambdaRatio: ratioSummary.mean,
        p90LambdaRatio: ratioSummary.p90,
      });
    }
  }
  assertProductionHybridConfigUnchanged(before);
  return out;
}
