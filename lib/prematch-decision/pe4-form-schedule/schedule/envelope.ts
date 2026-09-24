/**
 * PE-4F — Provider envelope completeness for team-centric fixture lists.
 * Analogous to PE-3H unpaged league+season gate. Does NOT prove semantic
 * schedule completeness.
 */

import type { ApiFootballFixturesResponse } from "@/lib/data-platform/providers/api-football/types";
import { isApiFootballSeasonListErrorsEmpty } from "@/lib/prematch-lifecycle/season-universe/api-football-paged-transport";
import type { Pe4TeamScheduleProviderEnvelope } from "@/lib/prematch-decision/pe4-form-schedule/schedule/types";

/**
 * True when the HTTP payload proves a complete single-envelope list for the
 * requested team query (errors empty, paging 1/1, results===length).
 */
export function evaluatePe4TeamScheduleProviderEnvelope(
  payload: ApiFootballFixturesResponse,
): Pe4TeamScheduleProviderEnvelope {
  if (!isApiFootballSeasonListErrorsEmpty(payload.errors)) {
    return {
      ok: false,
      providerEnvelopeComplete: false,
      reason: "provider_errors_nonempty",
    };
  }
  if (!Array.isArray(payload.response)) {
    return {
      ok: false,
      providerEnvelopeComplete: false,
      reason: "malformed_provider_response",
    };
  }
  const paging = payload.paging;
  if (
    paging == null ||
    !Number.isInteger(paging.current) ||
    !Number.isInteger(paging.total) ||
    paging.current < 1 ||
    paging.total < 1
  ) {
    return {
      ok: false,
      providerEnvelopeComplete: false,
      reason: "malformed_provider_response",
    };
  }
  if (paging.current !== 1 || paging.total !== 1) {
    return {
      ok: false,
      providerEnvelopeComplete: false,
      reason: "incomplete_paging",
    };
  }
  const results = payload.results;
  if (
    typeof results !== "number" ||
    !Number.isFinite(results) ||
    !Number.isInteger(results) ||
    results < 0
  ) {
    return {
      ok: false,
      providerEnvelopeComplete: false,
      reason: "malformed_provider_response",
    };
  }
  if (results !== payload.response.length) {
    return {
      ok: false,
      providerEnvelopeComplete: false,
      reason: "results_length_mismatch",
    };
  }
  return { ok: true, providerEnvelopeComplete: true };
}
