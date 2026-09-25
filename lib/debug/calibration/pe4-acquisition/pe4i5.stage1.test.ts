/**
 * PE-4I.5 — Offline Stage-1 auth / schedule-only / queue tests.
 * Fake transport only. Zero HTTP / provider calls.
 */

import { mkdtempSync, rmSync } from "node:fs";
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
  PE4I2_ACQUISITION_VERSION,
  PE4I2_PROVIDER,
  PE4I2_SCHEMA_VERSION,
  Pe4I5Stage1AuthError,
  Pe4I5StatisticsEndpointForbiddenError,
  assertPe4I5Stage1LiveAuthorized,
  buildStage2QueueAndAudit,
  createFakePe4I2Transport,
  createPe4I2AcquisitionCache,
  createScheduleOnlyTransport,
  isPe4I5Stage1LiveAuthorized,
  newCompetitionPinsToApply,
  proposeEvidenceBackedCompetitionPins,
  scheduleIdentityDigest,
  scheduleUnitKey,
  type Pe4I2RawScheduleEnvelope,
  type Pe4I2RawScheduleFixtureRow,
} from "@/lib/debug/calibration/pe4-acquisition";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length) {
    const d = tempDirs.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
});

function row(partial: {
  id: string;
  kickoff: string;
  home?: string;
  away?: string;
  compId?: string | null;
  compName?: string | null;
  class?: Pe4I2RawScheduleFixtureRow["competitionClass"];
  status?: string;
}): Pe4I2RawScheduleFixtureRow {
  const home = partial.home ?? "33";
  const away = partial.away ?? "40";
  const compId = partial.compId ?? "39";
  const status = partial.status ?? "FT";
  return {
    providerFixtureId: partial.id,
    providerCompetitionId: compId,
    providerCompetitionName: partial.compName ?? "Premier League",
    competitionClass: partial.class ?? "target_domestic_league",
    kickoffUtc: partial.kickoff,
    status,
    homeTeamId: home,
    awayTeamId: away,
    homeTeamName: "A",
    awayTeamName: "B",
    homeGoals: 1,
    awayGoals: 0,
    identityDigest: scheduleIdentityDigest({
      providerFixtureId: partial.id,
      kickoffUtc: partial.kickoff,
      homeTeamId: home,
      awayTeamId: away,
      providerCompetitionId: compId,
      status,
      homeGoals: 1,
      awayGoals: 0,
    }),
  };
}

function envelope(
  teamId: string,
  season: string,
  fixtures: Pe4I2RawScheduleFixtureRow[],
): Pe4I2RawScheduleEnvelope {
  return {
    schemaVersion: PE4I2_SCHEMA_VERSION,
    acquisitionVersion: PE4I2_ACQUISITION_VERSION,
    evidenceKind: "team_season_schedule",
    acquiredAtUtc: "2026-09-25T00:00:00.000Z",
    provider: PE4I2_PROVIDER,
    providerTeamId: teamId,
    requestedSeason: season,
    providerEnvelopeComplete: true,
    pagingCurrent: 1,
    pagingTotal: 1,
    resultsCount: fixtures.length,
    fixtures,
    contentDigest: "test",
  };
}

