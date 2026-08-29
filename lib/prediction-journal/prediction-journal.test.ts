import { beforeEach, describe, expect, it } from "vitest";
import { mapOpportunityFromDecision } from "@/lib/apex-opportunities/map";
import { evaluateDecision } from "@/lib/decision-engine/evaluate";
import type { ApexDecisionInput } from "@/lib/decision-engine/types";
import {
  getPredictionJournalService,
  predictionIdFromParts,
  resetPredictionJournalService,
} from "@/lib/prediction-journal";

function decisionSample(): ApexDecisionInput {
  return {
    matchId: "1035089",
    kickoffAt: "2026-08-27T15:00:00.000Z",
    predicted: "home",
    predictedLabel: "Victoria Arsenal",
    homeName: "Arsenal",
    awayName: "Chelsea",
    oneXTwo: { home: 0.62, draw: 0.2, away: 0.18 },
    expectedGoals: { home: 2.05, away: 0.82, total: 2.87 },
    decimalOdds: 2.15,
    bookmaker: "Pinnacle",
    bookmakerCount: 3,
    home: {
      name: "Arsenal",
      formLetters: ["W", "W", "W", "D", "W"],
      formQuality: 0.86,
      restDays: 7,
      matchesLast7: 0,
      goalsFor: 12,
      goalsAgainst: 3,
      played: 5,
      awayWinPct: 0.45,
      injuryCount: 0,
      consecutiveAway: 0,
      rank: 1,
    },
    away: {
      name: "Chelsea",
      formLetters: ["L", "L", "D", "L", "W"],
      formQuality: 0.32,
      restDays: 3,
      matchesLast7: 1,
      goalsFor: 4,
      goalsAgainst: 9,
      played: 5,
      awayWinPct: 0.22,
      injuryCount: 1,
      consecutiveAway: 1,
      rank: 12,
    },
    h2h: { pickWins: 3, otherWins: 1, draws: 1, meetings: 5 },
    weather: null,
  };
}

describe("APEX Prediction Journal MVP", () => {
  beforeEach(() => {
    resetPredictionJournalService();
  });

  it("assigns a unique prediction id", () => {
    expect(
      predictionIdFromParts({
        fixtureId: "1035089",
        market: "1x2",
        selectionLabel: "Arsenal",
      }),
    ).toBe("pred:1035089:1x2:arsenal");
  });

  it("persists a Decision Engine recommendation without a save click", () => {
    const input = decisionSample();
    const decision = evaluateDecision(input);
    const row = mapOpportunityFromDecision({
      fixtureId: input.matchId,
      kickoffAt: input.kickoffAt,
      leagueName: "Premier League",
      home: { name: "Arsenal", shortName: "ARS", logoUrl: null },
      away: { name: "Chelsea", shortName: "CHE", logoUrl: null },
      predicted: decision.predicted,
      decision,
      decisionInput: input,
    });

    const journal = getPredictionJournalService();
    const listed = journal.listPredictions({ fixtureId: "1035089" });
    expect(listed).toHaveLength(1);
    const stored = journal.getPrediction(listed[0]!.id);
    expect(stored).not.toBeNull();
    expect(stored?.status).toBe("PENDING");
    expect(stored?.fixtureId).toBe("1035089");
    expect(stored?.league).toBe("Premier League");
    expect(stored?.homeTeam).toBe("Arsenal");
    expect(stored?.awayTeam).toBe("Chelsea");
    expect(stored?.market).toBe("1x2");
    expect(stored?.recommendation).toBe(row.recommendation);
    expect(stored?.bookmakerOdds).toBe(row.bookmakerOdds);
    expect(stored?.modelProbability).toBe(decision.value.modelProbability);
    expect(stored?.fairOdds).toBe(decision.value.fairOdds);
    expect(stored?.expectedValue).toBe(decision.value.expectedValue);
    expect(stored?.confidence).toBe(decision.confidence.value);
    expect(stored?.risk).toBe(decision.risk.band);
    expect(stored?.apexScore).toBe(row.score);
    expect(stored?.decision.engineId).toBe("deterministic-v1");
    expect(stored?.createdAt).toBeTruthy();
  });

  it("upserts the same fixture market instead of duplicating PENDING rows", () => {
    const input = decisionSample();
    const decision = evaluateDecision(input);
    const args = {
      fixtureId: input.matchId,
      kickoffAt: input.kickoffAt,
      leagueName: "Premier League",
      home: { name: "Arsenal" as const, shortName: "ARS", logoUrl: null },
      away: { name: "Chelsea" as const, shortName: "CHE", logoUrl: null },
      predicted: decision.predicted,
      decision,
      decisionInput: input,
    };
    mapOpportunityFromDecision(args);
    mapOpportunityFromDecision(args);
    expect(
      getPredictionJournalService().listPredictions({ status: "PENDING" }),
    ).toHaveLength(1);
  });

  it("updates a stored prediction without inventing settlement", () => {
    const input = decisionSample();
    const decision = evaluateDecision(input);
    mapOpportunityFromDecision({
      fixtureId: input.matchId,
      kickoffAt: input.kickoffAt,
      leagueName: "Premier League",
      home: { name: "Arsenal", shortName: "ARS", logoUrl: null },
      away: { name: "Chelsea", shortName: "CHE", logoUrl: null },
      predicted: decision.predicted,
      decision,
      decisionInput: input,
    });
    const journal = getPredictionJournalService();
    const id = journal.listPredictions()[0]!.id;
    const updated = journal.updatePrediction(id, { season: "2025" });
    expect(updated?.season).toBe("2025");
    expect(updated?.status).toBe("PENDING");
    expect(journal.getPrediction(id)?.season).toBe("2025");
  });
});
