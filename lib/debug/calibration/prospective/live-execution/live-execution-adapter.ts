/**
 * Offline live-execution adapter. Synthetic transports only. Default DRY_RUN.
 * Composes frozen 5C.1–5C.5A modules; does not implement a new prediction engine.
 */

import { ProspectiveIntegrityError } from "@/lib/debug/calibration/prospective/candidate-integrity";
import { verifyBatchHashes } from "@/lib/debug/calibration/prospective/capture/capture-integrity";
import { captureProspectiveBatch } from "@/lib/debug/calibration/prospective/capture/capture-runner";
import { loadPriorCaptureIndex } from "@/lib/debug/calibration/prospective/capture/capture-persist";
import type { LiveCaptureBatchFn } from "@/lib/debug/calibration/prospective/live-capture/live-capture-types";
import {
  ACCEPTED_PROSPECTIVE_SEASON,
  LiveCaptureRejectedError,
  type LiveCaptureFixtureInput,
} from "@/lib/debug/calibration/prospective/live-capture/live-capture-types";
import { orchestrateLiveCapture } from "@/lib/debug/calibration/prospective/live-capture/live-capture-orchestrator";
import { PROSPECTIVE_COMPETITION_ID } from "@/lib/debug/calibration/prospective/protocol/protocol-types";
import {
  countPersistedProspectiveN,
  emptyProviderCallAccounting,
} from "@/lib/debug/calibration/prospective/live-execution/live-execution-accounting";
import { buildPreMatchCatalogueEvidence } from "@/lib/debug/calibration/prospective/live-execution/live-execution-evidence";
import { projectOptionalOdds } from "@/lib/debug/calibration/prospective/live-execution/live-execution-odds";
import {
  projectPriorUniverse,
  projectTargetFixture,
} from "@/lib/debug/calibration/prospective/live-execution/live-execution-projection";
import { buildLiveExecutionReport } from "@/lib/debug/calibration/prospective/live-execution/live-execution-report";
import {
  LIVE_EXECUTION_DEFAULT_MODE,
  LIVE_EXECUTION_MODE_PERSIST_PENDING,
  LIVE_EXECUTION_PHASE,
  LiveExecutionRejectedError,
  type LiveExecutionMode,
  type LiveExecutionRequest,
  type LiveExecutionResult,
  type ProjectedTargetFixture,
} from "@/lib/debug/calibration/prospective/live-execution/live-execution-types";
import {
  classifyExecutionFixture,
  recheckFrozenCaptureWindow,
} from "@/lib/debug/calibration/prospective/live-execution/live-execution-window";

function resolveMode(mode: LiveExecutionMode | undefined): LiveExecutionMode {
  return mode ?? LIVE_EXECUTION_DEFAULT_MODE;
}

function reject(
  message: string,
  report: ReturnType<typeof buildLiveExecutionReport>,
  classifications: LiveExecutionRejectedError["classifications"] = [],
): never {
  throw new LiveExecutionRejectedError(message, report, classifications);
}

function integrityCaptureImpl(): LiveCaptureBatchFn {
  return (fixtures, options) => {
    const result = captureProspectiveBatch(fixtures, { ...options, dryRun: true });
    const tampered = { ...result.batch, recordsHash: "integrity-failure" };
    verifyBatchHashes(tampered);
    return result;
  };
}

