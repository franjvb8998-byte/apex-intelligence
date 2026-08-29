import { describe, expect, it } from "vitest";
import { createDataPlatform } from "@/lib/data-platform/platform";
import { createMockProvider } from "@/lib/data-platform/providers/mock";
import { DEMO_MATCH_EXTERNAL_ID } from "@/lib/data-platform/providers/_shared/demo-fixture";
import {
  PLATFORM_CACHE_TTL_MS,
  createCataloguePlatformServices,
  createFootballCollector,
  createInMemoryCatalogueStore,
  isPermanentCache,
} from "@/lib/data-platform/v1";

describe("Data Platform v1", () => {
  it("keeps historical snapshots permanent and odds hotter than fixtures", () => {
    expect(isPermanentCache("historical")).toBe(true);
    expect(PLATFORM_CACHE_TTL_MS.odds).toBe(2 * 60 * 1000);
    expect(PLATFORM_CACHE_TTL_MS.fixtures).toBe(15 * 60 * 1000);
    expect(PLATFORM_CACHE_TTL_MS.standings).toBe(6 * 60 * 60 * 1000);
    expect(PLATFORM_CACHE_TTL_MS.teamStats).toBe(24 * 60 * 60 * 1000);
  });

  it("collects mock fixtures into the catalogue for internal services", async () => {
    const platform = createDataPlatform({
      providers: [createMockProvider()],
    });
    const store = createInMemoryCatalogueStore();
    const collector = createFootballCollector({
      provider: platform.providers.mock!,
      normalizer: platform.normalizer,
      store,
    });
    const services = createCataloguePlatformServices(store);

    const result = await collector.collect({
      resource: "fixtures",
      date: "2026-08-17",
    });

    expect(result.status).toBe("collected");
    expect(result.upserted).toBeGreaterThanOrEqual(1);

    const listed = await services.fixtures.list();
    expect(listed.length).toBeGreaterThanOrEqual(1);
    const first = listed[0]!;
    const loaded = await services.fixtures.getById(first.match.id);
    expect(loaded?.match.id).toBe(first.match.id);
    const odds = await services.odds.listForFixture(first.match.id);
    expect(Array.isArray(odds)).toBe(true);
  });

  it("marks standings collection unsupported until the provider port grows", async () => {
    const platform = createDataPlatform({
      providers: [createMockProvider()],
    });
    const collector = createFootballCollector({
      provider: platform.providers.mock!,
      normalizer: platform.normalizer,
      store: createInMemoryCatalogueStore(),
    });
    const result = await collector.collect({ resource: "standings" });
    expect(result.status).toBe("unsupported");
    expect(result.upserted).toBe(0);
  });

  it("snapshots odds through fetchMatch without touching UI loaders", async () => {
    const platform = createDataPlatform({
      providers: [createMockProvider()],
    });
    const store = createInMemoryCatalogueStore();
    const collector = createFootballCollector({
      provider: platform.providers.mock!,
      normalizer: platform.normalizer,
      store,
    });
    const result = await collector.collect({
      resource: "odds",
      externalMatchId: DEMO_MATCH_EXTERNAL_ID,
    });
    expect(result.status).toBe("collected");
    const bundles = await store.listBundles();
    expect(bundles.length).toBe(1);
  });
});
