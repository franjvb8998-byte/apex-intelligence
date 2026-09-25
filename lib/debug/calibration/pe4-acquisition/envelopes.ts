/**
 * PE-4I.2 — Immutable raw evidence envelopes (schedule + statistics).
 */

import type { Pe4I2CompetitionClass } from "@/lib/debug/calibration/pe4-acquisition/competition-registry";
import {
  PE4I2_ACQUISITION_VERSION,
  PE4I2_PROVIDER,
  PE4I2_SCHEMA_VERSION,
} from "@/lib/debug/calibration/pe4-acquisition/protocol";

export type Pe4I2RawStatisticRow = {
  /** Raw provider statistic type/name. Never rewritten. */
  rawName: string;
  /**
   * Raw value as returned. null means missing/absent — NOT zero.
   * Distinguishes missing from numeric 0.
   */
  rawValue: string | number | null;
  valuePresence: "present" | "missing";
  parseableNumeric: boolean;
  parsedNumeric: number | null;
};

export type Pe4I2RawScheduleFixtureRow = {
  providerFixtureId: string;
  providerCompetitionId: string | null;
  providerCompetitionName: string | null;
  competitionClass: Pe4I2CompetitionClass;
  kickoffUtc: string;
  status: string;
  homeTeamId: string;
  awayTeamId: string;
  /** Display only — not part of identityDigest. */
  homeTeamName: string | null;
  awayTeamName: string | null;
  homeGoals: number | null;
  awayGoals: number | null;
  /** Opaque content digest of identity fields for conflict detection. */
  identityDigest: string;
};

export type Pe4I2RawScheduleEnvelope = {
  schemaVersion: typeof PE4I2_SCHEMA_VERSION;
  acquisitionVersion: typeof PE4I2_ACQUISITION_VERSION;
  evidenceKind: "team_season_schedule";
  acquiredAtUtc: string;
  provider: typeof PE4I2_PROVIDER;
  providerTeamId: string;
  requestedSeason: string;
  providerEnvelopeComplete: boolean;
  pagingCurrent: number | null;
  pagingTotal: number | null;
  resultsCount: number | null;
  fixtures: Pe4I2RawScheduleFixtureRow[];
  /** SHA-256 of deterministic fixture payload (order-independent). */
  contentDigest: string;
};

export type Pe4I2RawStatisticsTeamBlock = {
  providerTeamId: string;
  teamName: string | null;
  statistics: Pe4I2RawStatisticRow[];
};

export type Pe4I2RawStatisticsEnvelope = {
  schemaVersion: typeof PE4I2_SCHEMA_VERSION;
  acquisitionVersion: typeof PE4I2_ACQUISITION_VERSION;
  evidenceKind: "fixture_statistics";
  acquiredAtUtc: string;
  provider: typeof PE4I2_PROVIDER;
  providerFixtureId: string;
  providerEnvelopeComplete: boolean;
  resultsCount: number | null;
  teams: Pe4I2RawStatisticsTeamBlock[];
  contentDigest: string;
  /**
   * Explicit: vendor xG field observation for this envelope.
   * Never inferred from EloPoisson expectedGoals.
   */
  vendorXgFieldObserved: boolean;
};