export function executeLiveCaptureAdapter(request: LiveExecutionRequest): LiveExecutionResult {
  const mode = resolveMode(request.mode);
  const capturedAt = request.capturedAt ?? request.clock.now();
  const createdAt = request.createdAt ?? capturedAt;
  const dryRun = mode !== LIVE_EXECUTION_MODE_PERSIST_PENDING;
  const priorIndex =
    request.priorIndex
    ?? (mode === LIVE_EXECUTION_MODE_PERSIST_PENDING && request.persistRoot
      ? loadPriorCaptureIndex(request.persistRoot)
      : undefined);
  const nBefore = countPersistedProspectiveN({
    priorIndex,
    persistRoot: request.persistRoot,
  });

  if (request.transport?.kind === "live") {
    const placeholder: ProjectedTargetFixture = {
      fixtureId: "unknown",
      competitionId: PROSPECTIVE_COMPETITION_ID,
      season: ACCEPTED_PROSPECTIVE_SEASON,
      kickoffUtc: capturedAt,
      status: "UNKNOWN",
      homeTeamId: "",
      awayTeamId: "",
      homeTeamName: "",
      awayTeamName: "",
    };
    reject(
      "live transport is not authorized in 5C.5B.1",
      buildLiveExecutionReport({
        target: placeholder,
        capturedAt,
        mode,
        prospectiveNBefore: nBefore,
        prospectiveNAfter: nBefore,
      }),
    );
  }

  if (mode === LIVE_EXECUTION_MODE_PERSIST_PENDING && !request.persistRoot) {
    reject(
      "PERSIST_PENDING requires an explicit persistRoot",
      buildLiveExecutionReport({
        target: {
          fixtureId: "unknown",
          competitionId: PROSPECTIVE_COMPETITION_ID,
          season: ACCEPTED_PROSPECTIVE_SEASON,
          kickoffUtc: capturedAt,
          status: "UNKNOWN",
          homeTeamId: "",
          awayTeamId: "",
          homeTeamName: "",
          awayTeamName: "",
        },
        capturedAt,
        mode,
        prospectiveNBefore: nBefore,
        prospectiveNAfter: nBefore,
      }),
    );
  }

  const universe = request.transport?.loadUniverse() ?? {
    target: request.target,
    fixtures: request.fixtures ?? [],
  };
  let target: ProjectedTargetFixture;
  try {
    target = projectTargetFixture(universe.target);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    reject(
      message,
      buildLiveExecutionReport({
        target: {
          fixtureId: "unknown",
          competitionId: String(PROSPECTIVE_COMPETITION_ID),
          season: ACCEPTED_PROSPECTIVE_SEASON,
          kickoffUtc: capturedAt,
          status: "UNKNOWN",
          homeTeamId: "",
          awayTeamId: "",
          homeTeamName: "",
          awayTeamName: "",
        },
        capturedAt,
        mode,
        prospectiveNBefore: nBefore,
        prospectiveNAfter: nBefore,
      }),
    );
  }
  const priors = projectPriorUniverse(universe.fixtures);
  const rawOdds = request.transport?.loadOdds?.(target.fixtureId) ?? request.odds ?? null;

  let report = buildLiveExecutionReport({
    target,
    capturedAt,
    mode,
    prospectiveNBefore: nBefore,
    prospectiveNAfter: nBefore,
  });

  if (request.simulateEvidenceFailure === true) {
    reject("simulated evidence failure", report);
  }

  const evidence = buildPreMatchCatalogueEvidence({
    target,
    universe: priors,
    evidenceAsOf: capturedAt,
  });
  const oddsSnapshot = projectOptionalOdds(rawOdds, capturedAt, target.kickoffUtc);
  const fixture: LiveCaptureFixtureInput = {
    fixtureId: target.fixtureId,
    competitionId: target.competitionId,
    season: target.season,
    kickoffUtc: target.kickoffUtc,
    status: target.status,
    homeTeamId: target.homeTeamId,
    awayTeamId: target.awayTeamId,
    homeTeamName: target.homeTeamName,
    awayTeamName: target.awayTeamName,
    evidenceAsOf: capturedAt,
    preMatchEvidence: {
      home: evidence.home,
      away: evidence.away,
    },
    oddsSnapshot,
  };

  const classification = classifyExecutionFixture({
    fixture,
    capturedAt,
    priorIndex,
  });
  report = buildLiveExecutionReport({
    target,
    capturedAt,
    mode,
    classification: classification?.disposition,
    fixture,
    provenance: evidence.provenance,
    oddsPresent: oddsSnapshot != null,
    prospectiveNBefore: nBefore,
    prospectiveNAfter: nBefore,
  });

  try {
    recheckFrozenCaptureWindow({
      fixture,
      capturedAt,
      priorIndex,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const classifications = error instanceof LiveCaptureRejectedError ? error.classifications : [];
    reject(message, {
      ...report,
      protocolClassification: classifications[0]?.disposition ?? report.protocolClassification,
    }, classifications);
  }

  try {
    const capture = orchestrateLiveCapture({
      fixtures: [fixture],
      clock: request.clock,
      capturedAt,
      createdAt,
      dryRun,
      persistRoot: request.persistRoot,
      priorIndex,
      simulateCandidateFailure: request.simulateCandidateFailure,
      simulateFailureAfterTempWrite: request.simulatePersistenceFailure,
      captureImpl: request.simulateIntegrityFailure === true ? integrityCaptureImpl() : undefined,
    });
    if (capture.batch) verifyBatchHashes(capture.batch);
    const hashVerification = capture.batch ? "PASS" as const : "NOT_RUN";
    const nAfter = dryRun
      ? nBefore
      : countPersistedProspectiveN({ persistRoot: request.persistRoot });
    const persisted = capture.capture?.persisted != null;
    report = buildLiveExecutionReport({
      target,
      capturedAt,
      mode,
      classification: capture.classifications[0]?.disposition ?? classification?.disposition,
      fixture,
      provenance: evidence.provenance,
      oddsPresent: oddsSnapshot != null,
      recordCount: capture.recordCount,
      hashVerification,
      persistenceStatus: persisted ? "PERSISTED" : "NOT_WRITTEN",
      prospectiveNBefore: nBefore,
      prospectiveNAfter: nAfter,
      includeCandidateIds: true,
    });
    return {
      phase: LIVE_EXECUTION_PHASE,
      mode,
      dryRun,
      report,
      capture,
      classification: capture.classifications[0] ?? classification,
      provenance: evidence.provenance,
      projectedTarget: target,
      callAccounting: emptyProviderCallAccounting(),
    };
  } catch (error) {
    if (error instanceof LiveExecutionRejectedError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    const classifications = error instanceof LiveCaptureRejectedError ? error.classifications : [];
    const persistenceFailed =
      request.simulatePersistenceFailure === true
      || error instanceof ProspectiveIntegrityError
      || /persist|integrity/i.test(message);
    reject(message, {
      ...report,
      hashVerification: request.simulateIntegrityFailure === true ? "FAIL" : report.hashVerification,
      persistenceStatus: persistenceFailed ? "FAILED" : "NOT_WRITTEN",
      prospectiveNAfter: countPersistedProspectiveN({ persistRoot: request.persistRoot, priorIndex }),
    }, classifications);
  }
}
