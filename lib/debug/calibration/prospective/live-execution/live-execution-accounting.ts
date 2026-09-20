/**
 * Debug-only call accounting and prospective-N helpers.
 * 5C.5B.1 never increments provider call counters.
 */

import { CANDIDATE_MANIFEST_FINGERPRINT } from "@/lib/debug/calibration/prospective/candidate-config";
import type { PriorCaptureIndex } from "@/lib/debug/calibration/prospective/capture/capture-types";
import { loadPriorCaptureIndex } from "@/lib/debug/calibration/prospective/capture/capture-persist";
import {
  ZERO_PROVIDER_CALLS,
  type LiveExecutionCallAccounting,
} from "@/lib/debug/calibration/prospective/live-execution/live-execution-types";

export function emptyProviderCallAccounting(): LiveExecutionCallAccounting {
  return { ...ZERO_PROVIDER_CALLS };
}

export function countPersistedProspectiveN(input?: {
  priorIndex?: PriorCaptureIndex;
  persistRoot?: string;
  fingerprint?: string;
}): number {
  const fingerprint = input?.fingerprint ?? CANDIDATE_MANIFEST_FINGERPRINT;
  const index = input?.priorIndex ?? (input?.persistRoot ? loadPriorCaptureIndex(input.persistRoot) : { entries: [] });
  const fixtures = new Set<string>();
  for (const entry of index.entries) {
    if (entry.candidateFingerprint === fingerprint) {
      fixtures.add(entry.fixtureId);
    }
  }
  return fixtures.size;
}
