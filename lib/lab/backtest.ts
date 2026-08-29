/**
 * Closed-book walk of Learning Engine cases.
 * Unit outcome marks (+1 / −1). No invented book odds.
 */

import type { LearningCase } from "@/lib/learning-engine/types/case";
import type { LabBacktest, LabBacktestMark, LabPoint } from "@/lib/lab/types";

export function simulateUnitMarks(cases: LearningCase[]): LabBacktest {
  const sorted = [...cases].sort((a, b) =>
    a.actual.finishedAt.localeCompare(b.actual.finishedAt),
  );
  let equity = 0;
  const marks: LabBacktestMark[] = [];
  const points: LabPoint[] = [{ label: "t0", value: 0 }];

  for (const row of sorted) {
    equity += row.outcomeCorrect ? 1 : -1;
    marks.push({
      id: row.id,
      label: `Case ${row.prediction.matchId}`,
      predicted: row.prediction.predictedOutcome,
      actual: row.actual.outcome,
      hit: row.outcomeCorrect,
      brier: row.error.brierScore,
      confidence: row.prediction.confidence,
      equity,
    });
    points.push({
      label: row.actual.finishedAt.slice(0, 10),
      value: equity,
    });
  }

  const hits = marks.filter((mark) => mark.hit).length;
  const meanBrier =
    marks.length === 0
      ? 0
      : marks.reduce((sum, mark) => sum + mark.brier, 0) / marks.length;

  return {
    modelVersion:
      sorted[0]?.prediction.modelVersion ?? "elo-poisson-hybrid-0.1.0",
    sampleLabel: "Learning Engine closed book · unit 1X2 marks",
    sampleSize: marks.length,
    hitRate: marks.length === 0 ? 0 : hits / marks.length,
    meanBrier,
    marks,
    equity: points,
  };
}
