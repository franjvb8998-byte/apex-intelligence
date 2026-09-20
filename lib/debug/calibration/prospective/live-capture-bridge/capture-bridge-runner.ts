/**
 * Controlled capture bridge. Synthetic only. Default DRY_RUN.
 * Does not invoke 5C.4 discovery or accept 5C.5B.1 kind:"live" transport.
 */

import { executeLiveCaptureAdapter } from "@/lib/debug/calibration/prospective/live-execution/live-execution-adapter";
import {
  LIVE_EXECUTION_DEFAULT_MODE,
  LiveExecutionRejectedError,
} from "@/lib/debug/calibration/prospective/live-execution/live-execution-types";
import {
  projectPriorUniverse,
  projectTargetFixture,
} from "@/lib/debug/calibration/prospective/live-execution/live-execution-projection";
import { countPersistedProspectiveN } from "@/lib/debug/calibration/prospective/live-execution/live-execution-accounting";
import { countScoredProspectiveN } from "@/lib/debug/calibration/prospective/scoring/scoring-accounting";
import { minutesBeforeKickoffUtc } from "@/lib/debug/calibration/prospective/protocol/protocol-utc";
import {
  assertCaptureBridgeBudget,
  planCaptureBridgeBudget,
  unspentBridgeAccounting,
} from "@/lib/debug/calibration/prospective/live-capture-bridge/capture-bridge-budget";
import {
  countSameKickoffExcluded,
  targetAppearsInUniverse,
} from "@/lib/debug/calibration/prospective/live-capture-bridge/capture-bridge-evidence";
import { assertReviewedInWindow } from "@/lib/debug/calibration/prospective/live-capture-bridge/capture-bridge-handoff";
import { assertIdentityBound } from "@/lib/debug/calibration/prospective/live-capture-bridge/capture-bridge-identity";
import { assertCaptureBridgeOffline } from "@/lib/debug/calibration/prospective/live-capture-bridge/capture-bridge-interlock";
import { resolveOptionalBridgeOdds } from "@/lib/debug/calibration/prospective/live-capture-bridge/capture-bridge-odds";
import { buildCaptureBridgeReport } from "@/lib/debug/calibration/prospective/live-capture-bridge/capture-bridge-report";
import {
  CAPTURE_BRIDGE_PHASE,
  CaptureBridgeRejectedError,
  emptyBridgeReport,
  type CaptureBridgeEvidenceUniverse,
  type CaptureBridgeRequest,
  type CaptureBridgeResult,
  type CaptureDisposition,
} from "@/lib/debug/calibration/prospective/live-capture-bridge/capture-bridge-types";
import type { ProjectedTargetFixture } from "@/lib/debug/calibration/prospective/live-execution/live-execution-types";

function rejectBridge(input: {
  request: CaptureBridgeRequest;
  message: string;
  startedAt: string;
  mode: CaptureBridgeRequest["mode"];
  accounting: ReturnType<typeof unspentBridgeAccounting>;
  capturedNBefore: number;
  scoredNBefore: number;
  extra?: Parameters<typeof emptyBridgeReport>[0];
}): never {
  const mode = input.mode ?? LIVE_EXECUTION_DEFAULT_MODE;
  throw new CaptureBridgeRejectedError(
    input.message,
    emptyBridgeReport({
      fixtureId: input.request.handoff.fixtureId,
      competitionId: input.request.handoff.competitionId,
      season: input.request.handoff.season,
      kickoffUtc: input.request.handoff.kickoffUtc,
      reviewedDiscoveryAtUtc: input.request.handoff.reviewedDiscoveryAtUtc,
      reviewedClassification: input.request.handoff.reviewedClassification,
      executionStartedAtUtc: input.startedAt,
      executionMode: mode,
      dryRun: mode === "DRY_RUN",
      providerCallAccounting: input.accounting,
      capturedNBefore: input.capturedNBefore,
      capturedNAfter: countPersistedProspectiveN({ persistRoot: input.request.persistRoot }),
      scoredNBefore: input.scoredNBefore,
      scoredNAfter: countScoredProspectiveN(input.request.persistRoot),
      captureDisposition: "REJECTED",
      ...input.extra,
    }),
  );
}

function loadBoundUniverse(
  request: CaptureBridgeRequest,
  reject: (message: string, extra?: Parameters<typeof emptyBridgeReport>[0]) => never,
): { universe: CaptureBridgeEvidenceUniverse; projected: ProjectedTargetFixture } {
  let universe: CaptureBridgeEvidenceUniverse;
  try {
    universe = request.transport.loadEvidenceUniverse(request.handoff);
  } catch (error) {
    reject(error instanceof Error ? error.message : "evidence transport failure", {
      finalClassification: "SOURCE_FAILURE",
    });
  }
  try {
    const projected = projectTargetFixture(universe.target);
    assertIdentityBound(request.handoff, projected);
    return { universe, projected };
  } catch (error) {
    reject(error instanceof Error ? error.message : "identity mismatch", { identityVerified: false });
  }
}

