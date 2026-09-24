/**
 * PE-4F — Cross-competition schedule foundation (offline mocked transport).
 */

import { describe, expect, it, vi } from "vitest";
import { apexIdFor } from "@/lib/data-platform/providers/_shared/demo-fixture";
import type { ApiFootballFixtureItem } from "@/lib/data-platform/providers/api-football/types";
import {
  acquirePe4TeamSchedule,
  createRunScopedPe4TeamScheduleCache,
  digestPe4CrossCompScheduleSide,
  evaluatePe4TeamScheduleProviderEnvelope,
  extractPe4CrossCompScheduleSide,
  extractPe4FormScheduleEvidence,
  mergePe4CompetitionScopedWithCrossCompSchedule,
  normalizePe4TeamScheduleFixtures,
  pe4TeamScheduleCacheKey,
  requestedWindowCoversCongestionInterval,
  PE4_FAIL_CLOSED_MATRIX,
  PE4_CROSS_COMP_SCHEDULE_SOURCE,
} from "@/lib/prematch-decision/pe4-form-schedule";
import {
  GOLDEN_TARGET,
  goldenANormalMidSeason,
} from "@/lib/prematch-decision/pe4-form-schedule/goldens";
import { PE3C_C0_RECON_ACTIVATION } from "@/lib/prematch-lifecycle/pe3-activation";

const TARGET_COMP = apexIdFor("api-football", "league", "39");
const OTHER_COMP = apexIdFor("api-football", "league", "2");
const FRIENDLY_COMP = apexIdFor("api-football", "league", "667");
const TEAM_APEX = apexIdFor("api-football", "team", "42");
const OPP_APEX = apexIdFor("api-football", "team", "49");
const T = "2024-09-20T15:00:00.000Z";

function item(partial: {
  id: number;
  date: string;
  status?: string;
  homeId?: number;
  awayId?: number;
  leagueId?: number;
  season?: number;
  homeGoals?: number | null;
  awayGoals?: number | null;
}): ApiFootballFixtureItem {
  const homeId = partial.homeId ?? 42;
  const awayId = partial.awayId ?? 49;
  return {
    fixture: {
      id: partial.id,
      date: partial.date,
      status: {
        long: partial.status ?? "Match Finished",
        short: (partial.status ?? "FT") as ApiFootballFixtureItem["fixture"]["status"]["short"],
        elapsed: 90,
      },
    },
    league: {
      id: partial.leagueId ?? 39,
      name: "League",
      season: partial.season ?? 2024,
    },
    teams: {
      home: { id: homeId, name: `T${homeId}` },
      away: { id: awayId, name: `T${awayId}` },
    },
    goals: {
      home: partial.homeGoals === undefined ? 1 : partial.homeGoals,
      away: partial.awayGoals === undefined ? 0 : partial.awayGoals,
    },
    score: {
      fulltime: {
        home: partial.homeGoals === undefined ? 1 : partial.homeGoals,
        away: partial.awayGoals === undefined ? 0 : partial.awayGoals,
      },
    },
  };
}

function envelopePayload(
  response: ApiFootballFixtureItem[],
  overrides: Record<string, unknown> = {},
) {
  return {
    get: "fixtures",
    parameters: {},
    errors: [],
    results: response.length,
    paging: { current: 1, total: 1 },
    response,
    ...overrides,
  };
}

describe("PE-4F activation / fail-closed extension", () => {
  it("keeps PE3C_C0_RECON_ACTIVATION false", () => {
    expect(PE3C_C0_RECON_ACTIVATION).toBe(false);
  });

  it("extends fail-closed matrix for cross-comp cases (non-fatal, PE-3 eligible)", () => {
    const keys = [
      "provider_rejected_request",
      "provider_errors_nonempty",
      "paging_total_not_one",
      "results_length_mismatch",
      "malformed_schedule_row",
      "requested_team_absent_from_row",
      "conflicting_duplicate_schedule_fixture",
      "incomplete_requested_window",
      "unresolved_competition_load_policy",
      "no_previous_match_in_season",
      "season_boundary_uncertainty",
      "one_team_complete_other_partial",
    ] as const;
    for (const key of keys) {
      expect(PE4_FAIL_CLOSED_MATRIX[key].extractionFatal).toBe(false);
      expect(PE4_FAIL_CLOSED_MATRIX[key].pe3FallbackEligible).toBe(true);
    }
  });
});

