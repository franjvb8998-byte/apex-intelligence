import type { DataQualityModule } from "@/lib/data-platform/contracts/data-quality";
import type { EventStore } from "@/lib/data-platform/contracts/event-store";
import type { MatchDataProvider } from "@/lib/data-platform/contracts/match-data-provider";
import type { MatchDataNormalizer } from "@/lib/data-platform/contracts/normalizer";
import { createDataQualityModule } from "@/lib/data-platform/quality";
import { createInMemoryEventStore } from "@/lib/data-platform/event-store";
import { createMatchDataNormalizer } from "@/lib/data-platform/normalization";
import { createMockProvider } from "@/lib/data-platform/providers/mock";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";

export type IngestMatchResult = {
  bundle: ApexMatchBundle;
  eventsAppended: number;
};

export type DataPlatform = {
  providers: Record<string, MatchDataProvider>;
  normalizer: MatchDataNormalizer;
  quality: DataQualityModule;
  eventStore: EventStore;
  /**
   * Provider → normalize → trust score → event store.
   * Intelligence Core should receive `bundle` only (Apex model).
   */
  ingestMatch(input: {
    providerId: string;
    externalMatchId: string;
    persistEvents?: boolean;
  }): Promise<IngestMatchResult>;
};

export type CreateDataPlatformOptions = {
  providers?: MatchDataProvider[];
  normalizer?: MatchDataNormalizer;
  quality?: DataQualityModule;
  eventStore?: EventStore;
};

/**
 * Composition root for the Data Platform (infra only).
 * Swap providers without touching Intelligence Core.
 */
export function createDataPlatform(
  options: CreateDataPlatformOptions = {},
): DataPlatform {
  const providerList = options.providers ?? [createMockProvider()];
  const providers: Record<string, MatchDataProvider> = {};
  for (const provider of providerList) {
    providers[provider.id] = provider;
  }

  const normalizer = options.normalizer ?? createMatchDataNormalizer();
  const quality = options.quality ?? createDataQualityModule();
  const eventStore = options.eventStore ?? createInMemoryEventStore();

  return {
    providers,
    normalizer,
    quality,
    eventStore,
    async ingestMatch(input) {
      const provider = providers[input.providerId];
      if (!provider) {
        throw new Error(
          `Unknown provider "${input.providerId}". Register it in createDataPlatform({ providers }).`,
        );
      }

      const envelope = await provider.fetchMatch({
        externalMatchId: input.externalMatchId,
      });
      const bundle = normalizer.normalize(envelope);
      const trustScore = quality.score(bundle);
      bundle.trustScore = trustScore;

      let eventsAppended = 0;
      if (input.persistEvents !== false && bundle.events.length > 0) {
        await eventStore.append({
          matchId: bundle.match.id,
          events: bundle.events,
        });
        eventsAppended = bundle.events.length;
      }

      return { bundle, eventsAppended };
    },
  };
}
