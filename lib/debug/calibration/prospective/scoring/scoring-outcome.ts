/**
 * Final-outcome projection and H/D/A class. Reuses frozen reconstruct outcomeFromScore.
 */

import { outcomeFromScore } from "@/lib/debug/calibration/reconstruct";
import type { CalibrationOutcome } from "@/lib/debug/calibration/types";
import {
  ALLOWED_FINAL_STATUSES,
  type AllowedFinalStatus,
  type ObservedClass,
  type ProspectiveFinalOutcome,
} from "@/lib/debug/calibration/prospective/scoring/scoring-types";
import {
  ScoringRejectedError,
  emptyScoringReport,
} from "@/lib/debug/calibration/prospective/scoring/scoring-types";

export function toCalibrationOutcome(observed: ObservedClass): CalibrationOutcome {
  if (observed === "HOME") return "home";
  if (observed === "AWAY") return "away";
  return "draw";
}

export function fromCalibrationOutcome(actual: CalibrationOutcome): ObservedClass {
  if (actual === "home") return "HOME";
  if (actual === "away") return "AWAY";
  return "DRAW";
}

export function deriveObservedClass(homeGoals: number, awayGoals: number): ObservedClass {
  return fromCalibrationOutcome(outcomeFromScore(homeGoals, awayGoals));
}

export function isAllowedFinalStatus(status: string): status is AllowedFinalStatus {
  return (ALLOWED_FINAL_STATUSES as readonly string[]).includes(status);
}

export function assertValidFinalOutcome(outcome: ProspectiveFinalOutcome): void {
  if (!outcome.fixtureId.trim()) {
    throw new ScoringRejectedError("outcome fixtureId is missing", emptyScoringReport());
  }
  if (outcome.provenance !== "synthetic") {
    throw new ScoringRejectedError("5C.6 accepts synthetic outcomes only", emptyScoringReport());
  }
  if (!isAllowedFinalStatus(outcome.finalStatus)) {
    throw new ScoringRejectedError(
      `non-final status ${outcome.finalStatus} rejected`,
      emptyScoringReport({ fixtureId: outcome.fixtureId }),
    );
  }
  if (!Number.isInteger(outcome.homeGoals) || !Number.isInteger(outcome.awayGoals)) {
    throw new ScoringRejectedError(
      "final goals must be integers",
      emptyScoringReport({ fixtureId: outcome.fixtureId }),
    );
  }
  if (outcome.homeGoals < 0 || outcome.awayGoals < 0) {
    throw new ScoringRejectedError(
      "negative goals rejected",
      emptyScoringReport({ fixtureId: outcome.fixtureId }),
    );
  }
}