describe("PE-4F provider envelope", () => {
  it("complete when errors empty + paging 1/1 + results===length", () => {
    const payload = envelopePayload([item({ id: 1, date: "2024-09-01T15:00:00+00:00" })]);
    expect(evaluatePe4TeamScheduleProviderEnvelope(payload)).toEqual({
      ok: true,
      providerEnvelopeComplete: true,
    });
  });

  it("incomplete when errors nonempty", () => {
    const payload = envelopePayload([], { errors: { rateLimit: "yes" } });
    expect(evaluatePe4TeamScheduleProviderEnvelope(payload as never).ok).toBe(
      false,
    );
  });

  it("incomplete when paging.total > 1", () => {
    const payload = envelopePayload([], {
      paging: { current: 1, total: 2 },
      results: 0,
    });
    const ev = evaluatePe4TeamScheduleProviderEnvelope(payload as never);
    expect(ev.ok).toBe(false);
    if (!ev.ok) expect(ev.reason).toBe("incomplete_paging");
  });

  it("incomplete on results mismatch / malformed", () => {
    expect(
      evaluatePe4TeamScheduleProviderEnvelope(
        envelopePayload([item({ id: 1, date: "2024-09-01T15:00:00+00:00" })], {
          results: 99,
        }) as never,
      ).ok,
    ).toBe(false);
    expect(
      evaluatePe4TeamScheduleProviderEnvelope({
        get: "fixtures",
        parameters: {},
        errors: [],
        results: 0,
        paging: { current: 1, total: 1 },
        response: null,
      } as never).ok,
    ).toBe(false);
  });
});

