import { describe, expect, it } from "vitest";
import { edgePp, expectedValue, fairOdds, impliedProbability } from "@/lib/copilot/pricing";
import { extractTeamQuery, parseCopilotIntent } from "@/lib/copilot/intent";
import { resolveFixtureFromQuery } from "@/lib/copilot/resolve-match";
import { buildLocalBriefing } from "@/lib/copilot/analyst";
import { suggestedStake } from "@/lib/copilot/stake";
import type { CopilotMatchSnapshot } from "@/lib/copilot/types";
import {
  createCopilotAiClient,
  listCopilotAiProviderIds,
} from "@/lib/copilot/ai";
import { createCopilotService } from "@/lib/copilot/service";
import {
  createCopilotDataLoader,
  RECORDED_CATALOGUE_NOTE,
  type CopilotDataLoader,
} from "@/lib/copilot/load";
import { createApiFootballDataProvider } from "@/lib/data-platform";
import { ApiFootballError } from "@/lib/data-platform/providers/api-football/errors";
import type { DashboardMatchSummary } from "@/lib/dashboard/types";

describe("Copilot pricing", () => {
  it("computes fair odds, EV and edge from model probability", () => {
    expect(fairOdds(0.5)).toBe(2);
    expect(impliedProbability(2)).toBeCloseTo(0.5);
    expect(expectedValue(0.5, 2.2)).toBeCloseTo(0.1);
    expect(edgePp(0.5, 2.2)).toBeCloseTo(0.5 - 1 / 2.2);
    expect(fairOdds(null)).toBeNull();
    expect(expectedValue(0.5, null)).toBeNull();
  });
});

describe("Copilot intent", () => {
  it("detects analyze vs value vs stake", () => {
    expect(parseCopilotIntent("Analiza Arsenal vs Chelsea.").kind).toBe(
      "analyze_match",
    );
    expect(extractTeamQuery("Analiza Arsenal vs Chelsea.")).toContain("Arsenal");
    expect(parseCopilotIntent("¿Quién tiene más valor hoy?").kind).toBe(
      "value_scan",
    );
    expect(parseCopilotIntent("¿Qué stake sugiere APEX?").kind).toBe(
      "stake_advice",
    );
    expect(parseCopilotIntent("Explícame esta predicción.").kind).toBe(
      "explain_prediction",
    );
  });
});

describe("resolveFixtureFromQuery", () => {
  const fixtures: DashboardMatchSummary[] = [
    {
      id: "1",
      externalId: "1035089",
      kickoffAt: "2024-04-23T19:00:00.000Z",
      status: "finished",
      leagueName: "Premier League",
      homeTeam: { id: "h", name: "Arsenal", shortName: "ARS", logoUrl: null },
      awayTeam: { id: "a", name: "Chelsea", shortName: "CHE", logoUrl: null },
      score: { home: 2, away: 1 },
    },
  ];

  it("matches team names without inventing a fixture", () => {
    expect(resolveFixtureFromQuery(fixtures, "arsenal chelsea")?.externalId).toBe(
      "1035089",
    );
    expect(resolveFixtureFromQuery(fixtures, "zzz")).toBeNull();
  });
});

function sampleSnapshot(over: Partial<CopilotMatchSnapshot> = {}): CopilotMatchSnapshot {
  return {
    matchId: "m1",
    externalId: "1035089",
    leagueName: "Premier League",
    kickoffAt: "2024-04-23T19:00:00.000Z",
    status: "finished",
    home: {
      id: "h",
      name: "Arsenal",
      form: "WWDLW",
      played: 10,
      wins: 6,
      draws: 2,
      losses: 2,
      goalsFor: 18,
      goalsAgainst: 8,
    },
    away: {
      id: "a",
      name: "Chelsea",
      form: "LDLWW",
      played: 10,
      wins: 4,
      draws: 2,
      losses: 4,
      goalsFor: 12,
      goalsAgainst: 14,
    },
    oneXTwo: { home: 0.48, draw: 0.27, away: 0.25 },
    overUnder25: { over: 0.55, under: 0.45 },
    btts: { yes: 0.52, no: 0.48 },
    expectedGoals: { home: 1.6, away: 1.1, total: 2.7 },
    predictedOutcome: "home",
    predictedLabel: "Victoria Arsenal",
    confidence: { value: 0.62, band: "medium" },
    modelVersion: "test-pe",
    elo: { home: 1580, away: 1520, estimated: true },
    strengths: [{ label: "xG local", detail: "xG local 1.60 vs visitante 1.10." }],
    weaknesses: [{ label: "Empate", detail: "P(empate)=27%." }],
    tactical: [{ label: "Tempo alto", detail: "xG total 2.70." }],
    recommendation: {
      id: "rec-bet",
      title: "Back Arsenal",
      action: "bet",
      market: "1x2",
      selection: "home",
      priority: "medium",
      rationale: "Published edge.",
      confidence: { value: 0.62, band: "medium" },
    },
    valueBet: null,
    markets: [
      {
        market: "1X2",
        selection: "home",
        label: "Home",
        modelProbability: 0.48,
        fairOdds: 1 / 0.48,
        decimalOdds: 2.3,
        impliedProbability: 1 / 2.3,
        edge: 0.48 - 1 / 2.3,
        expectedValue: 0.48 * 2.3 - 1,
        bookmaker: "1xBet",
      },
    ],
    injuries: [],
    h2h: [],
    provenance: {
      dataPlatform: true,
      probabilityEngine: true,
      reasoning: "rules",
    },
    ...over,
  };
}

