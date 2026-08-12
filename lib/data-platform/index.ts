/**
 * APEX Data Platform — provider-agnostic ingestion infrastructure.
 *
 * Flow: MatchDataProvider → Normalizer → ApexMatchBundle → DataQuality → EventStore
 * Intelligence Core must consume Apex* types only — never vendor payloads.
 *
 * See docs/DATA_PLATFORM.md
 */

export type * from "@/lib/data-platform/types";
export type * from "@/lib/data-platform/contracts";

export {
  createDataPlatform,
  type DataPlatform,
  type CreateDataPlatformOptions,
  type IngestMatchResult,
} from "@/lib/data-platform/platform";

export {
  createApiFootballProvider,
  ApiFootballProvider,
  createSportMonksProvider,
  SportMonksProvider,
  createFootballDataProvider,
  FootballDataProvider,
  createMockProvider,
  MockProvider,
  DEMO_MATCH_EXTERNAL_ID,
  createDemoFixturePayload,
} from "@/lib/data-platform/providers";

export {
  createMatchDataNormalizer,
  DefaultMatchDataNormalizer,
} from "@/lib/data-platform/normalization";
export { createDefaultProviderMappers } from "@/lib/data-platform/normalization/mappers";

export {
  createDataQualityModule,
  DefaultDataQualityModule,
} from "@/lib/data-platform/quality";

export {
  createInMemoryEventStore,
  InMemoryEventStore,
} from "@/lib/data-platform/event-store";
