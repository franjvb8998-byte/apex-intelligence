/**
 * PE-4D — Deterministic synthetic golden universes (offline).
 * No wall-clock dependence; fixed ISO kickoffs.
 */

import type { PrematchStrengthUniverseFixture } from "@/lib/match-center/prematch-strength/types";
import type { Pe4FormScheduleTarget } from "@/lib/prematch-decision/pe4-form-schedule/types";

export const GOLDEN_TARGET_KICKOFF = "2026-09-20T15:00:00.000Z";
export const GOLDEN_COMP = "comp-golden";
export const GOLDEN_SEASON = "2026";
export const GOLDEN_HOME = "team-home";
export const GOLDEN_AWAY = "team-away";
export const GOLDEN_OPP_A = "opp-a";
export const GOLDEN_OPP_B = "opp-b";
export const GOLDEN_OTHER = "team-other";

export const GOLDEN_TARGET: Pe4FormScheduleTarget = {
  fixtureId: "fx-golden-target",
  kickoffUtc: GOLDEN_TARGET_KICKOFF,
  homeTeamId: GOLDEN_HOME,
  awayTeamId: GOLDEN_AWAY,
  competitionId: GOLDEN_COMP,
  season: GOLDEN_SEASON,
};

function row(
  partial: Partial<PrematchStrengthUniverseFixture> &
    Pick<PrematchStrengthUniverseFixture, "fixtureId" | "kickoffUtc">,
): PrematchStrengthUniverseFixture {
  return {
    homeTeamId: GOLDEN_HOME,
    awayTeamId: GOLDEN_OTHER,
    competitionId: GOLDEN_COMP,
    season: GOLDEN_SEASON,
    status: "FT",
    homeGoals: 1,
    awayGoals: 0,
    ...partial,
  };
}

/** GOLDEN A — normal mid-season, catalogue opponents, mixed venue. */
export function goldenANormalMidSeason(): PrematchStrengthUniverseFixture[] {
  return [
    // OPP_A history before HOME match
    row({
      fixtureId: "a-opp-a-1",
      kickoffUtc: "2026-08-20T15:00:00.000Z",
      homeTeamId: GOLDEN_OPP_A,
      awayTeamId: GOLDEN_OTHER,
      homeGoals: 2,
      awayGoals: 0,
    }),
    row({
      fixtureId: "a-opp-a-2",
      kickoffUtc: "2026-08-27T15:00:00.000Z",
      homeTeamId: GOLDEN_OTHER,
      awayTeamId: GOLDEN_OPP_A,
      homeGoals: 1,
      awayGoals: 1,
    }),
    // HOME priors
    row({
      fixtureId: "a-home-1",
      kickoffUtc: "2026-09-01T15:00:00.000Z",
      homeTeamId: GOLDEN_HOME,
      awayTeamId: GOLDEN_OPP_A,
      homeGoals: 2,
      awayGoals: 1,
    }),
    row({
      fixtureId: "a-home-2",
      kickoffUtc: "2026-09-08T15:00:00.000Z",
      homeTeamId: GOLDEN_OTHER,
      awayTeamId: GOLDEN_HOME,
      homeGoals: 0,
      awayGoals: 0,
    }),
    row({
      fixtureId: "a-home-3",
      kickoffUtc: "2026-09-13T15:00:00.000Z",
      homeTeamId: GOLDEN_HOME,
      awayTeamId: "fresh-opp-home-3",
      homeGoals: 3,
      awayGoals: 0,
    }),
    // fresh-opp-home-3 has no history → base_prior for that match
    // AWAY priors
    row({
      fixtureId: "a-away-opp-1",
      kickoffUtc: "2026-08-22T15:00:00.000Z",
      homeTeamId: GOLDEN_OPP_B,
      awayTeamId: GOLDEN_OTHER,
      homeGoals: 1,
      awayGoals: 0,
    }),
    row({
      fixtureId: "a-away-1",
      kickoffUtc: "2026-09-05T15:00:00.000Z",
      homeTeamId: GOLDEN_AWAY,
      awayTeamId: GOLDEN_OPP_B,
      homeGoals: 1,
      awayGoals: 2,
    }),
    row({
      fixtureId: "a-away-2",
      kickoffUtc: "2026-09-12T15:00:00.000Z",
      homeTeamId: GOLDEN_OTHER,
      awayTeamId: GOLDEN_AWAY,
      homeGoals: 2,
      awayGoals: 2,
    }),
  ];
}

