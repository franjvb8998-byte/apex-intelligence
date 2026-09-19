/**
 * Pre-match eligibility and time-contract guards. No live schedule decisions.
 */

import {
  HistoricalFirewallError,
  ProspectiveIntegrityError,
} from "@/lib/debug/calibration/prospective/candidate-integrity";
import { USED_HISTORICAL_SEASONS } from "@/lib/debug/calibration/prospective/candidate-types";
import {
  assertIsoTimestamp,
  minutesBeforeKickoff,
} from "@/lib/debug/calibration/prospective/capture/capture-clock";
import {
  FORBIDDEN_CAPTURE_INPUT_KEYS,
  FORBIDDEN_FINAL_STATUSES,
  type CaptureWindowMinutes,
  type ProspectiveFixtureInput,
  type ProspectiveOddsSnapshot,
} from "@/lib/debug/calibration/prospective/capture/capture-types";

const EVIDENCE_TIMESTAMP_KEY = /(asOf|capturedAt|timestamp)$/i;

export function assertNoOutcomeLeakage(value: unknown, path = "input"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoOutcomeLeakage(item, `${path}[${index}]`));
    return;
  }
  if (value === null || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if ((FORBIDDEN_CAPTURE_INPUT_KEYS as readonly string[]).includes(key)) {
      throw new ProspectiveIntegrityError(`capture input cannot contain outcome field ${key} at ${path}`);
    }
    if (key === "fixtureStatus") {
      const status = String(record[key] ?? "").toUpperCase();
      if ((FORBIDDEN_FINAL_STATUSES as readonly string[]).includes(status)) {
        throw new ProspectiveIntegrityError(`capture input cannot contain final fixtureStatus ${status}`);
      }
    }
    assertNoOutcomeLeakage(record[key], `${path}.${key}`);
  }
}

export function assertHistoricalFirewall(input: Pick<ProspectiveFixtureInput, "season" | "competitionId">): void {
  if ((USED_HISTORICAL_SEASONS as readonly string[]).includes(input.season)) {
    throw new HistoricalFirewallError(
      `${input.season} is used 5B investigation data and cannot enter prospective capture`,
    );
  }
  const competition = input.competitionId.toLowerCase();
  if (
    (competition.includes("premier") || competition === "pl" || competition.includes("39")) &&
    (USED_HISTORICAL_SEASONS as readonly string[]).includes(input.season)
  ) {
    throw new HistoricalFirewallError(`Premier League ${input.season} is forbidden prospective data`);
  }
}

export function assertTimeContract(input: {
  kickoff: string;
  capturedAt: string;
  evidenceAsOf: string;
}): void {
  const kickoff = assertIsoTimestamp(input.kickoff, "kickoff");
  const capturedAt = assertIsoTimestamp(input.capturedAt, "capturedAt");
  const evidenceAsOf = assertIsoTimestamp(input.evidenceAsOf, "evidenceAsOf");
  if (!(capturedAt < kickoff)) {
    throw new ProspectiveIntegrityError("capturedAt must be before kickoff");
  }
  if (!(evidenceAsOf <= capturedAt)) {
    throw new ProspectiveIntegrityError("evidenceAsOf must be at or before capturedAt");
  }
  if (!(evidenceAsOf < kickoff)) {
    throw new ProspectiveIntegrityError("evidence timestamps must be before kickoff");
  }
}

export function assertEvidenceTimestampsBeforeKickoff(value: unknown, kickoff: string, path = "input"): void {
  const kickoffMs = assertIsoTimestamp(kickoff, "kickoff");
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertEvidenceTimestampsBeforeKickoff(item, kickoff, `${path}[${index}]`),
    );
    return;
  }
  if (value === null || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  for (const [key, child] of Object.entries(record)) {
    if (key === "kickoff") continue;
    if (typeof child === "string" && EVIDENCE_TIMESTAMP_KEY.test(key)) {
      const ms = assertIsoTimestamp(child, key);
      if (!(ms < kickoffMs)) {
        throw new ProspectiveIntegrityError(`${key} must be before kickoff`);
      }
    }
    assertEvidenceTimestampsBeforeKickoff(child, kickoff, `${path}.${key}`);
  }
}

export function assertOddsTimestampGuard(
  odds: ProspectiveOddsSnapshot | null | undefined,
  capturedAt: string,
  kickoff: string,
): void {
  if (odds == null) return;
  const oddsMs = assertIsoTimestamp(odds.capturedAt, "oddsCapturedAt");
  const capturedMs = assertIsoTimestamp(capturedAt, "capturedAt");
  const kickoffMs = assertIsoTimestamp(kickoff, "kickoff");
  if (!(oddsMs <= capturedMs)) {
    throw new ProspectiveIntegrityError("oddsCapturedAt must be at or before capturedAt");
  }
  if (!(oddsMs < kickoffMs)) {
    throw new ProspectiveIntegrityError("oddsCapturedAt must be before kickoff");
  }
}

export function assertCaptureWindow(
  kickoff: string,
  capturedAt: string,
  window: CaptureWindowMinutes | null | undefined,
): void {
  if (window == null) return;
  if (
    !(window.earliestCaptureMinutesBeforeKickoff >= window.latestCaptureMinutesBeforeKickoff) ||
    window.latestCaptureMinutesBeforeKickoff < 0
  ) {
    throw new ProspectiveIntegrityError("capture window minutes are invalid");
  }
  const minutes = minutesBeforeKickoff(kickoff, capturedAt);
  if (minutes > window.earliestCaptureMinutesBeforeKickoff) {
    throw new ProspectiveIntegrityError("fixture is outside the earliest capture window");
  }
  if (minutes < window.latestCaptureMinutesBeforeKickoff) {
    throw new ProspectiveIntegrityError("fixture is outside the latest capture window");
  }
}

export function assertUniqueInputFixtures(fixtures: readonly ProspectiveFixtureInput[]): void {
  const seen = new Set<string>();
  for (const fixture of fixtures) {
    if (seen.has(fixture.fixtureId)) {
      throw new ProspectiveIntegrityError(`duplicate fixture ${fixture.fixtureId} in one input batch`);
    }
    seen.add(fixture.fixtureId);
  }
}

export function assertEligibleFixture(
  input: ProspectiveFixtureInput,
  capturedAt: string,
  window?: CaptureWindowMinutes | null,
): void {
  assertNoOutcomeLeakage(input);
  assertHistoricalFirewall(input);
  assertTimeContract({
    kickoff: input.kickoff,
    capturedAt,
    evidenceAsOf: input.evidenceAsOf,
  });
  assertEvidenceTimestampsBeforeKickoff(input, input.kickoff);
  assertOddsTimestampGuard(input.oddsSnapshot, capturedAt, input.kickoff);
  assertCaptureWindow(input.kickoff, capturedAt, window);
}
