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
      injuries: options.injuries,
    };

    return this.analyze(input);
  }
}

export function createMatchAnalysisService(
  options?: MatchAnalysisServiceOptions,
): MatchAnalysisService {
  return new MatchAnalysisService(options);
}

function decimalFor(
  quote: ApexMatchBundle["odds"][number] | undefined,
  keys: string[],
): number | null {
  if (!quote) return null;
  const byKey = Object.fromEntries(
    quote.selections.map((s) => [s.key.toLowerCase(), s.decimalOdds]),
  );
  for (const key of keys) {
    const value = byKey[key];
    if (value != null && Number.isFinite(value)) return value;
  }
  return null;
}

function bestDecimalAmong(
  quotes: ApexMatchBundle["odds"],
  keys: string[],
): number | null {
  let best: number | null = null;
  for (const quote of quotes) {
    const value = decimalFor(quote, keys);
    if (value == null) continue;
    if (best == null || value > best) best = value;
  }
  return best;
}

function extractOdds(
  bundle: ApexMatchBundle,
): MatchAnalysisInput["marketOdds"] | undefined {
  const oneXTwo = bundle.odds.filter((o) => o.market === "1x2");
  const overUnder = bundle.odds.filter(
    (o) => o.market === "over_under" && (o.line == null || o.line === 2.5),
  );
  const btts = bundle.odds.filter((o) => o.market === "btts");
  if (!oneXTwo.length && !overUnder.length && !btts.length) return undefined;

  return {
    home: bestDecimalAmong(oneXTwo, ["home", "1"]),
    draw: bestDecimalAmong(oneXTwo, ["draw", "x"]),
    away: bestDecimalAmong(oneXTwo, ["away", "2"]),
    over25: bestDecimalAmong(overUnder, ["over"]),
    under25: bestDecimalAmong(overUnder, ["under"]),
    bttsYes: bestDecimalAmong(btts, ["yes", "si", "sí"]),
    bttsNo: bestDecimalAmong(btts, ["no"]),
  };
}
