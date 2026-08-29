import { describe, expect, it } from "vitest";
import { opportunityFixture } from "@/lib/apex-opportunities/fixture";
import { expectedValue, impliedProbability } from "@/lib/match-rating/pricing";
import { analyzeCombo } from "@/lib/smart-combos/analyze";
import { buildCombo } from "@/lib/smart-combos/build";
import { analyzeCorrelation } from "@/lib/smart-combos/correlation";
import { buildDailySmartCombos } from "@/lib/smart-combos/daily";
import { opportunityToComboLeg } from "@/lib/smart-combos/legs";
import { optimizeCombo } from "@/lib/smart-combos/optimize";
import {
  combinedDecimalOdds,
  independentApexProbability,
} from "@/lib/smart-combos/pricing";
import { simulateCombo } from "@/lib/smart-combos/simulate";

function row(
  fixtureId: string,
  over: Parameters<typeof opportunityFixture>[0] = {},
) {
  return opportunityFixture({ fixtureId, ...over });
}

const arsenal = row("1", {
  home: { name: "Arsenal", shortName: "ARS", logoUrl: null },
  away: { name: "Chelsea", shortName: "CHE", logoUrl: null },
  selectionLabel: "Arsenal",
  leagueName: "Premier League",
  fairOdds: 1.9,
  bookmakerOdds: 2.1,
  expectedValue: 0.08,
  score: 82,
  confidence: 74,
  riskBand: "low",
  riskScore: 18,
  verdict: "elite_pick",
});

const madrid = row("2", {
  home: { name: "Real Madrid", shortName: "RMA", logoUrl: null },
  away: { name: "Sevilla", shortName: "SEV", logoUrl: null },
  selectionLabel: "Real Madrid",
  leagueName: "La Liga",
  kickoffAt: "2026-08-27T19:00:00.000Z",
  fairOdds: 1.7,
  bookmakerOdds: 1.85,
  expectedValue: 0.09,
  score: 80,
  confidence: 70,
  riskBand: "low",
  riskScore: 22,
  predicted: "home",
  verdict: "strong_bet",
  verdictLabel: "Strong Bet",
});

const bayern = row("3", {
  home: { name: "Bayern", shortName: "BAY", logoUrl: null },
  away: { name: "Gladbach", shortName: "BMG", logoUrl: null },
  selectionLabel: "Bayern",
  leagueName: "Bundesliga",
  kickoffAt: "2026-08-28T16:30:00.000Z",
  fairOdds: 1.55,
  bookmakerOdds: 1.62,
  expectedValue: 0.05,
  score: 77,
  confidence: 68,
  riskBand: "medium",
  riskScore: 40,
  verdict: "strong_bet",
  verdictLabel: "Strong Bet",
});

const inter = row("4", {
  home: { name: "Inter", shortName: "INT", logoUrl: null },
  away: { name: "Lazio", shortName: "LAZ", logoUrl: null },
  selectionLabel: "Inter",
  leagueName: "Serie A",
  kickoffAt: "2026-08-28T18:45:00.000Z",
  fairOdds: 1.8,
  bookmakerOdds: 2.05,
  expectedValue: 0.14,
  score: 76,
  confidence: 66,
  riskBand: "low",
  riskScore: 28,
  verdict: "lean_bet",
  verdictLabel: "Lean Bet",
});

const weak = row("5", {
  home: { name: "Burnley", shortName: "BUR", logoUrl: null },
  away: { name: "Everton", shortName: "EVE", logoUrl: null },
  selectionLabel: "Burnley",
  leagueName: "Premier League",
  kickoffAt: "2026-08-27T15:00:00.000Z",
  fairOdds: 2.8,
  bookmakerOdds: 2.4,
  expectedValue: -0.14,
  score: 48,
  confidence: 38,
  confidenceBand: "low",
  riskBand: "high",
  riskScore: 72,
  positiveEdge: false,
  verdict: "avoid",
  verdictLabel: "Avoid",
  recommendation: "Avoid",
});

