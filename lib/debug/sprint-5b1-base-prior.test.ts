/**
 * Sprint 5B.1 — production regressions for the base-prior Elo fallback.
 * Does not change PE / catalogue / explicit formulas; asserts the resolver.
 */

import { describe, expect, it } from "vitest";
import { getApexOpportunities } from "@/lib/apex-opportunities/load";
import { createMockDataProvider } from "@/lib/data-platform/mock-provider";
import { DEMO_MATCH_EXTERNAL_ID } from "@/lib/data-platform/providers/_shared/demo-fixture";
import type { IDataProvider } from "@/lib/data-platform/provider";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import {
  confidenceFromHybrid,
  createEloPoissonHybridEngine,
  estimateEloFromTeamId,
} from "@/lib/intelligence/modules/probability";
import { EMPTY_MATCH_CENTER_ENRICHMENT } from "@/lib/match-center/enrich";
import {
  createMatchCenterFromApexBundle,
  resolveEloWithProvenance,
} from "@/lib/match-center/from-data-platform";

const HOME_BASE = 1580;
const AWAY_BASE = 1520;
const BANGLADESH_CANONICAL = "apex:api-football:team:17885";
const KOREA_CANONICAL = "apex:api-football:team:1728";

function pct(value: number): number {
  return Math.round(value * 100);
}

async function fixtureBundle(ids: {
  homeId: string;
  awayId: string;
  homeName?: string;
  awayName?: string;
}): Promise<ApexMatchBundle> {
  const bundle = await createMockDataProvider().getMatch({
    matchId: DEMO_MATCH_EXTERNAL_ID,
  });
  return {
    ...bundle,
    homeTeam: {
      ...bundle.homeTeam,
      id: ids.homeId,
      name: ids.homeName ?? "Bangladesh W",
      externalRefs: [{ provider: "api-football", externalId: ids.homeId }],
    },
    awayTeam: {
      ...bundle.awayTeam,
      id: ids.awayId,
      name: ids.awayName ?? "South Korea W",
      externalRefs: [{ provider: "api-football", externalId: ids.awayId }],
    },
    match: {
      ...bundle.match,
      id: "apex:api-football:match:1639552",
      kickoffAt: "2027-08-15T18:00:00.000Z",
      vendorStatusShort: "NS",
      externalRefs: [{ provider: "api-football", externalId: "1639552" }],
    },
  };
}

describe("Sprint 5B.1 — fixture 1639552 missing-stat golden", () => {
  it("uses base_prior 1580/1520 (ΔElo +60); historical 93% artifact is gone", async () => {
    const bundle = await fixtureBundle({
      homeId: BANGLADESH_CANONICAL,
      awayId: KOREA_CANONICAL,
    });
    const home = resolveEloWithProvenance(null, bundle.homeTeam.id, HOME_BASE);
    const away = resolveEloWithProvenance(null, bundle.awayTeam.id, AWAY_BASE);
    expect(home.source).toBe("base_prior");
    expect(away.source).toBe("base_prior");
    expect(home.elo).toBe(1580);
    expect(away.elo).toBe(1520);
    expect(home.elo - away.elo).toBe(60);

    const hybrid = createEloPoissonHybridEngine().predict({
      homeElo: home.elo,
      awayElo: away.elo,
    });
    const confidence = confidenceFromHybrid(hybrid);

    expect(hybrid.expectedGoals.home).toBeCloseTo(2.0481794397029938, 12);
    expect(hybrid.expectedGoals.away).toBeCloseTo(0.8141376520417585, 12);
    expect(hybrid.elo.oneXTwo.home).toBeCloseTo(0.5658258819883103, 12);
    expect(hybrid.elo.oneXTwo.draw).toBeCloseTo(0.15863528858505035, 12);
    expect(hybrid.elo.oneXTwo.away).toBeCloseTo(0.27553882942663926, 12);
    expect(hybrid.poisson.oneXTwo.home).toBeCloseTo(0.6606906796248216, 12);
    expect(hybrid.poisson.oneXTwo.draw).toBeCloseTo(0.20030779678135308, 12);
    expect(hybrid.poisson.oneXTwo.away).toBeCloseTo(0.13900152359382525, 12);
    expect(hybrid.oneXTwo.home).toBeCloseTo(0.6322312403338683, 12);
    expect(hybrid.oneXTwo.draw).toBeCloseTo(0.18780604432246226, 12);
    expect(hybrid.oneXTwo.away).toBeCloseTo(0.1799627153436695, 12);
    expect(hybrid.meta.poissonBlendWeight).toBe(0.7);
    expect(confidence.value).toBeCloseTo(0.1693232136569085, 12);
    expect(confidence.band).toBe("low");
    expect(pct(hybrid.elo.oneXTwo.home)).toBe(57);
    expect(pct(hybrid.elo.oneXTwo.draw)).toBe(16);
    expect(pct(hybrid.elo.oneXTwo.away)).toBe(28);
    expect(pct(hybrid.poisson.oneXTwo.home)).toBe(66);
    expect(pct(hybrid.poisson.oneXTwo.draw)).toBe(20);
    expect(pct(hybrid.poisson.oneXTwo.away)).toBe(14);
    expect(pct(hybrid.oneXTwo.home)).toBe(63);
    expect(pct(hybrid.oneXTwo.draw)).toBe(19);
    expect(pct(hybrid.oneXTwo.away)).toBe(18);
    expect(pct(hybrid.oneXTwo.home)).toBeLessThan(90);
    expect(pct(hybrid.oneXTwo.home)).not.toBe(93);

    const center = createMatchCenterFromApexBundle(bundle, {
      enrichment: EMPTY_MATCH_CENTER_ENRICHMENT,
    });
    expect(center.preview.eloInput.homeElo).toBe(1580);
    expect(center.preview.eloInput.awayElo).toBe(1520);
    expect(center.preview.analysis.oneXTwo).toEqual(hybrid.oneXTwo);
    expect(center.preview.hybrid.expectedGoals.home).toBe(hybrid.expectedGoals.home);
    expect(center.preview.analysis.confidence).toEqual(confidence);
  });
});