/** GOLDEN B — early season: fewer than requestedLastN; base_prior opponents. */
export function goldenBEarlySeason(): PrematchStrengthUniverseFixture[] {
  return [
    row({
      fixtureId: "b-home-1",
      kickoffUtc: "2026-09-10T15:00:00.000Z",
      homeTeamId: GOLDEN_HOME,
      awayTeamId: "fresh-opp",
      homeGoals: 1,
      awayGoals: 0,
    }),
    row({
      fixtureId: "b-away-1",
      kickoffUtc: "2026-09-11T15:00:00.000Z",
      homeTeamId: GOLDEN_AWAY,
      awayTeamId: "fresh-opp-2",
      homeGoals: 0,
      awayGoals: 1,
    }),
  ];
}

/**
 * GOLDEN C — temporal trap: same-kickoff, post-M opp results, future,
 * postponed — all must be excluded from evidence where required.
 */
export function goldenCTemporalTrap(): {
  universe: PrematchStrengthUniverseFixture[];
  matchMId: string;
  matchMKickoff: string;
} {
  const matchMId = "c-match-M";
  const matchMKickoff = "2026-09-10T15:00:00.000Z";
  return {
    matchMId,
    matchMKickoff,
    universe: [
      row({
        fixtureId: "c-opp-pre",
        kickoffUtc: "2026-09-01T15:00:00.000Z",
        homeTeamId: GOLDEN_OPP_A,
        awayTeamId: GOLDEN_OTHER,
        homeGoals: 1,
        awayGoals: 0,
      }),
      row({
        fixtureId: matchMId,
        kickoffUtc: matchMKickoff,
        homeTeamId: GOLDEN_HOME,
        awayTeamId: GOLDEN_OPP_A,
        homeGoals: 2,
        awayGoals: 0,
      }),
      // same-kickoff opp result — must not affect M's opponent strength
      row({
        fixtureId: "c-opp-same",
        kickoffUtc: matchMKickoff,
        homeTeamId: GOLDEN_OPP_A,
        awayTeamId: GOLDEN_OTHER,
        homeGoals: 5,
        awayGoals: 0,
      }),
      // post-M opp wins
      row({
        fixtureId: "c-opp-post",
        kickoffUtc: "2026-09-15T15:00:00.000Z",
        homeTeamId: GOLDEN_OPP_A,
        awayTeamId: GOLDEN_OTHER,
        homeGoals: 4,
        awayGoals: 0,
      }),
      // future to target
      row({
        fixtureId: "c-future",
        kickoffUtc: "2026-09-25T15:00:00.000Z",
        homeTeamId: GOLDEN_HOME,
        awayTeamId: GOLDEN_OTHER,
        homeGoals: 9,
        awayGoals: 0,
      }),
      // postponed — must not count for rest/congestion
      row({
        fixtureId: "c-pst",
        kickoffUtc: "2026-09-18T15:00:00.000Z",
        homeTeamId: GOLDEN_HOME,
        awayTeamId: GOLDEN_OTHER,
        status: "PST",
        homeGoals: null,
        awayGoals: null,
      }),
    ],
  };
}

/** GOLDEN D — conflicting duplicate → extraction fatal. */
export function goldenDCorruptedUniverse(): PrematchStrengthUniverseFixture[] {
  return [
    row({
      fixtureId: "dup",
      kickoffUtc: "2026-09-10T15:00:00.000Z",
      homeGoals: 2,
      awayGoals: 0,
    }),
    row({
      fixtureId: "dup",
      kickoffUtc: "2026-09-10T15:00:00.000Z",
      homeGoals: 0,
      awayGoals: 2,
    }),
  ];
}

/**
 * GOLDEN E — competition universe implies long rest; provenance must
 * declare blindness (no fabricated cup match).
 */
export function goldenECrossCompetitionBlindness(): PrematchStrengthUniverseFixture[] {
  return [
    row({
      fixtureId: "e-home-old",
      kickoffUtc: "2026-09-01T15:00:00.000Z",
      homeTeamId: GOLDEN_HOME,
      awayTeamId: GOLDEN_OTHER,
      homeGoals: 1,
      awayGoals: 0,
    }),
    // 19 days later → competition-scoped rest looks long (456h)
    // A midweek cup match is intentionally ABSENT from this universe.
  ];
}