describe("PE-4I.5 Stage-1 auth", () => {
  it("requires execute-live, confirm, stage schedule, and max-calls <= 50", () => {
    expect(isPe4I5Stage1LiveAuthorized([])).toBe(false);
    expect(
      isPe4I5Stage1LiveAuthorized([
        "--execute-live",
        "--confirm-provider-calls",
        "--max-calls",
        "50",
      ]),
    ).toBe(false);
    expect(
      isPe4I5Stage1LiveAuthorized([
        "--execute-live",
        "--confirm-provider-calls",
        "--stage",
        "statistics",
        "--max-calls",
        "50",
      ]),
    ).toBe(false);
    expect(() =>
      assertPe4I5Stage1LiveAuthorized([
        "--execute-live",
        "--confirm-provider-calls",
        "--stage",
        "schedule",
        "--max-calls",
        "51",
      ]),
    ).toThrow(Pe4I5Stage1AuthError);
    const ok = assertPe4I5Stage1LiveAuthorized([
      "--execute-live",
      "--confirm-provider-calls",
      "--stage",
      "schedule",
      "--max-calls",
      "50",
    ]);
    expect(ok.maxCalls).toBe(50);
    expect(ok.stage).toBe("schedule");
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

describe("PE-4I.5 schedule-only transport", () => {
  it("forwards schedule and throws on statistics", async () => {
    const inner = createFakePe4I2Transport({
      onRequest: () => ({ ok: true, payload: { response: [] } }),
    });
    const t = createScheduleOnlyTransport(inner);
    await t.request({
      kind: "team_season_schedule",
      providerTeamId: "33",
      season: "2024",
    });
    expect(inner.calls.length).toBe(1);
    await expect(
      t.request({ kind: "fixture_statistics", providerFixtureId: "1" }),
    ).rejects.toBeInstanceOf(Pe4I5StatisticsEndpointForbiddenError);
    expect(t.statisticsAttempts).toBe(1);
  });

  it("refuses season 2025", async () => {
    const inner = createFakePe4I2Transport({
      onRequest: () => ({ ok: true, payload: { response: [] } }),
    });
    const t = createScheduleOnlyTransport(inner);
    await expect(
      t.request({
        kind: "team_season_schedule",
        providerTeamId: "33",
        season: "2025",
      }),
    ).rejects.toThrow(/2025/);
  });
});

describe("PE-4I.5 competition pins + stage2 queue", () => {
  it("proposes UCL/UECL pins with unambiguous names; new pins empty once registry updated", () => {
    const fixtures = [
      row({
        id: "100",
        kickoff: "2024-09-01T00:00:00.000Z",
        compId: "2",
        compName: "UEFA Champions League",
        class: "unknown_competition",
      }),
      row({
        id: "101",
        kickoff: "2024-09-02T00:00:00.000Z",
        compId: "848",
        compName: "UEFA Europa Conference League",
        class: "unknown_competition",
      }),
    ];
    const all = proposeEvidenceBackedCompetitionPins(fixtures);
    expect(all.map((p) => p.providerCompetitionId).sort()).toEqual([
      "2",
      "848",
    ]);
    // After PE-4I.5 registry update these are already pinned.
    expect(newCompetitionPinsToApply(fixtures)).toEqual([]);
    expect(
      proposeEvidenceBackedCompetitionPins([
        row({
          id: "102",
          kickoff: "2024-09-03T00:00:00.000Z",
          compId: "999",
          compName: "Some Ambiguous Cup Thing",
          class: "unknown_competition",
        }),
      ]),
    ).toEqual([]);
  });

  it("builds primary queue with pin overrides and dedupe savings", () => {
    const shared = row({ id: "1", kickoff: "2024-08-10T00:00:00.000Z" });
    const envA = envelope("33", "2024", [
      shared,
      row({
        id: "2",
        kickoff: "2024-09-01T00:00:00.000Z",
        compId: "2",
        compName: "UEFA Champions League",
        class: "unknown_competition",
      }),
      row({
        id: "3",
        kickoff: "2024-07-01T00:00:00.000Z",
        compId: "667",
        compName: "Friendlies Clubs",
        class: "other_known_competition",
      }),
    ]);
    const envB = envelope("40", "2024", [shared]);
    const pinOverrides = new Map([
      ["2", "uefa_champions_league" as const],
    ]);
    const q = buildStage2QueueAndAudit({
      envelopes: [envA, envB],
      acquisitionNowUtc: "2026-09-25T00:00:00.000Z",
      pinOverrides,
    });
    expect(q.fixtureIds).toEqual(["1", "2"]);
    expect(q.naiveTeamFixtureStatisticsRequests).toBe(3); // fixture 1 twice + UCL
    expect(q.naiveTeamFixtureStatisticsRequests - q.fixtureIds.length).toBe(1);
    expect(q.excludedAuditCounts.friendlies_preseason).toBe(1);
  });

  it("persists schedule units resume-safe in temp cache", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "pe4i5-"));
    tempDirs.push(dir);
    const cache = createPe4I2AcquisitionCache(dir);
    const key = scheduleUnitKey("33", "2024");
    cache.putCompleted({
      unitKey: key,
      kind: "team_season_schedule",
      contentDigest: "abc",
      payload: { ok: true },
    });
    expect(cache.getUnit(key)?.status).toBe("completed");
    expect(() =>
      cache.putCompleted({
        unitKey: key,
        kind: "team_season_schedule",
        contentDigest: "different",
        payload: { ok: false },
      }),
    ).toThrow(/conflict/i);
  });
});