describe("Sprint 5B.1 — ID independence", () => {
  const ids = [
    BANGLADESH_CANONICAL,
    KOREA_CANONICAL,
    "17885",
    "1728",
    "1",
    "-1",
    "999999999",
    "00000000-0000-4000-8000-000000000000",
    "apex:api-football:team:1",
    "totally-arbitrary-string",
  ];

  it("changing home or away id does not change fallback Elo, xG, 1X2, or confidence", () => {
    const engine = createEloPoissonHybridEngine();
    const first = engine.predict({
      homeElo: resolveEloWithProvenance(null, ids[0]!, HOME_BASE).elo,
      awayElo: resolveEloWithProvenance(null, ids[1]!, AWAY_BASE).elo,
    });
    const firstConfidence = confidenceFromHybrid(first);
    for (const id of ids) {
      expect(resolveEloWithProvenance(null, id, HOME_BASE).elo).toBe(HOME_BASE);
      expect(resolveEloWithProvenance(null, id, AWAY_BASE).elo).toBe(AWAY_BASE);
      expect(estimateEloFromTeamId(id, HOME_BASE)).toBe(HOME_BASE);
      const hybrid = engine.predict({
        homeElo: resolveEloWithProvenance(null, id, HOME_BASE).elo,
        awayElo: resolveEloWithProvenance(null, id, AWAY_BASE).elo,
      });
      expect(hybrid.expectedGoals).toEqual(first.expectedGoals);
      expect(hybrid.oneXTwo).toEqual(first.oneXTwo);
      expect(confidenceFromHybrid(hybrid)).toEqual(firstConfidence);
    }
  });

  it("swapping arbitrary IDs while keeping home/away roles does not change PE", async () => {
    const original = createMatchCenterFromApexBundle(
      await fixtureBundle({
        homeId: BANGLADESH_CANONICAL,
        awayId: KOREA_CANONICAL,
      }),
      { enrichment: EMPTY_MATCH_CENTER_ENRICHMENT },
    );
    const swappedIds = createMatchCenterFromApexBundle(
      await fixtureBundle({
        homeId: KOREA_CANONICAL,
        awayId: BANGLADESH_CANONICAL,
      }),
      { enrichment: EMPTY_MATCH_CENTER_ENRICHMENT },
    );
    expect(swappedIds.preview.eloInput.homeElo).toBe(
      original.preview.eloInput.homeElo,
    );
    expect(swappedIds.preview.eloInput.awayElo).toBe(
      original.preview.eloInput.awayElo,
    );
    expect(swappedIds.preview.analysis.oneXTwo).toEqual(
      original.preview.analysis.oneXTwo,
    );
    expect(swappedIds.preview.hybrid.expectedGoals).toEqual(
      original.preview.hybrid.expectedGoals,
    );
    expect(swappedIds.preview.analysis.confidence).toEqual(
      original.preview.analysis.confidence,
    );
  });

  it("no missing-data fixture can become a 90%+ favorite from its id", async () => {
    for (const homeId of ids) {
      for (const awayId of ids) {
        const home = resolveEloWithProvenance(null, homeId, HOME_BASE).elo;
        const away = resolveEloWithProvenance(null, awayId, AWAY_BASE).elo;
        expect(home - away).toBe(60);
      }
    }
    const hybrid = createEloPoissonHybridEngine().predict({
      homeElo: HOME_BASE,
      awayElo: AWAY_BASE,
    });
    expect(hybrid.oneXTwo.home).toBeLessThan(0.9);
  });
});

