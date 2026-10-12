/**
 * PE-5.2 — in-memory evidence-class tests.
 * No provider calls, no artifact writes, no sealed 2025 outcome reads.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { goalsG1Protocol } from "@/lib/debug/calibration/goals/g1/protocol";
import { buildPe4I21EligibilityContract } from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i21-eligibility";
import { PE4I21_PRODUCTION_WIRING } from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i21-protocol";
import {
  classifyPe5Evidence,
  pe5UnavailableNumeric,
  type Pe5EvidenceInput,
} from "@/lib/debug/calibration/pe5-availability/evidence-class";
import {
  PE5_PINNED_PE4I21_CONTRACT_DIGEST,
  PE5_PRODUCTION_WIRING,
  digestPe5Protocol,
  pe5Protocol,
} from "@/lib/debug/calibration/pe5-availability/protocol";
import { PE3C_C0_RECON_ACTIVATION } from "@/lib/prematch-lifecycle/pe3-activation";

const TARGET_KICKOFF = "2024-08-17T14:00:00.000Z";
const CAPTURED_BEFORE = "2024-08-17T12:30:00.000Z";
const PRIOR_KICKOFF = "2024-08-10T14:00:00.000Z";

function evidence(overrides: Partial<Pe5EvidenceInput> = {}): Pe5EvidenceInput {
  return {
    evidenceId: "snap-1",
    kind: "injury_unavailability",
    provenance: "prospective_snapshot",
    sourceFixtureId: "1001",
    sourceKickoffUtc: TARGET_KICKOFF,
    sourceProviderSeasonId: "2024",
    capturedAtUtc: CAPTURED_BEFORE,
    captureTimestampVerified: true,
    observation: "present",
    observedValue: 2,
    targetFixtureId: "1001",
    targetKickoffUtc: TARGET_KICKOFF,
    targetProviderSeasonId: "2024",
    ...overrides,
  };
}

describe("PE-5.2 evidence classes", () => {
  it("accepts a verified prospective snapshot captured strictly before kickoff", () => {
    const decision = classifyPe5Evidence(evidence());
    expect(decision).toMatchObject({
      ok: true,
      evidenceClass: "PROSPECTIVE_PREMATCH_SNAPSHOT",
      reason: "classified",
      targetPrematchEligible: true,
      laterTargetHistoryEligible: false,
      numericValue: null,
      retainedObservation: 2,
      availability: "classified",
      zeroFilled: false,
    });
    expect(decision.numericValue).not.toBe(0);
  });

  it("keeps a present zero distinct from a missing observation", () => {
    const presentZero = classifyPe5Evidence(evidence({ observedValue: 0 }));
    expect(presentZero.ok).toBe(true);
    expect(presentZero.retainedObservation).toBe(0);
    expect(presentZero.numericValue).toBeNull();
    const missing = classifyPe5Evidence(
      evidence({ observation: "missing", observedValue: null }),
    );
    expect(missing).toMatchObject({
      ok: false,
      evidenceClass: "UNSUPPORTED_OR_UNAVAILABLE",
      reason: "missing_observation",
      numericValue: null,
      retainedObservation: null,
      availability: "unavailable",
      zeroFilled: false,
    });
    expect(pe5UnavailableNumeric()).toBeNull();
  });

  it("rejects a missing observation coerced to zero or paired with a value", () => {
    expect(
      classifyPe5Evidence(
        evidence({ observation: "missing", observedValue: 0 }),
      ).reason,
    ).toBe("missing_coerced_to_zero");
    expect(
      classifyPe5Evidence(
        evidence({ observation: "missing", observedValue: 3 }),
      ).reason,
    ).toBe("missing_observation_has_value");
    expect(
      classifyPe5Evidence(
        evidence({ observedValue: Number.NaN }),
      ).reason,
    ).toBe("non_finite_observation");
  });

  it("refuses fixture kickoff, a missing clock, and an unverified clock as capture time", () => {
    expect(
      classifyPe5Evidence(evidence({ capturedAtUtc: TARGET_KICKOFF })).reason,
    ).toBe("capture_time_is_fixture_kickoff");
    expect(
      classifyPe5Evidence(evidence({ capturedAtUtc: null })).reason,
    ).toBe("missing_capture_timestamp");
    expect(
      classifyPe5Evidence(evidence({ capturedAtUtc: "" })).reason,
    ).toBe("missing_capture_timestamp");
    expect(
      classifyPe5Evidence(
        evidence({ captureTimestampVerified: false }),
      ).reason,
    ).toBe("capture_timestamp_unverified");
    expect(
      classifyPe5Evidence(
        evidence({ capturedAtUtc: "2024-08-17" }),
      ).reason,
    ).toBe("malformed_timestamp");
  });

  it("excludes capture at or after the target kickoff from the pre-match class", () => {
    const atKickoff = classifyPe5Evidence(
      evidence({ capturedAtUtc: "2024-08-17T14:00:00.000Z" }),
    );
    expect(atKickoff.reason).toBe("capture_time_is_fixture_kickoff");
    expect(atKickoff.targetPrematchEligible).toBe(false);
    const after = classifyPe5Evidence(
      evidence({ capturedAtUtc: "2024-08-17T14:00:01.000Z" }),
    );
    expect(after).toMatchObject({
      ok: false,
      evidenceClass: "SAME_MATCH_OR_POST_MATCH_EXCLUDED",
      reason: "not_strictly_before_target",
      targetPrematchEligible: false,
      laterTargetHistoryEligible: false,
    });
  });

  it("keeps same-match realized lineups and minutes out of that match", () => {
    for (const kind of ["confirmed_starting_xi", "rotation_minutes"] as const) {
      const decision = classifyPe5Evidence(
        evidence({
          kind,
          provenance: "realized_matchday",
          captureTimestampVerified: false,
          capturedAtUtc: null,
          observedValue: 11,
        }),
      );
      expect(decision).toMatchObject({
        ok: false,
        evidenceClass: "SAME_MATCH_OR_POST_MATCH_EXCLUDED",
        reason: "same_match_realized_excluded",
        targetPrematchEligible: false,
        laterTargetHistoryEligible: false,
        numericValue: null,
      });
    }
  });

  it("admits prior-match realized evidence only when its kickoff is strictly earlier", () => {
    const prior = classifyPe5Evidence(
      evidence({
        kind: "rotation_minutes",
        provenance: "realized_matchday",
        captureTimestampVerified: false,
        capturedAtUtc: PRIOR_KICKOFF,
        sourceFixtureId: "1000",
        sourceKickoffUtc: PRIOR_KICKOFF,
        observedValue: 78,
      }),
    );
    expect(prior).toMatchObject({
      ok: true,
      evidenceClass: "REALIZED_MATCHDAY_HISTORY",
      targetPrematchEligible: false,
      laterTargetHistoryEligible: true,
      retainedObservation: 78,
      numericValue: null,
    });
    expect(
      classifyPe5Evidence(
        evidence({
          kind: "confirmed_starting_xi",
          provenance: "realized_matchday",
          captureTimestampVerified: false,
          capturedAtUtc: null,
          sourceFixtureId: "1002",
          sourceKickoffUtc: TARGET_KICKOFF,
        }),
      ).reason,
    ).toBe("same_kickoff_excluded");
    expect(
      classifyPe5Evidence(
        evidence({
          kind: "goalkeeper_availability",
          provenance: "realized_matchday",
          captureTimestampVerified: false,
          capturedAtUtc: null,
          sourceFixtureId: "1003",
          sourceKickoffUtc: "2024-08-24T14:00:00.000Z",
        }),
      ).reason,
    ).toBe("not_strictly_before_target");
  });

  it("uses a prior prospective snapshot as history and not as the target pre-match row", () => {
    const decision = classifyPe5Evidence(
      evidence({
        kind: "bench_availability",
        sourceFixtureId: "1000",
        sourceKickoffUtc: PRIOR_KICKOFF,
        capturedAtUtc: "2024-08-10T12:00:00.000Z",
        observedValue: 9,
      }),
    );
    expect(decision).toMatchObject({
      ok: true,
      evidenceClass: "PROSPECTIVE_PREMATCH_SNAPSHOT",
      targetPrematchEligible: false,
      laterTargetHistoryEligible: true,
      retainedObservation: 9,
    });
    expect(
      classifyPe5Evidence(
        evidence({
          sourceFixtureId: "1000",
          sourceKickoffUtc: PRIOR_KICKOFF,
          capturedAtUtc: "2024-08-10T15:00:00.000Z",
        }),
      ).reason,
    ).toBe("capture_not_before_source_kickoff");
  });

  it("leaves current snapshots unproven even when the clock is before kickoff", () => {
    const decision = classifyPe5Evidence(
      evidence({
        provenance: "current_snapshot",
        captureTimestampVerified: false,
        capturedAtUtc: CAPTURED_BEFORE,
      }),
    );
    expect(decision).toMatchObject({
      ok: false,
      evidenceClass: "CURRENT_SNAPSHOT_UNPROVEN",
      reason: "current_snapshot_unproven",
      targetPrematchEligible: false,
      numericValue: null,
      retainedObservation: null,
    });
    expect(
      classifyPe5Evidence(
        evidence({
          provenance: "current_snapshot",
          captureTimestampVerified: true,
        }),
      ).reason,
    ).toBe("ambiguous_provenance");
  });

  it("refuses season aggregates and unsupported squad families", () => {
    expect(
      classifyPe5Evidence(
        evidence({
          kind: "rotation_minutes",
          provenance: "season_aggregate",
          captureTimestampVerified: false,
          capturedAtUtc: null,
          observedValue: 2400,
        }),
      ),
    ).toMatchObject({
      ok: false,
      evidenceClass: "UNSUPPORTED_OR_UNAVAILABLE",
      reason: "season_aggregate_not_prematch",
      numericValue: null,
      retainedObservation: null,
      zeroFilled: false,
    });
    expect(
      classifyPe5Evidence(
        evidence({
          kind: "rotation_minutes",
          provenance: "prospective_snapshot",
        }),
      ).reason,
    ).toBe("ambiguous_provenance");
    for (const kind of [
      "expected_starting_xi",
      "player_importance",
      "international_duty",
      "travel_absence",
      "coach_change",
    ] as const) {
      const decision = classifyPe5Evidence(evidence({ kind }));
      expect(decision.reason).toBe("unsupported_evidence_type");
      expect(decision.numericValue).toBeNull();
      expect(decision.targetPrematchEligible).toBe(false);
    }
    expect(
      classifyPe5Evidence(
        evidence({ provenance: "unsupported", captureTimestampVerified: false }),
      ).reason,
    ).toBe("unsupported_evidence_type");
  });

  it("excludes calendar-2025 and provider-season-2025 targets and sources", () => {
    expect(
      classifyPe5Evidence(
        evidence({
          targetProviderSeasonId: "2025",
          targetKickoffUtc: "2026-01-10T15:00:00.000Z",
          sourceKickoffUtc: "2026-01-10T15:00:00.000Z",
          capturedAtUtc: "2026-01-10T12:00:00.000Z",
        }),
      ).reason,
    ).toBe("holdout_target_excluded");
    expect(
      classifyPe5Evidence(
        evidence({
          targetKickoffUtc: "2025-01-04T15:00:00.000Z",
          sourceKickoffUtc: "2025-01-04T15:00:00.000Z",
          capturedAtUtc: "2025-01-04T12:00:00.000Z",
          targetProviderSeasonId: "2024",
          sourceProviderSeasonId: "2024",
        }),
      ).reason,
    ).toBe("holdout_target_excluded");
    expect(
      classifyPe5Evidence(
        evidence({
          provenance: "realized_matchday",
          captureTimestampVerified: false,
          capturedAtUtc: null,
          sourceFixtureId: "1000",
          sourceProviderSeasonId: "2025",
          sourceKickoffUtc: PRIOR_KICKOFF,
        }),
      ).reason,
    ).toBe("holdout_source_excluded");
    expect(
      classifyPe5Evidence(
        evidence({
          provenance: "realized_matchday",
          captureTimestampVerified: false,
          capturedAtUtc: null,
          kind: "suspension",
          sourceFixtureId: "1000",
          sourceKickoffUtc: "2025-05-11T15:00:00.000Z",
          sourceProviderSeasonId: "2024",
          targetKickoffUtc: "2026-02-01T15:00:00.000Z",
          targetProviderSeasonId: "2024",
        }),
      ).reason,
    ).toBe("holdout_source_excluded");
  });

  it("fails closed on invalid identifiers and ambiguous provenance", () => {
    expect(classifyPe5Evidence(evidence({ evidenceId: "" })).reason).toBe(
      "invalid_identifier",
    );
    expect(classifyPe5Evidence(evidence({ sourceFixtureId: "0" })).reason).toBe(
      "invalid_identifier",
    );
    expect(
      classifyPe5Evidence(evidence({ targetFixtureId: "fixture-a" })).reason,
    ).toBe("invalid_identifier");
    expect(
      classifyPe5Evidence(evidence({ targetProviderSeasonId: "24" })).reason,
    ).toBe("invalid_identifier");
    expect(
      classifyPe5Evidence(evidence({ sourceKickoffUtc: "2024-08-17T14:00:00" }))
        .reason,
    ).toBe("malformed_timestamp");
    expect(
      classifyPe5Evidence(
        evidence({
          provenance: "realized_matchday",
          captureTimestampVerified: true,
          capturedAtUtc: null,
        }),
      ).reason,
    ).toBe("ambiguous_provenance");
    expect(
      classifyPe5Evidence(
        evidence({
          sourceKickoffUtc: "2024-08-17T15:00:00.000Z",
        }),
      ).reason,
    ).toBe("ambiguous_provenance");
    const unknown = evidence();
    (unknown as { provenance: string }).provenance = "vendor_guess";
    expect(classifyPe5Evidence(unknown).reason).toBe("ambiguous_provenance");
  });

  it("rejects impossible civil dates as capture times and as kickoffs", () => {
    const impossible = [
      "2024-02-31T12:00:00.000Z",
      "2024-08-17T24:00:00.000Z",
      "2023-02-29T00:00:00.000Z",
    ] as const;
    for (const stamp of impossible) {
      expect(
        classifyPe5Evidence(evidence({ capturedAtUtc: stamp })),
      ).toMatchObject({
        ok: false,
        reason: "malformed_timestamp",
        targetPrematchEligible: false,
        laterTargetHistoryEligible: false,
        numericValue: null,
      });
      expect(
        classifyPe5Evidence(
          evidence({
            sourceKickoffUtc: stamp,
            capturedAtUtc: "2024-01-01T00:00:00.000Z",
          }),
        ).reason,
      ).toBe("malformed_timestamp");
      expect(
        classifyPe5Evidence(
          evidence({
            sourceFixtureId: "1000",
            sourceKickoffUtc: "2024-01-01T12:00:00.000Z",
            targetKickoffUtc: stamp,
            capturedAtUtc: "2023-12-01T00:00:00.000Z",
          }),
        ).reason,
      ).toBe("malformed_timestamp");
    }
  });

  it("accepts the 2024 leap day and supported fractional-second UTC forms", () => {
    expect(
      classifyPe5Evidence(
        evidence({
          sourceKickoffUtc: "2024-02-29T15:00:00.000Z",
          targetKickoffUtc: "2024-02-29T15:00:00.000Z",
          capturedAtUtc: "2024-02-29T12:30:00.000Z",
        }),
      ),
    ).toMatchObject({
      ok: true,
      evidenceClass: "PROSPECTIVE_PREMATCH_SNAPSHOT",
      targetPrematchEligible: true,
    });
    expect(
      classifyPe5Evidence(evidence({ capturedAtUtc: "2024-08-17T12:30:00Z" })).ok,
    ).toBe(true);
    for (const capturedAtUtc of [
      "2024-08-17T12:30:00.1Z",
      "2024-08-17T12:30:00.10Z",
      "2024-08-17T12:30:00.100Z",
    ] as const) {
      expect(classifyPe5Evidence(evidence({ capturedAtUtc })).ok).toBe(true);
    }
  });

  it("rejects non-boolean capture attestations", () => {
    for (const captureTimestampVerified of ["yes", 1, {}, null, undefined]) {
      const decision = classifyPe5Evidence(
        evidence({
          captureTimestampVerified: captureTimestampVerified as never,
        }),
      );
      expect(decision).toMatchObject({
        ok: false,
        reason: "ambiguous_provenance",
        targetPrematchEligible: false,
        laterTargetHistoryEligible: false,
        numericValue: null,
      });
    }
  });

  it("excludes a prospective snapshot of a different fixture at the same kickoff", () => {
    expect(
      classifyPe5Evidence(
        evidence({
          sourceFixtureId: "1000",
          sourceKickoffUtc: TARGET_KICKOFF,
          capturedAtUtc: "2024-08-17T12:00:00.000Z",
        }),
      ),
    ).toMatchObject({
      ok: false,
      evidenceClass: "SAME_MATCH_OR_POST_MATCH_EXCLUDED",
      reason: "same_kickoff_excluded",
      targetPrematchEligible: false,
      laterTargetHistoryEligible: false,
    });
  });

  it("retains a present negative and a present null without writing zero", () => {
    // Current numeric contract: these values are not a domain error and are not filled.
    expect(classifyPe5Evidence(evidence({ observedValue: -1 }))).toMatchObject({
      ok: true,
      targetPrematchEligible: true,
      retainedObservation: -1,
      numericValue: null,
      zeroFilled: false,
    });
    expect(classifyPe5Evidence(evidence({ observedValue: null }))).toMatchObject({
      ok: true,
      targetPrematchEligible: true,
      retainedObservation: null,
      numericValue: null,
      zeroFilled: false,
    });
  });

  it("classifies suspensions, benches, and goalkeepers under the same pre-match rule", () => {
    for (const kind of [
      "suspension",
      "bench_availability",
      "goalkeeper_availability",
      "confirmed_starting_xi",
    ] as const) {
      expect(classifyPe5Evidence(evidence({ kind })).ok).toBe(true);
    }
  });

  it("is deterministic and isolates production, C0, G1, and the PE-4I.21 digest", () => {
    expect(classifyPe5Evidence(evidence())).toEqual(classifyPe5Evidence(evidence()));
    const protocol = pe5Protocol();
    expect(protocol.productionWiring).toBe(false);
    expect(protocol.providerCallsForbidden).toBe(true);
    expect(protocol.artifactWritesForbidden).toBe(true);
    expect(protocol.acquisitionAuthorized).toBe(false);
    expect(protocol.pe53Authorized).toBe(false);
    expect(PE5_PRODUCTION_WIRING).toBe(false);
    expect(digestPe5Protocol()).toBe(
      "b9598e27d654177ed322e6db671842b2c6c2378e9450be11e7ecc66727f1cbd9",
    );
    expect(PE4I21_PRODUCTION_WIRING).toBe(false);
    expect(PE3C_C0_RECON_ACTIVATION).toBe(false);
    expect(goalsG1Protocol(10).selectedShrinkageK).toBe(10);
    const contract = buildPe4I21EligibilityContract();
    expect(contract.contractDigest).toBe(PE5_PINNED_PE4I21_CONTRACT_DIGEST);
    expect(contract.labelsRead).toBe(false);
    expect(contract.providerCallsMade).toBe(0);
    const root = path.join(
      process.cwd(),
      "lib/debug/calibration/pe5-availability",
    );
    const protocolSource = readFileSync(path.join(root, "protocol.ts"), "utf8");
    const classSource = readFileSync(
      path.join(root, "evidence-class.ts"),
      "utf8",
    );
    for (const source of [protocolSource, classSource]) {
      expect(source).not.toMatch(/node:fs|node:http|from "fs"|fetch\(/);
      expect(source).not.toMatch(/prematch-lifecycle|match-center|scheduler/);
    }
  });
});
