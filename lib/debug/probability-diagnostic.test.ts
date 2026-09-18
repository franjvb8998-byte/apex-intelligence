import { afterEach, describe, expect, it } from "vitest";
import { createMockDataProvider } from "@/lib/data-platform/mock-provider";
import { DEMO_MATCH_EXTERNAL_ID } from "@/lib/data-platform/providers/_shared/demo-fixture";
import {
  bindProbabilityDiagnosticLog,
  buildProbabilityDiagnostic,
  formatProbabilityDiagnostic,
  isProbabilityDiagnosticEnabled,
  maybeEmitProbabilityDiagnostic,
  shouldEmitProbabilityDiagnostic,
  type ProbabilityDiagnostic,
  type ProbabilityDiagnosticLog,
} from "@/lib/debug/probability-diagnostic";
import {
  createEloPoissonHybridEngine,
  estimateEloFromTeamId,
} from "@/lib/intelligence/modules/probability";
import { EMPTY_MATCH_CENTER_ENRICHMENT } from "@/lib/match-center/enrich";
import {
  createMatchCenterFromApexBundle,
  resolveEloWithProvenance,
} from "@/lib/match-center/from-data-platform";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";

afterEach(() => {
  bindProbabilityDiagnosticLog(null);
});

function capturingLog(): {
  messages: string[];
  records: ProbabilityDiagnostic[];
  log: ProbabilityDiagnosticLog;
} {
  const messages: string[] = [];
  const records: ProbabilityDiagnostic[] = [];
  return {
    messages,
    records,
    log: (message, record) => {
      messages.push(message);
      records.push(record);
    },
  };
}

async function demoBundle(): Promise<ApexMatchBundle> {
  return createMockDataProvider().getMatch({
    matchId: DEMO_MATCH_EXTERNAL_ID,
  });
}

function withFixtureId(
  bundle: ApexMatchBundle,
  externalId: string,
): ApexMatchBundle {
  return {
    ...bundle,
    match: {
      ...bundle.match,
      id: `apex:mock:match:${externalId}`,
      externalRefs: [{ provider: "mock", externalId }],
    },
  };
}

describe("Sprint 5A probability diagnostic gating", () => {
  const match = { id: "apex:api-football:match:99", externalId: "99" };

  it("is disabled by default", () => {
    expect(isProbabilityDiagnosticEnabled({})).toBe(false);
    expect(shouldEmitProbabilityDiagnostic(match, {})).toBe(false);
  });

  it("emits for a selected fixture only when filtered", () => {
    const env = { APEX_PROBABILITY_DIAGNOSTIC_FIXTURE: "99" };
    expect(shouldEmitProbabilityDiagnostic(match, env)).toBe(true);
    expect(
      shouldEmitProbabilityDiagnostic(
        { id: "apex:api-football:match:100", externalId: "100" },
        env,
      ),
    ).toBe(false);
  });

  it("does not emit when diagnostics are disabled", () => {
    const capture = capturingLog();
    const emitted = maybeEmitProbabilityDiagnostic(
      {
        kind: "apex.probability_diagnostic",
        context: "unknown",
        matchId: match.id,
        providerFixtureId: "99",
        competition: "Test",
        season: null,
        homeName: "Home",
        awayName: "Away",
        home: {
          teamName: "Home",
          canonicalTeamId: "h",
          providerTeamId: null,
          elo: 1500,
          source: "estimated_hash",
          base: 1580,
          played: null,
          wins: null,
          goalsFor: null,
          goalsAgainst: null,
          goalDifference: null,
          hashOffset: -80,
        },
        away: {
          teamName: "Away",
          canonicalTeamId: "a",
          providerTeamId: null,
          elo: 1500,
          source: "estimated_hash",
          base: 1520,
          played: null,
          wins: null,
          goalsFor: null,
          goalsAgainst: null,
          goalDifference: null,
          hashOffset: -20,
        },
        homeElo: 1500,
        awayElo: 1500,
        eloDifference: 0,
        expectedGoals: { home: 1.45, away: 1.15 },
        eloOneXTwo: { home: 0.4, draw: 0.3, away: 0.3 },
        poissonOneXTwo: { home: 0.4, draw: 0.3, away: 0.3 },
        hybridOneXTwo: { home: 0.4, draw: 0.3, away: 0.3 },
        poissonBlendWeight: 0.7,
        confidence: 0.2,
        confidenceBand: "low",
      },
      { env: {}, log: capture.log },
    );
    expect(emitted).toBe(false);
    expect(capture.messages).toEqual([]);
  });
});

