/**
 * PE-5.2 — offline squad evidence-class protocol.
 * Research classification only. No collector, no provider calls, no artifacts.
 */

import { createHash } from "node:crypto";

export const PE5_PROTOCOL_VERSION =
  "pe5.offline_evidence_class_protocol.v1" as const;
export const PE5_SCHEMA_VERSION =
  "pe5.offline_evidence_class_protocol.schema.v1" as const;
export const PE5_PRODUCTION_WIRING = false as const;

/**
 * Logical PE-4I.21 contract digest. PE-5.2 reads this pin.
 * It does not recompute or rewrite the PE-4 contract.
 */
export const PE5_PINNED_PE4I21_CONTRACT_DIGEST =
  "f204eca3f3851af8d0c276fb09c81e7d99c39bc7873d1cd8963cad9a74dcd76c" as const;

export const PE5_EVIDENCE_CLASSES = [
  "PROSPECTIVE_PREMATCH_SNAPSHOT",
  "REALIZED_MATCHDAY_HISTORY",
  "CURRENT_SNAPSHOT_UNPROVEN",
  "SAME_MATCH_OR_POST_MATCH_EXCLUDED",
  "UNSUPPORTED_OR_UNAVAILABLE",
] as const;

export type Pe5EvidenceClass = (typeof PE5_EVIDENCE_CLASSES)[number];

/** Families a verified pre-kickoff snapshot is allowed to carry. */
export const PE5_PROSPECTIVE_KINDS = [
  "injury_unavailability",
  "suspension",
  "confirmed_starting_xi",
  "bench_availability",
  "goalkeeper_availability",
] as const;

/** Prior-match evidence usable only when its kickoff is strictly earlier. */
export const PE5_REALIZED_KINDS = [
  ...PE5_PROSPECTIVE_KINDS,
  "rotation_minutes",
] as const;

/** No supported pre-match or realized-history source in this protocol. */
export const PE5_UNSUPPORTED_KINDS = [
  "expected_starting_xi",
  "player_importance",
  "international_duty",
  "travel_absence",
  "coach_change",
] as const;

export const PE5_EVIDENCE_KINDS = [
  ...PE5_REALIZED_KINDS,
  ...PE5_UNSUPPORTED_KINDS,
] as const;

export type Pe5SquadEvidenceKind = (typeof PE5_EVIDENCE_KINDS)[number];

export const PE5_PROVENANCE_VALUES = [
  "prospective_snapshot",
  "realized_matchday",
  "current_snapshot",
  "season_aggregate",
  "unsupported",
] as const;

export type Pe5EvidenceProvenance = (typeof PE5_PROVENANCE_VALUES)[number];

export const PE5_FAIL_REASONS = [
  "invalid_identifier",
  "malformed_timestamp",
  "missing_capture_timestamp",
  "capture_timestamp_unverified",
  "capture_time_is_fixture_kickoff",
  "capture_not_before_source_kickoff",
  "ambiguous_provenance",
  "unsupported_evidence_type",
  "season_aggregate_not_prematch",
  "missing_coerced_to_zero",
  "missing_observation_has_value",
  "missing_observation",
  "holdout_target_excluded",
  "holdout_source_excluded",
  "same_match_realized_excluded",
  "same_kickoff_excluded",
  "not_strictly_before_target",
  "current_snapshot_unproven",
  "non_finite_observation",
] as const;

export type Pe5FailReason = (typeof PE5_FAIL_REASONS)[number];

export function pe5Protocol() {
  return {
    protocolVersion: PE5_PROTOCOL_VERSION,
    schemaVersion: PE5_SCHEMA_VERSION,
    scope: "research_calibration_offline_evidence_classes_only" as const,
    productionWiring: PE5_PRODUCTION_WIRING,
    providerCallsForbidden: true as const,
    artifactWritesForbidden: true as const,
    collectorAuthorized: false as const,
    acquisitionAuthorized: false as const,
    pe53Authorized: false as const,
    modelingForbidden: true as const,
    noWeights: true as const,
    noOddsEv: true as const,
    no2025Unsealing: true as const,
    missingStaysNull: true as const,
    pinnedPe4I21ContractDigest: PE5_PINNED_PE4I21_CONTRACT_DIGEST,
    evidenceClasses: PE5_EVIDENCE_CLASSES,
    prospectiveKinds: PE5_PROSPECTIVE_KINDS,
    realizedKinds: PE5_REALIZED_KINDS,
    unsupportedKinds: PE5_UNSUPPORTED_KINDS,
  };
}

export function digestPe5Protocol(): string {
  return createHash("sha256")
    .update(JSON.stringify(pe5Protocol()), "utf8")
    .digest("hex");
}
