/**
 * Map vendor fixture/odds payloads into calibration reconstruction input.
 * Debug/collector only.
 */

import type { ReconstructionFixture } from "@/lib/debug/calibration/types";
import type {
  ApiFootballFixtureItem,
  ApiFootballOddsItem,
  ApiFootballOddsResponse,
} from "@/lib/data-platform/providers/api-football/types";

export function reconstructionFixtureFromVendor(
  item: ApiFootballFixtureItem,
): ReconstructionFixture {
  return {
    fixtureId: String(item.fixture.id),
    kickoff: item.fixture.date,
    competitionId: String(item.league.id),
    competitionName: item.league.name,
    season: String(item.league.season ?? ""),
    homeTeamId: String(item.teams.home.id),
    homeTeamName: item.teams.home.name,
    awayTeamId: String(item.teams.away.id),
    awayTeamName: item.teams.away.name,
    status: item.fixture.status.short,
    goalsHome: item.goals.home,
    goalsAway: item.goals.away,
    fulltimeHome: item.score?.fulltime?.home ?? null,
    fulltimeAway: item.score?.fulltime?.away ?? null,
  };
}

export type ExtractedOneXTwoOdds = {
  bookmaker: string;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  vendorUpdateAt: string | null;
};

function parseOdd(value: string | undefined): number | null {
  if (value == null) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 1 ? parsed : null;
}

function oneXTwoFromBookmaker(
  bookmaker: { name: string; bets?: Array<{ name: string; values: Array<{ value: string; odd: string }> }> },
): Omit<ExtractedOneXTwoOdds, "vendorUpdateAt"> | null {
  const bet = (bookmaker.bets ?? []).find((entry) => {
    const name = entry.name.toLowerCase();
    return name.includes("match winner") || name === "1x2";
  });
  if (!bet) return null;
  let home: number | null = null;
  let draw: number | null = null;
  let away: number | null = null;
  for (const value of bet.values) {
    const key = value.value.trim().toLowerCase();
    const odd = parseOdd(value.odd);
    if (odd == null) continue;
    if (key === "home" || key === "1") home = odd;
    else if (key === "draw" || key === "x") draw = odd;
    else if (key === "away" || key === "2") away = odd;
  }
  if (home == null || draw == null || away == null) return null;
  return { bookmaker: bookmaker.name, homeOdds: home, drawOdds: draw, awayOdds: away };
}

function vendorUpdateAt(item: ApiFootballOddsItem): string | null {
  const record = item as ApiFootballOddsItem & { update?: unknown };
  return typeof record.update === "string" && record.update.trim()
    ? record.update
    : null;
}

export function extractOneXTwoOdds(
  payload: ApiFootballOddsResponse | null | undefined,
): ExtractedOneXTwoOdds | null {
  const items = payload?.response ?? [];
  const candidates: ExtractedOneXTwoOdds[] = [];
  for (const item of items) {
    const update = vendorUpdateAt(item);
    const bookmakers = [...(item.bookmakers ?? [])].sort((a, b) => a.id - b.id);
    for (const bookmaker of bookmakers) {
      const extracted = oneXTwoFromBookmaker(bookmaker);
      if (!extracted) continue;
      candidates.push({ ...extracted, vendorUpdateAt: update });
    }
  }
  const pinnacle = candidates.find((row) =>
    row.bookmaker.toLowerCase().includes("pinnacle"),
  );
  return pinnacle ?? candidates[0] ?? null;
}
