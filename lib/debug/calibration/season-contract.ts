/**
 * Fail-closed contracts for the debug microcollector.
 * Does not change production client semantics.
 */

import { apiFootballVendorErrorText } from "@/lib/data-platform/providers/api-football/cache-policy";
import type { ApiFootballFixturesResponse } from "@/lib/data-platform/providers/api-football/types";
import { MICROCOLLECTION_TARGET_COUNT } from "@/lib/debug/calibration/micro-shape";

export class MicrocollectEmptySeasonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MicrocollectEmptySeasonError";
  }
}

export class MicrocollectVendorEnvelopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MicrocollectVendorEnvelopeError";
  }
}

export class MicrocollectNoEligibleTargetsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MicrocollectNoEligibleTargetsError";
  }
}

export class MicrocollectTargetShortfallError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MicrocollectTargetShortfallError";
  }
}

/**
 * HTTP 200 + response=[] is not a valid empty season.
 * API-Football can put parameter/subscription errors in a 200 envelope.
 */
export function assertCalibrationFixtureEnvelope(
  payload: ApiFootballFixturesResponse,
): void {
  const errorText = apiFootballVendorErrorText(payload);
  if (errorText) {
    throw new MicrocollectVendorEnvelopeError(
      `API-Football fixture envelope errors are non-empty: ${errorText}`,
    );
  }
  if (payload.results === 0) {
    throw new MicrocollectEmptySeasonError(
      "API-Football fixture envelope results=0; refusing empty season as a successful collection",
    );
  }
  const count = payload.response?.length ?? 0;
  if (count === 0) {
    throw new MicrocollectEmptySeasonError(
      "API-Football fixture response.length=0; HTTP/envelope success is not a valid empty season",
    );
  }
}

export function assertMicrocollectionTargetContract(input: {
  fixtureCount: number;
  eligibleCount: number;
  selectedCount: number;
  expectedTargetCount?: number;
  allowShortfall?: boolean;
}): void {
  const expectedTargetCount =
    input.expectedTargetCount ?? MICROCOLLECTION_TARGET_COUNT;
  if (input.fixtureCount === 0) {
    throw new MicrocollectEmptySeasonError(
      "Mapped fixture count is 0; refusing empty season as a successful collection",
    );
  }
  if (input.eligibleCount === 0) {
    throw new MicrocollectNoEligibleTargetsError(
      "Eligible completed fixture count is 0; refusing microcollection without countable FT/AET/PEN targets",
    );
  }
  if (input.selectedCount < expectedTargetCount && input.allowShortfall !== true) {
    throw new MicrocollectTargetShortfallError(
      `Selected ${input.selectedCount} targets from ${input.eligibleCount} eligible fixtures; requested ${expectedTargetCount} (set allowShortfall only for an intentional short run)`,
    );
  }
}
