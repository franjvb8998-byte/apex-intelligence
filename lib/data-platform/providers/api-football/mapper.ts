/**
 * Map API-Football vendor DTOs → ApexMatchBundle.
 * Owns all vendor-specific translation for this provider.
 */

import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import type { ApexMatchEvent, ApexEventType } from "@/lib/data-platform/types/event";
import type { ApexMatchStatus } from "@/lib/data-platform/types/match";
import type { ApexOddsQuote } from "@/lib/data-platform/types/odds";
import type { ApexPlayer, PlayerPosition } from "@/lib/data-platform/types/team";
import type { ProviderRawEnvelope } from "@/lib/data-platform/types/provider";
import {
  apexIdFor,
  nowIso,
} from "@/lib/data-platform/providers/_shared/demo-fixture";
import type {
  ApiFootballEvent,
  ApiFootballFixtureItem,
  ApiFootballFixturesResponse,
  ApiFootballLineup,
  ApiFootballOddsItem,
  ApiFootballStatusShort,
} from "@/lib/data-platform/providers/api-football/types";

const PROVIDER = "api-football" as const;

export function isApiFootballFixturesPayload(
  payload: unknown,
): payload is ApiFootballFixturesResponse {
  if (typeof payload !== "object" || payload === null) return false;
  if (!("response" in payload)) return false;
  const response = (payload as { response: unknown }).response;
  if (!Array.isArray(response) || response.length === 0) return false;
  const first = response[0];
  return (
    typeof first === "object" &&
    first !== null &&
    "fixture" in first &&
    "teams" in first &&
    "goals" in first
  );
}

export function mapApiFootballStatus(
  short: ApiFootballStatusShort,
): ApexMatchStatus {
  switch (short) {
    case "NS":
    case "TBD":
      return "scheduled";
    case "1H":
    case "2H":
    case "HT":
    case "ET":
    case "BT":
    case "P":
    case "LIVE":
    case "INT":
      return "live";
    case "FT":
    case "AET":
    case "PEN":
      return "finished";
    case "PST":
      return "postponed";
    case "CANC":
    case "ABD":
    case "AWD":
    case "WO":
      return "cancelled";
    case "SUSP":
      return "suspended";
    default:
      return "unknown";
  }
}

function mapEventType(type: string, detail: string): ApexEventType {
  const t = type.toLowerCase();
  const d = detail.toLowerCase();
  if (t === "goal") {
    if (d.includes("own")) return "own_goal";
    if (d.includes("penalty") && d.includes("miss")) return "penalty_miss";
    if (d.includes("penalty")) return "penalty_goal";
    return "goal";
  }
  if (t === "card") {
    if (d.includes("red")) return "red_card";
    return "yellow_card";
  }
  if (t === "subst") return "substitution";
  if (t === "var") return "var";
  return "other";
}

function mapPosition(pos: string | null | undefined): PlayerPosition {
  switch ((pos ?? "").toUpperCase()) {
    case "G":
      return "goalkeeper";
    case "D":
      return "defender";
    case "M":
      return "midfielder";
    case "F":
      return "forward";
    default:
      return "unknown";
  }
}

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 3).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]!.slice(0, 2)).toUpperCase();
}

function mapPlayers(
  lineups: ApiFootballLineup[] | null | undefined,
  leagueId: string,
): ApexPlayer[] {
  if (!lineups?.length) return [];
  const players: ApexPlayer[] = [];
  for (const lineup of lineups) {
    const teamId = apexIdFor(PROVIDER, "team", String(lineup.team.id));
    const rows = [
      ...(lineup.startXI ?? []),
      ...(lineup.substitutes ?? []),
    ];
    for (const row of rows) {
      const id = String(row.player.id);
      players.push({
        id: apexIdFor(PROVIDER, "player", id),
        teamId,
        name: row.player.name,
        shirtNumber: row.player.number ?? null,
        position: mapPosition(row.player.pos),
        nationality: null,
        externalRefs: [{ provider: PROVIDER, externalId: id }],
      });
    }
  }
  // leagueId reserved for future team↔league consistency checks
  void leagueId;
  return players;
}

