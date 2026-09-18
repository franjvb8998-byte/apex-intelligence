/**
 * Chronological train / validation / test assignment.
 * Boundaries are explicit run configuration. Example dates are not defaults.
 */

export type ChronologicalSplit = {
  /** Inclusive train end (ISO). */
  trainThrough: string;
  /** Inclusive validation end (ISO). Must be after trainThrough. */
  validationThrough: string;
  /** Inclusive test start (ISO). Must be after validationThrough. */
  testFrom: string;
};

export type SplitFold = "train" | "validation" | "test";

/**
 * Illustrative example ONLY. Not a universal production calibration boundary
 * and not used as a hidden default by assignChronologicalFold.
 */
export const EXAMPLE_CHRONOLOGICAL_SPLIT: ChronologicalSplit = {
  trainThrough: "2024-12-31T23:59:59.000Z",
  validationThrough: "2025-06-30T23:59:59.000Z",
  testFrom: "2025-07-01T00:00:00.000Z",
};

export class InvalidChronologicalSplitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidChronologicalSplitError";
  }
}

export function assertChronologicalSplit(split: ChronologicalSplit): void {
  const trainThrough = Date.parse(split.trainThrough);
  const validationThrough = Date.parse(split.validationThrough);
  const testFrom = Date.parse(split.testFrom);
  if (
    !Number.isFinite(trainThrough) ||
    !Number.isFinite(validationThrough) ||
    !Number.isFinite(testFrom)
  ) {
    throw new InvalidChronologicalSplitError(
      "Chronological split boundaries must be valid ISO timestamps",
    );
  }
  if (!(trainThrough < validationThrough)) {
    throw new InvalidChronologicalSplitError(
      "trainThrough must be strictly before validationThrough",
    );
  }
  if (!(validationThrough < testFrom)) {
    throw new InvalidChronologicalSplitError(
      "validationThrough must be strictly before testFrom",
    );
  }
}

export function assignChronologicalFold(
  kickoff: string,
  split: ChronologicalSplit,
): SplitFold {
  assertChronologicalSplit(split);
  const t = Date.parse(kickoff);
  if (!Number.isFinite(t)) {
    throw new InvalidChronologicalSplitError(`Invalid kickoff: ${kickoff}`);
  }
  if (t <= Date.parse(split.trainThrough)) return "train";
  if (t <= Date.parse(split.validationThrough)) return "validation";
  if (t >= Date.parse(split.testFrom)) return "test";
  throw new InvalidChronologicalSplitError(
    "Kickoff falls in a gap between validationThrough and testFrom",
  );
}