describe("resolveEloWithProvenance", () => {
  it("reports catalogue source and the stats actually used", () => {
    const derived = resolveEloWithProvenance(
      { played: 2, wins: 2, goalsFor: 7, goalsAgainst: 0 },
      "apex:api-football:team:home",
      1580,
    );
    expect(derived.source).toBe("catalogue");
    expect(derived.base).toBe(1580);
    expect(derived.played).toBe(2);
    expect(derived.wins).toBe(2);
    expect(derived.goalsFor).toBe(7);
    expect(derived.goalsAgainst).toBe(0);
    expect(derived.goalDifference).toBe(7);
    expect(derived.hashOffset).toBeNull();
    expect(derived.elo).toBe(Math.round(1580 - 80 + 220 + 7 * 2.5));
  });

  it("reports estimated_hash when stats are missing or played is zero", () => {
    const teamId = "apex:api-football:team:away";
    const missing = resolveEloWithProvenance(null, teamId, 1520);
    expect(missing.source).toBe("estimated_hash");
    expect(missing.elo).toBe(estimateEloFromTeamId(teamId, 1520));
    expect(missing.hashOffset).toBe(missing.elo - 1520);
    expect(missing.played).toBeNull();
    expect(missing.wins).toBeNull();
    expect(missing.goalsFor).toBeNull();
    expect(missing.goalsAgainst).toBeNull();
    expect(missing.goalDifference).toBeNull();

    const zeroPlayed = resolveEloWithProvenance(
      { played: 0, wins: 0, goalsFor: 0, goalsAgainst: 0 },
      teamId,
      1520,
    );
    expect(zeroPlayed.source).toBe("estimated_hash");
    expect(zeroPlayed.elo).toBe(estimateEloFromTeamId(teamId, 1520));
    expect(zeroPlayed.played).toBe(0);
  });
});

describe("Sprint 5A probability diagnostic seam", () => {
  it("uses the same Elo values that are passed into the Probability Engine", async () => {
    const bundle = await demoBundle();
    const capture = capturingLog();
    const enrichment = {
      ...EMPTY_MATCH_CENTER_ENRICHMENT,
      teamStats: {
        home: { played: 2, wins: 2, goalsFor: 7, goalsAgainst: 0 },
      },
    };
    const center = createMatchCenterFromApexBundle(bundle, {
      enrichment,
      probabilityDiagnosticContext: "match_center",
      probabilityDiagnosticEnv: { APEX_PROBABILITY_DIAGNOSTIC: "1" },
      probabilityDiagnosticLog: capture.log,
    });

    expect(capture.records).toHaveLength(1);
    const record = capture.records[0]!;
    expect(record.home.source).toBe("catalogue");
    expect(record.away.source).toBe("estimated_hash");
    expect(record.eloDifference).toBe(record.homeElo - record.awayElo);
    expect(record.homeElo).toBe(record.home.elo);
    expect(record.awayElo).toBe(record.away.elo);

    const pe = createEloPoissonHybridEngine().predict({
      homeElo: record.homeElo,
      awayElo: record.awayElo,
    });
    expect(center.preview.analysis.oneXTwo).toEqual(pe.oneXTwo);
    expect(center.preview.hybrid.expectedGoals.home).toBe(pe.expectedGoals.home);
    expect(center.preview.hybrid.expectedGoals.away).toBe(pe.expectedGoals.away);
    expect(record.hybridOneXTwo).toEqual(pe.oneXTwo);
    expect(record.eloOneXTwo).toEqual(pe.elo.oneXTwo);
    expect(record.poissonOneXTwo).toEqual(pe.poisson.oneXTwo);
    expect(record.expectedGoals).toEqual({
      home: pe.expectedGoals.home,
      away: pe.expectedGoals.away,
    });
  });

  it("does not alter prediction output when diagnostics are enabled", async () => {
    const bundle = await demoBundle();
    const off = createMatchCenterFromApexBundle(bundle, {
      probabilityDiagnosticEnv: {},
    });
    const capture = capturingLog();
    const on = createMatchCenterFromApexBundle(bundle, {
      probabilityDiagnosticEnv: { APEX_PROBABILITY_DIAGNOSTIC: "1" },
      probabilityDiagnosticLog: capture.log,
    });

    expect(capture.records).toHaveLength(1);
    expect(on.preview.analysis.oneXTwo).toEqual(off.preview.analysis.oneXTwo);
    expect(on.preview.hybrid.expectedGoals).toEqual(
      off.preview.hybrid.expectedGoals,
    );
    expect(on.preview.analysis.predictedOutcome).toBe(
      off.preview.analysis.predictedOutcome,
    );
    expect(on.aiAnalysis.prediction.oneXTwo).toEqual(
      off.aiAnalysis.prediction.oneXTwo,
    );
    expect(on.aiAnalysis.confidence).toEqual(off.aiAnalysis.confidence);
  });

  it("emits only the selected fixture when a fixture filter is set", async () => {
    const bundle = await demoBundle();
    const target = withFixtureId(bundle, "diag-target");
    const other = withFixtureId(bundle, "diag-other");
    const capture = capturingLog();
    const env = { APEX_PROBABILITY_DIAGNOSTIC_FIXTURE: "diag-target" };

    createMatchCenterFromApexBundle(other, {
      probabilityDiagnosticEnv: env,
      probabilityDiagnosticLog: capture.log,
    });
    createMatchCenterFromApexBundle(target, {
      probabilityDiagnosticContext: "match_analysis",
      probabilityDiagnosticEnv: env,
      probabilityDiagnosticLog: capture.log,
    });

    expect(capture.records).toHaveLength(1);
    expect(capture.records[0]?.providerFixtureId).toBe("diag-target");
    expect(capture.records[0]?.context).toBe("match_analysis");
  });

  it("does not log when diagnostics are disabled on the Match Center seam", async () => {
    const bundle = await demoBundle();
    const capture = capturingLog();
    createMatchCenterFromApexBundle(bundle, {
      probabilityDiagnosticEnv: {},
      probabilityDiagnosticLog: capture.log,
    });
    expect(capture.messages).toEqual([]);
    expect(capture.records).toEqual([]);
  });

  it("diagnostic payload contains football-model fields only", async () => {
    const bundle = await demoBundle();
    const capture = capturingLog();
    createMatchCenterFromApexBundle(bundle, {
      probabilityDiagnosticEnv: { APEX_PROBABILITY_DIAGNOSTIC: "1" },
      probabilityDiagnosticLog: capture.log,
    });
    const record = capture.records[0];
    expect(record).toBeDefined();
    const serialized = JSON.stringify(record);
    expect(serialized).not.toMatch(
      /api[_-]?key|authorization|cookie|supabase|password|secret|token|bearer|email/i,
    );
    const keys = collectKeys(record);
    for (const key of keys) {
      expect(key).not.toMatch(
        /apiKey|accessToken|refreshToken|cookie|password|secret|authorization|userId|email/i,
      );
    }
  });
});

