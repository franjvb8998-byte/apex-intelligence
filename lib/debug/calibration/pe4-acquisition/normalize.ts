/**
 * PE-4I.2 — Normalize provider payloads into raw envelopes (offline).
 */

import { createHash } from "node:crypto";
import { classifyPe4I2Competition } from "@/lib/debug/calibration/pe4-acquisition/competition-registry";
import { scheduleIdentityDigest } from "@/lib/debug/calibration/pe4-acquisition/dedupe";
import { dedupeScheduleFixtures } from "@/lib/debug/calibration/pe4-acquisition/dedupe";
import type {
  Pe4I2RawScheduleEnvelope,
  Pe4I2RawStatisticsEnvelope,
} from "@/lib/debug/calibration/pe4-acquisition/envelopes";
import {
  PE4I2_ACQUISITION_VERSION,
  PE4I2_PROVIDER,
  PE4I2_SCHEMA_VERSION,
} from "@/lib/debug/calibration/pe4-acquisition/protocol";
import { buildRawStatisticRow } from "@/lib/debug/calibration/pe4-acquisition/statistics-discovery";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function digestScheduleFixtures(
  fixtures: Pe4I2RawScheduleEnvelope["fixtures"],
): string {
  const lines = fixtures
    .map((f) => f.identityDigest)
    .sort();
  return createHash("sha256").update(lines.join("\n"), "utf8").digest("hex");
}

export type NormalizeScheduleResult =
  | { ok: true; envelope: Pe4I2RawScheduleEnvelope }
  | {
      ok: false;
      reason:
        | "malformed_envelope"
        | "missing_team_identity"
        | "conflicting_duplicate_fixture"
        | "missing_fixture_id";
      message: string;
    };

/**
 * Accepts API-Football-like fixtures list payloads (or test doubles).
 */
export function normalizeTeamSeasonSchedulePayload(input: {
  providerTeamId: string;
  requestedSeason: string;
  acquiredAtUtc: string;
  payload: unknown;
}): NormalizeScheduleResult {
  const teamId = String(input.providerTeamId).trim();
  if (!/^[1-9]\d*$/.test(teamId)) {
    return {
      ok: false,
      reason: "missing_team_identity",
      message: "providerTeamId must be a positive integer string",
    };
  }
  if (!isRecord(input.payload)) {
    return {
      ok: false,
      reason: "malformed_envelope",
      message: "schedule payload must be an object",
    };
  }
  const response = input.payload.response;
  if (!Array.isArray(response)) {
    return {
      ok: false,
      reason: "malformed_envelope",
      message: "schedule payload.response must be an array",
    };
  }
  const paging = isRecord(input.payload.paging) ? input.payload.paging : null;
  const rows = [];
  for (const item of response) {
    if (!isRecord(item) || !isRecord(item.fixture) || !isRecord(item.teams)) {
      return {
        ok: false,
        reason: "malformed_envelope",
        message: "malformed fixture item",
      };
    }
    const fixtureId = String(item.fixture.id ?? "").trim();
    if (!fixtureId) {
      return {
        ok: false,
        reason: "missing_fixture_id",
        message: "fixture id missing",
      };
    }
    const home = isRecord(item.teams.home) ? item.teams.home : null;
    const away = isRecord(item.teams.away) ? item.teams.away : null;
    if (home?.id == null || away?.id == null) {
      return {
        ok: false,
        reason: "missing_team_identity",
        message: `fixture ${fixtureId} missing team ids`,
      };
    }
    const homeTeamId = String(home.id);
    const awayTeamId = String(away.id);
    if (homeTeamId !== teamId && awayTeamId !== teamId) {
      return {
        ok: false,
        reason: "missing_team_identity",
        message: `fixture ${fixtureId} does not include requested team`,
      };
    }
    const league = isRecord(item.league) ? item.league : null;
    const statusObj = isRecord(item.fixture.status) ? item.fixture.status : null;
    const status = String(statusObj?.short ?? "").trim();
    if (!status) {
      return {
        ok: false,
        reason: "malformed_envelope",
        message: `fixture ${fixtureId} missing status`,
      };
    }
    const kickoffRaw = String(item.fixture.date ?? "");
    const kickoffMs = Date.parse(kickoffRaw);
    if (!Number.isFinite(kickoffMs)) {
      return {
        ok: false,
        reason: "malformed_envelope",
        message: `fixture ${fixtureId} invalid kickoff`,
      };
    }
    const kickoffUtc = new Date(kickoffMs).toISOString();
    const providerCompetitionId =
      league?.id == null ? null : String(league.id);
    const providerCompetitionName =
      league?.name == null ? null : String(league.name);
    const classified = classifyPe4I2Competition({
      providerCompetitionId,
      providerCompetitionName,
    });
    const goals = isRecord(item.goals) ? item.goals : null;
    const homeGoals =
      goals?.home == null || goals.home === ""
        ? null
        : Number(goals.home);
    const awayGoals =
      goals?.away == null || goals.away === ""
        ? null
        : Number(goals.away);
    const identityDigest = scheduleIdentityDigest({
      providerFixtureId: fixtureId,
      kickoffUtc,
      homeTeamId,
      awayTeamId,
      providerCompetitionId,
      status,
      homeGoals:
        homeGoals != null && Number.isFinite(homeGoals) ? homeGoals : null,
      awayGoals:
        awayGoals != null && Number.isFinite(awayGoals) ? awayGoals : null,
    });
    rows.push({
      providerFixtureId: fixtureId,
      providerCompetitionId,
      providerCompetitionName,
      competitionClass: classified.competitionClass,
      kickoffUtc,
      status,
      homeTeamId,
      awayTeamId,
      homeTeamName: home.name == null ? null : String(home.name),
      awayTeamName: away.name == null ? null : String(away.name),
      homeGoals:
        homeGoals != null && Number.isFinite(homeGoals) ? homeGoals : null,
      awayGoals:
        awayGoals != null && Number.isFinite(awayGoals) ? awayGoals : null,
      identityDigest,
    });
  }
  const deduped = dedupeScheduleFixtures(rows);
  if (!deduped.ok) {
    return {
      ok: false,
      reason: deduped.reason,
      message: deduped.message,
    };
  }
  const pagingCurrent =
    paging && typeof paging.current === "number" ? paging.current : null;
  const pagingTotal =
    paging && typeof paging.total === "number" ? paging.total : null;
  const providerEnvelopeComplete =
    pagingTotal == null || pagingTotal === 1 || pagingCurrent === pagingTotal;
  const envelope: Pe4I2RawScheduleEnvelope = {
    schemaVersion: PE4I2_SCHEMA_VERSION,
    acquisitionVersion: PE4I2_ACQUISITION_VERSION,
    evidenceKind: "team_season_schedule",
    acquiredAtUtc: input.acquiredAtUtc,
    provider: PE4I2_PROVIDER,
    providerTeamId: teamId,
    requestedSeason: input.requestedSeason,
    providerEnvelopeComplete,
    pagingCurrent,
    pagingTotal,
    resultsCount:
      typeof input.payload.results === "number" ? input.payload.results : null,
    fixtures: deduped.fixtures,
    contentDigest: digestScheduleFixtures(deduped.fixtures),
  };
  return { ok: true, envelope };
}

