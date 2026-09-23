/**
 * PE-3C — Lifecycle-specific C0 reconstruction capture (candidate path).
 *
 * Does NOT change createScannerMatchCenter / global Scanner semantics.
 * Uses EMPTY enrichment + explicit Elo overrides into Match Center.
 */

import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import { EMPTY_MATCH_CENTER_ENRICHMENT } from "@/lib/match-center/enrich";
import { createMatchCenterFromApexBundle } from "@/lib/match-center/from-data-platform";
import type { MatchCenterData } from "@/lib/match-center/types";
import {
  PrematchUniverseConflictError,
  resolvePrematchStrengthFromUniverse,
  type PrematchStrengthResult,
  type PrematchStrengthTarget,
} from "@/lib/match-center/prematch-strength";
import { canonicalPrematchFixtureId } from "@/lib/prematch-decision/identity";
import {
  provenanceFromC0Strength,
  type PrematchInputProvenance,
} from "@/lib/prematch-decision/input-provenance";
import { isQuotaError } from "@/lib/repositories";
import type {
  SeasonUniverseAcquireResult,
  SeasonUniverseLoader,
  RunScopedSeasonUniverseCache,
} from "@/lib/prematch-lifecycle/season-universe";
import type { SeasonUniverseAcquireErr } from "@/lib/prematch-lifecycle/season-universe/run-scope-cache";
import {
  resolveSeasonUniverseKeyFromBundle,
  type SeasonUniverseKey,
} from "@/lib/prematch-lifecycle/season-universe";

export type LifecycleC0CaptureSkipReason =
  | "missing_competition"
  | "missing_season"
  | "invalid_season"
  | "invalid_vendor_league_id"
  | "missing_fixture_id"
  | "provider_failure"
  | "malformed_provider_response"
  | "incomplete_season_list"
  | "pagination_bound_exceeded"
  | "timeout"
  | "reconstruction_exception"
  | "conflicting_universe_evidence"
  | "loader_unavailable";

export type LifecycleC0StrengthOk = {
  ok: true;
  strength: PrematchStrengthResult;
  provenance: PrematchInputProvenance;
  center: MatchCenterData;
  key: SeasonUniverseKey;
  cacheHit: boolean;
  httpRequests: number;
};

export type LifecycleC0StrengthErr = {
  ok: false;
  reason: LifecycleC0CaptureSkipReason;
  cacheHit: boolean;
  httpRequests: number;
};

/**
 * Lifecycle Match Center with explicit Elo — empty enrichment (Scanner-like),
 * but Elo comes from C0 reconstruction, not base_prior derivation.
 */
export function createLifecycleMatchCenterWithExplicitElo(
  bundle: ApexMatchBundle,
  elo: { homeElo: number; awayElo: number },
): MatchCenterData {
  return createMatchCenterFromApexBundle(bundle, {
    enrichment: EMPTY_MATCH_CENTER_ENRICHMENT,
    homeElo: elo.homeElo,
    awayElo: elo.awayElo,
    probabilityDiagnosticContext: "scanner",
  });
}

export function buildPrematchStrengthTargetFromBundle(
  bundle: ApexMatchBundle,
  key: SeasonUniverseKey,
): PrematchStrengthTarget | null {
  const fixtureId = canonicalPrematchFixtureId(
    bundle.match.externalRefs[0]?.externalId ?? bundle.match.id,
  );
  if (!fixtureId) return null;
  if (!bundle.homeTeam.id || !bundle.awayTeam.id) return null;
  if (!bundle.match.kickoffAt) return null;
  return {
    fixtureId,
    kickoffUtc: bundle.match.kickoffAt,
    homeTeamId: bundle.homeTeam.id,
    awayTeamId: bundle.awayTeam.id,
    competitionId: key.competitionId,
    season: key.season,
  };
}

function mapAcquireReason(
  reason: SeasonUniverseAcquireErr["reason"],
): LifecycleC0CaptureSkipReason {
  switch (reason) {
    case "missing_competition":
    case "missing_season":
    case "invalid_season":
    case "invalid_vendor_league_id":
    case "provider_failure":
    case "malformed_provider_response":
    case "incomplete_season_list":
    case "pagination_bound_exceeded":
    case "timeout":
      return reason;
    default: {
      const _exhaustive: never = reason;
      return _exhaustive;
    }
  }
}

/**
 * Acquire universe (run-scoped) + reconstruct C0 Elo + build Match Center.
 * evidenceAcquiredAtUtc = lifecycle clock (NOT provider snapshot).
 */
export async function prepareLifecycleC0MatchCenter(input: {
  bundle: ApexMatchBundle;
  cache: RunScopedSeasonUniverseCache;
  loader: SeasonUniverseLoader | null;
  evidenceAcquiredAtUtc: string;
  modelVersion?: string | null;
}): Promise<LifecycleC0StrengthOk | LifecycleC0StrengthErr> {
  const seasonResolved = resolveSeasonUniverseKeyFromBundle(input.bundle);
  if (!seasonResolved.ok) {
    return {
      ok: false,
      reason: seasonResolved.reason,
      cacheHit: false,
      httpRequests: 0,
    };
  }

  if (!input.loader) {
    return {
      ok: false,
      reason: "loader_unavailable",
      cacheHit: false,
      httpRequests: 0,
    };
  }

  const key = seasonResolved.key;
  const beforeInvocations = input.cache.loaderInvocations;
  let acquired: SeasonUniverseAcquireResult;
  try {
    acquired = await input.cache.getOrLoad(key, input.loader);
  } catch (error) {
    if (isQuotaError(error)) throw error;
    return {
      ok: false,
      reason: "provider_failure",
      cacheHit: false,
      httpRequests: 0,
    };
  }
  const cacheHit = input.cache.loaderInvocations === beforeInvocations;
  const httpRequests = cacheHit ? 0 : (acquired.httpRequests ?? 0);

  if (!acquired.ok) {
    return {
      ok: false,
      reason: mapAcquireReason(acquired.reason),
      cacheHit,
      httpRequests,
    };
  }

  const target = buildPrematchStrengthTargetFromBundle(input.bundle, key);
  if (!target) {
    return {
      ok: false,
      reason: "missing_fixture_id",
      cacheHit,
      httpRequests,
    };
  }

  try {
    const strength = resolvePrematchStrengthFromUniverse({
      target,
      universe: acquired.fixtures,
      evidenceAcquiredAtUtc: input.evidenceAcquiredAtUtc,
    });
    const center = createLifecycleMatchCenterWithExplicitElo(input.bundle, {
      homeElo: strength.homeElo,
      awayElo: strength.awayElo,
    });
    const modelVersion =
      input.modelVersion ??
      center.preview.hybrid.modelVersion ??
      "elo-poisson-hybrid-0.1.0";
    const provenance = provenanceFromC0Strength({
      strength,
      modelVersion,
    });
    return {
      ok: true,
      strength,
      provenance,
      center,
      key,
      cacheHit,
      httpRequests,
    };
  } catch (error) {
    if (error instanceof PrematchUniverseConflictError) {
      return {
        ok: false,
        reason: "conflicting_universe_evidence",
        cacheHit,
        httpRequests,
      };
    }
    return {
      ok: false,
      reason: "reconstruction_exception",
      cacheHit,
      httpRequests,
    };
  }
}

export function classifyC0StrengthForReport(strength: PrematchStrengthResult): {
  fallbackBasePrior: boolean;
  mixed: boolean;
} {
  return {
    fallbackBasePrior: strength.fallback === true,
    mixed: strength.source === "mixed",
  };
}