function mapEvents(
  matchId: string,
  kickoffAt: string,
  events: ApiFootballEvent[] | null | undefined,
): ApexMatchEvent[] {
  if (!events?.length) return [];
  const kickoffMs = Date.parse(kickoffAt);

  return [...events]
    .map((event, index) => {
      const minute = event.time.elapsed;
      const occurredAt =
        Number.isFinite(kickoffMs) && minute != null
          ? new Date(kickoffMs + minute * 60_000).toISOString()
          : kickoffAt;
      const sourceEventId = `${event.type}-${minute ?? "x"}-${event.player.id ?? index}`;
      return {
        id: apexIdFor(PROVIDER, "event", sourceEventId),
        matchId,
        minute,
        occurredAt,
        type: mapEventType(event.type, event.detail),
        teamId: event.team.id
          ? apexIdFor(PROVIDER, "team", String(event.team.id))
          : null,
        playerId: event.player.id
          ? apexIdFor(PROVIDER, "player", String(event.player.id))
          : null,
        assistPlayerId: event.assist?.id
          ? apexIdFor(PROVIDER, "player", String(event.assist.id))
          : null,
        payload: {
          detail: event.detail,
          comments: event.comments ?? null,
          playerName: event.player.name,
          assistName: event.assist?.name ?? null,
        },
        sourceProvider: PROVIDER,
        sourceEventId,
        sequence: 0,
      } satisfies ApexMatchEvent;
    })
    .sort((a, b) => {
      const byTime = a.occurredAt.localeCompare(b.occurredAt);
      if (byTime !== 0) return byTime;
      return (a.minute ?? 0) - (b.minute ?? 0);
    })
    .map((event, index) => ({ ...event, sequence: index + 1 }));
}

function parseDecimalOdds(raw: string): number | null {
  const decimalOdds = Number.parseFloat(raw);
  return Number.isFinite(decimalOdds) ? decimalOdds : null;
}

function impliedFromDecimal(decimalOdds: number | null): number | null {
  return decimalOdds != null && decimalOdds > 0 ? 1 / decimalOdds : null;
}

function mapOneXTwoKey(value: string): string {
  const normalized = value.toLowerCase();
  if (normalized === "home" || value === "1") return "home";
  if (normalized === "away" || value === "2") return "away";
  return "draw";
}

function parseOverUnder(value: string): { key: "over" | "under"; line: number } | null {
  const match = value.trim().match(/^(over|under)\s+([0-9]+(?:\.[0-9]+)?)/i);
  if (!match) return null;
  const line = Number.parseFloat(match[2]!);
  if (!Number.isFinite(line)) return null;
  return {
    key: match[1]!.toLowerCase() === "over" ? "over" : "under",
    line,
  };
}

function mapBttsKey(value: string): "yes" | "no" | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "yes" || normalized === "si" || normalized === "sí") {
    return "yes";
  }
  if (normalized === "no") return "no";
  return null;
}

function mapOdds(
  matchId: string,
  oddsItems: ApiFootballOddsItem[] | null | undefined,
): ApexOddsQuote[] {
  if (!oddsItems?.length) return [];
  const quotes: ApexOddsQuote[] = [];
  const bookmaker = oddsItems[0]?.bookmakers?.[0];
  if (!bookmaker) return quotes;

  for (const bet of bookmaker.bets ?? []) {
    const name = bet.name.toLowerCase();
    if (name.includes("match winner") || name === "1x2") {
      const selections = bet.values.map((value) => {
        const decimalOdds = parseDecimalOdds(value.odd);
        return {
          key: mapOneXTwoKey(value.value),
          label: value.value,
          decimalOdds,
          impliedProbability: impliedFromDecimal(decimalOdds),
        };
      });
      quotes.push({
        id: apexIdFor(PROVIDER, "odds", `${matchId}-1x2-${bookmaker.id}`),
        matchId,
        market: "1x2",
        line: null,
        bookmaker: bookmaker.name,
        selections,
        capturedAt: nowIso(),
        sourceProvider: PROVIDER,
        externalRefs: [
          { provider: PROVIDER, externalId: `bet-${bet.id}` },
        ],
      });
      continue;
    }

    if (
      name.includes("goals over/under") ||
      name.includes("over/under") ||
      name === "goals over/under"
    ) {
      const byLine = new Map<
        number,
        Array<{
          key: string;
          label: string;
          decimalOdds: number | null;
          impliedProbability: number | null;
        }>
      >();
      for (const value of bet.values) {
        const parsed = parseOverUnder(value.value);
        if (!parsed) continue;
        const decimalOdds = parseDecimalOdds(value.odd);
        const list = byLine.get(parsed.line) ?? [];
        list.push({
          key: parsed.key,
          label: value.value,
          decimalOdds,
          impliedProbability: impliedFromDecimal(decimalOdds),
        });
        byLine.set(parsed.line, list);
      }
      for (const [line, selections] of byLine) {
        if (selections.length === 0) continue;
        quotes.push({
          id: apexIdFor(
            PROVIDER,
            "odds",
            `${matchId}-ou-${line}-${bookmaker.id}`,
          ),
          matchId,
          market: "over_under",
          line,
          bookmaker: bookmaker.name,
          selections,
          capturedAt: nowIso(),
          sourceProvider: PROVIDER,
          externalRefs: [
            { provider: PROVIDER, externalId: `bet-${bet.id}-${line}` },
          ],
        });
      }
      continue;
    }

    if (
      name.includes("both teams score") ||
      name.includes("both teams to score") ||
      name === "btts"
    ) {
      const selections = bet.values.flatMap((value) => {
        const key = mapBttsKey(value.value);
        if (!key) return [];
        const decimalOdds = parseDecimalOdds(value.odd);
        return [
          {
            key,
            label: value.value,
            decimalOdds,
            impliedProbability: impliedFromDecimal(decimalOdds),
          },
        ];
      });
      if (selections.length === 0) continue;
      quotes.push({
        id: apexIdFor(PROVIDER, "odds", `${matchId}-btts-${bookmaker.id}`),
        matchId,
        market: "btts",
        line: null,
        bookmaker: bookmaker.name,
        selections,
        capturedAt: nowIso(),
        sourceProvider: PROVIDER,
        externalRefs: [
          { provider: PROVIDER, externalId: `bet-${bet.id}` },
        ],
      });
    }
  }
  return quotes;
}

