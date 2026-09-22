/**
 * Match Center data loader — fixtures and match payloads via the DAL.
 * Free-plan flow: today's fixtures, then Premier League 2025 fallback.
 */

import type { IDataProvider } from "@/lib/data-platform";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import { matchSummaryFromBundle } from "@/lib/dashboard/map";
import type { DashboardMatchSummary } from "@/lib/dashboard/types";
import {
  EMPTY_MATCH_CENTER_ENRICHMENT,
  enrichMatchCenterContext,
} from "@/lib/match-center/enrich";
import { parseTrackedFixtureId } from "@/lib/apex-vision/live/parse-id";
import {
  getVisionLiveCoordinator,
  peekVisionLiveFixture,
  shouldKeepLiveTracking,
} from "@/lib/apex-vision/live";
import { vendorFixtureId } from "@/lib/match-center/fixture-id";
import { createMatchCenterFromApexBundle } from "@/lib/match-center/from-data-platform";
import {
  buildMatchCenterLiveLiteFromBundle,
  buildMatchCenterLiveLiteFromVision,
} from "@/lib/match-center/live-lite";
import type { MatchCenterData } from "@/lib/match-center/types";
import {
  createProductDataProvider,
  createRepositories,
} from "@/lib/repositories";
import { lookupFrozenPrematchDecision } from "@/lib/prematch-decision/attach";
import type { PrematchDecisionTicketStore } from "@/lib/prematch-decision/store";
import type { FinalFixtureEvidenceStore } from "@/lib/final-evidence/store";
import { loadHistoricalPrematchView } from "@/lib/prematch-evaluation/historical";
import {
  getFinalFixtureEvidenceStore,
} from "@/lib/final-evidence/store";
import {
  getPrematchDecisionEvaluationStore,
  type PrematchDecisionEvaluationStore,
} from "@/lib/prematch-evaluation/store";
import { getPrematchDecisionTicketStore } from "@/lib/prematch-decision/store";

export type LoadMatchCenterOptions = {
  /** External fixture id (API-Football fixture id or Apex id). */
  externalMatchId?: string;
  /** Kept for callers; Match Center no longer falls back to mock data. */
  requireProvider?: boolean;
  /** Inject Data Platform provider (tests). */
  provider?: IDataProvider;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  /**
   * When false, skip the fixture catalogue (dashboard already listed today).
   * Default true for `/match-center`.
   */
  includeFixtureList?: boolean;
  /**
   * Attach Vision live coordinator state on first paint.
   * Default false so catalogue/budget tests do not spend a live snapshot.
   * When true, in-play fixtures use Live Lite (no enrichment fan-out).
   */
  includeLiveRefresh?: boolean;
  ticketStore?: PrematchDecisionTicketStore;
  evidenceStore?: FinalFixtureEvidenceStore;
  evaluationStore?: PrematchDecisionEvaluationStore;
};

export function resolveMatchCenterProvider(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): IDataProvider {
  return createProductDataProvider(env);
}

function repositoriesFor(
  options: LoadMatchCenterOptions,
  enrichMatch = true,
) {
  const env = options.env ?? process.env;
  return createRepositories({
    provider: options.provider,
    env,
    enrichMatch,
  });
}

/**
 * Load Match Center from the DAL. Does not use the mock catalogue.
 *
 * Live Lite: when `includeLiveRefresh` and the fixture is already known live
 * (Vision store) or identity `getById` reports live, skip enrichment/odds.
 * Does not add a live=all discovery call. Unknown non-live fixtures keep the
 * rich prematch path and do not invoke Vision live transport.
 *
 * Identity `GET /fixtures?id=` is an intentional cold-start gate: Vision
 * `ids=` already carries Live Lite identity, but routing through Vision first
 * would make every prematch Match Center page hit live transport. Store miss
 * therefore pays identity + Vision ids snapshot (plus at most one dedicated
 * events fallback if frozen policy fires).
 */
export async function getMatchCenterData(
  options: LoadMatchCenterOptions = {},
): Promise<MatchCenterData> {
  const requested = vendorFixtureId(options.externalMatchId);
  const liveId = parseTrackedFixtureId(requested);
  const skipCatalogue = options.includeFixtureList === false && Boolean(requested);

  if (options.includeLiveRefresh && liveId != null) {
    const peeked = peekVisionLiveFixture(liveId);
    if (peeked && shouldKeepLiveTracking(peeked.statusShort)) {
      return loadLiveLite({
        liveId,
        skipCatalogue,
        identity: null,
        fixtures: [],
      });
    }

    const identityRepos = repositoriesFor(options, false);
    const fixtures = skipCatalogue
      ? []
      : await identityRepos.fixtures.listCatalogue();
    const matchId = resolveSelectedFixtureId(fixtures, requested ?? undefined);
    const identity = await identityRepos.fixtures.getById(matchId);
    if (identity.match.status === "live") {
      return loadLiveLite({
        liveId,
        skipCatalogue,
        identity,
        fixtures,
      });
    }

    return loadRichMatchCenter({
      options,
      skipCatalogue,
      fixtures,
      matchId,
    });
  }

  const repos = repositoriesFor(options, true);
  const fixtures = skipCatalogue ? [] : await repos.fixtures.listCatalogue();
  const matchId = resolveSelectedFixtureId(fixtures, requested ?? undefined);
  return loadRichMatchCenter({
    options,
    skipCatalogue,
    fixtures,
    matchId,
  });
}