export type NormalizeStatisticsResult =
  | { ok: true; envelope: Pe4I2RawStatisticsEnvelope }
  | { ok: false; reason: "malformed_envelope"; message: string };

export function normalizeFixtureStatisticsPayload(input: {
  providerFixtureId: string;
  acquiredAtUtc: string;
  payload: unknown;
}): NormalizeStatisticsResult {
  const fixtureId = String(input.providerFixtureId).trim();
  if (!fixtureId) {
    return {
      ok: false,
      reason: "malformed_envelope",
      message: "providerFixtureId required",
    };
  }
  if (!isRecord(input.payload) || !Array.isArray(input.payload.response)) {
    return {
      ok: false,
      reason: "malformed_envelope",
      message: "statistics payload.response must be an array",
    };
  }
  const teams = [];
  let vendorXgFieldObserved = false;
  for (const item of input.payload.response) {
    if (!isRecord(item) || !isRecord(item.team) || !Array.isArray(item.statistics)) {
      return {
        ok: false,
        reason: "malformed_envelope",
        message: "malformed statistics team block",
      };
    }
    const providerTeamId = String(item.team.id ?? "").trim();
    if (!providerTeamId) {
      return {
        ok: false,
        reason: "malformed_envelope",
        message: "statistics team id missing",
      };
    }
    const statistics = [];
    for (const row of item.statistics) {
      if (!isRecord(row)) {
        return {
          ok: false,
          reason: "malformed_envelope",
          message: "malformed statistic row",
        };
      }
      const rawName = String(row.type ?? "").trim();
      if (!rawName) {
        return {
          ok: false,
          reason: "malformed_envelope",
          message: "statistic type missing",
        };
      }
      const rawValue =
        row.value === undefined
          ? null
          : (row.value as string | number | null);
      const built = buildRawStatisticRow(rawName, rawValue);
      statistics.push(built);
      const lower = rawName.toLowerCase();
      if (
        built.valuePresence === "present" &&
        (lower === "expected_goals" ||
          lower === "expected goals" ||
          lower === "xg")
      ) {
        vendorXgFieldObserved = true;
      }
    }
    teams.push({
      providerTeamId,
      teamName: item.team.name == null ? null : String(item.team.name),
      statistics,
    });
  }
  teams.sort((a, b) => a.providerTeamId.localeCompare(b.providerTeamId));
  const contentDigest = createHash("sha256")
    .update(
      JSON.stringify(
        teams.map((t) => ({
          id: t.providerTeamId,
          stats: t.statistics.map((s) => [
            s.rawName,
            s.valuePresence,
            s.rawValue,
          ]),
        })),
      ),
      "utf8",
    )
    .digest("hex");
  return {
    ok: true,
    envelope: {
      schemaVersion: PE4I2_SCHEMA_VERSION,
      acquisitionVersion: PE4I2_ACQUISITION_VERSION,
      evidenceKind: "fixture_statistics",
      acquiredAtUtc: input.acquiredAtUtc,
      provider: PE4I2_PROVIDER,
      providerFixtureId: fixtureId,
      providerEnvelopeComplete: true,
      resultsCount:
        typeof input.payload.results === "number" ? input.payload.results : null,
      teams,
      contentDigest,
      vendorXgFieldObserved,
    },
  };
}
