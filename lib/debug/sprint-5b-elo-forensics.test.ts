/**
 * Sprint 5B forensic evidence.
 *
 * Part A — historical team-id hash (local replica, not production):
 *   Bangladesh W vs South Korea W missing-stat path produced ΔElo +232
 *   and hybrid 93/3/4. Kept so 5B.1 has a reason.
 *
 * Part B — current production resolver (Sprint 5B.1):
 *   missing-stat Elo is the home/away base prior. IDs contribute zero strength.
 */

import { describe, expect, it } from "vitest";
import { createMockDataProvider } from "@/lib/data-platform/mock-provider";
import { DEMO_MATCH_EXTERNAL_ID } from "@/lib/data-platform/providers/_shared/demo-fixture";
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
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import type { MatchAnalysisTeamStatSnapshot } from "@/lib/match-analysis/analysis-types";

const HOME_BASE = 1580;
const AWAY_BASE = 1520;
const BANGLADESH_PROVIDER_ID = "17885";
const KOREA_PROVIDER_ID = "1728";
const BANGLADESH_CANONICAL = `apex:api-football:team:${BANGLADESH_PROVIDER_ID}`;
const KOREA_CANONICAL = `apex:api-football:team:${KOREA_PROVIDER_ID}`;

const HASH_OFFSET_SPAN = 251;
const HASH_OFFSET_CENTER = 125;
const HASH_MIN_OFFSET = -HASH_OFFSET_CENTER;
const HASH_MAX_OFFSET = HASH_OFFSET_SPAN - 1 - HASH_OFFSET_CENTER;

/** Pre-5B.1 production formula. Do not use for live Elo. */
function historicalEstimateEloFromTeamId(
  teamId: string,
  base = 1500,
): number {
  let hash = 0;
  for (let i = 0; i < teamId.length; i++) {
    hash = (hash * 31 + teamId.charCodeAt(i)) >>> 0;
  }
  return base + (hash % 251) - 125;
}

function pct(value: number): number {
  return Math.round(value * 100);
}

async function bangladeshKoreaBundle(options?: {
  swapTeamIds?: boolean;
}): Promise<ApexMatchBundle> {
  const bundle = await createMockDataProvider().getMatch({
    matchId: DEMO_MATCH_EXTERNAL_ID,
  });
  const homeId = options?.swapTeamIds
    ? KOREA_CANONICAL
    : BANGLADESH_CANONICAL;
  const awayId = options?.swapTeamIds
    ? BANGLADESH_CANONICAL
    : KOREA_CANONICAL;
  const homeExt = options?.swapTeamIds
    ? KOREA_PROVIDER_ID
    : BANGLADESH_PROVIDER_ID;
  const awayExt = options?.swapTeamIds
    ? BANGLADESH_PROVIDER_ID
    : KOREA_PROVIDER_ID;
  return {
    ...bundle,
    homeTeam: {
      ...bundle.homeTeam,
      id: homeId,
      name: options?.swapTeamIds ? "South Korea W" : "Bangladesh W",
      externalRefs: [{ provider: "api-football", externalId: homeExt }],
    },
    awayTeam: {
      ...bundle.awayTeam,
      id: awayId,
      name: options?.swapTeamIds ? "Bangladesh W" : "South Korea W",
      externalRefs: [{ provider: "api-football", externalId: awayExt }],
    },
    match: {
      ...bundle.match,
      id: "apex:api-football:match:1639552",
      externalRefs: [{ provider: "api-football", externalId: "1639552" }],
    },
  };
}

