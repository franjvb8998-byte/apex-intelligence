/**
 * PE-5.3B — frozen fixture allowlist from the PE-5.3A preflight.
 * Identity only. No outcomes, no provider calls, no artifact writes.
 */

export const PE53B_ORIGIN_REQUEST_CAP = 20 as const;

export const PE53B_LIVE_PROVIDER_AUTHORIZED = false as const;

export const PE53B_IN_MEMORY_CONFIRMATION = "PE53B_IN_MEMORY_ONLY" as const;

export const PE53B_LIVE_CONFIRMATION = "PE53B_EXECUTE_LIVE" as const;

export type Pe53bFixture = {
  slot: number;
  fixtureId: string;
  competitionId: string;
  providerSeason: "2023" | "2024";
  kickoffUtc: string;
  homeTeamId: string;
  awayTeamId: string;
};

export const PE53B_SELECTED_FIXTURES = [
  {
    slot: 1,
    fixtureId: "1035037",
    competitionId: "39",
    providerSeason: "2023",
    kickoffUtc: "2023-08-11T19:00:00.000Z",
    homeTeamId: "44",
    awayTeamId: "50",
  },
  {
    slot: 2,
    fixtureId: "1035553",
    competitionId: "39",
    providerSeason: "2023",
    kickoffUtc: "2024-05-19T15:00:00.000Z",
    homeTeamId: "62",
    awayTeamId: "47",
  },
  {
    slot: 3,
    fixtureId: "1208021",
    competitionId: "39",
    providerSeason: "2024",
    kickoffUtc: "2024-08-16T19:00:00.000Z",
    homeTeamId: "33",
    awayTeamId: "36",
  },
  {
    slot: 4,
    fixtureId: "1208208",
    competitionId: "39",
    providerSeason: "2024",
    kickoffUtc: "2024-12-30T19:45:00.000Z",
    homeTeamId: "57",
    awayTeamId: "49",
  },
  {
    slot: 5,
    fixtureId: "1126192",
    competitionId: "2",
    providerSeason: "2023",
    kickoffUtc: "2023-11-07T17:45:00.000Z",
    homeTeamId: "165",
    awayTeamId: "34",
  },
  {
    slot: 6,
    fixtureId: "1299091",
    competitionId: "2",
    providerSeason: "2024",
    kickoffUtc: "2024-12-11T20:00:00.000Z",
    homeTeamId: "42",
    awayTeamId: "91",
  },
  {
    slot: 7,
    fixtureId: "1184829",
    competitionId: "3",
    providerSeason: "2023",
    kickoffUtc: "2024-04-18T19:00:00.000Z",
    homeTeamId: "48",
    awayTeamId: "168",
  },
  {
    slot: 8,
    fixtureId: "1314299",
    competitionId: "48",
    providerSeason: "2024",
    kickoffUtc: "2024-12-18T20:00:00.000Z",
    homeTeamId: "41",
    awayTeamId: "40",
  },
  {
    slot: 9,
    fixtureId: "1180022",
    competitionId: "45",
    providerSeason: "2023",
    kickoffUtc: "2024-03-16T12:15:00.000Z",
    homeTeamId: "39",
    awayTeamId: "1346",
  },
  {
    slot: 10,
    fixtureId: "1126302",
    competitionId: "848",
    providerSeason: "2023",
    kickoffUtc: "2023-11-09T20:00:00.000Z",
    homeTeamId: "66",
    awayTeamId: "201",
  },
] as const satisfies readonly Pe53bFixture[];

export const PE53B_FIXTURE_ALLOWLIST: readonly string[] =
  PE53B_SELECTED_FIXTURES.map((fixture) => fixture.fixtureId);

const ALLOWLIST_SET = new Set<string>(PE53B_FIXTURE_ALLOWLIST);

export function pe53bFixtureById(fixtureId: string): Pe53bFixture | null {
  const found = PE53B_SELECTED_FIXTURES.find(
    (fixture) => fixture.fixtureId === fixtureId,
  );
  return found ?? null;
}

export function isPe53bFixtureAllowed(fixtureId: string): boolean {
  return ALLOWLIST_SET.has(fixtureId);
}

export const PE53B_FROZEN_RESEARCH_PREFIXES = [
  "data/calibration",
  "lib/debug/calibration/pe4-acquisition",
  "lib/debug/calibration/pe4-as-of-t-features",
  "lib/debug/calibration/pe4-expectation",
  "lib/debug/calibration/pe4-form",
  "lib/prematch-lifecycle",
  "calendar-2025",
  "target-labels-separated",
] as const;

export function assertPe53bResearchPathUntouched(relativePath: string): void {
  const normalized = relativePath.replace(/\\/g, "/");
  const hit = PE53B_FROZEN_RESEARCH_PREFIXES.find((prefix) =>
    normalized.includes(prefix),
  );
  if (hit) {
    throw new Error(`PE-5.3B refuses frozen research path: ${normalized}`);
  }
}
