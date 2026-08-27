/**
 * API-Football IDataProvider — Real Data v1 (Sprint 6).
 * Selected via ProviderFactory when APEX_DATA_PROVIDER=api-football.
 * Without API_FOOTBALL_KEY / API_KEY → recorded fixtures (app keeps working).
 */

import { createTtlCache, type TtlCache } from "@/lib/data-platform/cache";
import { createDataQualityModule } from "@/lib/data-platform/quality";
import { nowIso } from "@/lib/data-platform/providers/_shared/demo-fixture";
import type { IDataProvider } from "@/lib/data-platform/provider";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import type { ProviderRawEnvelope } from "@/lib/data-platform/types/provider";
import type {
  DataProviderFixturesQuery,
  DataProviderMatchQuery,
} from "@/lib/data-platform/types";
import {
  createApiFootballClient,
  tryCreateApiFootballClientFromEnv,
  withApiFootballClientCache,
  type ApiFootballClient,
} from "@/lib/data-platform/providers/api-football/client";
import {
  API_FOOTBALL_CACHE_TTL_MS,
  isApiFootballRateLimitMessage,
} from "@/lib/data-platform/providers/api-football/cache-policy";
import {
  readApiFootballConfig,
  type ApiFootballConfig,
} from "@/lib/data-platform/providers/api-football/config";
import { ApiFootballError } from "@/lib/data-platform/providers/api-football/errors";
import { createFixtureApiFootballClient } from "@/lib/data-platform/providers/api-football/fixture-client";
import {
  RECORDED_API_FOOTBALL_FIXTURE_ID,
} from "@/lib/data-platform/providers/api-football/fixtures";
import {
  mapApiFootballEnvelopeToApexBundle,
  mapApiFootballStatus,
} from "@/lib/data-platform/providers/api-football/mapper";
import type {
  ApiFootballFixtureItem,
  ApiFootballFixturesResponse,
  ApiFootballOddsItem,
} from "@/lib/data-platform/providers/api-football/types";

export type ApiFootballDataProviderOptions = {
  apiKey?: string | null;
  baseUrl?: string;
  client?: ApiFootballClient;
  config?: Partial<ApiFootballConfig>;
  fetchImpl?: typeof fetch;
  /** When true, also fetch events + lineups and merge into the fixture. */
  enrichMatch?: boolean;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  /**
   * When no API key: use recorded fixtures (`recorded`, default) or throw (`error`).
   */
  fallback?: "recorded" | "error";
  cache?: TtlCache;
  cacheTtlMs?: number;
  /** Disable response cache (tests). Default true. */
  useCache?: boolean;
};

/** Process-wide HTTP cache so Dashboard and Match Center share fixture responses. */
const sharedApiFootballCache = createTtlCache({
  defaultTtlMs: API_FOOTBALL_CACHE_TTL_MS.match,
  maxEntries: 1_000,
});

