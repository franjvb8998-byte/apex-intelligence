/**
 * PE-4G.4 — Chronological internal folds on DEVELOPMENT (2023) rows.
 */

import { createHash } from "node:crypto";
import {
  PE4_EXPECTATION_POC_INTERNAL_FOLDS,
  PE4_EXPECTATION_POC_MIN_TRAIN_ROWS,
} from "@/lib/debug/calibration/pe4-expectation/protocol";
import type { Pe4ExpectationDatasetRow } from "@/lib/prematch-decision/pe4-form-schedule/expectation/dataset-types";

export type Pe4ExpectationInternalFold = {
  id: string;
  train: Pe4ExpectationDatasetRow[];
  eval: Pe4ExpectationDatasetRow[];
  trainFirstKickoffUtc: string;
  trainLastKickoffUtc: string;
  evalFirstKickoffUtc: string;
  evalLastKickoffUtc: string;
  trainFixtureDigest: string;
  evalFixtureDigest: string;
};

function fixtureDigest(rows: readonly Pe4ExpectationDatasetRow[]): string {
  return createHash("sha256")
    .update(
      [...rows.map((r) => r.fixtureId)].sort().join("\n"),
      "utf8",
    )
    .digest("hex");
}

export function sortChronologically(
  rows: readonly Pe4ExpectationDatasetRow[],
): Pe4ExpectationDatasetRow[] {
  return [...rows].sort((a, b) => {
    const k = a.kickoffUtc.localeCompare(b.kickoffUtc);
    if (k !== 0) return k;
    return a.fixtureId.localeCompare(b.fixtureId);
  });
}

/**
 * Build deterministic expanding chronological folds.
 * Eval block always strictly after train block by index order.
 */
export function buildPe4ExpectationInternalFolds(
  developmentRows: readonly Pe4ExpectationDatasetRow[],
): Pe4ExpectationInternalFold[] {
  const sorted = sortChronologically(developmentRows);
  const n = sorted.length;
  const folds: Pe4ExpectationInternalFold[] = [];

  for (const spec of PE4_EXPECTATION_POC_INTERNAL_FOLDS) {
    const trainEnd = Math.floor(n * spec.trainEndFrac);
    const evalEnd = Math.floor(n * spec.evalEndFrac);
    const train = sorted.slice(0, trainEnd);
    const evalRows = sorted.slice(trainEnd, evalEnd);
    if (train.length < PE4_EXPECTATION_POC_MIN_TRAIN_ROWS) continue;
    if (evalRows.length === 0) continue;

    // Disjointness
    const trainIds = new Set(train.map((r) => r.fixtureId));
    for (const r of evalRows) {
      if (trainIds.has(r.fixtureId)) {
        throw new Error(`Fold ${spec.id} has overlapping fixture`);
      }
    }
    // Temporal: last train kickoff <= first eval? Prefer train last < eval first
    if (
      train[train.length - 1]!.kickoffUtc >
      evalRows[0]!.kickoffUtc
    ) {
      // Same kickoff possible across fixtures; allow == but not train after eval
      const lastTrain = Date.parse(train[train.length - 1]!.kickoffUtc);
      const firstEval = Date.parse(evalRows[0]!.kickoffUtc);
      if (lastTrain > firstEval) {
        throw new Error(`Fold ${spec.id} violates chronological order`);
      }
    }

    folds.push({
      id: spec.id,
      train,
      eval: evalRows,
      trainFirstKickoffUtc: train[0]!.kickoffUtc,
      trainLastKickoffUtc: train[train.length - 1]!.kickoffUtc,
      evalFirstKickoffUtc: evalRows[0]!.kickoffUtc,
      evalLastKickoffUtc: evalRows[evalRows.length - 1]!.kickoffUtc,
      trainFixtureDigest: fixtureDigest(train),
      evalFixtureDigest: fixtureDigest(evalRows),
    });
  }
  return folds;
}