describe("probability diagnostic formatting", () => {
  it("renders runtime values and catalogue vs hash provenance", () => {
    const engine = createEloPoissonHybridEngine();
    const hybrid = engine.predict({ homeElo: 1738, awayElo: 1500 });
    const record = buildProbabilityDiagnostic({
      context: "scanner",
      matchId: "apex:mock:match:diag-home",
      providerFixtureId: "diag-home",
      competition: "Diagnostic League",
      season: "2026",
      home: {
        teamName: "Northbridge FC",
        canonicalTeamId: "apex:mock:team:home",
        providerTeamId: "home",
        elo: 1738,
        source: "catalogue",
        base: 1580,
        played: 2,
        wins: 2,
        goalsFor: 7,
        goalsAgainst: 0,
        goalDifference: 7,
        hashOffset: null,
      },
      away: {
        teamName: "Southport United",
        canonicalTeamId: "apex:mock:team:away",
        providerTeamId: "away",
        elo: 1500,
        source: "estimated_hash",
        base: 1520,
        played: null,
        wins: null,
        goalsFor: null,
        goalsAgainst: null,
        goalDifference: null,
        hashOffset: -20,
      },
      hybrid,
    });

    expect(record.eloDifference).toBe(238);
    const text = formatProbabilityDiagnostic(record);
    expect(text).toContain("APEX Probability Diagnostic");
    expect(text).toContain("Northbridge FC vs Southport United");
    expect(text).toContain("Source: catalogue");
    expect(text).toContain("Source: estimated_hash");
    expect(text).toContain("Played: 2");
    expect(text).toContain("Played: unavailable");
    expect(text).toContain("Hash offset: -20");
    expect(text).toContain("Context: scanner");
    expect(text).not.toMatch(/api[_-]?key|authorization|cookie|supabase/i);
  });
});

function collectKeys(value: unknown, acc: string[] = []): string[] {
  if (value == null || typeof value !== "object") return acc;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    acc.push(key);
    collectKeys(child, acc);
  }
  return acc;
}