describe("APEX Smart Combos", () => {
  it("prices an independent double with Decision Engine probabilities", () => {
    const legs = [opportunityToComboLeg(arsenal), opportunityToComboLeg(madrid)];
    const analysis = analyzeCombo(legs);
    const p1 = 1 / 1.9;
    const p2 = 1 / 1.7;
    expect(analysis.combinedOdds).toBeCloseTo(2.1 * 1.85, 8);
    expect(analysis.independentApexProbability).toBeCloseTo(p1 * p2, 8);
    expect(analysis.impliedProbability).toBeCloseTo(
      impliedProbability(2.1 * 1.85)!,
      8,
    );
    expect(analysis.expectedValue).toBeCloseTo(
      expectedValue(analysis.adjustedApexProbability!, analysis.combinedOdds)!,
      6,
    );
    expect(analysis.weakest?.fixtureId).toBe("1");
    expect(analysis.healthScore).toBeGreaterThan(0);
    expect(analysis.healthScore).toBeLessThanOrEqual(100);
    expect(analysis.verdict.kind).toBeTruthy();
    expect(analysis.sizing.stakePct).toBeLessThanOrEqual(5);
    expect(analysis.correlation.hasConflict).toBe(false);
  });

  it("zeros a mutually exclusive same-fixture 1X2 pair", () => {
    const home = opportunityToComboLeg(arsenal);
    const away = opportunityToComboLeg(
      row("1", {
        predicted: "away",
        selectionLabel: "Chelsea",
        fairOdds: 3.2,
        bookmakerOdds: 3.4,
      }),
    );
    const analysis = analyzeCombo([home, away]);
    expect(analysis.correlation.hasConflict).toBe(true);
    expect(analysis.adjustedApexProbability).toBe(0);
    expect(analysis.healthScore).toBe(0);
    expect(analysis.verdict.kind).toBe("avoid");
    expect(analysis.sizing.stakePct).toBe(0);
  });

  it("flags same-league correlation and lowers adjusted probability", () => {
    const secondPl = opportunityToComboLeg(
      row("9", {
        home: { name: "Liverpool", shortName: "LIV", logoUrl: null },
        away: { name: "Fulham", shortName: "FUL", logoUrl: null },
        selectionLabel: "Liverpool",
        leagueName: "Premier League",
        kickoffAt: "2026-08-27T17:30:00.000Z",
        fairOdds: 1.8,
        bookmakerOdds: 1.95,
      }),
    );
    const report = analyzeCorrelation([opportunityToComboLeg(arsenal), secondPl]);
    expect(report.pairs.some((pair) => pair.kind === "same_league")).toBe(true);
    expect(report.penalty).toBeGreaterThan(0);
    const analysis = analyzeCombo([opportunityToComboLeg(arsenal), secondPl]);
    expect(analysis.adjustedApexProbability!).toBeLessThan(
      analysis.independentApexProbability!,
    );
  });

  it("Monte Carlo hit rate tracks independence on uncorrelated legs", () => {
    const legs = [
      opportunityToComboLeg(arsenal),
      opportunityToComboLeg(madrid),
      opportunityToComboLeg(bayern),
    ];
    const sim = simulateCombo(legs, { trials: 8_000, seed: 7 });
    const independent = independentApexProbability(legs)!;
    expect(sim.hitRate).toBeGreaterThan(independent * 0.6);
    expect(sim.hitRate).toBeLessThan(independent * 1.4);
    expect(sim.histogram.reduce((a, b) => a + b, 0)).toBe(8_000);
    expect(sim.histogram[3]).toBeGreaterThan(0);
  });

  it("builds a conservative double and refuses an undersized scan", () => {
    const built = buildCombo([arsenal, madrid, bayern, inter], {
      legCount: 2,
      riskProfile: "conservative",
      oddsMax: 5,
    });
    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(built.analysis.legs).toHaveLength(2);
      expect(built.analysis.combinedOdds).toBeLessThanOrEqual(5);
    }

    const thin = buildCombo([arsenal], {
      legCount: 2,
      riskProfile: "conservative",
    });
    expect(thin.ok).toBe(false);
    if (!thin.ok) expect(thin.reason).toMatch(/Need 2/);
  });

  it("optimizes by dropping the weakest leg and suggesting a safer swap", () => {
    const current = analyzeCombo([
      opportunityToComboLeg(arsenal),
      opportunityToComboLeg(weak),
    ]);
    const opt = optimizeCombo(current, [arsenal, weak, madrid, bayern]);
    expect(opt.suggestions.some((row) => row.kind === "remove")).toBe(true);
    const safer = opt.suggestions.find((row) => row.kind === "safer");
    expect(safer?.added?.fixtureId).not.toBe("5");
    expect(safer?.analysis.legs.some((leg) => leg.fixtureId === "5")).toBe(false);
  });

  it("publishes daily profiles only when the scan can fill them", () => {
    const rich = buildDailySmartCombos(
      [arsenal, madrid, bayern, inter, weak],
      "2026-08-28T00:00:00.000Z",
    );
    expect(rich.items.some((item) => item.kind === "conservative")).toBe(true);
    expect(rich.items.every((item) => item.analysis.legs.length >= 2)).toBe(true);

    const thin = buildDailySmartCombos([arsenal], "2026-08-28T00:00:00.000Z");
    expect(thin.items).toHaveLength(0);
    expect(thin.unavailable.length).toBe(4);
  });

  it("combined odds is the product of published prices", () => {
    const legs = [opportunityToComboLeg(arsenal), opportunityToComboLeg(inter)];
    expect(combinedDecimalOdds(legs)).toBeCloseTo(2.1 * 2.05, 8);
  });
});
