import type { ProviderMapper } from "@/lib/data-platform/contracts/normalizer";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import type { ApexMatchEvent } from "@/lib/data-platform/types/event";
import type { DataProviderId } from "@/lib/data-platform/types/ids";
import type { ApexOddsQuote } from "@/lib/data-platform/types/odds";
import type { ApexPlayer } from "@/lib/data-platform/types/team";
import type { ProviderRawEnvelope } from "@/lib/data-platform/types/provider";
import {
  apexIdFor,
  nowIso,
  type MockFixturePayload,
} from "@/lib/data-platform/providers/_shared/demo-fixture";
import {
  isApiFootballFixturesPayload,
  mapApiFootballEnvelopeToApexBundle,
} from "@/lib/data-platform/providers/api-football/mapper";

function isFixturePayload(value: unknown): value is MockFixturePayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "match" in value &&
    "players" in value &&
    "events" in value &&
    "odds" in value
  );
}

/**
 * Unwrap vendor nesting → shared MockFixturePayload.
 * Real mappers will replace this with proper DTO parsing per provider.
 */
export function extractFixturePayload(
  provider: DataProviderId,
  payload: unknown,
): MockFixturePayload {
  if (isFixturePayload(payload)) {
    return payload;
  }

  if (
    provider === "api-football" &&
    typeof payload === "object" &&
    payload !== null &&
    "response" in payload &&
    Array.isArray((payload as { response: unknown }).response)
  ) {
    const first = (payload as { response: unknown[] }).response[0];
    if (isFixturePayload(first)) return first;
  }

  if (
    provider === "sportmonks" &&
    typeof payload === "object" &&
    payload !== null &&
    "data" in payload
  ) {
    const data = (payload as { data: unknown }).data;
    if (isFixturePayload(data)) return data;
  }

  throw new Error(
    `Unable to extract fixture payload for provider "${provider}"`,
  );
}

export function mapFixtureToApexBundle(
  provider: DataProviderId,
  envelope: ProviderRawEnvelope,
  fixture: MockFixturePayload,
): ApexMatchBundle {
  const matchId = apexIdFor(provider, "match", fixture.match.id);
  const homeTeamId = apexIdFor(provider, "team", fixture.match.home.id);
  const awayTeamId = apexIdFor(provider, "team", fixture.match.away.id);
  const leagueId = apexIdFor(provider, "league", fixture.match.league.id);
  const ingestedAt = envelope.fetchedAt;
  const updatedAt = nowIso();

  const players: ApexPlayer[] = fixture.players.map((player) => ({
    id: apexIdFor(provider, "player", player.id),
    teamId: apexIdFor(provider, "team", player.teamId),
    name: player.name,
    shirtNumber: player.shirtNumber,
    position: player.position,
    nationality: null,
    externalRefs: [{ provider, externalId: player.id }],
  }));

  const events: ApexMatchEvent[] = [...fixture.events]
    .sort((a, b) => {
      const byTime = a.occurredAt.localeCompare(b.occurredAt);
      if (byTime !== 0) return byTime;
      return (a.minute ?? 0) - (b.minute ?? 0);
    })
    .map((event, index) => ({
      id: apexIdFor(provider, "event", event.id),
      matchId,
      minute: event.minute,
      occurredAt: event.occurredAt,
      type: event.type,
      teamId: event.teamId
        ? apexIdFor(provider, "team", event.teamId)
        : null,
      playerId: event.playerId
        ? apexIdFor(provider, "player", event.playerId)
        : null,
      assistPlayerId: null,
      payload: event.payload ?? {},
      sourceProvider: provider,
      sourceEventId: event.id,
      sequence: index + 1,
    }));

  const odds: ApexOddsQuote[] = fixture.odds.map((quote) => ({
    id: apexIdFor(provider, "odds", quote.id),
    matchId,
    market: quote.market,
    line: quote.line,
    bookmaker: quote.bookmaker,
    selections: quote.selections.map((selection) => ({
      key: selection.key,
      label: selection.label,
      decimalOdds: selection.decimalOdds,
      impliedProbability:
        selection.decimalOdds > 0 ? 1 / selection.decimalOdds : null,
    })),
    capturedAt: quote.capturedAt,
    sourceProvider: provider,
    externalRefs: [{ provider, externalId: quote.id }],
  }));

  return {
    match: {
      id: matchId,
      leagueId,
      homeTeamId,
      awayTeamId,
      kickoffAt: fixture.match.kickoffAt,
      status: fixture.match.status,
      score: {
        home: fixture.match.score.home,
        away: fixture.match.score.away,
      },
      venue: fixture.match.venue
        ? {
            name: fixture.match.venue.name,
            city: fixture.match.venue.city,
            country: fixture.match.venue.country,
          }
        : null,
      minute: fixture.match.minute,
      externalRefs: [{ provider, externalId: fixture.match.id }],
      ingestedAt,
      updatedAt,
    },
    league: {
      id: leagueId,
      name: fixture.match.league.name,
      country: fixture.match.league.country,
      sport: "football",
      season: fixture.match.league.season,
      externalRefs: [{ provider, externalId: fixture.match.league.id }],
    },
    homeTeam: {
      id: homeTeamId,
      leagueId,
      name: fixture.match.home.name,
      shortName: fixture.match.home.shortName,
      crestUrl: null,
      externalRefs: [{ provider, externalId: fixture.match.home.id }],
    },
    awayTeam: {
      id: awayTeamId,
      leagueId,
      name: fixture.match.away.name,
      shortName: fixture.match.away.shortName,
      crestUrl: null,
      externalRefs: [{ provider, externalId: fixture.match.away.id }],
    },
    players,
    events,
    odds,
    provenance: {
      primaryProvider: provider,
      providers: [provider],
      normalizedAt: updatedAt,
    },
  };
}

function createMapper(provider: DataProviderId): ProviderMapper {
  return {
    provider,
    toApexBundle(envelope: ProviderRawEnvelope): ApexMatchBundle {
      if (envelope.provider !== provider) {
        throw new Error(
          `Mapper for ${provider} received envelope from ${envelope.provider}`,
        );
      }
      const fixture = extractFixturePayload(provider, envelope.payload);
      return mapFixtureToApexBundle(provider, envelope, fixture);
    },
  };
}

export const mockProviderMapper = createMapper("mock");

/**
 * API-Football mapper: prefers real vendor DTOs; falls back to legacy
 * MockFixturePayload nesting used by older demo envelopes.
 */
export const apiFootballMapper: ProviderMapper = {
  provider: "api-football",
  toApexBundle(envelope: ProviderRawEnvelope): ApexMatchBundle {
    if (envelope.provider !== "api-football") {
      throw new Error(
        `Mapper for api-football received envelope from ${envelope.provider}`,
      );
    }
    if (isApiFootballFixturesPayload(envelope.payload)) {
      return mapApiFootballEnvelopeToApexBundle(envelope);
    }
    const fixture = extractFixturePayload("api-football", envelope.payload);
    return mapFixtureToApexBundle("api-football", envelope, fixture);
  },
};

export const sportMonksMapper = createMapper("sportmonks");
export const footballDataMapper = createMapper("football-data");

export function createDefaultProviderMappers(): ProviderMapper[] {
  return [
    mockProviderMapper,
    apiFootballMapper,
    sportMonksMapper,
    footballDataMapper,
  ];
}
