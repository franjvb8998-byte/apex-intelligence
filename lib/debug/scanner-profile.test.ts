import { describe, expect, it, vi } from "vitest";
import { getApexOpportunities } from "@/lib/apex-opportunities/load";
import {
  beginScannerProfile,
  formatScannerProfile,
  measurePhase,
  measurePhaseSync,
  noteApiFootballCacheEvent,
  noteScannerFixtureCount,
  noteScannerOddsAttached,
  noteScannerRepositoryCall,
  runScannerProfile,
  type ScannerProfileSnapshot,
} from "@/lib/debug/scanner-profile";

function emptyPhase() {
  return {
    elapsedMs: 0,
    fixtures: 0,
    apiCalls: 0,
    cacheHits: 0,
    repositoryCalls: 0,
  };
}

describe("scanner profile", () => {
  it("is a no-op when no session is active", async () => {
    await expect(measurePhase("catalogue", async () => 42)).resolves.toBe(42);
    expect(measurePhaseSync("scoring", () => "ok")).toBe("ok");
    expect(() => noteApiFootballCacheEvent({ source: "API" })).not.toThrow();
    expect(() => noteScannerRepositoryCall()).not.toThrow();
  });

  it("records phase time, fixtures, API, CACHE, and repository calls", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    let printed = "";
    try {
      const result = await runScannerProfile(async () => {
        noteScannerFixtureCount(2);
        await measurePhase("catalogue", async () => {
          noteApiFootballCacheEvent({ source: "API" });
          noteScannerRepositoryCall();
        });
        measurePhaseSync(
          "attachOdds",
          () => {
            noteApiFootballCacheEvent({ source: "CACHE" });
            noteScannerOddsAttached();
          },
          { fixtures: 1 },
        );
        return "board";
      });
      expect(result).toBe("board");
      printed = log.mock.calls.map((call) => String(call[0] ?? "")).join("\n");
    } finally {
      log.mockRestore();
    }

    expect(printed).toContain("Opportunity Scanner Profile");
    expect(printed).toContain("API calls: 1");
    expect(printed).toContain("CACHE hits: 1");
    expect(printed).toContain("Repository calls: 1");
    expect(printed).toContain("Fixtures: 2");
    expect(printed).toContain("Odds attached: 1");
    expect(printed).toContain("Catalogue");
    expect(printed).toContain("attachOdds");
  });

  it("profiles a recorded catalogue through Decision Engine and scoring", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    let printed = "";
    try {
      const board = await runScannerProfile(async () => {
        return getApexOpportunities({
          env: {},
          scannerProfile: beginScannerProfile(),
        });
      });
      expect(board.analyzed.length).toBeGreaterThanOrEqual(1);
      expect(board.quotaExhausted).toBe(false);
      printed = log.mock.calls.map((call) => String(call[0] ?? "")).join("\n");
    } finally {
      log.mockRestore();
    }

    expect(printed).toContain("Opportunity Scanner Profile");
    expect(printed).toMatch(/Catalogue .+ \d+ ms/);
    expect(printed).toMatch(/Decision Engine .+ \d+ ms/);
    expect(printed).toMatch(/Scoring .+ \d+ ms/);
    expect(printed).toMatch(/Fixtures: [1-9]/);
  }, 30_000);

  it("formats the summary banner without changing numeric totals", () => {
    const snapshot: ScannerProfileSnapshot = {
      totalMs: 1000,
      fixtures: 3,
      oddsAttached: 2,
      apiCalls: 10,
      cacheHits: 4,
      quotaExhausted: false,
      repositoryCalls: 7,
      phases: {
        authentication: { ...emptyPhase(), elapsedMs: 40 },
        catalogue: { ...emptyPhase(), elapsedMs: 200, fixtures: 3, apiCalls: 1 },
        enrichment: { ...emptyPhase(), elapsedMs: 100, fixtures: 3 },
        attachOdds: { ...emptyPhase(), elapsedMs: 400, fixtures: 3, apiCalls: 9 },
        decisionEngine: { ...emptyPhase(), elapsedMs: 180, fixtures: 3 },
        scoring: { ...emptyPhase(), elapsedMs: 30, fixtures: 3 },
        serialization: { ...emptyPhase(), elapsedMs: 20, fixtures: 3 },
      },
    };

    const text = formatScannerProfile(snapshot);
    expect(text).toContain("Total: 1000 ms");
    expect(text).toContain("Authentication .......... 40 ms (4%)");
    expect(text).toContain("Catalogue ............... 200 ms (20%)");
    expect(text).toContain("attachOdds .............. 400 ms (40%)");
    expect(text).toContain("Decision Engine ......... 180 ms (18%)");
    expect(text).toContain("Scoring ................. 30 ms (3%)");
    expect(text).toContain("Serialization ........... 20 ms (2%)");
    expect(text).toContain("API calls: 10");
    expect(text).toContain("CACHE hits: 4");
    expect(text).toContain("Fixtures: 3");
    expect(text).toContain("Odds attached: 2");
  });
});
