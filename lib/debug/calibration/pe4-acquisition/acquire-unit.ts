/**
 * PE-4I.2 — Single-unit acquire helper for tests / future live.
 * Always requires explicit budget + transport. Dry-run path never calls this.
 */

import type { Pe4I2CallBudget } from "@/lib/debug/calibration/pe4-acquisition/budget";
import type { Pe4I2AcquisitionCache } from "@/lib/debug/calibration/pe4-acquisition/cache";
import {
  scheduleUnitKey,
  statisticsUnitKey,
} from "@/lib/debug/calibration/pe4-acquisition/cache";
import {
  normalizeFixtureStatisticsPayload,
  normalizeTeamSeasonSchedulePayload,
} from "@/lib/debug/calibration/pe4-acquisition/normalize";
import { assertSeasonAllowed } from "@/lib/debug/calibration/pe4-acquisition/protocol";
import type { Pe4I2ProviderTransport } from "@/lib/debug/calibration/pe4-acquisition/transport";

export type Pe4I2AcquireUnitResult =
  | {
      ok: true;
      unitKey: string;
      cacheHit: boolean;
      contentDigest: string;
    }
  | {
      ok: false;
      unitKey: string;
      reason: string;
      message: string;
    };

export async function acquireScheduleUnit(input: {
  transport: Pe4I2ProviderTransport;
  budget: Pe4I2CallBudget;
  cache: Pe4I2AcquisitionCache;
  providerTeamId: string;
  season: string;
  acquiredAtUtc?: string;
}): Promise<Pe4I2AcquireUnitResult> {
  const season = assertSeasonAllowed(input.season);
  const unitKey = scheduleUnitKey(input.providerTeamId, season);
  const existing = input.cache.getUnit(unitKey);
  if (existing?.status === "completed" && existing.contentDigest) {
    input.budget.recordCacheHit();
    return {
      ok: true,
      unitKey,
      cacheHit: true,
      contentDigest: existing.contentDigest,
    };
  }
  input.budget.beginAttempt();
  const res = await input.transport.request({
    kind: "team_season_schedule",
    providerTeamId: input.providerTeamId,
    season,
  });
  if (!res.ok) {
    input.budget.recordFailure();
    input.cache.putFailed({
      unitKey,
      kind: "team_season_schedule",
      retryable: res.reason === "provider_error",
      message: res.message,
    });
    return {
      ok: false,
      unitKey,
      reason: res.reason,
      message: res.message,
    };
  }
  const normalized = normalizeTeamSeasonSchedulePayload({
    providerTeamId: input.providerTeamId,
    requestedSeason: season,
    acquiredAtUtc: input.acquiredAtUtc ?? new Date().toISOString(),
    payload: res.payload,
  });
  if (!normalized.ok) {
    input.budget.recordFailure();
    input.cache.putFailed({
      unitKey,
      kind: "team_season_schedule",
      retryable: false,
      message: normalized.message,
    });
    return {
      ok: false,
      unitKey,
      reason: normalized.reason,
      message: normalized.message,
    };
  }
  input.budget.recordSuccess();
  input.cache.putCompleted({
    unitKey,
    kind: "team_season_schedule",
    contentDigest: normalized.envelope.contentDigest,
    payload: normalized.envelope,
  });
  return {
    ok: true,
    unitKey,
    cacheHit: false,
    contentDigest: normalized.envelope.contentDigest,
  };
}

export async function acquireStatisticsUnit(input: {
  transport: Pe4I2ProviderTransport;
  budget: Pe4I2CallBudget;
  cache: Pe4I2AcquisitionCache;
  providerFixtureId: string;
  acquiredAtUtc?: string;
}): Promise<Pe4I2AcquireUnitResult> {
  const unitKey = statisticsUnitKey(input.providerFixtureId);
  const existing = input.cache.getUnit(unitKey);
  if (existing?.status === "completed" && existing.contentDigest) {
    input.budget.recordCacheHit();
    return {
      ok: true,
      unitKey,
      cacheHit: true,
      contentDigest: existing.contentDigest,
    };
  }
  input.budget.beginAttempt();
  const res = await input.transport.request({
    kind: "fixture_statistics",
    providerFixtureId: input.providerFixtureId,
  });
  if (!res.ok) {
    input.budget.recordFailure();
    input.cache.putFailed({
      unitKey,
      kind: "fixture_statistics",
      retryable: res.reason === "provider_error",
      message: res.message,
    });
    return {
      ok: false,
      unitKey,
      reason: res.reason,
      message: res.message,
    };
  }
  const normalized = normalizeFixtureStatisticsPayload({
    providerFixtureId: input.providerFixtureId,
    acquiredAtUtc: input.acquiredAtUtc ?? new Date().toISOString(),
    payload: res.payload,
  });
  if (!normalized.ok) {
    input.budget.recordFailure();
    input.cache.putFailed({
      unitKey,
      kind: "fixture_statistics",
      retryable: false,
      message: normalized.message,
    });
    return {
      ok: false,
      unitKey,
      reason: normalized.reason,
      message: normalized.message,
    };
  }
  input.budget.recordSuccess();
  input.cache.putCompleted({
    unitKey,
    kind: "fixture_statistics",
    contentDigest: normalized.envelope.contentDigest,
    payload: normalized.envelope,
  });
  return {
    ok: true,
    unitKey,
    cacheHit: false,
    contentDigest: normalized.envelope.contentDigest,
  };
}
