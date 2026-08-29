import { describe, expect, it } from "vitest";
import { getMockBankroll } from "@/lib/bankroll/mock-data";
import { buildPortfolioReport } from "@/lib/portfolio/build";
import { parseMatchSides } from "@/lib/portfolio/classify";
import {
  diversificationFromShares,
  herfindahl,
  healthBand,
} from "@/lib/portfolio/metrics";

describe("portfolio classification", () => {
  it("splits match strings and maps known clubs to leagues", () => {
    expect(parseMatchSides("Arsenal vs Chelsea")).toEqual({
      home: "Arsenal",
      away: "Chelsea",
    });
    const report = buildPortfolioReport(getMockBankroll());
    const arsenal = report.classified.find(
      (row) => row.bet.match === "Arsenal vs Chelsea",
    );
    expect(arsenal?.league).toBe("Premier League");
    expect(arsenal?.competition).toBe("England");
    const nations = report.classified.find(
      (row) => row.bet.match === "Portugal vs España",
    );
    expect(nations?.league).toBe("International");
  });
});

describe("portfolio scores", () => {
  it("treats equal two-way shares as fully diversified", () => {
    expect(herfindahl([0.5, 0.5])).toBeCloseTo(0.5);
    expect(diversificationFromShares([0.5, 0.5])).toBe(100);
    expect(diversificationFromShares([1])).toBe(0);
    expect(healthBand(82)).toBe("Excellent");
    expect(healthBand(70)).toBe("Good");
    expect(healthBand(52)).toBe("Average");
    expect(healthBand(40)).toBe("Risky");
    expect(healthBand(10)).toBe("Critical");
  });
});

describe("portfolio report from bankroll history", () => {
  const report = buildPortfolioReport(getMockBankroll());

  it("reads current bankroll and pending exposure from the ledger", () => {
    expect(report.kpis.currentBankroll).toBe(
      getMockBankroll().metrics.currentBankroll,
    );
    expect(report.kpis.activeExposure).toBe(50);
    expect(report.pendingCount).toBe(1);
    expect(report.allocatedStake).toBeGreaterThan(report.kpis.activeExposure);
  });

  it("builds exposure charts from real markets, leagues and teams", () => {
    expect(report.byLeague[0]?.label).toBe("Premier League");
    expect(report.byLeague[0]!.share).toBeGreaterThan(0.35);
    expect(report.byMarket.some((slice) => slice.label === "1X2 · Local")).toBe(
      true,
    );
    expect(report.byTeam.some((slice) => slice.label === "Arsenal")).toBe(true);
    expect(report.byCompetition.some((slice) => slice.label === "England")).toBe(
      true,
    );
  });

  it("scores health 0–100 and emits data-backed insights", () => {
    expect(report.health.score).toBeGreaterThanOrEqual(0);
    expect(report.health.score).toBeLessThanOrEqual(100);
    expect(report.insights.some((row) => row.text.includes("Premier League"))).toBe(
      true,
    );
    expect(
      report.insights.some((row) => /portfolio risk is/i.test(row.text)),
    ).toBe(true);
    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(
      report.recommendations.some((row) => row.kind === "improve_diversification"),
    ).toBe(true);
  });

  it("does not invent Decision Engine numbers", () => {
    expect(report.kpis.expectedValue).not.toBeNull();
    expect(report.kpis.kellyAllocation).toBeCloseTo(50 / report.kpis.currentBankroll);
  });
});
