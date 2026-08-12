import { describe, expect, it } from "vitest";
import {
  blendOneXTwo,
  createEloPoissonHybridEngine,
  EloPoissonHybridEngine,
} from "@/lib/intelligence/modules/probability/hybrid/elo-poisson-engine";
import { eloWinExpectancy } from "@/lib/intelligence/modules/probability/math/elo";

/** Example fixtures — synthetic Elos, not live API data. */
const MATCHES = {
  /** Evenly matched mid-table sides */
  equal: {
    homeElo: 1500,
    awayElo: 1500,
    homeTeamId: "team-equal-home",
    awayTeamId: "team-equal-away",
    matchId: "match-equal",
  },
  /** Clear home favorite */
  homeFavorite: {
    homeElo: 1750,
    awayElo: 1450,
    homeTeamId: "team-strong-home",
    awayTeamId: "team-weak-away",
    matchId: "match-home-favorite",
  },
  /** Strong away side visiting a weak home */
  awayFavorite: {
    homeElo: 1400,
    awayElo: 1700,
    homeTeamId: "team-weak-home",
    awayTeamId: "team-strong-away",
    matchId: "match-away-favorite",
  },
  /** Two attacking giants → higher total xG */
  highScoring: {
    homeElo: 1850,
    awayElo: 1800,
    homeTeamId: "team-giant-home",
    awayTeamId: "team-giant-away",
    matchId: "match-high-scoring",
  },
} as const;

function sumOneXTwo(p: { home: number; draw: number; away: number }) {
  return p.home + p.draw + p.away;
}

describe("EloPoissonHybridEngine — example matches", () => {
  const engine = createEloPoissonHybridEngine();

  it("exposes a stable model version", () => {
    expect(engine.modelVersion).toBe("elo-poisson-hybrid-0.1.0");
  });

  it("equal teams: slight home edge, material draw, valid markets", () => {
    const result = engine.predict(MATCHES.equal);

    expect(sumOneXTwo(result.oneXTwo)).toBeCloseTo(1, 10);
    expect(result.overUnder25.over + result.overUnder25.under).toBeCloseTo(
      1,
      10,
    );
    expect(result.overUnder25.line).toBe(2.5);

    // Home advantage should tilt 1X2 toward home vs away.
    expect(result.oneXTwo.home).toBeGreaterThan(result.oneXTwo.away);
    expect(result.oneXTwo.draw).toBeGreaterThan(0.2);

    expect(result.elo.winExpectancyHome).toBeGreaterThan(0.5);
    expect(result.expectedGoals.home).toBeGreaterThan(
      result.expectedGoals.away,
    );
  });

  it("home favorite: home is the most likely 1X2 outcome", () => {
    const result = engine.predict(MATCHES.homeFavorite);

    expect(result.oneXTwo.home).toBeGreaterThan(result.oneXTwo.draw);
    expect(result.oneXTwo.home).toBeGreaterThan(result.oneXTwo.away);
    expect(result.oneXTwo.home).toBeGreaterThan(0.45);
    expect(result.poisson.lambdaHome).toBeGreaterThan(
      result.poisson.lambdaAway,
    );
  });

  it("away favorite: away wins 1X2 mass", () => {
    const result = engine.predict(MATCHES.awayFavorite);

    expect(result.oneXTwo.away).toBeGreaterThan(result.oneXTwo.home);
    expect(result.oneXTwo.away).toBeGreaterThan(result.oneXTwo.draw);
    expect(result.poisson.lambdaAway).toBeGreaterThan(
      result.poisson.lambdaHome,
    );
  });

  it("high-quality clash: higher total xG lifts Over 2.5 vs equal mid-table", () => {
    const equal = engine.predict(MATCHES.equal);
    const giants = engine.predict(MATCHES.highScoring);

    expect(giants.expectedGoals.total).toBeGreaterThan(
      equal.expectedGoals.total,
    );
    expect(giants.overUnder25.over).toBeGreaterThan(equal.overUnder25.over);
  });

  it("returns Poisson covered mass close to 1 on the truncated grid", () => {
    const result = engine.predict(MATCHES.homeFavorite);
    expect(result.poisson.coveredMass).toBeGreaterThan(0.99);
  });

  it("respects blend weight extremes", () => {
    const poissonOnly = new EloPoissonHybridEngine({
      poissonBlendWeight: 1,
    }).predict(MATCHES.equal);
    const eloOnly = new EloPoissonHybridEngine({
      poissonBlendWeight: 0,
    }).predict(MATCHES.equal);

    expect(poissonOnly.oneXTwo.home).toBeCloseTo(
      poissonOnly.poisson.oneXTwo.home,
      10,
    );
    expect(eloOnly.oneXTwo.home).toBeCloseTo(eloOnly.elo.oneXTwo.home, 10);
  });
});

describe("Elo helpers used by the hybrid", () => {
  it("gives home > 0.5 expectancy when ratings are equal (HFA)", () => {
    const e = eloWinExpectancy({
      homeElo: 1500,
      awayElo: 1500,
      homeAdvantageElo: 65,
    });
    expect(e).toBeGreaterThan(0.5);
    expect(e).toBeLessThan(0.65);
  });

  it("blends 1X2 distributions linearly then normalizes", () => {
    const blended = blendOneXTwo(
      { home: 0.5, draw: 0.3, away: 0.2 },
      { home: 0.2, draw: 0.3, away: 0.5 },
      0.5,
    );
    expect(sumOneXTwo(blended)).toBeCloseTo(1, 12);
    expect(blended.home).toBeCloseTo(0.35, 12);
    expect(blended.away).toBeCloseTo(0.35, 12);
  });
});
