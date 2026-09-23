/**
 * Prematch-safe prior selection and count reconstruction.
 */

import { isCompletedPrematchEvidenceStatus } from "@/lib/match-center/prematch-strength/completed-status";
import type {
  PrematchStrengthTarget,
  PrematchStrengthUniverseFixture,
  PrematchTeamEvidenceCounts,
} from "@/lib/match-center/prematch-strength/types";

export function parseKickoffUtcMillis(kickoffUtc: string): number | null {
  if (typeof kickoffUtc !== "string" || kickoffUtc.trim().length === 0) {
    return null;
  }
  const ms = Date.parse(kickoffUtc);
  return Number.isFinite(ms) ? ms : null;
}

export function isEligiblePriorKickoff(
  priorKickoffUtc: string,
  targetKickoffUtc: string,
): boolean {
  const priorMs = parseKickoffUtcMillis(priorKickoffUtc);
  const targetMs = parseKickoffUtcMillis(targetKickoffUtc);
  if (priorMs == null || targetMs == null) return false;
  return priorMs < targetMs;
}

export function isValidPrematchStrengthTarget(
  target: PrematchStrengthTarget,
): boolean {
  if (!target.fixtureId || !target.homeTeamId || !target.awayTeamId) return false;
  if (!target.competitionId || !target.season) return false;
  if (target.homeTeamId === target.awayTeamId) return false;
  return parseKickoffUtcMillis(target.kickoffUtc) != null;
}

function emptyCounts(teamId: string): PrematchTeamEvidenceCounts {
  return {
    teamId,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
  };
}

function applyCompletedResult(
  counts: PrematchTeamEvidenceCounts,
  goalsFor: number,
  goalsAgainst: number,
): void {
  counts.played += 1;
  counts.goalsFor += goalsFor;
  counts.goalsAgainst += goalsAgainst;
  counts.goalDifference = counts.goalsFor - counts.goalsAgainst;
  if (goalsFor > goalsAgainst) counts.wins += 1;
  else if (goalsFor < goalsAgainst) counts.losses += 1;
  else counts.draws += 1;
}

function priorMayContribute(
  prior: PrematchStrengthUniverseFixture,
  target: PrematchStrengthTarget,
): boolean {
  if (prior.fixtureId === target.fixtureId) return false;
  if (prior.competitionId !== target.competitionId) return false;
  if (prior.season !== target.season) return false;
  if (!isEligiblePriorKickoff(prior.kickoffUtc, target.kickoffUtc)) return false;
  if (!isCompletedPrematchEvidenceStatus(prior.status)) return false;
  if (prior.homeGoals == null || prior.awayGoals == null) return false;
  if (!Number.isFinite(prior.homeGoals) || !Number.isFinite(prior.awayGoals)) {
    return false;
  }
  if (prior.homeGoals < 0 || prior.awayGoals < 0) return false;
  if (
    prior.homeTeamId !== target.homeTeamId &&
    prior.awayTeamId !== target.homeTeamId &&
    prior.homeTeamId !== target.awayTeamId &&
    prior.awayTeamId !== target.awayTeamId
  ) {
    return false;
  }
  if (!prior.homeTeamId || !prior.awayTeamId) return false;
  if (prior.homeTeamId === prior.awayTeamId) return false;
  return true;
}

/** Identity-relevant fields for duplicate conflict detection. */
export function universeEvidenceIdentityKey(
  row: PrematchStrengthUniverseFixture,
): string {
  return [
    row.kickoffUtc,
    row.homeTeamId,
    row.awayTeamId,
    row.competitionId,
    row.season,
    row.status,
    row.homeGoals == null ? "" : String(row.homeGoals),
    row.awayGoals == null ? "" : String(row.awayGoals),
  ].join("|");
}

export type DedupeUniverseResult =
  | {
      ok: true;
      fixtures: PrematchStrengthUniverseFixture[];
    }
  | {
      ok: false;
      reason: "conflicting_duplicate_fixture";
      fixtureId: string;
    };

/**
 * Deduplicate by fixtureId.
 * Identical evidence → keep first after deterministic kickoff+id sort.
 * Conflicting evidence for same id → fail closed.
 */
export function dedupeUniverseByFixtureId(
  universe: readonly PrematchStrengthUniverseFixture[],
): DedupeUniverseResult {
  const sorted = [...universe].sort((a, b) => {
    const kickoff = a.kickoffUtc.localeCompare(b.kickoffUtc);
    if (kickoff !== 0) return kickoff;
    return a.fixtureId.localeCompare(b.fixtureId);
  });
  const byId = new Map<string, PrematchStrengthUniverseFixture>();
  for (const row of sorted) {
    if (!row.fixtureId) continue;
    const existing = byId.get(row.fixtureId);
    if (!existing) {
      byId.set(row.fixtureId, row);
      continue;
    }
    if (
      universeEvidenceIdentityKey(existing) !==
      universeEvidenceIdentityKey(row)
    ) {
      return {
        ok: false,
        reason: "conflicting_duplicate_fixture",
        fixtureId: row.fixtureId,
      };
    }
  }
  return { ok: true, fixtures: [...byId.values()] };
}

export type ReconstructedPrematchEvidence =
  | {
      ok: true;
      home: PrematchTeamEvidenceCounts;
      away: PrematchTeamEvidenceCounts;
      priorsInspected: number;
      priorsAccepted: number;
      acceptedPriors: PrematchStrengthUniverseFixture[];
    }
  | {
      ok: false;
      reason: "conflicting_duplicate_fixture";
      priorsInspected: number;
    };

/**
 * Reconstruct played/W/D/L/GF/GA for both target teams from a supplied universe.
 * Strict rule: prior.kickoff < target.kickoff. Target never contributes.
 */
export function reconstructPrematchTeamEvidence(input: {
  target: PrematchStrengthTarget;
  universe: readonly PrematchStrengthUniverseFixture[];
}): ReconstructedPrematchEvidence {
  const home = emptyCounts(input.target.homeTeamId);
  const away = emptyCounts(input.target.awayTeamId);
  const deduped = dedupeUniverseByFixtureId(input.universe);
  if (!deduped.ok) {
    return {
      ok: false,
      reason: "conflicting_duplicate_fixture",
      priorsInspected: input.universe.length,
    };
  }

  let priorsAccepted = 0;
  const acceptedPriors: PrematchStrengthUniverseFixture[] = [];

  for (const prior of deduped.fixtures) {
    if (!priorMayContribute(prior, input.target)) continue;
    const homeGoals = prior.homeGoals as number;
    const awayGoals = prior.awayGoals as number;

    if (prior.homeTeamId === input.target.homeTeamId) {
      applyCompletedResult(home, homeGoals, awayGoals);
    } else if (prior.awayTeamId === input.target.homeTeamId) {
      applyCompletedResult(home, awayGoals, homeGoals);
    }

    if (prior.homeTeamId === input.target.awayTeamId) {
      applyCompletedResult(away, homeGoals, awayGoals);
    } else if (prior.awayTeamId === input.target.awayTeamId) {
      applyCompletedResult(away, awayGoals, homeGoals);
    }

    priorsAccepted += 1;
    acceptedPriors.push(prior);
  }

  return {
    ok: true,
    home,
    away,
    priorsInspected: input.universe.length,
    priorsAccepted,
    acceptedPriors,
  };
}
