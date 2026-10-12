/**
 * PE-5.2 — classify squad evidence without acquiring it.
 * Fail closed. Missing stays null. Fixture kickoff is not a capture time.
 */

import {
  PE5_PROSPECTIVE_KINDS,
  PE5_PROVENANCE_VALUES,
  PE5_REALIZED_KINDS,
  PE5_UNSUPPORTED_KINDS,
  type Pe5EvidenceClass,
  type Pe5EvidenceProvenance,
  type Pe5FailReason,
  type Pe5SquadEvidenceKind,
} from "@/lib/debug/calibration/pe5-availability/protocol";
import { classifyHoldoutForResearch } from "@/lib/debug/calibration/pe4-as-of-t-features/holdout-firewall";

const FIXTURE_ID_RE = /^[1-9]\d{0,11}$/;
const EVIDENCE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/;
const SEASON_RE = /^(19|20|21)\d{2}$/;
const UTC_TIMESTAMP_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/;

const PROSPECTIVE_KIND_SET = new Set<string>(PE5_PROSPECTIVE_KINDS);
const REALIZED_KIND_SET = new Set<string>(PE5_REALIZED_KINDS);
const UNSUPPORTED_KIND_SET = new Set<string>(PE5_UNSUPPORTED_KINDS);
const PROVENANCE_SET = new Set<string>(PE5_PROVENANCE_VALUES);

export type Pe5EvidenceInput = {
  evidenceId: string;
  kind: Pe5SquadEvidenceKind;
  provenance: Pe5EvidenceProvenance;
  sourceFixtureId: string;
  sourceKickoffUtc: string;
  sourceProviderSeasonId: string;
  /** Null when no capture clock was stored. Do not copy fixture kickoff here. */
  capturedAtUtc: string | null;
  /** True only when capturedAtUtc is an attested capture clock. */
  captureTimestampVerified: boolean;
  observation: "present" | "missing";
  /** Present counts may be zero. Missing observations must pass null. */
  observedValue: number | null;
  targetFixtureId: string;
  targetKickoffUtc: string;
  targetProviderSeasonId: string;
};

export type Pe5EvidenceDecision = {
  ok: boolean;
  evidenceClass: Pe5EvidenceClass;
  reason: Pe5FailReason | "classified";
  targetPrematchEligible: boolean;
  laterTargetHistoryEligible: boolean;
  /** Protocol output never materializes a squad number. */
  numericValue: null;
  /** Raw count retained only on an eligible present observation. */
  retainedObservation: number | null;
  availability: "classified" | "unavailable";
  zeroFilled: false;
};

/** Squad features this protocol refuses to invent. Always null. */
export function pe5UnavailableNumeric(): null {
  return null;
}

