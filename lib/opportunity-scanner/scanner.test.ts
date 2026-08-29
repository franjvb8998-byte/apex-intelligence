import { describe, expect, it } from "vitest";
import { opportunityFixture } from "@/lib/apex-opportunities/fixture";
import { explainOpportunity } from "@/lib/opportunity-scanner/explain";
import {
  DEFAULT_SCANNER_FILTERS,
  filterScanner,
} from "@/lib/opportunity-scanner/filters";
import { applyScannerMode } from "@/lib/opportunity-scanner/modes";
import { scannerRecommendation, isStrongOrElite } from "@/lib/opportunity-scanner/recommend";
import { buildScannerRankings } from "@/lib/opportunity-scanner/ranking";
import { countryFromLeague } from "@/lib/opportunity-scanner/country";
import { parseComboSlip, serializeComboSlip } from "@/lib/smart-combos/slip-storage";
import {
  parseScannerFavorites,
  toggleFavoriteName,
} from "@/lib/opportunity-scanner/favorites";
import {
  buildScannerBriefing,
  buildScannerInsight,
} from "@/lib/opportunity-scanner/briefing";
import {
  MODE_EMPTY,
  RANKING_EMPTY,
  scannerFilterEmptyCopy,
} from "@/lib/opportunity-scanner/copy";
import {
  applyScannerPreset,
  matchingScannerPreset,
  scannerPresetById,
} from "@/lib/opportunity-scanner/presets";
import { scannerDeskStatus } from "@/lib/opportunity-scanner/status";

const elite = opportunityFixture();
const value = opportunityFixture({
  fixtureId: "val",
  score: 58,
  stars: 3,
    verdict: "lean_bet",
  verdictLabel: "Value Bet",
  recommendation: "Value Bet",
  expectedValue: 0.12,
  positiveEdge: true,
  confidence: 52,
  bookmakerOdds: 2.4,
  leagueName: "La Liga",
  country: "Spain",
  home: { name: "Girona", shortName: "GIR", logoUrl: null },
  away: { name: "Valencia", shortName: "VAL", logoUrl: null },
  selectionLabel: "Girona",
});
const dog = opportunityFixture({
  fixtureId: "dog",
  predicted: "away",
  selectionLabel: "Getafe",
  score: 61,
  verdict: "pass",
  verdictLabel: "Watch",
  recommendation: "Watch",
  positiveEdge: false,
  expectedValue: -0.02,
  bookmakerOdds: 3.4,
  confidence: 48,
  leagueName: "La Liga",
  country: "Spain",
});
const avoid = opportunityFixture({
  fixtureId: "avoid",
  verdict: "avoid",
  verdictLabel: "Avoid",
  recommendation: "Avoid",
  score: 44,
  confidence: 32,
  expectedValue: -0.1,
  positiveEdge: false,
  bookmakerOdds: 1.5,
});

describe("APEX Opportunity Scanner", () => {
  it("maps Scoring Engine v2 tiers onto the scanner badge", () => {
    expect(scannerRecommendation(elite)).toBe("Elite");
    expect(scannerRecommendation(value)).toBe("Value Bet");
    expect(scannerRecommendation(dog)).toBe("Watch");
    expect(scannerRecommendation(avoid)).toBe("Avoid");
  });

  it("does not re-score when switching AI modes", () => {
    const rows = [elite, value, dog, avoid];
    const ranked = applyScannerMode(rows, "ranked");
    expect(ranked.map((row) => row.fixtureId)).toEqual([
      "1035089",
      "dog",
      "val",
      "avoid",
    ]);

    const hunter = applyScannerMode(rows, "value_hunter");
    expect(hunter.map((row) => row.fixtureId)).toEqual(["val", "1035089"]);
    expect(hunter[0]?.score).toBe(value.score);

    const premium = applyScannerMode(rows, "premium");
    expect(premium.every((row) => isStrongOrElite(row))).toBe(
      true,
    );

    const long = applyScannerMode(rows, "high_odds");
    expect(long.every((row) => (row.bookmakerOdds ?? 0) >= 2.5)).toBe(true);

    const combo = applyScannerMode(rows, "smart_combo");
    expect(combo.some((row) => row.fixtureId === "avoid")).toBe(false);
  });

  it("filters country, odds, EV, confidence and favorite teams", () => {
    const rows = [elite, value, dog];
    const spain = filterScanner(
      rows,
      {
        league: "all",
        country: "Spain",
        market: "all",
        oddsMin: null,
        oddsMax: null,
        minEv: null,
        minConfidence: 0,
        risk: "all",
        favoriteLeaguesOnly: false,
        favoriteTeamsOnly: false,
      },
      "value_hunter",
    );
    expect(spain.map((row) => row.fixtureId)).toEqual(["val"]);

    const teams = filterScanner(
      rows,
      {
        league: "all",
        country: "all",
        market: "all",
        oddsMin: null,
        oddsMax: null,
        minEv: null,
        minConfidence: 0,
        risk: "all",
        favoriteLeaguesOnly: false,
        favoriteTeamsOnly: true,
      },
      "conservative",
      [],
      ["Arsenal"],
    );
    expect(teams.map((row) => row.fixtureId)).toEqual(["1035089"]);
  });

  it("builds daily ranking boards from the scan", () => {
    const boards = buildScannerRankings([elite, value, dog, avoid]);
    expect(boards.map((board) => board.kind)).toEqual([
      "top10",
      "value",
      "confidence",
      "longshots",
    ]);
    expect(boards[0]?.items[0]?.fixtureId).toBe("1035089");
    expect(boards[3]?.items.some((row) => row.fixtureId === "dog")).toBe(true);
  });

  it("explains a card from Decision Engine reasons, not a black box", () => {
    const explained = explainOpportunity(elite);
    expect(explained.why).toMatch(/expected value/i);
    expect(explained.supporting.length).toBeGreaterThan(0);
    expect(explained.risks.length).toBeGreaterThan(0);
    expect(explained.fairOdds).toBe(elite.fairOdds);
    expect(explained.stakeLabel).toBe(elite.stakeLabel);
  });

  it("resolves country from a known league when the vendor omitted it", () => {
    expect(countryFromLeague("Premier League", null)).toBe("England");
    expect(countryFromLeague("Unknown Cup", "Brazil")).toBe("Brazil");
  });

  it("toggles favorite leagues and teams without inventing names", () => {
    expect(toggleFavoriteName(["Premier League"], "La Liga")).toEqual([
      "Premier League",
      "La Liga",
    ]);
    expect(toggleFavoriteName(["La Liga"], "La Liga")).toEqual([]);
    expect(parseScannerFavorites('{"leagues":["La Liga"],"teams":["Arsenal"]}')).toEqual({
      leagues: ["La Liga"],
      teams: ["Arsenal"],
    });
  });

  it("serializes a Smart Combo slip as unique fixture ids", () => {
    expect(parseComboSlip(serializeComboSlip(["b", "a", "b"]))).toEqual([
      "b",
      "a",
    ]);
    expect(parseComboSlip("not-json")).toEqual([]);
  });
});