describe("Sprint 5B forensic — historical hash (not production)", () => {
  it("canonical Apex IDs hashed to ΔElo = +232", () => {
    const home = historicalEstimateEloFromTeamId(
      BANGLADESH_CANONICAL,
      HOME_BASE,
    );
    const away = historicalEstimateEloFromTeamId(KOREA_CANONICAL, AWAY_BASE);
    expect(home).toBe(1664);
    expect(away).toBe(1432);
    expect(home - away).toBe(232);
  });

  it("raw provider IDs did NOT hash to +232", () => {
    const home = historicalEstimateEloFromTeamId(
      BANGLADESH_PROVIDER_ID,
      HOME_BASE,
    );
    const away = historicalEstimateEloFromTeamId(KOREA_PROVIDER_ID, AWAY_BASE);
    expect(home - away).toBe(-27);
  });

  it("historical 1664/1432 still reproduces 93/3/4 and xG 5.51/0.30 on frozen PE", () => {
    const engine = createEloPoissonHybridEngine();
    const result = engine.predict({ homeElo: 1664, awayElo: 1432 });
    expect(result.expectedGoals.home).toBeCloseTo(5.51, 2);
    expect(result.expectedGoals.away).toBeCloseTo(0.3, 2);
    expect(pct(result.oneXTwo.home)).toBe(93);
    expect(pct(result.oneXTwo.draw)).toBe(3);
    expect(pct(result.oneXTwo.away)).toBe(4);
    const confidence = confidenceFromHybrid(result);
    expect(Math.round(confidence.value * 100)).toBe(72);
    expect(confidence.band).toBe("medium");
  });

  it("historical hash offset was bounded to [-125, +125]", () => {
    const samples = [
      BANGLADESH_CANONICAL,
      KOREA_CANONICAL,
      "1",
      "999999",
      "apex:api-football:team:1",
    ];
    for (const id of samples) {
      const offset =
        historicalEstimateEloFromTeamId(id, HOME_BASE) - HOME_BASE;
      expect(offset).toBeGreaterThanOrEqual(HASH_MIN_OFFSET);
      expect(offset).toBeLessThanOrEqual(HASH_MAX_OFFSET);
    }
  });

  it("historical max hash gap allowed Elo +310 and >95% home", () => {
    const engine = createEloPoissonHybridEngine();
    const result = engine.predict({
      homeElo: HOME_BASE + HASH_MAX_OFFSET,
      awayElo: AWAY_BASE + HASH_MIN_OFFSET,
    });
    expect(HOME_BASE + HASH_MAX_OFFSET - (AWAY_BASE + HASH_MIN_OFFSET)).toBe(
      310,
    );
    expect(result.expectedGoals.home).toBe(6);
    expect(result.oneXTwo.home).toBeGreaterThan(0.95);
  });

  it("swapping historical hashed IDs inverted the favorite", () => {
    const originalHome = historicalEstimateEloFromTeamId(
      BANGLADESH_CANONICAL,
      HOME_BASE,
    );
    const originalAway = historicalEstimateEloFromTeamId(
      KOREA_CANONICAL,
      AWAY_BASE,
    );
    const swappedHome = historicalEstimateEloFromTeamId(
      KOREA_CANONICAL,
      HOME_BASE,
    );
    const swappedAway = historicalEstimateEloFromTeamId(
      BANGLADESH_CANONICAL,
      AWAY_BASE,
    );
    expect(originalHome - originalAway).toBe(232);
    expect(swappedHome - swappedAway).toBe(-112);
  });
});

describe("Sprint 5B.1 production — hash is no longer football strength", () => {
  it("production estimateEloFromTeamId returns the base and ignores the id", () => {
    expect(estimateEloFromTeamId(BANGLADESH_CANONICAL, HOME_BASE)).toBe(
      HOME_BASE,
    );
    expect(estimateEloFromTeamId(KOREA_CANONICAL, AWAY_BASE)).toBe(AWAY_BASE);
    expect(estimateEloFromTeamId("42", 1500)).toBe(1500);
    expect(estimateEloFromTeamId("49", 1500)).toBe(1500);
  });

  it("missing/zero/empty stats resolve to base_prior at 1580/1520, not +232", async () => {
    const missing = resolveEloWithProvenance(
      null,
      BANGLADESH_CANONICAL,
      HOME_BASE,
    );
    const undefinedStats = resolveEloWithProvenance(
      undefined,
      BANGLADESH_CANONICAL,
      HOME_BASE,
    );
    const playedZero = resolveEloWithProvenance(
      { played: 0, wins: 0, goalsFor: 0, goalsAgainst: 0 },
      BANGLADESH_CANONICAL,
      HOME_BASE,
    );
    const playedMissing = resolveEloWithProvenance(
      { wins: 2, goalsFor: 7, goalsAgainst: 0 },
      BANGLADESH_CANONICAL,
      HOME_BASE,
    );
    for (const derived of [missing, undefinedStats, playedZero, playedMissing]) {
      expect(derived.source).toBe("base_prior");
      expect(derived.elo).toBe(HOME_BASE);
      expect(derived.hashOffset).toBeNull();
    }

    const away = resolveEloWithProvenance(null, KOREA_CANONICAL, AWAY_BASE);
    expect(away.source).toBe("base_prior");
    expect(away.elo).toBe(AWAY_BASE);
    expect(missing.elo - away.elo).toBe(60);

    const center = createMatchCenterFromApexBundle(
      await bangladeshKoreaBundle(),
      { enrichment: EMPTY_MATCH_CENTER_ENRICHMENT },
    );
    expect(center.preview.eloInput.homeElo).toBe(HOME_BASE);
    expect(center.preview.eloInput.awayElo).toBe(AWAY_BASE);
    expect(pct(center.preview.analysis.oneXTwo.home)).toBeLessThan(90);
  });

  it("catalogue diagnostic inputs stay 1460 / 1688", () => {
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

  it("played=1 100% wins + extreme GD is still 1795 (catalogue bit-identical)", () => {
    const snapshot: MatchAnalysisTeamStatSnapshot = {
      played: 1,
      wins: 1,
      goalsFor: 30,
      goalsAgainst: 0,
    };
    const derived = resolveEloWithProvenance(
      snapshot,
      BANGLADESH_CANONICAL,
      HOME_BASE,
    );
    expect(derived.source).toBe("catalogue");
    expect(derived.elo).toBe(1795);
  });
});