describe("Sprint 5B.1 — catalogue and explicit paths bit-identical", () => {
  it("keeps Bangladesh/Korea current catalogue Elos 1460 / 1688", () => {
    expect(
      resolveEloWithProvenance(
        { played: 2, wins: 0, goalsFor: 0, goalsAgainst: 16 },
        BANGLADESH_CANONICAL,
        HOME_BASE,
      ).elo,
    ).toBe(1460);
    expect(
      resolveEloWithProvenance(
        { played: 2, wins: 2, goalsFor: 11, goalsAgainst: 0 },
        KOREA_CANONICAL,
        AWAY_BASE,
      ).elo,
    ).toBe(1688);
  });

  it("keeps additional catalogue samples unchanged", () => {
    expect(
      resolveEloWithProvenance(
        { played: 2, wins: 2, goalsFor: 7, goalsAgainst: 0 },
        "apex:api-football:team:home",
        HOME_BASE,
      ).elo,
    ).toBe(Math.round(1580 - 80 + 220 + 7 * 2.5));
    expect(
      resolveEloWithProvenance(
        { played: 10, wins: 5, goalsFor: 12, goalsAgainst: 12 },
        "apex:api-football:team:mid",
        AWAY_BASE,
      ).elo,
    ).toBe(Math.round(1520 - 80 + 0.5 * 220 + 0));
  });

  it("explicit Elo is unchanged and ignores stats/ids", () => {
    const derived = resolveEloWithProvenance(
      { played: 2, wins: 2, goalsFor: 11, goalsAgainst: 0 },
      BANGLADESH_CANONICAL,
      HOME_BASE,
      1710,
    );
    expect(derived.source).toBe("explicit");
    expect(derived.elo).toBe(1710);
    expect(derived.base).toBeNull();
    expect(derived.hashOffset).toBeNull();
  });
});

describe("Sprint 5B.1 — product surfaces share the resolver", () => {
  it("Scanner empty-enrichment path uses base_prior (Feed/Lab/Combos inherit this board)", async () => {
    const bundle = await fixtureBundle({
      homeId: BANGLADESH_CANONICAL,
      awayId: KOREA_CANONICAL,
    });
    const center = createMatchCenterFromApexBundle(bundle, {
      enrichment: EMPTY_MATCH_CENTER_ENRICHMENT,
      probabilityDiagnosticContext: "scanner",
    });
    expect(center.preview.eloInput.homeElo).toBe(1580);
    expect(center.preview.eloInput.awayElo).toBe(1520);
    expect(pct(center.preview.analysis.oneXTwo.home)).toBeLessThan(90);
  });

  it("getApexOpportunities (Scanner/Feed/Lab/Combos) does not emit the 93% hash artifact", async () => {
    const template = await fixtureBundle({
      homeId: BANGLADESH_CANONICAL,
      awayId: KOREA_CANONICAL,
    });
    const row: ApexMatchBundle = { ...template, odds: [] };
    const provider: IDataProvider = {
      id: "mock",
      displayName: "5b1-scanner",
      async listFixtures() {
        return [row];
      },
      async getMatch() {
        return row;
      },
    };
    const board = await getApexOpportunities({ provider, env: {} });
    expect(board.analyzed.length).toBeGreaterThan(0);
    const item = board.analyzed.find((entry) => entry.fixtureId === "1639552");
    expect(item).toBeDefined();
    expect(item!.confidence).toBeLessThan(90);
  });

  it("Match Center / Copilot team-stats path stays catalogue when played > 0", () => {
    const home = resolveEloWithProvenance(
      { played: 2, wins: 0, goalsFor: 0, goalsAgainst: 16 },
      BANGLADESH_CANONICAL,
      HOME_BASE,
    );
    const away = resolveEloWithProvenance(
      { played: 2, wins: 2, goalsFor: 11, goalsAgainst: 0 },
      KOREA_CANONICAL,
      AWAY_BASE,
    );
    expect(home.source).toBe("catalogue");
    expect(away.source).toBe("catalogue");
    expect(home.elo).toBe(1460);
    expect(away.elo).toBe(1688);
  });

  it("Match Center / Copilot missing stats use base_prior, not id hash", () => {
    const home = resolveEloWithProvenance(null, BANGLADESH_CANONICAL, HOME_BASE);
    const away = resolveEloWithProvenance(null, KOREA_CANONICAL, AWAY_BASE);
    expect(home.source).toBe("base_prior");
    expect(away.source).toBe("base_prior");
    expect(home.elo).toBe(1580);
    expect(away.elo).toBe(1520);
  });
});
