/**
 * Safe execution report. No secrets, raw payloads, target results, scoring, or ranking.
 */

import { CANDIDATE_MANIFEST_FINGERPRINT } from "@/lib/debug/calibration/prospective/candidate-config";
import { PROSPECTIVE_CANDIDATE_IDS } from "@/lib/debug/calibration/prospective/candidate-types";
import type { LiveCaptureFixtureInput } from "@/lib/debug/calibration/prospective/live-capture/live-capture-types";
import { minutesBeforeKickoffUtc } from "@/lib/debug/calibration/prospective/protocol/protocol-utc";
import type { PlannerDisposition } from "@/lib/debug/calibration/prospective/protocol/protocol-types";
import { emptyProviderCallAccounting } from "@/lib/debug/calibration/prospective/live-execution/live-execution-accounting";
import type {
  LiveExecutionEvidenceProvenance,
  LiveExecutionHashVerification,
  LiveExecutionMode,
  LiveExecutionPersistenceStatus,
  LiveExecutionReport,
  ProjectedTargetFixture,
} from "@/lib/debug/calibration/prospective/live-execution/live-execution-types";

export function buildLiveExecutionReport(input: {
  target: ProjectedTargetFixture;
  capturedAt: string;
  mode: LiveExecutionMode;
  classification?: PlannerDisposition | "NOT_CLASSIFIED";
  fixture?: LiveCaptureFixtureInput;
  provenance?: LiveExecutionEvidenceProvenance | null;
  oddsPresent?: boolean;
  recordCount?: number;
  hashVerification?: LiveExecutionHashVerification;
  persistenceStatus?: LiveExecutionPersistenceStatus;
  prospectiveNBefore?: number;
  prospectiveNAfter?: number;
  includeCandidateIds?: boolean;
}): LiveExecutionReport {
  const minutes = Number.isFinite(Date.parse(input.target.kickoffUtc))
    ? minutesBeforeKickoffUtc(input.target.kickoffUtc, input.capturedAt)
    : null;
  return {
    fixtureId: input.target.fixtureId,
    competitionId: input.target.competitionId,
    season: input.target.season,
    kickoffUtc: input.target.kickoffUtc,
    capturedAtUtc: input.capturedAt,
    minutesToKickoff: minutes,
    status: input.target.status,
    protocolClassification: input.classification ?? "NOT_CLASSIFIED",
    evidencePresent: input.provenance != null || input.fixture?.preMatchEvidence != null,
    homeEvidenceCount: input.provenance?.homeEvidenceMatchCount ?? input.fixture?.preMatchEvidence.home.matchesPlayed ?? 0,
    awayEvidenceCount: input.provenance?.awayEvidenceMatchCount ?? input.fixture?.preMatchEvidence.away.matchesPlayed ?? 0,
    latestEvidenceKickoff: input.provenance?.latestAcceptedKickoff ?? null,
    oddsPresent: input.oddsPresent ?? input.fixture?.oddsSnapshot != null,
    executionMode: input.mode,
    candidateFingerprint: CANDIDATE_MANIFEST_FINGERPRINT,
    candidateIds: input.includeCandidateIds ? [...PROSPECTIVE_CANDIDATE_IDS] : [],
    recordCount: input.recordCount ?? 0,
    hashVerification: input.hashVerification ?? "NOT_RUN",
    persistenceStatus: input.persistenceStatus ?? "NOT_WRITTEN",
    prospectiveNBefore: input.prospectiveNBefore ?? 0,
    prospectiveNAfter: input.prospectiveNAfter ?? input.prospectiveNBefore ?? 0,
    providerCallAccounting: emptyProviderCallAccounting(),
  };
}