export function classifyPe5Evidence(input: Pe5EvidenceInput): Pe5EvidenceDecision {
  if (!EVIDENCE_ID_RE.test(input.evidenceId)) {
    return reject("invalid_identifier", "UNSUPPORTED_OR_UNAVAILABLE");
  }
  if (
    !FIXTURE_ID_RE.test(input.sourceFixtureId) ||
    !FIXTURE_ID_RE.test(input.targetFixtureId)
  ) {
    return reject("invalid_identifier", "UNSUPPORTED_OR_UNAVAILABLE");
  }
  if (
    !SEASON_RE.test(input.sourceProviderSeasonId) ||
    !SEASON_RE.test(input.targetProviderSeasonId)
  ) {
    return reject("invalid_identifier", "UNSUPPORTED_OR_UNAVAILABLE");
  }
  if (
    input.observation !== "present" &&
    input.observation !== "missing"
  ) {
    return reject("ambiguous_provenance", "UNSUPPORTED_OR_UNAVAILABLE");
  }
  if (!PROVENANCE_SET.has(input.provenance)) {
    return reject("ambiguous_provenance", "UNSUPPORTED_OR_UNAVAILABLE");
  }
  if (typeof input.captureTimestampVerified !== "boolean") {
    return reject("ambiguous_provenance", "UNSUPPORTED_OR_UNAVAILABLE");
  }
  if (
    !PROSPECTIVE_KIND_SET.has(input.kind) &&
    !REALIZED_KIND_SET.has(input.kind) &&
    !UNSUPPORTED_KIND_SET.has(input.kind)
  ) {
    return reject("unsupported_evidence_type", "UNSUPPORTED_OR_UNAVAILABLE");
  }

  const sourceKickoffMs = utcMillis(input.sourceKickoffUtc);
  const targetKickoffMs = utcMillis(input.targetKickoffUtc);
  if (sourceKickoffMs == null || targetKickoffMs == null) {
    return reject("malformed_timestamp", "UNSUPPORTED_OR_UNAVAILABLE");
  }

  const targetHoldout = classifyHoldoutForResearch({
    kickoffUtc: input.targetKickoffUtc,
    providerSeasonId: input.targetProviderSeasonId,
  });
  if (targetHoldout !== "dev_or_conf_eligible") {
    return reject("holdout_target_excluded", "UNSUPPORTED_OR_UNAVAILABLE");
  }
  const sourceHoldout = classifyHoldoutForResearch({
    kickoffUtc: input.sourceKickoffUtc,
    providerSeasonId: input.sourceProviderSeasonId,
  });
  if (sourceHoldout !== "dev_or_conf_eligible") {
    return reject("holdout_source_excluded", "UNSUPPORTED_OR_UNAVAILABLE");
  }

  if (input.observation === "missing") {
    if (input.observedValue === 0) {
      return reject("missing_coerced_to_zero", "UNSUPPORTED_OR_UNAVAILABLE");
    }
    if (input.observedValue != null) {
      return reject("missing_observation_has_value", "UNSUPPORTED_OR_UNAVAILABLE");
    }
  } else if (
    input.observedValue != null &&
    !Number.isFinite(input.observedValue)
  ) {
    return reject("non_finite_observation", "UNSUPPORTED_OR_UNAVAILABLE");
  }

  if (UNSUPPORTED_KIND_SET.has(input.kind) || input.provenance === "unsupported") {
    return reject("unsupported_evidence_type", "UNSUPPORTED_OR_UNAVAILABLE");
  }
  if (input.provenance === "season_aggregate") {
    return reject("season_aggregate_not_prematch", "UNSUPPORTED_OR_UNAVAILABLE");
  }
  if (input.observation === "missing") {
    return reject("missing_observation", "UNSUPPORTED_OR_UNAVAILABLE");
  }

  if (input.provenance === "current_snapshot") {
    if (input.captureTimestampVerified === true) {
      return reject("ambiguous_provenance", "CURRENT_SNAPSHOT_UNPROVEN");
    }
    return reject("current_snapshot_unproven", "CURRENT_SNAPSHOT_UNPROVEN");
  }

  if (input.provenance === "prospective_snapshot") {
    return classifyProspective(input, sourceKickoffMs, targetKickoffMs);
  }

  return classifyRealized(input, sourceKickoffMs, targetKickoffMs);
}

function classifyProspective(
  input: Pe5EvidenceInput,
  sourceKickoffMs: number,
  targetKickoffMs: number,
): Pe5EvidenceDecision {
  const conflict = conflictingFixtureKickoff(input, sourceKickoffMs, targetKickoffMs);
  if (conflict) return conflict;
  if (!PROSPECTIVE_KIND_SET.has(input.kind)) {
    return reject("ambiguous_provenance", "UNSUPPORTED_OR_UNAVAILABLE");
  }
  if (input.captureTimestampVerified !== true) {
    return reject("capture_timestamp_unverified", "CURRENT_SNAPSHOT_UNPROVEN");
  }
  if (input.capturedAtUtc == null || input.capturedAtUtc === "") {
    return reject("missing_capture_timestamp", "CURRENT_SNAPSHOT_UNPROVEN");
  }
  const capturedMs = utcMillis(input.capturedAtUtc);
  if (capturedMs == null) {
    return reject("malformed_timestamp", "UNSUPPORTED_OR_UNAVAILABLE");
  }
  if (
    capturedMs === sourceKickoffMs ||
    capturedMs === targetKickoffMs ||
    input.capturedAtUtc === input.sourceKickoffUtc ||
    input.capturedAtUtc === input.targetKickoffUtc
  ) {
    return reject(
      "capture_time_is_fixture_kickoff",
      "CURRENT_SNAPSHOT_UNPROVEN",
    );
  }
  if (capturedMs >= targetKickoffMs) {
    return reject(
      "not_strictly_before_target",
      "SAME_MATCH_OR_POST_MATCH_EXCLUDED",
    );
  }
  if (capturedMs >= sourceKickoffMs) {
    return reject(
      "capture_not_before_source_kickoff",
      "SAME_MATCH_OR_POST_MATCH_EXCLUDED",
    );
  }

  const sameFixture = input.sourceFixtureId === input.targetFixtureId;
  if (sameFixture) {
    return accept({
      evidenceClass: "PROSPECTIVE_PREMATCH_SNAPSHOT",
      targetPrematchEligible: true,
      laterTargetHistoryEligible: false,
      retainedObservation: input.observedValue,
    });
  }
  if (sourceKickoffMs === targetKickoffMs) {
    return reject(
      "same_kickoff_excluded",
      "SAME_MATCH_OR_POST_MATCH_EXCLUDED",
    );
  }
  if (sourceKickoffMs > targetKickoffMs) {
    return reject(
      "not_strictly_before_target",
      "SAME_MATCH_OR_POST_MATCH_EXCLUDED",
    );
  }
  return accept({
    evidenceClass: "PROSPECTIVE_PREMATCH_SNAPSHOT",
    targetPrematchEligible: false,
    laterTargetHistoryEligible: true,
    retainedObservation: input.observedValue,
  });
}

