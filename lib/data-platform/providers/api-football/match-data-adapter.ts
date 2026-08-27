/**
 * Legacy MatchDataProvider adapter for API-Football.
 * Preserved for existing ingest / recorded-fallback paths.
 * New IDataProvider HTTP surface lives in api-football-provider.ts.
 */

import type {
  FetchFixturesQuery,
  FetchMatchQuery,
  MatchDataProvider,
  ProviderCapabilities,
} from "@/lib/data-platform/contracts/match-data-provider";
import type { TtlCache } from "@/lib/data-platform/cache";
import { createTtlCache } from "@/lib/data-platform/cache";
import { DataPlatformHttpError } from "@/lib/data-platform/http";
import { nowIso } from "@/lib/data-platform/providers/_shared/demo-fixture";
import type { ProviderRawEnvelope } from "@/lib/data-platform/types/provider";
import {
  createApiFootballClient,
  tryCreateApiFootballClientFromEnv,
  withApiFootballClientCache,
  type ApiFootballClient,
} from "@/lib/data-platform/providers/api-football/client";
import { readApiFootballEnv } from "@/lib/data-platform/providers/api-football/config";
import {
  createRecordedApiFootballFixturesResponse,
  RECORDED_API_FOOTBALL_FIXTURE_ID,
} from "@/lib/data-platform/providers/api-football/recorded-fixture";
import type { ApiFootballFixturesResponse } from "@/lib/data-platform/providers/api-football/types";

export type ApiFootballProviderOptions = {
  apiKey?: string | null;
  baseUrl?: string;
  client?: ApiFootballClient | null;
  cache?: TtlCache;
  cacheTtlMs?: number;
  fallback?: "recorded" | "error";
  recordedPayload?: ApiFootballFixturesResponse;
  includeEvents?: boolean;
  fetchImpl?: typeof fetch;
};

function hasApiErrors(payload: ApiFootballFixturesResponse): string | null {
  const errors = payload.errors;
  if (!errors) return null;
  if (Array.isArray(errors) && errors.length === 0) return null;
  if (typeof errors === "object" && !Array.isArray(errors)) {
    const values = Object.values(errors as Record<string, unknown>).filter(
      Boolean,
    );
    if (values.length === 0) return null;
    return values.map(String).join("; ");
  }
  if (Array.isArray(errors) && errors.length > 0) {
    return errors.map(String).join("; ");
  }
  return null;
}

/** @deprecated Prefer IDataProvider via api-football-provider.ts for new code. */
export class ApiFootballProvider implements MatchDataProvider {
  readonly id = "api-football" as const;
  readonly displayName = "API-Football";

  private readonly client: ApiFootballClient | null;
  private readonly cache: TtlCache;
  private readonly cacheTtlMs: number;
  private readonly fallback: "recorded" | "error";
  private readonly recordedPayload: ApiFootballFixturesResponse;
  private readonly includeEvents: boolean;

  constructor(options: ApiFootballProviderOptions = {}) {
    const env = readApiFootballEnv();
    const apiKey =
      options.apiKey === undefined ? env.apiKey : options.apiKey;

    this.cache = options.cache ?? createTtlCache({ maxEntries: 1_000 });
    this.cacheTtlMs = options.cacheTtlMs ?? 60_000;
    this.fallback = options.fallback ?? "recorded";
    this.recordedPayload =
      options.recordedPayload ?? createRecordedApiFootballFixturesResponse();
    this.includeEvents = options.includeEvents ?? true;

    if (options.client !== undefined) {
      this.client = options.client;
    } else if (apiKey) {
      this.client = withApiFootballClientCache(
        createApiFootballClient({
          apiKey,
          baseUrl: options.baseUrl ?? env.baseUrl,
          fetchImpl: options.fetchImpl,
        }),
        this.cache,
      );
    } else if (options.apiKey === undefined) {
      const fromEnv = tryCreateApiFootballClientFromEnv(process.env, {
        fetchImpl: options.fetchImpl,
      });
      this.client = fromEnv
        ? withApiFootballClientCache(fromEnv, this.cache)
        : null;
    } else {
      this.client = null;
    }
  }

  capabilities(): ProviderCapabilities {
    return {
      matches: true,
      events: true,
      lineups: true,
      odds: false,
      live: true,
      mockOnly: this.client === null,
    };
  }

