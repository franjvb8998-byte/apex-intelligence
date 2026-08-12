import type {
  ActualMatchResult,
  PredictionRecord,
} from "@/lib/learning-engine/types/case";

const MODEL = "elo-poisson-hybrid-0.1.0";

/**
 * Mock closed matches for Learning Engine demos/tests.
 * TODO(realtime): replace with Data Platform + PredictionPipeline outputs.
 */
export function createMockLearningFixtures(): Array<{
  prediction: PredictionRecord;
  actual: ActualMatchResult;
}> {
  return [
    {
      prediction: {
        id: "pred-1",
        matchId: "match-1",
        modelVersion: MODEL,
        predictedAt: "2026-08-01T16:00:00.000Z",
        predictedOutcome: "home",
        probabilities: { home: 0.52, draw: 0.26, away: 0.22 },
        confidence: 0.61,
        markets: [
          { market: "1x2", selection: "home", probability: 0.52 },
          { market: "over_under_25", selection: "over", probability: 0.58 },
          { market: "btts", selection: "yes", probability: 0.55 },
        ],
        variables: [
          { key: "home_elo", value: 1620, source: "elo" },
          { key: "away_elo", value: 1510, source: "elo" },
          { key: "lambda_home", value: 1.55, source: "poisson" },
        ],
        factors: [
          {
            key: "home-form",
            label: "Forma local",
            direction: "supports",
            weight: 0.3,
          },
        ],
      },
      actual: {
        matchId: "match-1",
        finishedAt: "2026-08-01T18:00:00.000Z",
        outcome: "home",
        homeScore: 2,
        awayScore: 1,
        marketResults: [
          { market: "1x2", winningSelection: "home" },
          { market: "over_under_25", winningSelection: "over" },
          { market: "btts", winningSelection: "yes" },
        ],
      },
    },
    {
      prediction: {
        id: "pred-2",
        matchId: "match-2",
        modelVersion: MODEL,
        predictedAt: "2026-08-03T16:00:00.000Z",
        predictedOutcome: "home",
        probabilities: { home: 0.57, draw: 0.24, away: 0.19 },
        confidence: 0.72,
        markets: [
          { market: "1x2", selection: "home", probability: 0.57 },
          { market: "over_under_25", selection: "over", probability: 0.62 },
          { market: "btts", selection: "yes", probability: 0.51 },
        ],
        variables: [
          { key: "home_elo", value: 1700, source: "elo" },
          { key: "away_elo", value: 1480, source: "elo" },
          { key: "injury_flag", value: true, source: "lineups" },
        ],
        factors: [
          {
            key: "injury-midfield",
            label: "Bajas mediocampo",
            direction: "against",
            weight: 0.22,
            detail: "Pivote dudoso",
          },
        ],
      },
      actual: {
        matchId: "match-2",
        finishedAt: "2026-08-03T18:00:00.000Z",
        outcome: "draw",
        homeScore: 1,
        awayScore: 1,
        marketResults: [
          { market: "1x2", winningSelection: "draw" },
          { market: "over_under_25", winningSelection: "under" },
          { market: "btts", winningSelection: "yes" },
        ],
      },
    },
    {
      prediction: {
        id: "pred-3",
        matchId: "match-3",
        modelVersion: MODEL,
        predictedAt: "2026-08-05T16:00:00.000Z",
        predictedOutcome: "away",
        probabilities: { home: 0.28, draw: 0.27, away: 0.45 },
        confidence: 0.58,
        markets: [
          { market: "1x2", selection: "away", probability: 0.45 },
          { market: "over_under_25", selection: "over", probability: 0.54 },
          { market: "btts", selection: "no", probability: 0.48 },
        ],
        variables: [
          { key: "home_elo", value: 1490, source: "elo" },
          { key: "away_elo", value: 1635, source: "elo" },
        ],
        factors: [
          {
            key: "away-form",
            label: "Forma visitante",
            direction: "supports",
            weight: 0.25,
          },
        ],
      },
      actual: {
        matchId: "match-3",
        finishedAt: "2026-08-05T18:00:00.000Z",
        outcome: "draw",
        homeScore: 0,
        awayScore: 0,
        marketResults: [
          { market: "1x2", winningSelection: "draw" },
          { market: "over_under_25", winningSelection: "under" },
          { market: "btts", winningSelection: "no" },
        ],
      },
    },
    {
      prediction: {
        id: "pred-4",
        matchId: "match-4",
        modelVersion: MODEL,
        predictedAt: "2026-08-07T16:00:00.000Z",
        predictedOutcome: "home",
        probabilities: { home: 0.6, draw: 0.22, away: 0.18 },
        confidence: 0.74,
        markets: [
          { market: "1x2", selection: "home", probability: 0.6 },
          { market: "over_under_25", selection: "over", probability: 0.66 },
          { market: "btts", selection: "yes", probability: 0.57 },
        ],
        variables: [
          { key: "home_elo", value: 1680, source: "elo" },
          { key: "injury_flag", value: true, source: "lineups" },
        ],
        factors: [
          {
            key: "injury-attack",
            label: "Lesión delantero",
            direction: "against",
            weight: 0.2,
          },
        ],
      },
      actual: {
        matchId: "match-4",
        finishedAt: "2026-08-07T18:00:00.000Z",
        outcome: "away",
        homeScore: 0,
        awayScore: 2,
        marketResults: [
          { market: "1x2", winningSelection: "away" },
          { market: "over_under_25", winningSelection: "under" },
          { market: "btts", winningSelection: "no" },
        ],
      },
    },
  ];
}
