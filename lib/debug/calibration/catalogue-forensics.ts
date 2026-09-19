/**
 * Offline catalogue-Elo formula decomposition.
 * Does not change the production formula.
 */

import { scoreRowWithPolicy } from "@/lib/debug/calibration/evaluate";
import { createCurrentCataloguePolicy } from "@/lib/debug/calibration/policies";
import { rowEvidenceBucket } from "@/lib/debug/calibration/reconstruct";
import type { CalibrationRow, EvidenceBucket } from "@/lib/debug/calibration/types";

export type CatalogueEloDecomposition = {
  roleBase: number;
  minus80: -80;
  played: number;
  wins: number;
  goalsFor: number;
  goalsAgainst: number;
  winRate: number;
  winRateTerm: number;
  goalDifference: number;
  clampedGoalDifference: number;
  gdTerm: number;
  elo: number;
};

export function decomposeCatalogueElo(input: {
  base: number;
  played: number;
  wins: number;
  goalsFor: number;
  goalsAgainst: number;
}): CatalogueEloDecomposition {
  const winRate = input.played > 0 ? input.wins / input.played : 0;
  const goalDifference = input.goalsFor - input.goalsAgainst;
  const clampedGoalDifference = Math.max(-30, Math.min(30, goalDifference));
  const winRateTerm = winRate * 220;
  const gdTerm = clampedGoalDifference * 2.5;
  return {
    roleBase: input.base,
    minus80: -80,
    played: input.played,
    wins: input.wins,
    goalsFor: input.goalsFor,
    goalsAgainst: input.goalsAgainst,
    winRate,
    winRateTerm,
    goalDifference,
    clampedGoalDifference,
    gdTerm,
    elo: Math.round(input.base - 80 + winRateTerm + gdTerm),
  };
}

export type SparseCatalogueGapCase = {
  fixtureId: string;
  kickoff: string;
  homeTeamName: string;
  awayTeamName: string;
  bucket: EvidenceBucket;
  homePlayedBefore: number;
  awayPlayedBefore: number;
  homeWinsBefore: number;
  awayWinsBefore: number;
  homeGfBefore: number;
  homeGaBefore: number;
  awayGfBefore: number;
  awayGaBefore: number;
  homeElo: number;
  awayElo: number;
  absGap: number;
  homeDecomposition: CatalogueEloDecomposition;
  awayDecomposition: CatalogueEloDecomposition;
  predicted: { home: number; draw: number; away: number };
  confidence: number;
  actualOutcome: CalibrationRow["actualOutcome"];
};

export function sparseCatalogueGaps(
  rows: readonly CalibrationRow[],
  minAbsGap = 200,
): SparseCatalogueGapCase[] {
  const policy = createCurrentCataloguePolicy();
  const out: SparseCatalogueGapCase[] = [];
  for (const row of rows) {
    const bucket = rowEvidenceBucket(row);
    if (bucket !== "1-3") continue;
    const scored = scoreRowWithPolicy(row, policy);
    const absGap = Math.abs(scored.homeElo - scored.awayElo);
    if (absGap < minAbsGap) continue;
    const home = policy.resolve(row, "home");
    const away = policy.resolve(row, "away");
    out.push({
      fixtureId: row.fixtureId,
      kickoff: row.kickoff,
      homeTeamName: row.homeTeamName,
      awayTeamName: row.awayTeamName,
      bucket,
      homePlayedBefore: row.homePlayedBefore,
      awayPlayedBefore: row.awayPlayedBefore,
      homeWinsBefore: row.homeWinsBefore,
      awayWinsBefore: row.awayWinsBefore,
      homeGfBefore: row.homeGfBefore,
      homeGaBefore: row.homeGaBefore,
      awayGfBefore: row.awayGfBefore,
      awayGaBefore: row.awayGaBefore,
      homeElo: scored.homeElo,
      awayElo: scored.awayElo,
      absGap,
      homeDecomposition: decomposeCatalogueElo({
        base: home.base,
        played: row.homePlayedBefore,
        wins: row.homeWinsBefore,
        goalsFor: row.homeGfBefore,
        goalsAgainst: row.homeGaBefore,
      }),
      awayDecomposition: decomposeCatalogueElo({
        base: away.base,
        played: row.awayPlayedBefore,
        wins: row.awayWinsBefore,
        goalsFor: row.awayGfBefore,
        goalsAgainst: row.awayGaBefore,
      }),
      predicted: scored.oneXTwo,
      confidence: scored.confidence,
      actualOutcome: row.actualOutcome,
    });
  }
  return out.sort((a, b) => b.absGap - a.absGap);
}
