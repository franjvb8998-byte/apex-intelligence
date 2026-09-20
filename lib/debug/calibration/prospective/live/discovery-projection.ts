/**
 * Immediate safe projection. Outcome fields are discarded and never copied.
 */

import { HistoricalFirewallError } from "@/lib/debug/calibration/prospective/candidate-integrity";
import { USED_HISTORICAL_SEASONS } from "@/lib/debug/calibration/prospective/candidate-types";
import { toUtcIso } from "@/lib/debug/calibration/prospective/protocol/protocol-utc";
import {
  DISCOVERY_FORBIDDEN_PAYLOAD_KEYS,
  DiscoveryIntegrityError,
  SEASON_VERIFICATION_METHOD,
  type SafeDiscoveredFixture,
} from "@/lib/debug/calibration/prospective/live/discovery-types";
import { PROSPECTIVE_COMPETITION_ID } from "@/lib/debug/calibration/prospective/protocol/protocol-types";

const FORBIDDEN_KEY_SET = new Set<string>(
  DISCOVERY_FORBIDDEN_PAYLOAD_KEYS.map((key) => key.toLowerCase()),
);

type VendorFixtureLike = {
  fixture?: {
    id?: unknown;
    date?: unknown;
    status?: { short?: unknown; long?: unknown };
  };
  league?: {
    id?: unknown;
    season?: unknown;
  };
  teams?: {
    home?: { id?: unknown; name?: unknown };
    away?: { id?: unknown; name?: unknown };
  };
};

type VendorEnvelopeLike = {
  errors?: unknown;
  results?: unknown;
  paging?: { current?: unknown; total?: unknown };
  response?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function textOf(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

export function vendorEnvelopeErrorText(payload: unknown): string | null {
  const record = asRecord(payload);
  if (!record) return null;
  const errors = record.errors;
  if (errors == null) return null;
  if (Array.isArray(errors)) {
    if (errors.length === 0) return null;
    return JSON.stringify(errors);
  }
  if (typeof errors === "object") {
    const keys = Object.keys(errors);
    if (keys.length === 0) return null;
    return JSON.stringify(errors);
  }
  if (typeof errors === "string" && errors.trim()) return errors;
  return null;
}

export function projectSafeFixture(item: unknown): SafeDiscoveredFixture {
  const row = asRecord(item) as VendorFixtureLike | null;
  if (!row) {
    throw new DiscoveryIntegrityError("vendor fixture item is not an object");
  }
  const fixtureId = textOf(row.fixture?.id);
  const competitionId = textOf(row.league?.id);
  const season = textOf(row.league?.season);
  const kickoffRaw = textOf(row.fixture?.date);
  const homeTeamId = textOf(row.teams?.home?.id);
  const awayTeamId = textOf(row.teams?.away?.id);
  const homeTeamName = textOf(row.teams?.home?.name);
  const awayTeamName = textOf(row.teams?.away?.name);
  const statusShort = textOf(row.fixture?.status?.short);
  const statusLong = textOf(row.fixture?.status?.long);
  if (!fixtureId || !competitionId || !season || !kickoffRaw || !homeTeamId || !awayTeamId) {
    throw new DiscoveryIntegrityError("vendor fixture is missing identifiers required for discovery");
  }
  const projected: SafeDiscoveredFixture = {
    fixtureId,
    competitionId,
    season,
    kickoffUtc: toUtcIso(kickoffRaw, "kickoff"),
    statusShort,
    statusLong,
    homeTeamId,
    homeTeamName,
    awayTeamId,
    awayTeamName,
  };
  assertSafeProjectedObject(projected);
  return projected;
}

export function projectSafeFixtures(payload: unknown): {
  fixtures: SafeDiscoveredFixture[];
  pagingObserved: { current: number | null; total: number | null };
} {
  const envelope = asRecord(payload) as VendorEnvelopeLike | null;
  if (!envelope) {
    throw new DiscoveryIntegrityError("vendor fixture envelope is not an object");
  }
  const errorText = vendorEnvelopeErrorText(envelope);
  if (errorText) {
    throw new DiscoveryIntegrityError(`vendor fixture envelope errors are non-empty: ${errorText}`);
  }
  const response = envelope.response;
  if (!Array.isArray(response)) {
    throw new DiscoveryIntegrityError("vendor fixture envelope response is missing");
  }
  const fixtures = response.map((item) => projectSafeFixture(item));
  const paging = asRecord(envelope.paging);
  const current = paging && Number.isFinite(Number(paging.current)) ? Number(paging.current) : null;
  const total = paging && Number.isFinite(Number(paging.total)) ? Number(paging.total) : null;
  return {
    fixtures,
    pagingObserved: { current, total },
  };
}

export function assertSafeProjectedObject(value: unknown, path = "$"): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertSafeProjectedObject(entry, `${path}[${index}]`));
    return;
  }
  const record = asRecord(value);
  if (!record) return;
  for (const [key, child] of Object.entries(record)) {
    if (FORBIDDEN_KEY_SET.has(key.toLowerCase())) {
      throw new DiscoveryIntegrityError(`forbidden outcome field ${key} survived at ${path}`);
    }
    assertSafeProjectedObject(child, `${path}.${key}`);
  }
}

export function verifySeasonFromProjected(fixtures: readonly SafeDiscoveredFixture[]): string {
  if (fixtures.length === 0) {
    throw new DiscoveryIntegrityError(
      "cannot verify the current Premier League season: fixture discovery returned no rows",
    );
  }
  const seasons = [...new Set(fixtures.map((row) => row.season))];
  for (const season of seasons) {
    if ((USED_HISTORICAL_SEASONS as readonly string[]).includes(season)) {
      throw new HistoricalFirewallError(
        `${season} is used 5B investigation data and cannot enter prospective discovery`,
      );
    }
  }
  if (seasons.length !== 1) {
    throw new DiscoveryIntegrityError(
      `fixture discovery returned multiple seasons (${seasons.join(", ")}); refusing to guess`,
    );
  }
  const competitionIds = [...new Set(fixtures.map((row) => row.competitionId))];
  if (competitionIds.length !== 1 || competitionIds[0] !== PROSPECTIVE_COMPETITION_ID) {
    throw new DiscoveryIntegrityError(
      `fixture discovery competition ${competitionIds.join(", ") || "missing"} is not Premier League ${PROSPECTIVE_COMPETITION_ID}`,
    );
  }
  return seasons[0]!;
}

export function seasonVerificationMethod(): string {
  return SEASON_VERIFICATION_METHOD;
}
