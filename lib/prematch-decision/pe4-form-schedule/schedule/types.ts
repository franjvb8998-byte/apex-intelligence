/**
 * PE-4F — Cross-competition team schedule normalized model.
 * Distinct from PrematchStrengthUniverseFixture (C0 competition+season).
 */

export type Pe4TeamScheduleAcquisitionScope =
  | "team_season"
  | "team_season_window";

/**
 * Competition load classification for schedule metrics.
 * Conservative: unknown competitions are not counted as competitive load.
 */
export type Pe4CompetitionLoadClass =
  | "target_competition"
  | "other_known_competition"
  | "unknown";

export type Pe4TeamScheduleFixture = {
  fixtureId: string;
  kickoffUtc: string;
  status: string;
  homeTeamId: string;
  awayTeamId: string;
  /** Apex competition id (apex:api-football:league:N) when vendor league id known. */
  competitionId: string | null;
  /** Vendor numeric league id string when present. */
  vendorLeagueId: string | null;
  season: string | null;
  homeGoals: number | null;
  awayGoals: number | null;
  acquisitionScope: Pe4TeamScheduleAcquisitionScope;
  loadClass: Pe4CompetitionLoadClass;
};

export type Pe4TeamScheduleProviderEnvelope =
  | { ok: true; providerEnvelopeComplete: true }
  | {
      ok: false;
      providerEnvelopeComplete: false;
      reason:
        | "provider_errors_nonempty"
        | "malformed_provider_response"
        | "incomplete_paging"
        | "results_length_mismatch";
    };

export type Pe4TeamScheduleAcquireKey =
  | {
      kind: "team_season";
      teamId: string;
      season: string;
    }
  | {
      kind: "team_season_window";
      teamId: string;
      season: string;
      fromDate: string;
      toDate: string;
    };

export type Pe4TeamScheduleAcquireOk = {
  ok: true;
  key: Pe4TeamScheduleAcquireKey;
  providerEnvelopeComplete: true;
  fixtures: readonly Pe4TeamScheduleFixture[];
  competitionIdsRepresented: readonly string[];
  httpRequests: number;
};

export type Pe4TeamScheduleAcquireErr = {
  ok: false;
  key: Pe4TeamScheduleAcquireKey | null;
  providerEnvelopeComplete: false;
  reason:
    | "provider_errors_nonempty"
    | "malformed_provider_response"
    | "incomplete_paging"
    | "results_length_mismatch"
    | "invalid_request_args"
    | "provider_failure"
    | "requested_team_absent_from_row"
    | "malformed_schedule_row"
    | "conflicting_duplicate_fixture";
  message: string;
  httpRequests: number;
};

export type Pe4TeamScheduleAcquireResult =
  | Pe4TeamScheduleAcquireOk
  | Pe4TeamScheduleAcquireErr;

export type Pe4CrossCompScheduleSideEvidence = {
  teamId: string;
  vendorTeamId: string;
  providerSeason: string;
  acquisitionScope: Pe4TeamScheduleAcquisitionScope;
  requestedFromDate: string | null;
  requestedToDate: string | null;
  providerEnvelopeComplete: boolean;
  congestionWindowComplete: boolean;
  previousMatchComplete: boolean;
  /**
   * False only when congestion is semantically complete under an explicit
   * load-inclusion policy. Otherwise remains true.
   */
  crossCompetitionBlind: boolean;
  congestionWindowFromUtc: string;
  congestionWindowToExclusiveUtc: string;
  congestionFixtureIds: string[];
  congestionMatchCount: number;
  previousCompletedKickoffUtc: string | null;
  /** Hours since previous completed (competitive-policy) match; null if incomplete. */
  restHoursSincePreviousCompleted: number | null;
  competitionIdsRepresented: string[];
  normalizedFixtureIds: string[];
  semanticStatus: "USED" | "PARTIAL" | "UNAVAILABLE";
  semanticReason: string | null;
  /**
   * True only when congestion + previous-match semantics are both complete
   * under an explicit load-inclusion policy. Distinct from providerEnvelopeComplete.
   */
  semanticScheduleComplete: boolean;
  scheduleEvidenceDigest: string;
  /** Preserved competition-scoped rest for audit (from PE-4B layer). */
  competitionScopedRestHoursSnapshot: number | null;
  competitionScopedCongestion28dSnapshot: number | null;
};