  async fetchMatch(query: FetchMatchQuery): Promise<ProviderRawEnvelope> {
    const cacheKey = `api-football:match:${query.externalMatchId}`;
    const cached = this.cache.get<ProviderRawEnvelope>(cacheKey);
    if (cached) {
      return {
        ...cached,
        meta: {
          ...cached.meta,
          cacheHit: true,
        },
      };
    }

    const envelope = this.client
      ? await this.fetchMatchLive(query.externalMatchId)
      : this.fetchMatchFallback(query.externalMatchId);

    this.cache.set(cacheKey, envelope, this.cacheTtlMs);
    return envelope;
  }

  async fetchFixtures(
    query: FetchFixturesQuery = {},
  ): Promise<ProviderRawEnvelope[]> {
    const date = query.date ?? new Date().toISOString().slice(0, 10);
    const cacheKey = `api-football:fixtures:${date}:${query.leagueExternalId ?? ""}:${query.limit ?? ""}`;
    const cached = this.cache.get<ProviderRawEnvelope[]>(cacheKey);
    if (cached) return cached;

    if (!this.client) {
      const single = this.fetchMatchFallback(RECORDED_API_FOOTBALL_FIXTURE_ID);
      const list = [single];
      this.cache.set(cacheKey, list, this.cacheTtlMs);
      return list;
    }

    const payload = await this.client.getFixturesByDate(date);
    const errorMessage = hasApiErrors(payload);
    if (errorMessage) {
      throw new DataPlatformHttpError({
        message: `API-Football fixtures error: ${errorMessage}`,
        code: "provider",
        providerId: this.id,
        details: payload.errors,
      });
    }

    let items = payload.response ?? [];
    if (query.leagueExternalId) {
      items = items.filter(
        (item) => String(item.league.id) === query.leagueExternalId,
      );
    }
    if (query.limit != null && query.limit > 0) {
      items = items.slice(0, query.limit);
    }

    const fetchedAt = nowIso();
    const envelopes: ProviderRawEnvelope[] = items.map((item) => ({
      provider: this.id,
      externalMatchId: String(item.fixture.id),
      fetchedAt,
      payload: {
        ...payload,
        results: 1,
        response: [item],
      },
      meta: {
        endpoint: "GET /fixtures",
        mode: "live",
        date,
      },
    }));

    this.cache.set(cacheKey, envelopes, this.cacheTtlMs);
    return envelopes;
  }

  private async fetchMatchLive(
    externalMatchId: string,
  ): Promise<ProviderRawEnvelope> {
    const client = this.client!;
    const payload = await client.getFixture(externalMatchId);
    const errorMessage = hasApiErrors(payload);
    if (errorMessage) {
      throw new DataPlatformHttpError({
        message: `API-Football fixture error: ${errorMessage}`,
        code: "provider",
        providerId: this.id,
        details: payload.errors,
      });
    }

    if (!payload.response?.length) {
      throw new DataPlatformHttpError({
        message: `API-Football fixture not found: ${externalMatchId}`,
        code: "not_found",
        status: 404,
        providerId: this.id,
      });
    }

    if (this.includeEvents) {
      try {
        const events = await client.getEvents(externalMatchId);
        const first = payload.response[0]!;
        first.events = events.response ?? first.events ?? [];
      } catch {
        // Events are optional enrichment — keep fixture if events fail.
      }
    }

    return {
      provider: this.id,
      externalMatchId: String(payload.response[0]!.fixture.id),
      fetchedAt: nowIso(),
      payload,
      meta: {
        endpoint: "GET /fixtures?id=",
        mode: "live",
        includeEvents: this.includeEvents,
      },
    };
  }

  private fetchMatchFallback(externalMatchId: string): ProviderRawEnvelope {
    if (this.fallback === "error") {
      throw new DataPlatformHttpError({
        message:
          "API-Football client not configured. Set API_FOOTBALL_KEY or pass options.client.",
        code: "unauthorized",
        providerId: this.id,
      });
    }

    const recorded = structuredClone(this.recordedPayload);

    return {
      provider: this.id,
      externalMatchId: String(
        recorded.response[0]?.fixture.id ?? RECORDED_API_FOOTBALL_FIXTURE_ID,
      ),
      fetchedAt: nowIso(),
      payload: recorded,
      meta: {
        endpoint: "recorded-fixture",
        mode: "recorded",
        notes: [
          "Serving recorded API-Football payload (no API_FOOTBALL_KEY).",
          `Requested id: ${externalMatchId}`,
        ],
      },
    };
  }
}

export function createApiFootballProvider(
  options?: ApiFootballProviderOptions,
): MatchDataProvider {
  return new ApiFootballProvider(options);
}

export {
  RECORDED_API_FOOTBALL_FIXTURE_ID,
  createRecordedApiFootballFixturesResponse,
} from "@/lib/data-platform/providers/api-football/recorded-fixture";
