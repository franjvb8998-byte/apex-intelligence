/**
 * Offline prospective evaluation runner. Synthetic scored artifacts only.
 * Default STRICT: any invalid artifact rejects the entire evaluation.
 * AUDITED_COLLECTION: invalid artifacts are excluded with deterministic reasons.
 */

import type { ProspectiveScoredArtifact } from "@/lib/debug/calibration/prospective/scoring/scoring-types";
import { inspectScoredArtifact } from "@/lib/debug/calibration/prospective/evaluation/evaluation-integrity";
import {
  buildEvaluationReport,
  observationsFromArtifacts,
} from "@/lib/debug/calibration/prospective/evaluation/evaluation-report";
import {
  EVALUATION_DEFAULT_MODE,
  EvaluationRejectedError,
  type EvaluateProspectiveRequest,
  type EvaluateProspectiveResult,
  type EvaluationMode,
  type EvaluationRejection,
} from "@/lib/debug/calibration/prospective/evaluation/evaluation-types";

function sortByFixtureId(artifacts: readonly ProspectiveScoredArtifact[]): ProspectiveScoredArtifact[] {
  return [...artifacts].sort((left, right) => left.fixtureId.localeCompare(right.fixtureId));
}

function collectRejections(
  artifacts: readonly ProspectiveScoredArtifact[],
): { accepted: ProspectiveScoredArtifact[]; rejections: EvaluationRejection[] } {
  const accepted: ProspectiveScoredArtifact[] = [];
  const rejections: EvaluationRejection[] = [];
  const seen = new Set<string>();
  for (const artifact of sortByFixtureId(artifacts)) {
    const fixtureId = artifact.fixtureId?.trim() || artifact.fixtureId || "";
    if (seen.has(fixtureId)) {
      rejections.push({ fixtureId, reason: "DUPLICATE_FIXTURE" });
      continue;
    }
    seen.add(fixtureId);
    const reason = inspectScoredArtifact(artifact);
    if (reason) {
      rejections.push({ fixtureId, reason });
      continue;
    }
    accepted.push(artifact);
  }
  return { accepted, rejections };
}

export function evaluateProspectiveScores(
  request: EvaluateProspectiveRequest,
): EvaluateProspectiveResult {
  const mode: EvaluationMode = request.mode ?? EVALUATION_DEFAULT_MODE;
  const { accepted, rejections } = collectRejections(request.artifacts ?? []);

  if (mode === "STRICT" && rejections.length > 0) {
    const report = buildEvaluationReport({
      artifacts: [],
      mode,
      rejections,
      integrityStatus: "FAIL",
    });
    throw new EvaluationRejectedError(
      `evaluation rejected: ${rejections.map((item) => item.reason).join(",")}`,
      report,
    );
  }

  const integrityStatus = accepted.length === 0 ? "EMPTY" : "PASS";
  const report = buildEvaluationReport({
    artifacts: accepted,
    mode,
    rejections,
    integrityStatus,
  });
  return {
    phase: report.phase,
    report,
    observations: observationsFromArtifacts(accepted),
  };
}
