/**
 * PE-4I.4 — Bulk acquisition planner tests.
 * Fake fixtures only. Zero HTTP / provider calls.
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
  PE4I2_HOLDOUT_SEASON,
  PE4I2_PL_TEAMS_2023,
  PE4I2_PL_TEAMS_2024,
  PE4I4_CANONICAL_PERFORMANCE_FIELDS,
  PE4I4_XG_STATUS,
  assertNoProviderSeason2025Request,
  authorizeLiveStage2,
  buildCallEstimates,
  buildPe4I4BulkAcquisitionPlan,
  buildPrimaryStatisticsQueue,
  classifySeasonAxes,
  createPe4I2AcquisitionCache,
  createPe4I2CallBudget,
  dedupeScheduleFixtures,
  emptyBatchBudgetReport,
  evaluateStatisticsEligibility,
  filterStrictlyBeforeTarget,
  isEligibleHistoricalForTarget,
  isResearchHoldoutOutcomeEvidence,
  mapRawStatToCanonicalSide,
  pe4I4PrimaryStatsInclusion,
  refuseEloPoissonXgSubstitution,
  refusePe4I4LiveBulkExecution,
  rosterCounts,
  scheduleIdentityDigest,
  scheduleUnitKey,
  validateStage2QueueReady,
  verifyPe4I3SmokeCache,
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
  class?: Pe4I2RawScheduleFixtureRow["competitionClass"];
  status?: string;
  homeGoals?: number | null;
  awayGoals?: number | null;
}): Pe4I2RawScheduleFixtureRow {
  const home = partial.home ?? "1";
  const away = partial.away ?? "2";
  const identityDigest = scheduleIdentityDigest({
    providerFixtureId: partial.id,
    kickoffUtc: partial.kickoff,
    homeTeamId: home,
    awayTeamId: away,
    providerCompetitionId: partial.compId ?? "39",
    status: partial.status ?? "FT",
    homeGoals: partial.homeGoals === undefined ? 1 : partial.homeGoals,
    awayGoals: partial.awayGoals === undefined ? 0 : partial.awayGoals,
  });
  return {
    providerFixtureId: partial.id,
    providerCompetitionId: partial.compId ?? "39",
    providerCompetitionName: "Fake",
    competitionClass: partial.class ?? "target_domestic_league",
    kickoffUtc: partial.kickoff,
    status: partial.status ?? "FT",
    homeTeamId: home,
    awayTeamId: away,
    homeTeamName: "H",
    awayTeamName: "A",
    homeGoals: partial.homeGoals === undefined ? 1 : partial.homeGoals,
    awayGoals: partial.awayGoals === undefined ? 0 : partial.awayGoals,
    identityDigest,
  };
}

function envelope(
  teamId: string,
  season: string,
  fixtures: Pe4I2RawScheduleFixtureRow[],
): Pe4I2RawScheduleEnvelope {
  return {
    schemaVersion: "pe4.acquisition.raw.v1",
    acquisitionVersion: "pe4.acquisition.infrastructure.v1",
    evidenceKind: "team_season_schedule",
    acquiredAtUtc: "2026-01-01T00:00:00.000Z",
    provider: "api-football",
    providerTeamId: teamId,
    requestedSeason: season,
    providerEnvelopeComplete: true,
    pagingCurrent: 1,
    pagingTotal: 1,
    resultsCount: fixtures.length,
    fixtures,
    contentDigest: "fake",
  };
}

describe("PE-4I.4 bulk acquisition plan", () => {
  it("schedule plan is deterministic and shuffle-invariant for club-season units", () => {
    const a = buildPe4I4BulkAcquisitionPlan({ caches: [] });
    const b = buildPe4I4BulkAcquisitionPlan({ caches: [] });
    expect(a.planDigest).toBe(b.planDigest);
    expect(a.clubSeasonUnits.map((u) => u.unitKey)).toEqual(
      b.clubSeasonUnits.map((u) => u.unitKey),
    );
    const counts = rosterCounts();
    expect(a.clubSeasonUnits).toHaveLength(counts.clubSeasonUnits);
    expect(a.uniqueClubs2023).toHaveLength(PE4I2_PL_TEAMS_2023.length);
    expect(a.uniqueClubs2024).toHaveLength(PE4I2_PL_TEAMS_2024.length);
    expect(a.targetSeasons).toEqual(["2023", "2024"]);
    expect(a.providerCallsMade).toBe(0);
    expect(a.liveEnabled).toBe(false);
  });

  it("subtracts cached schedule units from missing call estimate", () => {
    const root = mkdtempSync(path.join(tmpdir(), "pe4i4-plan-"));
    tempDirs.push(root);
    const cache = createPe4I2AcquisitionCache(root);
    cache.putCompleted({
      unitKey: scheduleUnitKey("33", "2024"),
      kind: "team_season_schedule",
      contentDigest: "abc",
      payload: { fixtures: [] },
    });
    const plan = buildPe4I4BulkAcquisitionPlan({ caches: [cache] });
    expect(plan.cachedScheduleUnits).toBe(1);
    expect(plan.missingScheduleUnits).toBe(plan.clubSeasonUnits.length - 1);
    expect(plan.estimatedScheduleCalls).toBe(plan.missingScheduleUnits);
  });

  it("fixture dedupe collapses identical duplicates and fails closed on conflict", () => {
    const a = row({ id: "100", kickoff: "2024-01-01T15:00:00.000Z" });
    const same = { ...a };
    const conflict = row({
      id: "100",
      kickoff: "2024-01-01T15:00:00.000Z",
      homeGoals: 3,
    });
    const ok = dedupeScheduleFixtures([a, same]);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.fixtures).toHaveLength(1);
      expect(ok.collapsedIdenticalDuplicates).toBe(1);
    }
    const bad = dedupeScheduleFixtures([a, conflict]);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reason).toBe("conflicting_duplicate_fixture");
  });

  it("canonical ordering is kickoffUtc then fixtureId", () => {
    const rows = [
      row({ id: "b", kickoff: "2024-02-01T15:00:00.000Z" }),
      row({ id: "a", kickoff: "2024-01-01T15:00:00.000Z" }),
      row({ id: "c", kickoff: "2024-01-01T15:00:00.000Z" }),
    ];
    const ok = dedupeScheduleFixtures(rows);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.fixtures.map((f) => f.providerFixtureId)).toEqual([
        "a",
        "c",
        "b",
      ]);
    }
  });

  it("statistics eligibility excludes friendlies/preseason and shields Community Shield", () => {
    const now = "2026-01-01T00:00:00.000Z";
    const pl = evaluateStatisticsEligibility({
      providerFixtureId: "1",
      status: "FT",
      kickoffUtc: "2024-08-01T15:00:00.000Z",
      providerCompetitionId: "39",
      competitionClass: "target_domestic_league",
      discoveredFromProviderSeason: "2024",
      acquisitionNowUtc: now,
    });
    expect(pl.eligibleForPrimaryQueue).toBe(true);

    const friendly = evaluateStatisticsEligibility({
      providerFixtureId: "2",
      status: "FT",
      kickoffUtc: "2024-07-01T15:00:00.000Z",
      providerCompetitionId: "667",
      competitionClass: "other_known_competition",
      discoveredFromProviderSeason: "2024",
      acquisitionNowUtc: now,
    });
    expect(friendly.eligibleForPrimaryQueue).toBe(false);
    expect(friendly.reason).toBe("friendlies_or_preseason_excluded");

    const summer = evaluateStatisticsEligibility({
      providerFixtureId: "3",
      status: "FT",
      kickoffUtc: "2024-07-20T15:00:00.000Z",
      providerCompetitionId: "1022",
      competitionClass: "other_known_competition",
      discoveredFromProviderSeason: "2024",
      acquisitionNowUtc: now,
    });
    expect(summer.reason).toBe("friendlies_or_preseason_excluded");

    const shield = evaluateStatisticsEligibility({
      providerFixtureId: "4",
      status: "FT",
      kickoffUtc: "2024-08-10T15:00:00.000Z",
      providerCompetitionId: "528",
      competitionClass: "other_known_competition",
      discoveredFromProviderSeason: "2024",
      acquisitionNowUtc: now,
    });
    expect(shield.reason).toBe("community_shield_separate_audit");
  });

  it("preserves unknown competitions without dropping them from raw policy", () => {
    expect(
      pe4I4PrimaryStatsInclusion({
        providerCompetitionId: "99999",
        competitionClass: "unknown_competition",
      }),
    ).toBe("PRESERVE_RAW_UNKNOWN");
    const elig = evaluateStatisticsEligibility({
      providerFixtureId: "9",
      status: "FT",
      kickoffUtc: "2024-09-01T15:00:00.000Z",
      providerCompetitionId: "99999",
      competitionClass: "unknown_competition",
      discoveredFromProviderSeason: "2024",
      acquisitionNowUtc: "2026-01-01T00:00:00.000Z",
    });
    expect(elig.eligibleForPrimaryQueue).toBe(false);
    expect(elig.reason).toBe("unknown_competition_audit_only");
  });

  it("includes UEL by registry id even if cached class was unknown", () => {
    const elig = evaluateStatisticsEligibility({
      providerFixtureId: "10",
      status: "FT",
      kickoffUtc: "2024-10-01T15:00:00.000Z",
      providerCompetitionId: "3",
      competitionClass: "unknown_competition",
      discoveredFromProviderSeason: "2024",
      acquisitionNowUtc: "2026-01-01T00:00:00.000Z",
    });
    expect(elig.eligibleForPrimaryQueue).toBe(true);
  });

  it("rejects holdout provider season and future fixtures for stats queue", () => {
    expect(
      evaluateStatisticsEligibility({
        providerFixtureId: "11",
        status: "FT",
        kickoffUtc: "2025-08-01T15:00:00.000Z",
        providerCompetitionId: "39",
        competitionClass: "target_domestic_league",
        discoveredFromProviderSeason: "2025",
        acquisitionNowUtc: "2026-01-01T00:00:00.000Z",
      }).reason,
    ).toBe("holdout_provider_season_forbidden");

    expect(
      evaluateStatisticsEligibility({
        providerFixtureId: "12",
        status: "NS",
        kickoffUtc: "2027-01-01T15:00:00.000Z",
        providerCompetitionId: "39",
        competitionClass: "target_domestic_league",
        discoveredFromProviderSeason: "2024",
        acquisitionNowUtc: "2026-01-01T00:00:00.000Z",
      }).eligibleForPrimaryQueue,
    ).toBe(false);
  });

  it("primary stats queue excludes friendlies after fixture-id dedupe", () => {
    const e1 = envelope("33", "2024", [
      row({ id: "100", kickoff: "2024-08-01T15:00:00.000Z", home: "33", away: "36" }),
      row({
        id: "200",
        kickoff: "2024-07-01T15:00:00.000Z",
        home: "33",
        away: "99",
        compId: "667",
        class: "other_known_competition",
      }),
    ]);
    const e2 = envelope("36", "2024", [
      row({ id: "100", kickoff: "2024-08-01T15:00:00.000Z", home: "33", away: "36" }),
    ]);
    const q = buildPrimaryStatisticsQueue({
      envelopes: [e1, e2],
      acquisitionNowUtc: "2026-01-01T00:00:00.000Z",
    });
    expect(q.fixtureIds).toEqual(["100"]);
    expect(q.excluded.some((x) => x.fixtureId === "200")).toBe(true);
  });

  it("missing != zero for xG mapping; refuses EloPoisson substitution", () => {
    const missing = mapRawStatToCanonicalSide({
      rawName: "expected_goals",
      rawValue: null,
      valuePresence: "missing",
      parsedNumeric: null,
      side: "for",
    });
    expect(missing?.valuePresence).toBe("missing");
    expect(missing?.parsedNumeric).toBeNull();
    expect(missing?.eloPoissonSubstitutionUsed).toBe(false);

    const present = mapRawStatToCanonicalSide({
      rawName: "expected_goals",
      rawValue: "2.43",
      valuePresence: "present",
      parsedNumeric: 2.43,
      side: "for",
    });
    expect(present?.canonical).toBe("expected_goals_for");
    expect(present?.parsedNumeric).toBe(2.43);

    expect(refuseEloPoissonXgSubstitution().allowed).toBe(false);
    expect(PE4I4_XG_STATUS).toBe("OBSERVED_IN_CONTROLLED_PROVIDER_SAMPLE");
    expect(PE4I4_CANONICAL_PERFORMANCE_FIELDS).toContain("expected_goals_for");
  });

  it("as-of-T requires kickoff(M) < kickoff(T) and excludes self/same-kickoff", () => {
    const target = {
      providerFixtureId: "T",
      kickoffUtc: "2024-10-01T15:00:00.000Z",
    };
    expect(
      isEligibleHistoricalForTarget({
        historical: {
          providerFixtureId: "M",
          kickoffUtc: "2024-09-01T15:00:00.000Z",
        },
        target,
      }).ok,
    ).toBe(true);
    expect(
      isEligibleHistoricalForTarget({
        historical: target,
        target,
      }).ok,
    ).toBe(false);
    expect(
      isEligibleHistoricalForTarget({
        historical: {
          providerFixtureId: "X",
          kickoffUtc: "2024-10-01T15:00:00.000Z",
        },
        target,
      }).ok,
    ).toBe(false);

    const filtered = filterStrictlyBeforeTarget(
      [
        { providerFixtureId: "1", kickoffUtc: "2024-11-01T15:00:00.000Z" },
        { providerFixtureId: "2", kickoffUtc: "2024-09-01T15:00:00.000Z" },
        { providerFixtureId: "T", kickoffUtc: "2024-10-01T15:00:00.000Z" },
      ],
      target,
    );
    expect(filtered.map((f) => f.providerFixtureId)).toEqual(["2"]);
  });

  it("holdout firewall: provider season ≠ calendar ≠ research; no season 2025 requests", () => {
    const axes = classifySeasonAxes({
      providerSeasonId: "2024",
      kickoffUtc: "2025-01-15T15:00:00.000Z",
    });
    expect(axes.providerSeasonId).toBe("2024");
    expect(axes.calendarKickoffYear).toBe(2025);
    expect(axes.researchSeasonAxis).toBe("2024");
    expect(
      isResearchHoldoutOutcomeEvidence({
        providerSeasonId: "2024",
        kickoffUtc: "2025-01-15T15:00:00.000Z",
      }),
    ).toBe(false);
    expect(() => assertNoProviderSeason2025Request("2025")).toThrow(/2025/);
    expect(PE4I2_HOLDOUT_SEASON).toBe("2025");
  });

  it("two-stage separation: queue ready offline but live Stage-2 refused", () => {
    const ready = validateStage2QueueReady({
      stage1Complete: true,
      statisticsQueueDigest: "abc",
      fixtureIds: ["1", "2"],
    });
    expect(ready.ok).toBe(true);
    expect(authorizeLiveStage2(ready).authorized).toBe(false);
    expect(refusePe4I4LiveBulkExecution().providerCallsMade).toBe(0);

    const notReady = validateStage2QueueReady({
      stage1Complete: false,
      statisticsQueueDigest: null,
      fixtureIds: null,
    });
    expect(notReady.ok).toBe(false);
  });

  it("budget accounting requires explicit maxCalls; resume counters start clean", () => {
    const report = emptyBatchBudgetReport({
      dryRun: true,
      plannedCalls: 39,
      maxCalls: 50,
    });
    expect(report.remaining).toBe(50);
    expect(report.attempted).toBe(0);
    expect(() =>
      emptyBatchBudgetReport({ dryRun: false, plannedCalls: 1, maxCalls: -1 }),
    ).toThrow();

    const budget = createPe4I2CallBudget(3);
    budget.beginAttempt();
    budget.recordSuccess();
    budget.recordCacheHit();
    const snap = budget.snapshot();
    expect(snap.attempted).toBe(1);
    expect(snap.succeeded).toBe(1);
    expect(snap.cacheHits).toBe(1);
    expect(snap.remaining).toBe(2);
  });

  it("call estimate ranges are structured lower/upper not pretended exact", () => {
    const e = buildCallEstimates({ missingScheduleUnits: 39 });
    expect(e.estimatedScheduleCalls).toBe(39);
    expect(e.estimatedUniqueLeagueFixtures).toBe(760);
    expect(e.estimatedStatisticsCallsRange.lower).toBeLessThan(
      e.estimatedStatisticsCallsRange.upper,
    );
    expect(e.estimatedTotalProviderCallsRange.lower).toBe(
      39 + e.estimatedStatisticsCallsRange.lower,
    );
  });

  it("safety pins: activation false, expectation UNAVAILABLE, G1 digest stable", () => {
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
    const p = goalsG1Protocol(10);
    expect(p.selectedShrinkageK).toBe(10);
    expect(digestGoalsG1Protocol(p)).toBe(
      "ad35f71225febd77bae15f2281d0fbb0ac7cd927eb67392a685daa98dc87414b",
    );
  });

  it("loads PE-4I.3 smoke cache offline when present", () => {
    const v = verifyPe4I3SmokeCache();
    if (!v.found) {
      // Cache may be gitignored / absent in some CI clones — still assert API shape.
      expect(v.loadOk).toBe(false);
      expect(v.unitKey).toBe("schedule::team=33::season=2024");
      return;
    }
    expect(v.loadOk).toBe(true);
    expect(v.uniqueFixtures).toBe(68);
    expect(v.contentDigest).toMatch(/^[a-f0-9]{64}$/);
  });
});