export function executeCaptureBridge(request: CaptureBridgeRequest): CaptureBridgeResult {
  assertCaptureBridgeOffline(request);
  const plan = planCaptureBridgeBudget({
    priorDiscoveryCalls: request.priorDiscoveryCalls,
    plannedEvidenceCalls: request.plannedEvidenceCalls,
    plannedOddsCalls: request.plannedOddsCalls,
  });
  assertCaptureBridgeBudget(plan, request.handoff.fixtureId);
  const accounting = unspentBridgeAccounting(plan);
  const startedAt = request.capturedAt ?? request.clock.now();
  const capturedNBefore = countPersistedProspectiveN({ persistRoot: request.persistRoot });
  const scoredNBefore = countScoredProspectiveN(request.persistRoot);
  const mode = request.mode ?? LIVE_EXECUTION_DEFAULT_MODE;
  const reject = (message: string, extra: Parameters<typeof emptyBridgeReport>[0] = {}): never =>
    rejectBridge({
      request,
      message,
      startedAt,
      mode,
      accounting,
      capturedNBefore,
      scoredNBefore,
      extra,
    });

  try {
    assertReviewedInWindow(request.handoff);
  } catch (error) {
    if (error instanceof CaptureBridgeRejectedError) {
      throw new CaptureBridgeRejectedError(error.message, {
        ...error.report,
        providerCallAccounting: accounting,
        capturedNBefore,
        capturedNAfter: capturedNBefore,
        scoredNBefore,
        scoredNAfter: scoredNBefore,
        executionStartedAtUtc: startedAt,
      });
    }
    throw error;
  }

  const { universe, projected } = loadBoundUniverse(request, reject);
  const priors = projectPriorUniverse(universe.fixtures);
  const sameKickoffExcludedCount = countSameKickoffExcluded(priors, projected);
  const targetExcluded = targetAppearsInUniverse(priors, projected);

  let oddsFailed = false;
  let rawOdds: unknown = null;
  try {
    rawOdds = request.transport.loadOdds?.(projected.fixtureId) ?? null;
  } catch {
    oddsFailed = true;
  }
  const odds = resolveOptionalBridgeOdds({
    raw: rawOdds,
    capturedAt: startedAt,
    kickoffUtc: projected.kickoffUtc,
    transportFailed: oddsFailed,
  });

  try {
    const execution = executeLiveCaptureAdapter({
      clock: request.clock,
      capturedAt: startedAt,
      createdAt: startedAt,
      mode,
      persistRoot: request.persistRoot,
      target: universe.target,
      fixtures: universe.fixtures,
      odds: odds.odds,
      simulateCandidateFailure: request.simulateCandidateFailure,
      simulatePersistenceFailure: request.simulatePersistenceFailure,
      simulateEvidenceFailure: request.simulateEvidenceFailure,
    });
    const latestAccepted = execution.provenance?.latestAcceptedKickoff;
    if (latestAccepted && Date.parse(latestAccepted) >= Date.parse(projected.kickoffUtc)) {
      reject("same-kickoff contamination", {
        identityVerified: true,
        minutesToKickoff: minutesBeforeKickoffUtc(projected.kickoffUtc, startedAt),
        finalClassification: execution.classification?.disposition ?? "IN_WINDOW",
        evidenceFixtureCount: execution.provenance?.priorsAccepted ?? 0,
        evidenceCutoff: projected.kickoffUtc,
        sameKickoffExcludedCount,
        targetExcluded,
        oddsDisposition: odds.disposition,
      });
    }
    const capturedNAfter = countPersistedProspectiveN({ persistRoot: request.persistRoot });
    const scoredNAfter = countScoredProspectiveN(request.persistRoot);
    const persisted = execution.capture?.capture?.persisted != null;
    const disposition: CaptureDisposition = persisted ? "CAPTURED" : "DRY_RUN";
    return {
      phase: CAPTURE_BRIDGE_PHASE,
      dryRun: execution.dryRun,
      batch: execution.capture?.batch ?? null,
      report: buildCaptureBridgeReport({
        fixtureId: projected.fixtureId,
        competitionId: projected.competitionId,
        season: projected.season,
        kickoffUtc: projected.kickoffUtc,
        reviewedDiscoveryAtUtc: request.handoff.reviewedDiscoveryAtUtc,
        reviewedClassification: request.handoff.reviewedClassification,
        executionStartedAtUtc: startedAt,
        minutesToKickoff: minutesBeforeKickoffUtc(projected.kickoffUtc, startedAt),
        finalClassification: execution.classification?.disposition ?? "IN_WINDOW",
        identityVerified: true,
        evidenceFixtureCount: execution.provenance?.priorsAccepted ?? 0,
        evidenceCutoff: projected.kickoffUtc,
        sameKickoffExcludedCount,
        targetExcluded,
        oddsDisposition: odds.disposition,
        fiveArmCount: execution.capture?.recordCount ?? 0,
        includeCandidateIds: true,
        captureDisposition: disposition,
        executionMode: mode,
        dryRun: execution.dryRun,
        accounting,
        batchId: execution.capture?.batch?.batchId,
        batchHash: execution.capture?.batch?.batchHash,
        recordsHash: execution.capture?.batch?.recordsHash,
        evidenceManifestHash: execution.capture?.batch?.evidenceManifestHash,
        capturedNBefore,
        capturedNAfter,
        scoredNBefore,
        scoredNAfter,
      }),
    };
  } catch (error) {
    if (error instanceof CaptureBridgeRejectedError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    const classification =
      error instanceof LiveExecutionRejectedError ? error.protocolClassification : "NOT_CLASSIFIED";
    return reject(message, {
      identityVerified: true,
      minutesToKickoff: minutesBeforeKickoffUtc(projected.kickoffUtc, startedAt),
      finalClassification: classification === "NOT_CLASSIFIED" ? "NOT_CLASSIFIED" : classification,
      evidenceFixtureCount: priors.length,
      evidenceCutoff: projected.kickoffUtc,
      sameKickoffExcludedCount,
      targetExcluded,
      oddsDisposition: odds.disposition,
      captureDisposition: /persist/i.test(message) ? "FAILED" : "REJECTED",
    });
  }
}