describe("PE-4F normalize", () => {
  it("accepts requested team home or away; sorts deterministically", () => {
    const items = [
      item({ id: 20, date: "2024-09-10T15:00:00+00:00", homeId: 49, awayId: 42 }),
      item({ id: 10, date: "2024-09-01T15:00:00+00:00", homeId: 42, awayId: 49 }),
    ];
    const result = normalizePe4TeamScheduleFixtures({
      items,
      vendorTeamId: "42",
      targetCompetitionId: TARGET_COMP,
      acquisitionScope: "team_season",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fixtures.map((f) => f.fixtureId)).toEqual(["10", "20"]);
    expect(result.fixtures[0]!.homeTeamId).toBe(TEAM_APEX);
    expect(result.fixtures[1]!.awayTeamId).toBe(TEAM_APEX);
  });

  it("fails closed when requested team absent", () => {
    const result = normalizePe4TeamScheduleFixtures({
      items: [item({ id: 1, date: "2024-09-01T15:00:00+00:00", homeId: 1, awayId: 2 })],
      vendorTeamId: "42",
      targetCompetitionId: TARGET_COMP,
      acquisitionScope: "team_season",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("requested_team_absent_from_row");
  });

  it("fails closed on malformed / conflicting duplicate", () => {
    const malformed = normalizePe4TeamScheduleFixtures({
      items: [
        {
          ...item({ id: 1, date: "not-a-date", homeId: 42 }),
          fixture: {
            id: 1,
            date: "not-a-date",
            status: { short: "FT", long: "FT", elapsed: 90 },
          },
        },
      ],
      vendorTeamId: "42",
      targetCompetitionId: TARGET_COMP,
      acquisitionScope: "team_season",
    });
    expect(malformed.ok).toBe(false);

    const conflict = normalizePe4TeamScheduleFixtures({
      items: [
        item({ id: 5, date: "2024-09-01T15:00:00+00:00", homeGoals: 1 }),
        item({ id: 5, date: "2024-09-01T15:00:00+00:00", homeGoals: 3 }),
      ],
      vendorTeamId: "42",
      targetCompetitionId: TARGET_COMP,
      acquisitionScope: "team_season",
    });
    expect(conflict.ok).toBe(false);
    if (!conflict.ok) expect(conflict.reason).toBe("conflicting_duplicate_fixture");
  });

  it("dedupes identical duplicate once", () => {
    const row = item({ id: 7, date: "2024-09-01T15:00:00+00:00" });
    const result = normalizePe4TeamScheduleFixtures({
      items: [row, { ...row }],
      vendorTeamId: "42",
      targetCompetitionId: TARGET_COMP,
      acquisitionScope: "team_season_window",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fixtures).toHaveLength(1);
  });
});

describe("PE-4F run-scope cache", () => {
  it("loads once per key; concurrent callers share Promise; windows distinct", async () => {
    const cache = createRunScopedPe4TeamScheduleCache();
    let loads = 0;
    const loader = vi.fn(async (key: { kind: string }) => {
      loads += 1;
      await new Promise((r) => setTimeout(r, 5));
      return {
        ok: true as const,
        key: key as never,
        providerEnvelopeComplete: true as const,
        fixtures: [],
        competitionIdsRepresented: [],
        httpRequests: 1,
      };
    });

    const k1 = { kind: "team_season" as const, teamId: "42", season: "2024" };
    const [a, b] = await Promise.all([
      cache.getOrLoad(k1, loader),
      cache.getOrLoad(k1, loader),
    ]);
    expect(a).toBe(b);
    expect(loads).toBe(1);
    expect(cache.loaderInvocations).toBe(1);

    const k2 = {
      kind: "team_season_window" as const,
      teamId: "42",
      season: "2024",
      fromDate: "2024-09-01",
      toDate: "2024-09-30",
    };
    await cache.getOrLoad(k2, loader);
    expect(loads).toBe(2);
    expect(pe4TeamScheduleCacheKey(k1)).not.toBe(pe4TeamScheduleCacheKey(k2));

    const k3 = {
      kind: "team_season_window" as const,
      teamId: "42",
      season: "2024",
      fromDate: "2024-08-01",
      toDate: "2024-09-30",
    };
    await cache.getOrLoad(k3, loader);
    expect(loads).toBe(3);
  });
});

describe("PE-4F acquire (mocked client)", () => {
  it("acquires team+season and surfaces envelope incompleteness", async () => {
    const client = {
      getTeamFixturesBySeason: vi.fn(async () =>
        envelopePayload([
          item({ id: 1, date: "2024-09-01T15:00:00+00:00" }),
        ]),
      ),
      getTeamFixturesBySeasonWindow: vi.fn(),
    };
    const ok = await acquirePe4TeamSchedule({
      client,
      key: { kind: "team_season", teamId: "42", season: "2024" },
      targetCompetitionId: TARGET_COMP,
    });
    expect(ok.ok).toBe(true);
    expect(client.getTeamFixturesBySeason).toHaveBeenCalledWith("42", "2024");
    expect(client.getTeamFixturesBySeasonWindow).not.toHaveBeenCalled();

    client.getTeamFixturesBySeason.mockResolvedValueOnce(
      envelopePayload([], { errors: ["x"], results: 0 }),
    );
    const bad = await acquirePe4TeamSchedule({
      client,
      key: { kind: "team_season", teamId: "42", season: "2024" },
      targetCompetitionId: TARGET_COMP,
    });
    expect(bad.ok).toBe(false);
  });
});

describe("PE-4F temporal / window / rest / policy", () => {
  function sideFromFixtures(
    fixtures: ReturnType<typeof normalizePe4TeamScheduleFixtures>,
    opts: {
      scope: "team_season" | "team_season_window";
      from?: string | null;
      to?: string | null;
    },
  ) {
    expect(fixtures.ok).toBe(true);
    if (!fixtures.ok) throw new Error("normalize failed");
    return extractPe4CrossCompScheduleSide({
      teamId: TEAM_APEX,
      vendorTeamId: "42",
      providerSeason: "2024",
      acquisitionScope: opts.scope,
      requestedFromDate: opts.from ?? null,
      requestedToDate: opts.to ?? null,
      providerEnvelopeComplete: true,
      fixtures: fixtures.fixtures,
      targetKickoffUtc: T,
      competitionScopedRestHoursSnapshot: 120,
      competitionScopedCongestion28dSnapshot: 1,
    });
  }

  it("includes pre-T FT/AET/PEN; excludes same-kickoff/future/NS/LIVE/PST/CANC/ABD/AWD/WO", () => {
    const rows = [
      item({ id: 1, date: "2024-09-10T15:00:00+00:00", status: "FT" }),
      item({ id: 2, date: "2024-09-11T15:00:00+00:00", status: "AET" }),
      item({ id: 3, date: "2024-09-12T15:00:00+00:00", status: "PEN" }),
      item({ id: 4, date: T, status: "FT" }),
      item({ id: 5, date: "2024-09-21T15:00:00+00:00", status: "FT" }),
      item({ id: 6, date: "2024-09-13T15:00:00+00:00", status: "NS" }),
      item({ id: 7, date: "2024-09-13T16:00:00+00:00", status: "LIVE" }),
      item({ id: 8, date: "2024-09-13T17:00:00+00:00", status: "PST" }),
      item({ id: 9, date: "2024-09-13T18:00:00+00:00", status: "CANC" }),
      item({ id: 10, date: "2024-09-13T19:00:00+00:00", status: "ABD" }),
      item({ id: 11, date: "2024-09-13T20:00:00+00:00", status: "AWD" }),
      item({ id: 12, date: "2024-09-13T21:00:00+00:00", status: "WO" }),
    ];
    const norm = normalizePe4TeamScheduleFixtures({
      items: rows,
      vendorTeamId: "42",
      targetCompetitionId: TARGET_COMP,
      acquisitionScope: "team_season",
    });
    const side = sideFromFixtures(norm, { scope: "team_season" });
    expect(side.congestionFixtureIds.sort()).toEqual(["1", "2", "3"]);
    expect(side.previousCompletedKickoffUtc).toBe("2024-09-12T15:00:00.000Z");
    expect(side.previousMatchComplete).toBe(true);
    expect(side.restHoursSincePreviousCompleted).toBe(8 * 24);
  });

  it("exact T-28d lower boundary inclusive; insufficient window not complete", () => {
    const exact28 = "2024-08-23T15:00:00.000Z";
    const outside = "2024-08-23T14:59:59.999Z";
    const norm = normalizePe4TeamScheduleFixtures({
      items: [
        item({ id: 1, date: exact28 }),
        item({ id: 2, date: outside }),
      ],
      vendorTeamId: "42",
      targetCompetitionId: TARGET_COMP,
      acquisitionScope: "team_season_window",
    });
    const covered = sideFromFixtures(norm, {
      scope: "team_season_window",
      from: "2024-08-23",
      to: "2024-09-20",
    });
    expect(covered.congestionFixtureIds).toEqual(["1"]);
    expect(covered.congestionWindowComplete).toBe(true);

    expect(
      requestedWindowCoversCongestionInterval({
        fromDate: "2024-08-24",
        toDate: "2024-09-20",
        targetKickoffUtc: T,
      }),
    ).toBe(false);
    const short = sideFromFixtures(norm, {
      scope: "team_season_window",
      from: "2024-08-24",
      to: "2024-09-20",
    });
    expect(short.congestionWindowComplete).toBe(false);
    expect(short.semanticReason).toBe("incomplete_requested_window");
  });

  it("unknown competition policy: provider complete, semantic incomplete", () => {
    const norm = normalizePe4TeamScheduleFixtures({
      items: [
        item({
          id: 1,
          date: "2024-09-10T15:00:00+00:00",
          leagueId: 667,
        }),
        item({
          id: 2,
          date: "2024-09-05T15:00:00+00:00",
          leagueId: 39,
        }),
      ],
      vendorTeamId: "42",
      targetCompetitionId: TARGET_COMP,
      acquisitionScope: "team_season",
    });
    const side = sideFromFixtures(norm, { scope: "team_season" });
    expect(side.providerEnvelopeComplete).toBe(true);
    expect(side.congestionFixtureIds).toEqual(["2"]);
    expect(side.congestionWindowComplete).toBe(false);
    expect(side.semanticScheduleComplete).toBe(false);
    expect(side.crossCompetitionBlind).toBe(true);
    expect(side.semanticReason).toBe("unresolved_competition_load_policy");
    expect(norm.ok && norm.fixtures.some((f) => f.competitionId === FRIENDLY_COMP)).toBe(
      true,
    );
  });

  it("no previous same-season → previousMatchComplete=false; no invented rest", () => {
    const norm = normalizePe4TeamScheduleFixtures({
      items: [],
      vendorTeamId: "42",
      targetCompetitionId: TARGET_COMP,
      acquisitionScope: "team_season",
    });
    const side = sideFromFixtures(norm, { scope: "team_season" });
    expect(side.previousMatchComplete).toBe(false);
    expect(side.previousCompletedKickoffUtc).toBeNull();
    expect(side.restHoursSincePreviousCompleted).toBeNull();
    expect(side.semanticReason).toBe("no_previous_match_in_season");
  });
});

describe("PE-4F digest", () => {
  it("is invariant to provider order and acquisition time; changes on material fixture", () => {
    const a = item({ id: 1, date: "2024-09-01T15:00:00+00:00" });
    const b = item({ id: 2, date: "2024-09-10T15:00:00+00:00" });
    const n1 = normalizePe4TeamScheduleFixtures({
      items: [a, b],
      vendorTeamId: "42",
      targetCompetitionId: TARGET_COMP,
      acquisitionScope: "team_season",
    });
    const n2 = normalizePe4TeamScheduleFixtures({
      items: [b, a],
      vendorTeamId: "42",
      targetCompetitionId: TARGET_COMP,
      acquisitionScope: "team_season",
    });
    expect(n1.ok && n2.ok).toBe(true);
    if (!n1.ok || !n2.ok) return;
    const s1 = extractPe4CrossCompScheduleSide({
      teamId: TEAM_APEX,
      vendorTeamId: "42",
      providerSeason: "2024",
      acquisitionScope: "team_season",
      requestedFromDate: null,
      requestedToDate: null,
      providerEnvelopeComplete: true,
      fixtures: n1.fixtures,
      targetKickoffUtc: T,
      competitionScopedRestHoursSnapshot: null,
      competitionScopedCongestion28dSnapshot: null,
    });
    const s2 = extractPe4CrossCompScheduleSide({
      teamId: TEAM_APEX,
      vendorTeamId: "42",
      providerSeason: "2024",
      acquisitionScope: "team_season",
      requestedFromDate: null,
      requestedToDate: null,
      providerEnvelopeComplete: true,
      fixtures: n2.fixtures,
      targetKickoffUtc: T,
      competitionScopedRestHoursSnapshot: null,
      competitionScopedCongestion28dSnapshot: null,
    });
    expect(s1.scheduleEvidenceDigest).toBe(s2.scheduleEvidenceDigest);
    expect(s1.congestionFixtureIds).toEqual(["1", "2"]);

    const n3 = normalizePe4TeamScheduleFixtures({
      items: [a, item({ id: 99, date: "2024-09-12T15:00:00+00:00" })],
      vendorTeamId: "42",
      targetCompetitionId: TARGET_COMP,
      acquisitionScope: "team_season",
    });
    expect(n3.ok).toBe(true);
    if (!n3.ok) return;
    const s3 = extractPe4CrossCompScheduleSide({
      teamId: TEAM_APEX,
      vendorTeamId: "42",
      providerSeason: "2024",
      acquisitionScope: "team_season",
      requestedFromDate: null,
      requestedToDate: null,
      providerEnvelopeComplete: true,
      fixtures: n3.fixtures,
      targetKickoffUtc: T,
      competitionScopedRestHoursSnapshot: null,
      competitionScopedCongestion28dSnapshot: null,
    });
    expect(s3.scheduleEvidenceDigest).not.toBe(s1.scheduleEvidenceDigest);

    const rest = { ...s1 };
    delete (rest as { scheduleEvidenceDigest?: string }).scheduleEvidenceDigest;
    expect(digestPe4CrossCompScheduleSide(rest)).toBe(s1.scheduleEvidenceDigest);
  });
});

describe("PE-4F merge seam", () => {
  it("changes schedule evidence only; preserves form/opponent; fallback blindness", () => {
    const pe4 = extractPe4FormScheduleEvidence({
      target: GOLDEN_TARGET,
      universe: goldenANormalMidSeason(),
      lastN: 5,
    });
    expect(pe4.ok).toBe(true);
    if (!pe4.ok) return;

    const formDigest = pe4.layer.evidenceDigest;
    const homeW = pe4.layer.home.lastNAggregate.wins;
    const oppStatus = pe4.layer.home.components.opponentAdjustedForm;

    const norm = normalizePe4TeamScheduleFixtures({
      items: [
        item({ id: 1, date: "2024-09-01T15:00:00+00:00" }),
        item({ id: 2, date: "2024-09-10T15:00:00+00:00" }),
      ],
      vendorTeamId: "42",
      targetCompetitionId: TARGET_COMP,
      acquisitionScope: "team_season",
    });
    expect(norm.ok).toBe(true);
    if (!norm.ok) return;

    const completeSide = extractPe4CrossCompScheduleSide({
      teamId: TEAM_APEX,
      vendorTeamId: "42",
      providerSeason: "2024",
      acquisitionScope: "team_season",
      requestedFromDate: null,
      requestedToDate: null,
      providerEnvelopeComplete: true,
      fixtures: norm.fixtures,
      targetKickoffUtc: T,
      competitionScopedRestHoursSnapshot:
        pe4.layer.home.competitionScopedRestHoursSincePreviousCompleted,
      competitionScopedCongestion28dSnapshot:
        pe4.layer.home.competitionScopedMatchesInWindows.previous28Days,
    });

    expect(completeSide.crossCompetitionBlind).toBe(false);
    expect(completeSide.congestionWindowComplete).toBe(true);

    const bothComplete = mergePe4CompetitionScopedWithCrossCompSchedule({
      competitionScopedLayer: pe4.layer,
      homeSchedule: completeSide,
      awaySchedule: completeSide,
    });
    expect(bothComplete.crossCompetitionBlind).toBe(false);
    expect(bothComplete.scheduleEvidenceSource).toBe(PE4_CROSS_COMP_SCHEDULE_SOURCE);
    expect(bothComplete.competitionScopedLayer.evidenceDigest).toBe(formDigest);
    expect(bothComplete.competitionScopedLayer.home.lastNAggregate.wins).toBe(
      homeW,
    );
    expect(
      bothComplete.competitionScopedLayer.home.components.opponentAdjustedForm,
    ).toEqual(oppStatus);

    const onePartial = mergePe4CompetitionScopedWithCrossCompSchedule({
      competitionScopedLayer: pe4.layer,
      homeSchedule: completeSide,
      awaySchedule: null,
    });
    expect(onePartial.crossCompetitionBlind).toBe(true);
    expect(onePartial.usedCompetitionScopedFallback).toBe(true);
    expect(onePartial.mergeNotes.pe3C0Unchanged).toBe(true);
    expect(OTHER_COMP).toContain("league");
    expect(OPP_APEX).toContain("team");
  });
});
