/**
 * MatchAnalysisService — Sprint 8 orchestration.
 * Consumes Data Platform + Probability Engine public APIs.
 * Reasoning via rules (no OpenAI). Does not modify PE / LE / Data Platform.
 */

import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import {
  createEloPoissonHybridEngine,
  type ProbabilityEngine,
} from "@/lib/intelligence/modules/probability";
import type {
  MatchAnalysis,
  MatchAnalysisFromBundleOptions,
  MatchAnalysisInput,
} from "@/lib/match-analysis/analysis-types";
import {
  analyzeMatchWithRules,
  confidenceFromProbability,
} from "@/lib/match-analysis/rules/analyze-with-rules";

/** Deterministic pseudo-Elo — same approach as Match Center (no PE mutation). */
function estimateEloFromTeamId(teamId: string, base = 1500): number {
  let hash = 0;
  for (let i = 0; i < teamId.length; i++) {
    hash = (hash * 31 + teamId.charCodeAt(i)) >>> 0;
  }
  return base + (hash % 251) - 125;
}

export type MatchAnalysisServiceOptions = {
  engine?: ProbabilityEngine;
};

export class MatchAnalysisService {
  private readonly engine: ProbabilityEngine;

  constructor(options: MatchAnalysisServiceOptions = {}) {
    this.engine = options.engine ?? createEloPoissonHybridEngine();
  }

  /**
   * Analyze from an already-built input (PE result supplied by caller).
   */
  analyze(input: MatchAnalysisInput): MatchAnalysis {
    return analyzeMatchWithRules(input);
  }

  /**
   * Full flow: ApexMatchBundle (Data Platform) → PE.predict → rule reasoning.
   */
  analyzeBundle(
    bundle: ApexMatchBundle,
    options: MatchAnalysisFromBundleOptions = {},
  ): MatchAnalysis {
    const homeElo =
      options.homeElo ?? estimateEloFromTeamId(bundle.homeTeam.id, 1580);
    const awayElo =
      options.awayElo ?? estimateEloFromTeamId(bundle.awayTeam.id, 1520);

    const probability = this.engine.predict({
      homeElo,
      awayElo,
      homeTeamId: bundle.homeTeam.id,
      awayTeamId: bundle.awayTeam.id,
      matchId: bundle.match.id,
    });

    const oddsFromBundle = extractOdds(bundle);

    const input: MatchAnalysisInput = {
      match: bundle.match,
      homeTeam: bundle.homeTeam,
      awayTeam: bundle.awayTeam,
      league: bundle.league,
      teamStats: options.teamStats,
      probability,
      confidence: confidenceFromProbability(probability),
      timeline: bundle.events,
      players: bundle.players,
      marketOdds: options.marketOdds ?? oddsFromBundle,
    };

    return this.analyze(input);
  }
}

export function createMatchAnalysisService(
  options?: MatchAnalysisServiceOptions,
): MatchAnalysisService {
  return new MatchAnalysisService(options);
}

function extractOdds(
  bundle: ApexMatchBundle,
): MatchAnalysisInput["marketOdds"] | undefined {
  const oneXTwo = bundle.odds.find((o) => o.market === "1x2");
  if (!oneXTwo) return undefined;
  const byKey = Object.fromEntries(
    oneXTwo.selections.map((s) => [s.key.toLowerCase(), s.decimalOdds]),
  );
  return {
    home: byKey.home ?? byKey["1"] ?? null,
    draw: byKey.draw ?? byKey.x ?? null,
    away: byKey.away ?? byKey["2"] ?? null,
  };
}
