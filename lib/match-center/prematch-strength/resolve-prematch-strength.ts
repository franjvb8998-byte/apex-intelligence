/**
 * PE-3A entry: reconstruct prematch C0 Elo + provenance from a fixture universe.
 * Pure offline.
 */

import {
  catalogueEloFromPlayedStats,
  PRODUCTION_AWAY_ELO_BASE,
  PRODUCTION_HOME_ELO_BASE,
} from "@/lib/match-center/catalogue-elo";
import { estimateEloFromTeamId } from "@/lib/intelligence/modules/probability/elo-estimate";
import { digestAcceptedPrematchEvidence } from "@/lib/match-center/prematch-strength/evidence-digest";
import {
  isValidPrematchStrengthTarget,
  reconstructPrematchTeamEvidence,
} from "@/lib/match-center/prematch-strength/reconstruct-evidence";
import {
  PREMATCH_STRENGTH_REGIME_C0_RECON_V1,
  type PrematchSideStrength,
  type PrematchStrengthFallbackReason,
  type PrematchStrengthResult,
  type PrematchStrengthTarget,
  type PrematchStrengthUniverseFixture,
  type PrematchTeamEvidenceCounts,
} from "@/lib/match-center/prematch-strength/types";

export class PrematchUniverseConflictError extends Error {
  readonly code = "conflicting_universe_evidence" as const;
  constructor(message = "Conflicting duplicate fixture evidence in universe") {
    super(message);
    this.name = "PrematchUniverseConflictError";
  }
}

function sideFromEvidence(
  evidence: PrematchTeamEvidenceCounts,
  base: number,
): PrematchSideStrength {
  if (evidence.played <= 0) {
    return {
      teamId: evidence.teamId,
      elo: estimateEloFromTeamId(evidence.teamId, base),
      source: "base_prior",
      base,
      evidence,
    };
  }
  return {
    teamId: evidence.teamId,
    elo: catalogueEloFromPlayedStats({
      base,
      played: evidence.played,
      wins: evidence.wins,
      goalsFor: evidence.goalsFor,
      goalsAgainst: evidence.goalsAgainst,
    }),
    source: "catalogue",
    base,
    evidence,
  };
}

function emptyEvidence(teamId: string): PrematchTeamEvidenceCounts {
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

function basePriorPair(input: {
  target: PrematchStrengthTarget;
  /** Lifecycle acquisition / prediction clock — NOT a provider snapshot. */
  evidenceAcquiredAtUtc: string | null;
  priorsInspected: number;
  fallbackReason: Exclude<PrematchStrengthFallbackReason, null>;
}): PrematchStrengthResult {
  const homeEvidence = emptyEvidence(input.target.homeTeamId);
  const awayEvidence = emptyEvidence(input.target.awayTeamId);
  const home = sideFromEvidence(homeEvidence, PRODUCTION_HOME_ELO_BASE);
  const away = sideFromEvidence(awayEvidence, PRODUCTION_AWAY_ELO_BASE);
  const acquired = input.evidenceAcquiredAtUtc;
  return {
    homeElo: home.elo,
    awayElo: away.elo,
    home,
    away,
    source: "base_prior",
    regime: PREMATCH_STRENGTH_REGIME_C0_RECON_V1,
    evidenceAcquiredAtUtc: acquired,
    /** @deprecated Alias of evidenceAcquiredAtUtc (acquisition clock, not provider snapshot). */
    evidenceAsOfUtc: acquired,
    historicalCutoffUtc: input.target.kickoffUtc,
    targetFixtureId: input.target.fixtureId,
    priorsInspected: input.priorsInspected,
    priorsAccepted: 0,
    acceptedEvidenceDigest: digestAcceptedPrematchEvidence([]),
    fallback: true,
    fallbackReason: input.fallbackReason,
  };
}

/**
 * Reconstruct team-specific C0 Elo for a target fixture from a supplied universe.
 *
 * Guarantees:
 * - prior.kickoff < target.kickoff (strict)
 * - target never contributes
 * - same-kickoff / future / unfinished excluded
 * - duplicate fixtureIds with identical evidence counted once
 * - conflicting duplicates → PrematchUniverseConflictError (fail closed)
 * - empty / unusable universe → explicit base_prior 1580/1520
 *
 * evidenceAcquiredAtUtc is the caller clock (prediction/acquisition time).
 * It is NOT a provider historical snapshot timestamp.
 */
export function resolvePrematchStrengthFromUniverse(input: {
  target: PrematchStrengthTarget;
  universe: readonly PrematchStrengthUniverseFixture[];
  /** Preferred name: acquisition/prediction clock. */
  evidenceAcquiredAtUtc?: string | null;
  /**
   * @deprecated Prefer evidenceAcquiredAtUtc. Same semantics (acquisition clock).
   * Not a provider snapshot time.
   */
  evidenceAsOfUtc?: string | null;
}): PrematchStrengthResult {
  const evidenceAcquiredAtUtc =
    input.evidenceAcquiredAtUtc ?? input.evidenceAsOfUtc ?? null;

  if (!isValidPrematchStrengthTarget(input.target)) {
    const safeTarget: PrematchStrengthTarget = {
      fixtureId: input.target.fixtureId || "malformed",
      kickoffUtc: input.target.kickoffUtc || "1970-01-01T00:00:00.000Z",
      homeTeamId: input.target.homeTeamId || "home",
      awayTeamId: input.target.awayTeamId || "away",
      competitionId: input.target.competitionId || "unknown",
      season: input.target.season || "unknown",
    };
    return basePriorPair({
      target: safeTarget,
      evidenceAcquiredAtUtc,
      priorsInspected: input.universe.length,
      fallbackReason: "malformed_target",
    });
  }

  if (input.universe.length === 0) {
    return basePriorPair({
      target: input.target,
      evidenceAcquiredAtUtc,
      priorsInspected: 0,
      fallbackReason: "empty_universe",
    });
  }

  const reconstructed = reconstructPrematchTeamEvidence({
    target: input.target,
    universe: input.universe,
  });

  if (!reconstructed.ok) {
    throw new PrematchUniverseConflictError(
      `Conflicting duplicate fixture evidence (${reconstructed.reason})`,
    );
  }

  if (reconstructed.priorsAccepted === 0) {
    return basePriorPair({
      target: input.target,
      evidenceAcquiredAtUtc,
      priorsInspected: reconstructed.priorsInspected,
      fallbackReason: "no_completed_priors",
    });
  }

  const home = sideFromEvidence(
    reconstructed.home,
    PRODUCTION_HOME_ELO_BASE,
  );
  const away = sideFromEvidence(
    reconstructed.away,
    PRODUCTION_AWAY_ELO_BASE,
  );

  const source =
    home.source === away.source
      ? home.source
      : ("mixed" as const);

  return {
    homeElo: home.elo,
    awayElo: away.elo,
    home,
    away,
    source,
    regime: PREMATCH_STRENGTH_REGIME_C0_RECON_V1,
    evidenceAcquiredAtUtc,
    evidenceAsOfUtc: evidenceAcquiredAtUtc,
    historicalCutoffUtc: input.target.kickoffUtc,
    targetFixtureId: input.target.fixtureId,
    priorsInspected: reconstructed.priorsInspected,
    priorsAccepted: reconstructed.priorsAccepted,
    acceptedEvidenceDigest: digestAcceptedPrematchEvidence(
      reconstructed.acceptedPriors,
    ),
    fallback: false,
    fallbackReason: null,
  };
}
