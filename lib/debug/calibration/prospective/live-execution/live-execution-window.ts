/**
 * Final frozen-window recheck. Composes 5C.5A/5C.3 eligibility; does not redefine T-75/T-60/T-45.
 */

import {
  assertAllFixturesEligible,
  classifyLiveCaptureFixtures,
} from "@/lib/debug/calibration/prospective/live-capture/live-capture-eligibility";
import type { LiveCaptureFixtureInput } from "@/lib/debug/calibration/prospective/live-capture/live-capture-types";
import type { PriorCaptureIndex } from "@/lib/debug/calibration/prospective/capture/capture-types";
import type { PlannerClassification } from "@/lib/debug/calibration/prospective/protocol/protocol-types";

export function recheckFrozenCaptureWindow(input: {
  fixture: LiveCaptureFixtureInput;
  capturedAt: string;
  priorIndex?: PriorCaptureIndex;
}): PlannerClassification[] {
  return assertAllFixturesEligible({
    fixtures: [input.fixture],
    clock: { now: () => input.capturedAt },
    capturedAt: input.capturedAt,
    priorIndex: input.priorIndex,
  });
}

export function classifyExecutionFixture(input: {
  fixture: LiveCaptureFixtureInput;
  capturedAt: string;
  priorIndex?: PriorCaptureIndex;
}): PlannerClassification | null {
  return classifyLiveCaptureFixtures([input.fixture], input.capturedAt, input.priorIndex)[0] ?? null;
}
