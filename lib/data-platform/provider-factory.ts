/**
 * Data Platform v2 — ProviderFactory.
 * Selects IDataProvider from env / explicit kind without touching consumers.
 */

import {
  ApiFootballDataProvider,
  createApiFootballDataProvider,
} from "@/lib/data-platform/api-football-provider";
import {
  createMockDataProvider,
  DEMO_MATCH_EXTERNAL_ID,
  MockDataProvider,
} from "@/lib/data-platform/mock-provider";
import type { IDataProvider } from "@/lib/data-platform/provider";
import type {
  DataProviderConfig,
  DataProviderKind,
} from "@/lib/data-platform/types";

const DEFAULT_PROVIDER: DataProviderKind = "mock";

export type ProviderFactoryOptions = {
  /** Explicit kind overrides env. */
  provider?: DataProviderKind;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  mock?: ConstructorParameters<typeof MockDataProvider>[0];
  apiFootball?: ConstructorParameters<typeof ApiFootballDataProvider>[0];
};

/**
 * Read provider selection from environment.
 * `APEX_DATA_PROVIDER` = mock | api-football (default: mock).
 */
export function readDataProviderConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): DataProviderConfig {
  const raw = (env.APEX_DATA_PROVIDER ?? DEFAULT_PROVIDER)
    .trim()
    .toLowerCase();

  const provider: DataProviderKind =
    raw === "api-football" ? "api-football" : "mock";

  const defaultMatchId =
    env.APEX_DATA_DEFAULT_MATCH_ID?.trim() ||
    env.API_FOOTBALL_DEFAULT_FIXTURE_ID?.trim() ||
    DEMO_MATCH_EXTERNAL_ID;

  return { provider, defaultMatchId };
}

export class ProviderFactory {
  static create(options: ProviderFactoryOptions = {}): IDataProvider {
    const config = readDataProviderConfig(options.env);
    const kind = options.provider ?? config.provider;

    switch (kind) {
      case "api-football":
        return createApiFootballDataProvider(options.apiFootball);
      case "mock":
      default:
        return createMockDataProvider(options.mock);
    }
  }
}

/** Convenience: build the configured provider (mock by default). */
export function createDataProviderFromEnv(
  options: Omit<ProviderFactoryOptions, "provider"> = {},
): IDataProvider {
  return ProviderFactory.create(options);
}

export function getDefaultMatchId(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): string {
  return readDataProviderConfig(env).defaultMatchId ?? DEMO_MATCH_EXTERNAL_ID;
}
