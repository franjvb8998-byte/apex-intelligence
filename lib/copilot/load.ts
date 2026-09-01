/**
 * Load Match Center payloads for Copilot (Data Platform + PE). Does not invent fixtures.
 * Live feed first; recorded APEX catalogue if API-Football quota is exhausted.
 */

import type { IDataProvider } from "@/lib/data-platform";
import type { DashboardMatchSummary } from "@/lib/dashboard/types";
import {
  getMatchCenterData,
  listMatchCenterFixtures,
  resolveMatchCenterProvider,
  type LoadMatchCenterOptions,
} from "@/lib/match-center";
import type { MatchCenterData } from "@/lib/match-center/types";
import {
  createRecordedDataProvider,
  isQuotaError,
  loadUnlessQuota,
} from "@/lib/repositories";

export const RECORDED_CATALOGUE_NOTE =
  "El feed en vivo de API-Football no está disponible (cuota diaria). Informe del catálogo recorded APEX — cifras de ese dataset, no del mercado de hoy.";

export type CopilotDataLoader = {
  listFixtures: () => Promise<DashboardMatchSummary[]>;
  loadMatch: (externalMatchId: string) => Promise<MatchCenterData>;
};

export type CopilotDataLoaderOptions = LoadMatchCenterOptions & {
  /**
   * When true (default unless a provider is injected), quota errors fall back
   * to the recorded APEX catalogue. Tests inject a provider and skip this.
   */
  useRecordedOnQuota?: boolean;
};

export function isCopilotQuotaFailure(error: unknown): boolean {
  if (isQuotaError(error)) return true;
  return error instanceof Error && error.message === RECORDED_CATALOGUE_NOTE;
}

export function createRecordedCopilotProvider(): IDataProvider {
  return createRecordedDataProvider({ enrichMatch: true });
}

function fixtureKey(row: DashboardMatchSummary): string[] {
  return [row.externalId, row.id].filter((value): value is string => Boolean(value));
}

export function createCopilotDataLoader(
  options: CopilotDataLoaderOptions = {},
): CopilotDataLoader {
  const env = options.env ?? process.env;
  const primary: IDataProvider =
    options.provider ?? resolveMatchCenterProvider(env);
  const useRecordedOnQuota =
    options.useRecordedOnQuota ?? options.provider == null;

  async function listFrom(
    provider: IDataProvider,
    listEnv: NodeJS.ProcessEnv | Record<string, string | undefined> = env,
  ) {
    return listMatchCenterFixtures({ ...options, provider, env: listEnv });
  }

  async function loadFrom(
    provider: IDataProvider,
    externalMatchId: string,
    loadEnv: NodeJS.ProcessEnv | Record<string, string | undefined> = env,
  ) {
    // Removed duplicate listCatalogue on match load: Copilot GET already
    // listed today's catalogue; includeFixtureList: false reuses that and
    // only getById + enrich for the selected fixture. Same-request memo
    // also coalesces listFixtures({ date: today }) with Dashboard.
    return getMatchCenterData({
      ...options,
      provider,
      env: loadEnv,
      externalMatchId,
      includeFixtureList: false,
    });
  }

  async function recordedById(externalMatchId: string) {
    const recorded = createRecordedCopilotProvider();
    const catalogue = await listFrom(recorded, {});
    const hit = catalogue.find((row) =>
      fixtureKey(row).includes(externalMatchId),
    );
    if (!hit) return null;
    const id = hit.externalId ?? hit.id;
    return loadFrom(recorded, id, {});
  }

  return {
    async listFixtures() {
      if (!useRecordedOnQuota) {
        return listFrom(primary);
      }
      const live = await loadUnlessQuota(() => listFrom(primary));
      if (live.ok && live.data.length > 0) return live.data;
      return listFrom(createRecordedCopilotProvider(), {});
    },
    async loadMatch(externalMatchId: string) {
      if (!useRecordedOnQuota) {
        return loadFrom(primary, externalMatchId);
      }
      const live = await loadUnlessQuota(() =>
        loadFrom(primary, externalMatchId),
      );
      if (live.ok) return live.data;
      const recorded = await recordedById(externalMatchId);
      if (recorded) return recorded;
      throw live.quota
        ? new Error(RECORDED_CATALOGUE_NOTE)
        : new Error("No se pudo cargar el fixture APEX.");
    },
  };
}