describe("Opportunity Scanner briefing and desk UX", () => {
  it("builds a daily briefing from published scores without inventing markets", () => {
    const briefing = buildScannerBriefing(
      [elite, value],
      "2026-08-28T15:00:00.000Z",
    );
    expect(briefing.fixturesAnalyzed).toBe(2);
    expect(briefing.competitionsScanned).toBe(2);
    expect(briefing.bestLeague?.name).toBe("Premier League");
    expect(briefing.highestRatedMatch?.label).toBe("Arsenal vs Chelsea");
    expect(briefing.bestMarket).toBe("1x2");
    expect(briefing.averageConfidence).toBeCloseTo(62);
  });

  it("keeps insight copy filled when the catalogue is quiet", () => {
    const empty = buildScannerInsight(
      buildScannerBriefing([], "2026-08-28T15:00:00.000Z", true),
    );
    expect(empty.catalogEmpty).toBe(true);
    expect(empty.quotaExhausted).toBe(true);
    expect(empty.strongestLeagueName).toBeNull();
    expect(empty.interestingMatch).toBeNull();
  });

  it("summarizes analyzed vs qualified without changing ranking math", () => {
    const filters = { ...DEFAULT_SCANNER_FILTERS, minConfidence: 70 };
    const qualified = filterScanner([elite, value, dog], filters, "ranked");
    const status = scannerDeskStatus(
      [elite, value, dog],
      qualified,
      filters,
      "ranked",
    );
    expect(status.analyzed).toBe(3);
    expect(status.qualified).toBe(1);
    expect(status.rejected).toBe(2);
    expect(status.mainReason).toBe("confidenceFilter");
  });

  it("explains expected-value holds with analyst copy", () => {
    const filters = { ...DEFAULT_SCANNER_FILTERS, minEv: 0 };
    const qualified = filterScanner([dog, avoid], filters, "ranked");
    const status = scannerDeskStatus([dog, avoid], qualified, filters, "ranked");
    expect(status.qualified).toBe(0);
    expect(status.mainReason).toBe("evThreshold");
  });

  it("maps quick presets onto existing filters and modes only", () => {
    const elitePreset = applyScannerPreset("elite", {
      ...DEFAULT_SCANNER_FILTERS,
      favoriteLeaguesOnly: true,
    });
    expect(elitePreset.mode).toBe("premium");
    expect(elitePreset.filters.favoriteLeaguesOnly).toBe(true);

    const valuePreset = scannerPresetById("value");
    expect(valuePreset.filters.minEv).toBe(0);
    expect(valuePreset.mode).toBe("ranked");

    expect(
      matchingScannerPreset("ranked", {
        ...DEFAULT_SCANNER_FILTERS,
        minConfidence: 70,
      }),
    ).toBe("high_confidence");
    expect(matchingScannerPreset("ranked", DEFAULT_SCANNER_FILTERS)).toBe(
      "todays_best",
    );
  });

  it("educates empty ranking widgets instead of database language", () => {
    expect(RANKING_EMPTY.confidence).toBe("confidence");
    expect(MODE_EMPTY.smart_combo).toBe("smart_combo");
    expect(scannerFilterEmptyCopy("premium", DEFAULT_SCANNER_FILTERS).titleKey).toBe(
      "mode.premium",
    );
    expect(
      scannerFilterEmptyCopy("ranked", {
        ...DEFAULT_SCANNER_FILTERS,
        risk: "low",
      }).titleKey,
    ).toBe("filteredByRisk");
  });
});
