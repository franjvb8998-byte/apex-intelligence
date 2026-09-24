/**
 * PE-4F — Acquire team schedule via verified API-Football shapes.
 * Offline-friendly: caller supplies client (tests mock transport).
 */

import type { ApiFootballClient } from "@/lib/data-platform/providers/api-football/client";
import { ApiFootballError } from "@/lib/data-platform/providers/api-football/errors";
import type { ApiFootballFixturesResponse } from "@/lib/data-platform/providers/api-football/types";
import { evaluatePe4TeamScheduleProviderEnvelope } from "@/lib/prematch-decision/pe4-form-schedule/schedule/envelope";
import { normalizePe4TeamScheduleFixtures } from "@/lib/prematch-decision/pe4-form-schedule/schedule/normalize";
import type {
  Pe4TeamScheduleAcquireKey,
  Pe4TeamScheduleAcquireResult,
  Pe4TeamScheduleFixture,
} from "@/lib/prematch-decision/pe4-form-schedule/schedule/types";

export type AcquirePe4TeamScheduleInput = {
  client: Pick<
    ApiFootballClient,
    "getTeamFixturesBySeason" | "getTeamFixturesBySeasonWindow"
  >;
  key: Pe4TeamScheduleAcquireKey;
  /** Apex competition id for load classification (target fixture). */
  targetCompetitionId: string;
};

function competitionIdsFrom(
  fixtures: readonly Pe4TeamScheduleFixture[],
): string[] {
  const ids = new Set<string>();
  for (const row of fixtures) {
    if (row.competitionId) ids.add(row.competitionId);
  }
  return [...ids].sort();
}

async function fetchPayload(
  client: AcquirePe4TeamScheduleInput["client"],
  key: Pe4TeamScheduleAcquireKey,
): Promise<ApiFootballFixturesResponse> {
  if (key.kind === "team_season") {
    return client.getTeamFixturesBySeason(key.teamId, key.season);
  }
  return client.getTeamFixturesBySeasonWindow(
    key.teamId,
    key.season,
    key.fromDate,
    key.toDate,
  );
}

/**
 * Load + envelope-gate + normalize one team schedule request.
 * Exactly one HTTP call for the key (no hidden fallbacks).
 */
export async function acquirePe4TeamSchedule(
  input: AcquirePe4TeamScheduleInput,
): Promise<Pe4TeamScheduleAcquireResult> {
  const { key, targetCompetitionId } = input;
  let httpRequests = 0;
  let payload: ApiFootballFixturesResponse;
  try {
    payload = await fetchPayload(input.client, key);
    httpRequests = 1;
  } catch (err) {
    const message =
      err instanceof ApiFootballError
        ? err.message
        : err instanceof Error
          ? err.message
          : "provider failure";
    const invalidArgs =
      err instanceof ApiFootballError &&
      err.apiFootballCode === "invalid_ids";
    return {
      ok: false,
      key,
      providerEnvelopeComplete: false,
      reason: invalidArgs ? "invalid_request_args" : "provider_failure",
      message,
      httpRequests,
    };
  }

  const envelope = evaluatePe4TeamScheduleProviderEnvelope(payload);
  if (!envelope.ok) {
    return {
      ok: false,
      key,
      providerEnvelopeComplete: false,
      reason: envelope.reason,
      message: `Provider envelope incomplete: ${envelope.reason}`,
      httpRequests,
    };
  }

  const acquisitionScope =
    key.kind === "team_season" ? "team_season" : "team_season_window";
  const normalized = normalizePe4TeamScheduleFixtures({
    items: payload.response,
    vendorTeamId: key.teamId,
    targetCompetitionId,
    acquisitionScope,
  });
  if (!normalized.ok) {
    return {
      ok: false,
      key,
      providerEnvelopeComplete: false,
      reason: normalized.reason,
      message: normalized.message,
      httpRequests,
    };
  }

  return {
    ok: true,
    key,
    providerEnvelopeComplete: true,
    fixtures: normalized.fixtures,
    competitionIdsRepresented: competitionIdsFrom(normalized.fixtures),
    httpRequests,
  };
}
