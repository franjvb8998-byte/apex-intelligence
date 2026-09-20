/**
 * Deterministic evaluation hash. Fixture order is normalized first.
 */

import { sha256Canonical } from "@/lib/debug/calibration/prospective/capture/capture-manifest";
import type { ProspectiveEvaluationReport } from "@/lib/debug/calibration/prospective/evaluation/evaluation-types";

export function hashEvaluationReport(
  report: Omit<ProspectiveEvaluationReport, "evaluationHash"> | ProspectiveEvaluationReport,
): string {
  return sha256Canonical({
    evaluationVersion: report.evaluationVersion,
    phase: report.phase,
    candidateFingerprint: report.candidateFingerprint,
    protocolFingerprint: report.protocolFingerprint,
    evaluatedN: report.evaluatedN,
    fixtureCount: report.fixtureCount,
    candidateRowCount: report.candidateRowCount,
    checkpointState: report.checkpointState,
    formalReviewAvailable: report.formalReviewAvailable,
    firstScoredAt: report.firstScoredAt,
    lastScoredAt: report.lastScoredAt,
    firstKickoffUtc: report.firstKickoffUtc,
    lastKickoffUtc: report.lastKickoffUtc,
    observedHomeCount: report.observedHomeCount,
    observedDrawCount: report.observedDrawCount,
    observedAwayCount: report.observedAwayCount,
    integrityStatus: report.integrityStatus,
    rejectionPolicy: report.rejectionPolicy,
    rejectedCount: report.rejectedCount,
    rejections: report.rejections,
    candidateAggregates: report.candidateAggregates,
    classwiseCalibration: report.classwiseCalibration,
    eceReports: report.eceReports,
    providerCallAccounting: report.providerCallAccounting,
  });
}
