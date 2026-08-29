/**
 * Football Collector — vendor → normalizer → catalogue.
 * No React. No app/. No Decision Engine. No product pages.
 */

import type { MatchDataNormalizer } from "@/lib/data-platform/contracts/normalizer";
import type {
  FetchFixturesQuery,
  MatchDataProvider,
} from "@/lib/data-platform/contracts/match-data-provider";
import type { CatalogueStore } from "@/lib/data-platform/v1/catalogue-store";

export type CollectorResource =
  | "fixtures"
  | "odds"
  | "standings"
  | "team_statistics"
  | "injuries"
  | "lineups"
  | "h2h"
  | "recent_form";

export type CollectorJob = {
  resource: CollectorResource;
  /** UTC date YYYY-MM-DD for fixture lists. */
  date?: string;
  leagueExternalId?: string;
  externalMatchId?: string;
  limit?: number;
};

export type CollectorResult = {
  resource: CollectorResource;
  status: "collected" | "unsupported";
  upserted: number;
  detail: string;
};

export type FootballCollector = {
  collect(job: CollectorJob): Promise<CollectorResult>;
};

export type CreateFootballCollectorOptions = {
  provider: MatchDataProvider;
  normalizer: MatchDataNormalizer;
  store: CatalogueStore;
};

function fixturesQuery(job: CollectorJob): FetchFixturesQuery {
  return {
    date: job.date,
    leagueExternalId: job.leagueExternalId,
    limit: job.limit,
  };
}

/**
 * Ingests raw provider envelopes through the existing normalizer into the catalogue.
 * Resources that still live only on ApiFootballDataProvider HTTP helpers return
 * `unsupported` until those endpoints are lifted onto MatchDataProvider.
 */
export function createFootballCollector(
  options: CreateFootballCollectorOptions,
): FootballCollector {
  const { provider, normalizer, store } = options;

  return {
    async collect(job) {
      if (job.resource === "fixtures") {
        if (!provider.fetchFixtures) {
          return {
            resource: job.resource,
            status: "unsupported",
            upserted: 0,
            detail: `${provider.id} does not expose fetchFixtures.`,
          };
        }
        const envelopes = await provider.fetchFixtures(fixturesQuery(job));
        let upserted = 0;
        for (const envelope of envelopes) {
          const bundle = normalizer.normalize(envelope);
          await store.upsertBundle(bundle);
          upserted += 1;
        }
        return {
          resource: job.resource,
          status: "collected",
          upserted,
          detail: `Normalized ${upserted} fixture envelope(s) from ${provider.id}.`,
        };
      }

      if (job.resource === "odds" && job.externalMatchId) {
        const envelope = await provider.fetchMatch({
          externalMatchId: job.externalMatchId,
        });
        const bundle = normalizer.normalize(envelope);
        await store.upsertBundle(bundle);
        return {
          resource: job.resource,
          status: "collected",
          upserted: bundle.odds.length,
          detail: `Snapshot odds for ${bundle.match.id} (${bundle.odds.length} quote(s)).`,
        };
      }

      return {
        resource: job.resource,
        status: "unsupported",
        upserted: 0,
        detail:
          "Lift this resource onto MatchDataProvider before the Collector can persist it. Do not call ApiFootball HTTP from product pages.",
      };
    },
  };
}
