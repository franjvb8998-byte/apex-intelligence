/**
 * PE-4I.6 — Offline Stage-2A auth / batch selection / xG threshold tests.
 * Zero HTTP / provider calls.
 */

import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PE3C_C0_RECON_ACTIVATION } from "@/lib/prematch-lifecycle/pe3-activation";
import { resolvePe4HistoricalExpectation } from "@/lib/prematch-decision/pe4-form-schedule/expectation-contract";
import {
  digestGoalsG1Protocol,
  goalsG1Protocol,
} from "@/lib/debug/calibration/goals/g1/protocol";
import {
  Pe4I6ScheduleEndpointForbiddenError,
  Pe4I6Stage2AAuthError,
  assertPe4I6Stage2ALiveAuthorized,
  classifyXgCoverage,
  createFakePe4I2Transport,
  createPe4I2AcquisitionCache,
  createStatisticsOnlyTransport,
  isPe4I6Stage2ALiveAuthorized,
  PE4I6_XG_COVERAGE_THRESHOLDS,
  PE4I7_CANONICAL_STATS_FIELDS,
  selectStatisticsBatch,
  statisticsUnitKey,
} from "@/lib/debug/calibration/pe4-acquisition";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length) {
    const d = tempDirs.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
});

describe("PE-4I.6 Stage-2A auth", () => {
  it("requires execute-live, confirm, stage statistics, max-calls <= 150", () => {
    expect(isPe4I6Stage2ALiveAuthorized([])).toBe(false);
    expect(
      isPe4I6Stage2ALiveAuthorized([
        "--execute-live",
        "--confirm-provider-calls",
        "--max-calls",
        "150",
      ]),
    ).toBe(false);
    expect(
      isPe4I6Stage2ALiveAuthorized([
        "--execute-live",
        "--confirm-provider-calls",
        "--stage",
        "schedule",
        "--max-calls",
        "150",
      ]),
    ).toBe(false);
    expect(() =>
      assertPe4I6Stage2ALiveAuthorized([
        "--execute-live",
        "--confirm-provider-calls",
        "--stage",
        "statistics",
        "--max-calls",
        "151",
      ]),
    ).toThrow(Pe4I6Stage2AAuthError);
    const ok = assertPe4I6Stage2ALiveAuthorized([
      "--execute-live",
      "--confirm-provider-calls",
      "--stage",
      "statistics",
      "--max-calls",
      "150",
    ]);
    expect(ok.maxCalls).toBe(150);
    expect(ok.stage).toBe("statistics");
  });

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
    expect(digestGoalsG1Protocol(goalsG1Protocol(10))).toBe(
      "ad35f71225febd77bae15f2281d0fbb0ac7cd927eb67392a685daa98dc87414b",
    );
  });
});

describe("PE-4I.6 statistics-only transport", () => {
  it("forwards statistics and throws on schedule", async () => {
    const inner = createFakePe4I2Transport({
      onRequest: () => ({ ok: true, payload: { response: [] } }),
    });
    const t = createStatisticsOnlyTransport(inner);
    await t.request({
      kind: "fixture_statistics",
      providerFixtureId: "1",
    });
    expect(inner.calls.length).toBe(1);
    await expect(
      t.request({
        kind: "team_season_schedule",
        providerTeamId: "33",
        season: "2024",
      }),
    ).rejects.toBeInstanceOf(Pe4I6ScheduleEndpointForbiddenError);
    expect(t.scheduleAttempts).toBe(1);
  });
});

describe("PE-4I.6 batch selection + xG thresholds", () => {
  it("documents xG thresholds before classification", () => {
    expect(PE4I6_XG_COVERAGE_THRESHOLDS.highMinInclusive).toBe(0.9);
    expect(PE4I6_XG_COVERAGE_THRESHOLDS.partialMinInclusive).toBe(0.5);
    expect(PE4I6_XG_COVERAGE_THRESHOLDS.lowMinInclusive).toBe(0.1);
    expect(classifyXgCoverage(0.95)).toBe("XG_COVERAGE_HIGH");
    expect(classifyXgCoverage(0.7)).toBe("XG_COVERAGE_PARTIAL");
    expect(classifyXgCoverage(0.2)).toBe("XG_COVERAGE_LOW");
    expect(classifyXgCoverage(0.05)).toBe("XG_COVERAGE_UNUSABLE");
  });

  it("selects next uncached fixtures in canonical order up to maxNew", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "pe4i6-"));
    tempDirs.push(dir);
    mkdirSync(path.join(dir, "raw"), { recursive: true });
    const cache = createPe4I2AcquisitionCache(dir);
    cache.putCompleted({
      unitKey: statisticsUnitKey("2"),
      kind: "fixture_statistics",
      contentDigest: "abc",
      payload: { ok: true },
    });
    const ids = ["1", "2", "3", "4", "5"];
    const sel = selectStatisticsBatch({
      fixtureIds: ids,
      queueDigest: "x",
      caches: [cache],
      maxNew: 2,
    });
    expect(sel.initialCachedCount).toBe(1);
    expect(sel.initialUncachedCount).toBe(4);
    expect(sel.selectedFixtureIds).toEqual(["1", "3"]);
    expect(sel.firstSelectedFixtureId).toBe("1");
    expect(sel.lastSelectedFixtureId).toBe("3");
    expect(sel.selectedBatchSize).toBe(2);
  });

  it("PE-4I.7 stats fields exclude goals from statistics coverage set", () => {
    expect(PE4I7_CANONICAL_STATS_FIELDS).not.toContain("goals");
    expect(PE4I7_CANONICAL_STATS_FIELDS).toContain("expected_goals");
  });
});