function classifyRealized(
  input: Pe5EvidenceInput,
  sourceKickoffMs: number,
  targetKickoffMs: number,
): Pe5EvidenceDecision {
  const conflict = conflictingFixtureKickoff(input, sourceKickoffMs, targetKickoffMs);
  if (conflict) return conflict;
  if (input.provenance !== "realized_matchday") {
    return reject("ambiguous_provenance", "UNSUPPORTED_OR_UNAVAILABLE");
  }
  if (input.captureTimestampVerified === true) {
    return reject("ambiguous_provenance", "SAME_MATCH_OR_POST_MATCH_EXCLUDED");
  }
  if (!REALIZED_KIND_SET.has(input.kind)) {
    return reject("unsupported_evidence_type", "UNSUPPORTED_OR_UNAVAILABLE");
  }
  if (input.sourceFixtureId === input.targetFixtureId) {
    return reject(
      "same_match_realized_excluded",
      "SAME_MATCH_OR_POST_MATCH_EXCLUDED",
    );
  }
  if (sourceKickoffMs === targetKickoffMs) {
    return reject(
      "same_kickoff_excluded",
      "SAME_MATCH_OR_POST_MATCH_EXCLUDED",
    );
  }
  if (sourceKickoffMs > targetKickoffMs) {
    return reject(
      "not_strictly_before_target",
      "SAME_MATCH_OR_POST_MATCH_EXCLUDED",
    );
  }
  return accept({
    evidenceClass: "REALIZED_MATCHDAY_HISTORY",
    targetPrematchEligible: false,
    laterTargetHistoryEligible: true,
    retainedObservation: input.observedValue,
  });
}

function conflictingFixtureKickoff(
  input: Pe5EvidenceInput,
  sourceKickoffMs: number,
  targetKickoffMs: number,
): Pe5EvidenceDecision | null {
  if (
    input.sourceFixtureId === input.targetFixtureId &&
    sourceKickoffMs !== targetKickoffMs
  ) {
    return reject("ambiguous_provenance", "UNSUPPORTED_OR_UNAVAILABLE");
  }
  return null;
}

/**
 * PE-5 clock. The shared PE-4 parser is not used: ECMAScript Date.parse
 * normalizes impossible civil dates, and those instants must fail closed.
 * One to three fractional digits are tenths, hundredths, and milliseconds.
 */
function utcMillis(value: string): number | null {
  const match = UTC_TIMESTAMP_RE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const fraction = match[7];
  const millisecond = fraction == null ? 0 : Number(fraction.padEnd(3, "0"));
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    millisecond > 999
  ) {
    return null;
  }
  const instant = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  if (!Number.isFinite(instant)) return null;
  const roundTrip = new Date(instant);
  if (
    roundTrip.getUTCFullYear() !== year ||
    roundTrip.getUTCMonth() !== month - 1 ||
    roundTrip.getUTCDate() !== day ||
    roundTrip.getUTCHours() !== hour ||
    roundTrip.getUTCMinutes() !== minute ||
    roundTrip.getUTCSeconds() !== second ||
    roundTrip.getUTCMilliseconds() !== millisecond
  ) {
    return null;
  }
  return instant;
}

function accept(input: {
  evidenceClass: "PROSPECTIVE_PREMATCH_SNAPSHOT" | "REALIZED_MATCHDAY_HISTORY";
  targetPrematchEligible: boolean;
  laterTargetHistoryEligible: boolean;
  retainedObservation: number | null;
}): Pe5EvidenceDecision {
  return {
    ok: true,
    evidenceClass: input.evidenceClass,
    reason: "classified",
    targetPrematchEligible: input.targetPrematchEligible,
    laterTargetHistoryEligible: input.laterTargetHistoryEligible,
    numericValue: pe5UnavailableNumeric(),
    retainedObservation: input.retainedObservation,
    availability: "classified",
    zeroFilled: false,
  };
}

function reject(
  reason: Pe5FailReason,
  evidenceClass: Pe5EvidenceClass,
): Pe5EvidenceDecision {
  return {
    ok: false,
    evidenceClass,
    reason,
    targetPrematchEligible: false,
    laterTargetHistoryEligible: false,
    numericValue: pe5UnavailableNumeric(),
    retainedObservation: null,
    availability: "unavailable",
    zeroFilled: false,
  };
}
