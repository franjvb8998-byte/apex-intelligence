/**
 * PE-3B offline / dry-run C0 reconstruction → PE → ticket payload path.
 *
 * NOT imported by runPrematchLifecycle / createScannerMatchCenter.
 * Activation requires PE-3C after audit.
 */

import { createEloPoissonHybridEngine } from "@/lib/intelligence/modules/probability";
import type { HybridProbabilityResult } from "@/lib/intelligence/modules/probability";
import {
  resolvePrematchStrengthFromUniverse,
  type PrematchStrengthResult,
  type PrematchStrengthTarget,
  type PrematchStrengthUniverseFixture,
} from "@/lib/match-center/prematch-strength";
import { expectedValue } from "@/lib/match-center/markets";
import {
  provenanceFromC0Strength,
  type PrematchInputProvenance,
} from "@/lib/prematch-decision/input-provenance";
import type {
  PrematchDecisionTicket,
  PrematchPublishedSnapshot,
} from "@/lib/prematch-decision/ticket";
import { snapshotPrematchDecisionTicket } from "@/lib/prematch-decision/capture";
import type { PrematchActionability } from "@/lib/prematch-decision/actionability";

export type OfflineC0ReconOdds = {
  home: number | null;
  draw: number | null;
  away: number | null;
  bookmaker?: string | null;
};

export type OfflineC0ReconPipelineInput = {
  target: PrematchStrengthTarget;
  universe: readonly PrematchStrengthUniverseFixture[];
  homeTeamName: string;
  awayTeamName: string;
  /** Acquisition / prediction clock — NOT a provider snapshot. */
  evidenceAcquiredAtUtc?: string;
  /**
   * @deprecated Prefer evidenceAcquiredAtUtc (same acquisition-clock semantics).
   */
  evidenceAsOfUtc?: string;
  capturedAtUtc?: string;
  odds?: OfflineC0ReconOdds | null;
  leagueId?: string | null;
};

export type OfflineC0ReconPipelineResult = {
  strength: PrematchStrengthResult;
  hybrid: HybridProbabilityResult;
  provenance: PrematchInputProvenance;
  published: PrematchPublishedSnapshot;
  /** In-memory ticket payload (not written to Supabase). */
  ticketPayload: PrematchDecisionTicket;
  /** EV from model p × odds − 1; model probs unchanged by odds. */
  ev: {
    home: number | null;
    draw: number | null;
    away: number | null;
  };
};

function buildActionability(
  kickoffUtc: string,
  nowUtc: string,
): PrematchActionability {
  return {
    isCurrentlyActionable: true,
    reason: "ACTIONABLE_PREMATCH",
    fixtureStatus: "NS",
    kickoffUtc,
    nowUtc,
  };
}

/**
 * Offline end-to-end: universe → C0 strength → canonical PE → provenance → ticket shape.
 * Pure aside from PE math. No provider / DB.
 */
export function runOfflineC0ReconPipeline(
  input: OfflineC0ReconPipelineInput,
): OfflineC0ReconPipelineResult {
  const evidenceAcquiredAtUtc =
    input.evidenceAcquiredAtUtc ?? input.evidenceAsOfUtc;
  if (!evidenceAcquiredAtUtc) {
    throw new Error("evidenceAcquiredAtUtc is required");
  }
  const strength = resolvePrematchStrengthFromUniverse({
    target: input.target,
    universe: input.universe,
    evidenceAcquiredAtUtc,
  });

  const engine = createEloPoissonHybridEngine();
  const hybrid = engine.predict({
    homeElo: strength.homeElo,
    awayElo: strength.awayElo,
    matchId: input.target.fixtureId,
    homeTeamId: input.target.homeTeamId,
    awayTeamId: input.target.awayTeamId,
  });

  const provenance = provenanceFromC0Strength({
    strength,
    modelVersion: hybrid.meta.modelVersion,
  });

  const odds = input.odds ?? null;
  const published: PrematchPublishedSnapshot = {
    fixtureId: input.target.fixtureId,
    leagueId: input.leagueId ?? input.target.competitionId,
    season: input.target.season,
    homeTeamId: input.target.homeTeamId,
    awayTeamId: input.target.awayTeamId,
    homeTeamName: input.homeTeamName,
    awayTeamName: input.awayTeamName,
    kickoffUtc: input.target.kickoffUtc,
    vendorStatusShort: "NS",
    asOfUtc: evidenceAcquiredAtUtc,
    sourceMode: "scanner",
    modelVersion: hybrid.meta.modelVersion,
    expectedGoals: {
      home: hybrid.expectedGoals.home,
      away: hybrid.expectedGoals.away,
      total: hybrid.expectedGoals.total,
    },
    markets: [
      {
        marketId: "1x2",
        marketLine: null,
        selections: [
          {
            selectionId: "home",
            selectionLabel: "Home",
            modelProbability: hybrid.oneXTwo.home,
          },
          {
            selectionId: "draw",
            selectionLabel: "Draw",
            modelProbability: hybrid.oneXTwo.draw,
          },
          {
            selectionId: "away",
            selectionLabel: "Away",
            modelProbability: hybrid.oneXTwo.away,
          },
        ],
      },
    ],
    quotes: odds
      ? [
          {
            marketId: "1x2",
            selectionId: "home",
            bookmaker: odds.bookmaker ?? "offline",
            offeredOdds: odds.home,
            impliedProbability:
              odds.home != null && odds.home > 1 ? 1 / odds.home : null,
            marketAsOfUtc: evidenceAcquiredAtUtc,
          },
          {
            marketId: "1x2",
            selectionId: "draw",
            bookmaker: odds.bookmaker ?? "offline",
            offeredOdds: odds.draw,
            impliedProbability:
              odds.draw != null && odds.draw > 1 ? 1 / odds.draw : null,
            marketAsOfUtc: evidenceAcquiredAtUtc,
          },
          {
            marketId: "1x2",
            selectionId: "away",
            bookmaker: odds.bookmaker ?? "offline",
            offeredOdds: odds.away,
            impliedProbability:
              odds.away != null && odds.away > 1 ? 1 / odds.away : null,
            marketAsOfUtc: evidenceAcquiredAtUtc,
          },
        ]
      : [],
    scoring: null,
    evidence: {
      statistics: !strength.fallback,
      market: odds != null,
      form: false,
      h2h: false,
      injuries: false,
    },
    inputProvenance: provenance,
  };

  const capturedAtUtc = input.capturedAtUtc ?? evidenceAcquiredAtUtc;
  const ticketPayload = snapshotPrematchDecisionTicket(
    published,
    buildActionability(input.target.kickoffUtc, capturedAtUtc),
  );

  return {
    strength,
    hybrid,
    provenance,
    published,
    ticketPayload,
    ev: {
      home: expectedValue(hybrid.oneXTwo.home, odds?.home ?? null),
      draw: expectedValue(hybrid.oneXTwo.draw, odds?.draw ?? null),
      away: expectedValue(hybrid.oneXTwo.away, odds?.away ?? null),
    },
  };
}
