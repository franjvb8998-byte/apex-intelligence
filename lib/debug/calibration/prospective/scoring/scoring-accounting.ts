/**
 * capturedN vs scoredN. Scoring never increments capturedN.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CANDIDATE_MANIFEST_FINGERPRINT } from "@/lib/debug/calibration/prospective/candidate-config";
import { loadPriorCaptureIndex } from "@/lib/debug/calibration/prospective/capture/capture-persist";
import { scoredDirectory } from "@/lib/debug/calibration/prospective/scoring/scoring-persist";
import {
  ZERO_SCORING_PROVIDER_CALLS,
  type ProspectiveScoredArtifact,
  type ScoringProviderAccounting,
} from "@/lib/debug/calibration/prospective/scoring/scoring-types";

export function emptyScoringCallAccounting(): ScoringProviderAccounting {
  return { ...ZERO_SCORING_PROVIDER_CALLS };
}

export function countCapturedProspectiveN(persistRoot?: string): number {
  if (!persistRoot) return 0;
  const fixtures = new Set<string>();
  for (const entry of loadPriorCaptureIndex(persistRoot).entries) {
    if (entry.candidateFingerprint === CANDIDATE_MANIFEST_FINGERPRINT) {
      fixtures.add(entry.fixtureId);
    }
  }
  return fixtures.size;
}

export function countScoredProspectiveN(persistRoot?: string): number {
  if (!persistRoot) return 0;
  const directory = scoredDirectory(persistRoot);
  if (!existsSync(directory)) return 0;
  const fixtures = new Set<string>();
  for (const name of readdirSync(directory)) {
    if (!name.endsWith(".json") || name.includes(".tmp")) continue;
    const parsed = JSON.parse(readFileSync(join(directory, name), "utf8")) as ProspectiveScoredArtifact;
    if (parsed.candidateFingerprint === CANDIDATE_MANIFEST_FINGERPRINT && parsed.fixtureId) {
      fixtures.add(parsed.fixtureId);
    }
  }
  return fixtures.size;
}
