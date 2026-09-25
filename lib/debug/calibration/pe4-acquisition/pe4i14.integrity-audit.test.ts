/**
 * PE-4I.14 — Offline integrity audit tests. Zero provider calls.
 */

import { describe, expect, it } from "vitest";
import { PE3C_C0_RECON_ACTIVATION } from "@/lib/prematch-lifecycle/pe3-activation";
import { resolvePe4HistoricalExpectation } from "@/lib/prematch-decision/pe4-form-schedule/expectation-contract";
import { goalsG1Protocol } from "@/lib/debug/calibration/goals/g1/protocol";
import {
  classifyPe4I14ObservedXgLabel,
  pe4I14LocalCachePresent,
  runPe4I14IntegrityAudit,
  PE4I14_EXPECTED_CACHE_HITS,
  PE4I14_EXPECTED_CALENDAR_2025_SEALED,
  PE4I14_EXPECTED_QUEUE_DIGEST,
  PE4I14_EXPECTED_QUEUE_SIZE,
} from "@/lib/debug/calibration/pe4-acquisition/pe4i14-integrity-audit";

describe("PE-4I.14 integrity audit", () => {
  it("keeps safety pins", () => {
    expect(PE3C_C0_RECON_ACTIVATION).toBe(false);
    expect(
      resolvePe4HistoricalExpectation({
        targetStrengthCommon: 1600,
        opponentStrengthCommon: 1500,
        targetVenueRole: "HOME",
        pairwiseAvailable: true,
        historicalCutoffUtc: "2024-01-01T00:00:00.000Z",
        targetSource: "catalogue",
        opponentSource: "catalogue",
      }).status,
    ).toBe("UNAVAILABLE");
    expect(goalsG1Protocol(10).selectedShrinkageK).toBe(10);
  });

  it("classifies observed-sample xG labels with Stage-2E+ thresholds", () => {
    expect(classifyPe4I14ObservedXgLabel(0.9)).toBe(
      "XG_CAPABLE_IN_OBSERVED_SAMPLE",
    );
    expect(classifyPe4I14ObservedXgLabel(0.5)).toBe(
      "XG_PARTIAL_IN_OBSERVED_SAMPLE",
    );
    expect(classifyPe4I14ObservedXgLabel(0.49)).toBe(
      "XG_UNAVAILABLE_IN_OBSERVED_SAMPLE",
    );
  });

  it("runs offline against local cache when present (skip gracefully otherwise)", () => {
    if (!pe4I14LocalCachePresent()) {
      // CI without gitignored calibration cache
      expect(true).toBe(true);
      return;
    }

    const report = runPe4I14IntegrityAudit({
      writeArtifacts: true,
      compareRuns: true,
    });

    expect(report.providerCallsMade).toBe(0);
    expect(report.preflight.pass).toBe(true);
    expect(report.A_queue.digest).toBe(PE4I14_EXPECTED_QUEUE_DIGEST);
    expect(report.A_queue.size).toBe(PE4I14_EXPECTED_QUEUE_SIZE);
    expect(report.preflight.statisticsCacheHits).toBe(PE4I14_EXPECTED_CACHE_HITS);
    expect(report.preflight.uncached).toBe(0);
    expect(report.D_join.missingEnvelope).toBe(0);
    expect(report.D_join.withExactlyOneCompletedEnvelope).toBe(
      PE4I14_EXPECTED_QUEUE_SIZE,
    );
    expect(report.F_calendar2025.calendar2025AmongCachedQueue).toBe(
      PE4I14_EXPECTED_CALENDAR_2025_SEALED,
    );
    expect(report.F_calendar2025.holdoutStatus).toBe("SEALED");
    expect(report.I_reproducibility.runComparedEqual).toBe(true);
    expect(report.I_reproducibility.contentDigest.length).toBe(64);
    expect(report.J_callAccounting.coherentWith1094).toBe(true);
    expect(report.productionBoundary.pass).toBe(true);
    expect(report.blockers).toEqual([]);
    expect(report.checkpointReady).toBe(true);
    expect(report.finalVerdict).toBe("READY_FOR_RESEARCH_CHECKPOINT");
  }, 120_000);
});