export type MapApiFootballOptions = {
  odds?: ApiFootballOddsItem[] | null;
};

/**
 * Translate one fixtures list envelope into the canonical Apex bundle.
 */
export function mapApiFootballEnvelopeToApexBundle(
  envelope: ProviderRawEnvelope,
  options: MapApiFootballOptions = {},
): ApexMatchBundle {
  if (!isApiFootballFixturesPayload(envelope.payload)) {
    throw new Error(
      "API-Football mapper expected payload.response[0] with fixture/teams/goals",
    );
  }

  const item = envelope.payload.response[0]!;
  return mapApiFootballFixtureItemToApexBundle(envelope, item, options);
}

export function mapApiFootballFixtureItemToApexBundle(
  envelope: ProviderRawEnvelope,
  item: ApiFootballFixtureItem,
  options: MapApiFootballOptions = {},
): ApexMatchBundle {
  const externalMatchId = String(item.fixture.id);
  const matchId = apexIdFor(PROVIDER, "match", externalMatchId);
  const homeTeamId = apexIdFor(PROVIDER, "team", String(item.teams.home.id));
  const awayTeamId = apexIdFor(PROVIDER, "team", String(item.teams.away.id));
  const leagueId = apexIdFor(PROVIDER, "league", String(item.league.id));
  const ingestedAt = envelope.fetchedAt;
  const updatedAt = nowIso();
  const status = mapApiFootballStatus(item.fixture.status.short);
  const kickoffAt = new Date(item.fixture.date).toISOString();

  const players = mapPlayers(item.lineups, leagueId);
  const events = mapEvents(matchId, kickoffAt, item.events);
  const odds = mapOdds(matchId, options.odds);

  return {
    match: {
      id: matchId,
      leagueId,
      homeTeamId,
      awayTeamId,
      kickoffAt,
      status,
      score: {
        home: item.goals.home,
        away: item.goals.away,
        periods: {
          ht: item.score?.halftime
            ? {
                home: item.score.halftime.home,
                away: item.score.halftime.away,
              }
            : undefined,
          ft: item.score?.fulltime
            ? {
                home: item.score.fulltime.home,
                away: item.score.fulltime.away,
              }
            : undefined,
        },
      },
      venue: item.fixture.venue
        ? {
            name: item.fixture.venue.name ?? null,
            city: item.fixture.venue.city ?? null,
            country: item.league.country ?? null,
          }
        : null,
      minute: item.fixture.status.elapsed ?? null,
      externalRefs: [{ provider: PROVIDER, externalId: externalMatchId }],
      ingestedAt,
      updatedAt,
    },
    league: {
      id: leagueId,
      name: item.league.name,
      country: item.league.country ?? null,
      sport: "football",
      season:
        item.league.season != null ? String(item.league.season) : null,
      externalRefs: [
        { provider: PROVIDER, externalId: String(item.league.id) },
      ],
    },
    homeTeam: {
      id: homeTeamId,
      leagueId,
      name: item.teams.home.name,
      shortName: shortName(item.teams.home.name),
      crestUrl: item.teams.home.logo ?? null,
      externalRefs: [
        { provider: PROVIDER, externalId: String(item.teams.home.id) },
      ],
    },
    awayTeam: {
      id: awayTeamId,
      leagueId,
      name: item.teams.away.name,
      shortName: shortName(item.teams.away.name),
      crestUrl: item.teams.away.logo ?? null,
      externalRefs: [
        { provider: PROVIDER, externalId: String(item.teams.away.id) },
      ],
    },
    players,
    events,
    odds,
    provenance: {
      primaryProvider: PROVIDER,
      providers: [PROVIDER],
      normalizedAt: updatedAt,
    },
  };
}