async function loadLiveLite(input: {
  liveId: number;
  skipCatalogue: boolean;
  identity: ApexMatchBundle | null;
  fixtures: ApexMatchBundle[];
}): Promise<MatchCenterData> {
  const coordinator = getVisionLiveCoordinator();
  const view = await coordinator.refreshFixture(input.liveId);
  const state = peekVisionLiveFixture(input.liveId);
  const data = input.identity
    ? buildMatchCenterLiveLiteFromBundle(input.identity, view)
    : buildMatchCenterLiveLiteFromVision(view, state);
  data.live.providerLive = view;
  data.fixtures = input.skipCatalogue
    ? []
    : input.identity
      ? withSelectedFixture(input.fixtures, input.identity)
      : [];
  return data;
}

async function loadRichMatchCenter(input: {
  options: LoadMatchCenterOptions;
  skipCatalogue: boolean;
  fixtures: ApexMatchBundle[];
  matchId: string;
}): Promise<MatchCenterData> {
  const repos = repositoriesFor(input.options, true);
  const bundle = await repos.fixtures.getById(input.matchId);
  let enrichment;
  try {
    enrichment = await enrichMatchCenterContext(repos, bundle);
  } catch {
    enrichment = { ...EMPTY_MATCH_CENTER_ENRICHMENT };
  }
  const data = createMatchCenterFromApexBundle(bundle, {
    enrichment,
    probabilityDiagnosticContext: "match_center",
  });
  const fixtureId =
    vendorFixtureId(data.match.externalId) ??
    vendorFixtureId(data.match.matchId);
  if (fixtureId) {
    const frozen = await lookupFrozenPrematchDecision(
      fixtureId,
      input.options.ticketStore,
    );
    if (frozen) {
      data.preview.analysis = {
        ...data.preview.analysis,
        frozenPrematchDecision: frozen,
      };
    }
    data.preview.analysis = {
      ...data.preview.analysis,
      historicalPrematch: await loadHistoricalPrematchView(fixtureId, {
        ticketStore:
          input.options.ticketStore ?? getPrematchDecisionTicketStore(),
        evidenceStore:
          input.options.evidenceStore ?? getFinalFixtureEvidenceStore(),
        evaluationStore:
          input.options.evaluationStore ?? getPrematchDecisionEvaluationStore(),
      }),
    };
  }
  data.fixtures = input.skipCatalogue
    ? []
    : withSelectedFixture(input.fixtures, bundle);
  data.live.loadMode = "rich";
  if (input.options.includeLiveRefresh && data.match.status === "live") {
    const liveId = data.live.fixtureId ?? parseTrackedFixtureId(input.matchId);
    if (liveId != null) {
      data.live.providerLive =
        await getVisionLiveCoordinator().refreshFixture(liveId);
    }
  }
  return data;
}

/**
 * Catalogue only — no match analysis, PE, or enrichment.
 * Used by `/match-center` so opening the list does not load a fixture.
 */
export async function listMatchCenterFixtures(
  options: LoadMatchCenterOptions = {},
): Promise<DashboardMatchSummary[]> {
  const fixtures = await listMatchCenterFixtureBundles(options);
  return fixtures.map(matchSummaryFromBundle);
}

/**
 * Same catalogue as {@link listMatchCenterFixtures}, as Apex bundles
 * (odds + league logo available for Bankroll).
 */
export async function listMatchCenterFixtureBundles(
  options: LoadMatchCenterOptions = {},
): Promise<ApexMatchBundle[]> {
  return repositoriesFor(options).fixtures.listCatalogue();
}

function externalId(bundle: ApexMatchBundle): string | null {
  return vendorFixtureId(bundle.match.externalRefs[0]?.externalId) ??
    vendorFixtureId(bundle.match.id);
}

function bundleLookupIds(bundle: ApexMatchBundle): string[] {
  return [
    ...new Set(
      [bundle.match.id, bundle.match.externalRefs[0]?.externalId]
        .map(vendorFixtureId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
}

function resolveSelectedFixtureId(
  fixtures: ApexMatchBundle[],
  requestedId?: string,
): string {
  const requested = vendorFixtureId(requestedId);
  if (requested) {
    const hit = fixtures.find((bundle) =>
      bundleLookupIds(bundle).includes(requested),
    );
    if (hit) return externalId(hit) ?? requested;
    return requested;
  }

  const first = fixtures[0];
  if (first) return externalId(first) ?? first.match.id;
  throw new Error(
    "API-Football no devolvió fixtures para hoy ni Premier League 2025.",
  );
}

function withSelectedFixture(
  fixtures: ApexMatchBundle[],
  selected: ApexMatchBundle,
): DashboardMatchSummary[] {
  const summaries = fixtures.map(matchSummaryFromBundle);
  const loaded = matchSummaryFromBundle(selected);
  const alreadyListed = summaries.some(
    (row) =>
      (loaded.externalId && row.externalId === loaded.externalId) ||
      row.id === loaded.id,
  );
  return alreadyListed ? summaries : [loaded, ...summaries];
}

/**
 * Recorded ingest path kept for tests (no live key).
 */
export async function loadMatchCenterFromApiFootball(
  options: LoadMatchCenterOptions = {},
): Promise<MatchCenterData> {
  const env = options.env ?? {};
  const provider = resolveMatchCenterProvider(env);
  return getMatchCenterData({
    ...options,
    provider,
    env,
  });
}
