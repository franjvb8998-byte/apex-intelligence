/**
 * Score calibration rows with frozen production PE.
 * Elo treatment is the only experimental dimension.
 */

import {
  BOOKMAKER_ODDS_TIMING_DISCLAIMER,
  impliedProbabilitiesFromDecimalOdds,
} from "@/lib/debug/calibration/bookmaker";
import {
  createDefaultEloPolicies,
  type EloPolicy,
} from "@/lib/debug/calibration/policies";
import {
  stratifyMetrics,
  summarizeMetrics,
  type MetricRow,
  type MetricSummary,
} from "@/lib/debug/calibration/metrics";
import { rowEvidenceBucket } from "@/lib/debug/calibration/reconstruct";
import type { CalibrationRow, OneXTwo } from "@/lib/debug/calibration/types";
import {
  confidenceFromHybrid,
  createEloPoissonHybridEngine,
  type ProbabilityEngine,
} from "@/lib/intelligence/modules/probability";

export type ScoredCalibrationRow = {
  fixtureId: string;
  policyId: string;
  homeElo: number;
  awayElo: number;
  oneXTwo: OneXTwo;
  expectedGoals: { home: number; away: number };
  confidence: number;
  confidenceBand: "low" | "medium" | "high";
  peModelVersion: string;
  bucket: ReturnType<typeof rowEvidenceBucket>;
};

function createFrozenEngine(): ProbabilityEngine {
  return createEloPoissonHybridEngine();
}

export function scoreRowWithPolicy(
  row: CalibrationRow,
  policy: EloPolicy,
  engine: ProbabilityEngine = createFrozenEngine(),
): ScoredCalibrationRow {
  const home = policy.resolve(row, "home");
  const away = policy.resolve(row, "away");
  const hybrid = engine.predict({
    homeElo: home.elo,
    awayElo: away.elo,
    homeTeamId: row.homeTeamId,
    awayTeamId: row.awayTeamId,
    matchId: row.fixtureId,
  });
  const confidence = confidenceFromHybrid(hybrid);
  return {
    fixtureId: row.fixtureId,
    policyId: policy.id,
    homeElo: home.elo,
    awayElo: away.elo,
    oneXTwo: hybrid.oneXTwo,
    expectedGoals: {
      home: hybrid.expectedGoals.home,
      away: hybrid.expectedGoals.away,
    },
    confidence: confidence.value,
    confidenceBand: confidence.band,
    peModelVersion: hybrid.meta.modelVersion,
    bucket: rowEvidenceBucket(row),
  };
}

export function scoreRowsWithPolicies(
  rows: readonly CalibrationRow[],
  policies: readonly EloPolicy[] = createDefaultEloPolicies(),
  engine: ProbabilityEngine = createFrozenEngine(),
): ScoredCalibrationRow[] {
  const scored: ScoredCalibrationRow[] = [];
  for (const row of rows) {
    for (const policy of policies) {
      scored.push(scoreRowWithPolicy(row, policy, engine));
    }
  }
  return scored;
}

export function metricRowsFromScores(
  rows: readonly CalibrationRow[],
  scores: readonly ScoredCalibrationRow[],
): MetricRow[] {
  const byFixture = new Map(rows.map((row) => [row.fixtureId, row]));
  const out: MetricRow[] = [];
  for (const score of scores) {
    const row = byFixture.get(score.fixtureId);
    if (!row?.actualOutcome) continue;
    out.push({
      predicted: score.oneXTwo,
      actual: row.actualOutcome,
      bucket: score.bucket,
      policyId: score.policyId,
      competitionId: row.competitionId,
      category: row.category,
    });
  }
  return out;
}

export function bookmakerMetricRows(
  rows: readonly CalibrationRow[],
): MetricRow[] {
  const out: MetricRow[] = [];
  for (const row of rows) {
    if (!row.actualOutcome) continue;
    if (row.homeOdds == null || row.drawOdds == null || row.awayOdds == null) {
      continue;
    }
    const implied = impliedProbabilitiesFromDecimalOdds({
      homeOdds: row.homeOdds,
      drawOdds: row.drawOdds,
      awayOdds: row.awayOdds,
    });
    if (!implied) continue;
    out.push({
      predicted: implied.normalized,
      actual: row.actualOutcome,
      bucket: rowEvidenceBucket(row),
      policyId: "bookmaker_normalized",
      competitionId: row.competitionId,
      category: row.category,
    });
  }
  return out;
}

export type CalibrationHarnessReport = {
  peModelVersion: string;
  scores: ScoredCalibrationRow[];
  policyMetrics: Record<string, MetricSummary>;
  bookmakerMetrics: MetricSummary;
  bookmakerDisclaimer: string;
};

export function evaluateCalibrationRows(
  rows: readonly CalibrationRow[],
  policies: readonly EloPolicy[] = createDefaultEloPolicies(),
): CalibrationHarnessReport {
  const engine = createFrozenEngine();
  const scores = scoreRowsWithPolicies(rows, policies, engine);
  const metricRows = metricRowsFromScores(rows, scores);
  return {
    peModelVersion: engine.modelVersion,
    scores,
    policyMetrics: stratifyMetrics(metricRows),
    bookmakerMetrics: summarizeMetrics(bookmakerMetricRows(rows)),
    bookmakerDisclaimer: BOOKMAKER_ODDS_TIMING_DISCLAIMER,
  };
}
