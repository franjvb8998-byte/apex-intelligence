/**
 * Prospective leakage, immutability, and historical-firewall guards.
 */

import {
  PRODUCTION_BASE_COMMIT,
  USED_HISTORICAL_SEASONS,
  type ProspectiveCandidateId,
  type ProspectiveEvidence,
  type ProspectivePredictionRecord,
} from "@/lib/debug/calibration/prospective/candidate-types";
import { CANDIDATE_MANIFEST_FINGERPRINT } from "@/lib/debug/calibration/prospective/candidate-config";

export class ProspectiveIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProspectiveIntegrityError";
  }
}

export class HistoricalFirewallError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HistoricalFirewallError";
  }
}

const USED_DATASET_MARKERS = [
  "validation-5b6-pl-2023",
  "validation-5b6-pl-2025",
  "pilot-2026-09-19T05-52-08-473Z.population",
  "draw-5b7-forensics",
];

export function assertProductionBaseCommit(value: string): void {
  if (value !== PRODUCTION_BASE_COMMIT) {
    throw new ProspectiveIntegrityError(
      `productionBaseCommit must remain ${PRODUCTION_BASE_COMMIT}`,
    );
  }
}

export function assertKickoffAfterCapture(kickoff: string, capturedAt: string): void {
  if (!(Date.parse(kickoff) > Date.parse(capturedAt))) {
    throw new ProspectiveIntegrityError("kickoff must be after capturedAt");
  }
}

export function assertEvidenceBeforeKickoff(evidenceAsOf: string, kickoff: string): void {
  if (!(Date.parse(evidenceAsOf) < Date.parse(kickoff))) {
    throw new ProspectiveIntegrityError("evidenceAsOf must be before kickoff");
  }
}

export function assertUnscoredRecord(record: ProspectivePredictionRecord): void {
  if (record.resultStatus !== "PENDING") {
    throw new ProspectiveIntegrityError("capture records must be PENDING");
  }
  if (record.finalHomeGoals !== null || record.finalAwayGoals !== null) {
    throw new ProspectiveIntegrityError("outcome goals must be null at capture");
  }
  if (record.scoredAt !== null) {
    throw new ProspectiveIntegrityError("scoredAt must be null at capture");
  }
}

export function assertNotUsedHistoricalSeason(season: string): void {
  if ((USED_HISTORICAL_SEASONS as readonly string[]).includes(season)) {
    throw new HistoricalFirewallError(
      `${season} is used 5B investigation data and cannot enter prospective capture or scoring`,
    );
  }
}

export function assertNotHistoricalOutcomeDataset(path: string): void {
  const normalized = path.replace(/\\/g, "/");
  if (USED_DATASET_MARKERS.some((marker) => normalized.includes(marker))) {
    throw new HistoricalFirewallError(`Refusing historical outcome dataset ${path}`);
  }
}

export function assertManifestFingerprint(value: string): void {
  if (value !== CANDIDATE_MANIFEST_FINGERPRINT) {
    throw new ProspectiveIntegrityError("candidate manifest fingerprint changed during the run");
  }
}

export function assertUniqueFixtureCandidate(
  seen: ReadonlySet<string>,
  fixtureId: string,
  candidateId: ProspectiveCandidateId,
): void {
  const key = `${fixtureId}::${candidateId}`;
  if (seen.has(key)) {
    throw new ProspectiveIntegrityError(`duplicate fixture/candidate ${key}`);
  }
}

export function compareSameKickoff(
  left: Pick<ProspectiveEvidence, "kickoff" | "fixtureId">,
  right: Pick<ProspectiveEvidence, "kickoff" | "fixtureId">,
): number {
  const kickoff = left.kickoff.localeCompare(right.kickoff);
  if (kickoff !== 0) return kickoff;
  return left.fixtureId.localeCompare(right.fixtureId);
}

export function sortDeterministic(records: readonly ProspectiveEvidence[]): ProspectiveEvidence[] {
  return [...records].sort(compareSameKickoff);
}

export function evidenceWithoutOutcomes(evidence: ProspectiveEvidence): ProspectiveEvidence {
  const clone = { ...evidence };
  const forbidden = clone as ProspectiveEvidence & {
    actualHomeGoals?: unknown;
    actualAwayGoals?: unknown;
    actualOutcome?: unknown;
  };
  if (
    forbidden.actualHomeGoals !== undefined ||
    forbidden.actualAwayGoals !== undefined ||
    forbidden.actualOutcome !== undefined
  ) {
    throw new ProspectiveIntegrityError("prediction generation cannot access result fields");
  }
  return clone;
}