function vendorErrorMessage(payload: { errors?: unknown }): string | null {
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

function throwVendorError(
  scope: "fixture" | "fixtures",
  vendorError: string,
  details: unknown,
): never {
  const rateLimited = isApiFootballRateLimitMessage(vendorError);
  throw new ApiFootballError({
    message: `API-Football ${scope} error: ${vendorError}`,
    code: rateLimited ? "rate_limited" : "vendor_error",
    status: rateLimited ? 429 : null,
    details,
  });
}

function toEnvelope(
  payload: ApiFootballFixturesResponse,
  externalMatchId: string,
  mode: "live" | "recorded",
): ProviderRawEnvelope {
  return {
    provider: "api-football",
    externalMatchId,
    fetchedAt: nowIso(),
    payload,
    meta: {
      endpoint: "GET /fixtures",
      mode,
    },
  };
}

/**
 * HTTP / recorded provider implementing IDataProvider.
 */
export class ApiFootballDataProvider implements IDataProvider {
  readonly id = "api-football" as const;
  readonly displayName = "API-Football";

  private readonly client: ApiFootballClient;
  private readonly enrichMatch: boolean;
  private readonly quality = createDataQualityModule();
  private readonly mode: "live" | "recorded";

  constructor(options: ApiFootballDataProviderOptions = {}) {
    this.enrichMatch = options.enrichMatch ?? true;
    const env = options.env ?? process.env;
    const config = readApiFootballConfig(env);
    const fallback = options.fallback ?? "recorded";
    const cache = options.cache ?? sharedApiFootballCache;
    const useCache = options.useCache !== false;

    const wrap = (client: ApiFootballClient) =>
      useCache
        ? withApiFootballClientCache(client, cache, {
            ttlMs: options.cacheTtlMs,
          })
        : client;

    if (options.client) {
      this.client = wrap(options.client);
      this.mode = "live";
      return;
    }

    const apiKey =
      options.apiKey === undefined ? config.apiKey : options.apiKey;

    if (apiKey) {
      this.client = wrap(
        createApiFootballClient({
          apiKey,
          baseUrl: options.baseUrl ?? config.baseUrl,
          fetchImpl: options.fetchImpl,
          config: { ...config, ...options.config },
        }),
      );
      this.mode = "live";
      return;
    }

    if (options.apiKey === undefined) {
      const fromEnv = tryCreateApiFootballClientFromEnv(env, {
        fetchImpl: options.fetchImpl,
        config: options.config,
      });
      if (fromEnv) {
        this.client = wrap(fromEnv);
        this.mode = "live";
        return;
      }
    }

    if (fallback === "error") {
      throw new ApiFootballError({
        message:
          "ApiFootballDataProvider requires API_FOOTBALL_KEY / API_KEY (or options.client).",
        code: "missing_api_key",
      });
    }

    this.client = wrap(createFixtureApiFootballClient());
    this.mode = "recorded";
  }

  /** Expose the typed HTTP (or fixture) client for advanced callers. */
  get http(): ApiFootballClient {
    return this.client;
  }

  /** `live` when calling api-sports; `recorded` when offline fixtures are used. */
  get dataMode(): "live" | "recorded" {
    return this.mode;
  }

  async getMatch(query: DataProviderMatchQuery): Promise<ApexMatchBundle> {
    const matchId =
      query.matchId ||
      RECORDED_API_FOOTBALL_FIXTURE_ID;

    const payload = await this.client.getFixture(matchId);
    const vendorError = vendorErrorMessage(payload);
    if (vendorError) {
      throwVendorError("fixture", vendorError, payload.errors);
    }
    if (!payload.response?.length) {
      // Offline convenience: unknown ids fall back to the recorded sample.
      if (this.mode === "recorded") {
        const recorded = await this.client.getFixture(
          RECORDED_API_FOOTBALL_FIXTURE_ID,
        );
        return this.bundleFromPayload(recorded, RECORDED_API_FOOTBALL_FIXTURE_ID);
      }
      throw new ApiFootballError({
        message: `API-Football fixture not found: ${matchId}`,
        code: "empty_response",
        status: 404,
      });
    }

    const item = payload.response[0]!;

    if (this.enrichMatch && this.mode === "live") {
      const fixtureId = String(item.fixture.id);
      try {
        const events = await this.client.getEvents(fixtureId);
        item.events = events.response ?? item.events ?? [];
      } catch {
        // optional enrichment
      }
      try {
        const lineups = await this.client.getLineups(fixtureId);
        item.lineups = lineups.response ?? item.lineups ?? [];
      } catch {
        // optional enrichment
      }
    }

    let oddsItems: ApiFootballOddsItem[] | undefined;
    if (this.enrichMatch) {
      try {
        const oddsPayload = await this.client.getFixtureOdds(
          String(item.fixture.id),
        );
        oddsItems = oddsPayload.response ?? [];
      } catch {
        // optional enrichment
      }
    }

    return this.bundleFromPayload(
      payload,
      String(item.fixture.id),
      oddsItems,
    );
  }

  async listFixtures(
    query: DataProviderFixturesQuery = {},
  ): Promise<ApexMatchBundle[]> {
    const payload =
      query.leagueId && query.season
        ? await this.client.getFixturesByLeague(query.leagueId, query.season)
        : await this.client.getFixturesByDate(
            query.date ?? new Date().toISOString().slice(0, 10),
          );
    const vendorError = vendorErrorMessage(payload);
    if (vendorError) {
      throwVendorError("fixtures", vendorError, payload.errors);
    }

    let items = payload.response ?? [];
    if (query.leagueId && !query.season) {
      items = items.filter((item) => String(item.league.id) === query.leagueId);
    }
    items = rankFixtureItems(items);
    if (query.limit != null && query.limit > 0) {
      items = items.slice(0, query.limit);
    }

    return items.map((item) => {
      const single: ApiFootballFixturesResponse = {
        ...payload,
        results: 1,
        response: [item],
      };
      return this.bundleFromPayload(single, String(item.fixture.id));
    });
  }

  private bundleFromPayload(
    payload: ApiFootballFixturesResponse,
    externalMatchId: string,
    odds?: ApiFootballOddsItem[] | null,
  ): ApexMatchBundle {
    const bundle = mapApiFootballEnvelopeToApexBundle(
      toEnvelope(payload, externalMatchId, this.mode),
      { odds },
    );
    bundle.trustScore = this.quality.score(bundle);
    return bundle;
  }
}

function rankFixtureItems(
  items: ApiFootballFixtureItem[],
): ApiFootballFixtureItem[] {
  const rank = (item: ApiFootballFixtureItem) => {
    const status = mapApiFootballStatus(item.fixture.status.short);
    if (status === "live") return 0;
    if (status === "scheduled") return 1;
    if (status === "finished") return 2;
    return 3;
  };
  return [...items].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.fixture.date ?? "").localeCompare(b.fixture.date ?? ""),
  );
}

export function createApiFootballDataProvider(
  options?: ApiFootballDataProviderOptions,
): IDataProvider {
  return new ApiFootballDataProvider(options);
}