describe("local analyst", () => {
  it("writes an intelligence desk without inventing injuries or exposing formulas", () => {
    const briefing = buildLocalBriefing(sampleSnapshot());
    expect(briefing.intelligence.call).toBe("back_home");
    expect(briefing.intelligence.paragraph.toLowerCase()).not.toMatch(
      /p_modelo|ev\s*=|1\s*\/\s*p|kelly/i,
    );
    expect(briefing.intelligence.reasons.length).toBeGreaterThan(0);
    expect(briefing.intelligence.concerns.some((row) => /injur/i.test(row.title))).toBe(
      false,
    );
    expect(briefing.intelligence.live).toBeNull();
    expect(briefing.sections.some((section) => section.id === "executive")).toBe(true);
  });

  it("shows a live watch when there is no pre-match edge", () => {
    const briefing = buildLocalBriefing(
      sampleSnapshot({
        status: "scheduled",
        valueBet: null,
        markets: [
          {
            market: "1X2",
            selection: "home",
            label: "Home",
            modelProbability: 0.48,
            fairOdds: 1 / 0.48,
            decimalOdds: 2.05,
            impliedProbability: 1 / 2.05,
            edge: 0.48 - 1 / 2.05,
            expectedValue: 0.48 * 2.05 - 1,
            bookmaker: "1xBet",
          },
        ],
        recommendation: {
          id: "rec-watch",
          title: "Watch",
          action: "watch",
          market: "1x2",
          selection: "home",
          priority: "medium",
          rationale: "Fair board.",
          confidence: { value: 0.5, band: "medium" },
        },
      }),
    );
    expect(briefing.intelligence.call).toBe("watch_live");
    expect(briefing.intelligence.live).not.toBeNull();
    expect(briefing.intelligence.live?.cues.length).toBeGreaterThan(0);
  });

  it("suggests 0u when the engine says pass", () => {
    const stake = suggestedStake(
      sampleSnapshot({
        recommendation: {
          id: "rec-pass",
          title: "Pasar",
          action: "pass",
          priority: "low",
          rationale: "Señal poco clara.",
          confidence: { value: 0.3, band: "low" },
        },
      }),
    );
    expect(stake.units).toBe(0);
  });
});

describe("AI registry", () => {
  it("defaults to local and lists vendor ids without selecting them", () => {
    const client = createCopilotAiClient({});
    expect(client.id).toBe("local");
    expect(listCopilotAiProviderIds()).toEqual(
      expect.arrayContaining(["local", "openai", "claude", "gemini"]),
    );
    const openai = createCopilotAiClient({ COPILOT_AI_PROVIDER: "openai" });
    expect(openai.id).toBe("local");
  });
});

describe("CopilotService", () => {
  it("analyzes Arsenal vs Chelsea from the recorded Data Platform fixture", async () => {
    const provider = createApiFootballDataProvider({
      apiKey: null,
      fallback: "recorded",
      enrichMatch: true,
    });
    const service = createCopilotService({
      loader: createCopilotDataLoader({ provider, env: {} }),
    });
    const reply = await service.ask({ prompt: "Analiza Arsenal vs Chelsea." });
    expect(reply.card?.kind).toBe("briefing");
    if (reply.card?.kind === "briefing") {
      expect(reply.card.briefing.intelligence.paragraph.length).toBeGreaterThan(40);
      expect(reply.card.briefing.matchLabel.toLowerCase()).toContain("arsenal");
      expect(reply.card.briefing.intelligence.paragraph).not.toMatch(
        /P_modelo|EV =|1 \/ P/i,
      );
    }
  });

  it("falls back to the recorded catalogue when live load is quota-exhausted", async () => {
    const quota = new ApiFootballError({
      message:
        "You have reached the request limit for the day, Go to https://dashboard.api-football.com to upgrade your plan.",
      code: "rate_limited",
      status: 429,
    });
    const loader: CopilotDataLoader = {
      listFixtures: async () => [
        {
          id: "live-1",
          externalId: "9999999",
          kickoffAt: "2026-08-27T19:00:00.000Z",
          status: "scheduled",
          leagueName: "Premier League",
          homeTeam: { id: "h", name: "Arsenal", shortName: "ARS", logoUrl: null },
          awayTeam: { id: "a", name: "Chelsea", shortName: "CHE", logoUrl: null },
          score: { home: null, away: null },
        },
      ],
      loadMatch: async () => {
        throw quota;
      },
    };
    const service = createCopilotService({ loader });
    const reply = await service.ask({ prompt: "Analiza Arsenal vs Chelsea." });
    expect(reply.content).toContain(RECORDED_CATALOGUE_NOTE);
    expect(reply.card?.kind).toBe("briefing");
    if (reply.card?.kind === "briefing") {
      expect(reply.card.briefing.matchLabel.toLowerCase()).toContain("arsenal");
      expect(reply.card.briefing.intelligence).toBeDefined();
    }
  });
});
