/**
 * Sprint 5B.2 — catalogue Elo calibration characterization.
 * Production resolver/PE are invoked as-is. No formula changes.
 */

import { describe, expect, it } from "vitest";
import {
  confidenceFromHybrid,
  createEloPoissonHybridEngine,
} from "@/lib/intelligence/modules/probability";
import { resolveEloWithProvenance } from "@/lib/match-center/from-data-platform";
import type { MatchAnalysisTeamStatSnapshot } from "@/lib/match-analysis/analysis-types";

const HOME_BASE = 1580;
const AWAY_BASE = 1520;
const TEAM = "apex:api-football:team:audit";

function snap(
  played: number,
  wins: number,
  goalsFor: number,
  goalsAgainst: number,
): MatchAnalysisTeamStatSnapshot {
  return { played, wins, goalsFor, goalsAgainst };
}

function catalogueElo(
  snapshot: MatchAnalysisTeamStatSnapshot,
  base: number,
): number {
  return resolveEloWithProvenance(snapshot, TEAM, base).elo;
}

function pct(value: number): number {
  return Math.round(value * 100);
}

function peHomeVsAwayPrior(homeElo: number) {
  const hybrid = createEloPoissonHybridEngine().predict({
    homeElo,
    awayElo: AWAY_BASE,
  });
  const confidence = confidenceFromHybrid(hybrid);
  return {
    homeElo,
    awayElo: AWAY_BASE,
    delta: homeElo - AWAY_BASE,
    xgHome: hybrid.expectedGoals.home,
    xgAway: hybrid.expectedGoals.away,
    hybridHome: hybrid.oneXTwo.home,
    hybridDraw: hybrid.oneXTwo.draw,
    hybridAway: hybrid.oneXTwo.away,
    hybridPct: [
      pct(hybrid.oneXTwo.home),
      pct(hybrid.oneXTwo.draw),
      pct(hybrid.oneXTwo.away),
    ] as const,
    confidence: confidence.value,
    band: confidence.band,
  };
}

function pePair(homeElo: number, awayElo: number) {
  const hybrid = createEloPoissonHybridEngine().predict({ homeElo, awayElo });
  const confidence = confidenceFromHybrid(hybrid);
  return {
    homeElo,
    awayElo,
    delta: homeElo - awayElo,
    xgHome: hybrid.expectedGoals.home,
    xgAway: hybrid.expectedGoals.away,
    hybridPct: [
      pct(hybrid.oneXTwo.home),
      pct(hybrid.oneXTwo.draw),
      pct(hybrid.oneXTwo.away),
    ] as const,
    hybridHome: hybrid.oneXTwo.home,
    confidence: confidence.value,
    band: confidence.band,
  };
}

function row(
  label: string,
  snapshot: MatchAnalysisTeamStatSnapshot,
  base: number,
  vs: "away_prior" | "pair",
  awayElo?: number,
) {
  const elo = catalogueElo(snapshot, base);
  const pe =
    vs === "pair" && awayElo != null
      ? pePair(elo, awayElo)
      : peHomeVsAwayPrior(elo);
  return {
    label,
    played: snapshot.played,
    wins: snapshot.wins,
    gf: snapshot.goalsFor,
    ga: snapshot.goalsAgainst,
    base,
    elo,
    deltaFromBase: elo - base,
    xgHome: Number(pe.xgHome.toFixed(4)),
    xgAway: Number(pe.xgAway.toFixed(4)),
    hybridPct: pe.hybridPct,
    confidence: Number(pe.confidence.toFixed(4)),
    band: pe.band,
  };
}

describe("Sprint 5B.2 — catalogue Elo formula", () => {
  it("uses round(base − 80 + winRate×220 + clamp(GD,±30)×2.5)", () => {
    const derived = resolveEloWithProvenance(
      snap(2, 0, 0, 16),
      TEAM,
      HOME_BASE,
    );
    expect(derived.source).toBe("catalogue");
    expect(derived.elo).toBe(Math.round(1580 - 80 + 0 + -16 * 2.5));
    expect(derived.elo).toBe(1460);
    expect(derived.played).toBe(2);
    expect(derived.goalDifference).toBe(-16);
  });

  it("does not put played count in the Elo expression except as win-rate denominator", () => {
    const evenSmall = catalogueElo(snap(2, 1, 2, 2), HOME_BASE);
    const evenLarge = catalogueElo(snap(20, 10, 20, 20), HOME_BASE);
    expect(evenSmall).toBe(evenLarge);
    expect(evenSmall).toBe(1610);
  });

  it("treats goal difference as a season SUM, so extra games at the same rate move Elo until ±30", () => {
    expect(catalogueElo(snap(1, 1, 3, 0), HOME_BASE)).toBe(1728);
    expect(catalogueElo(snap(2, 2, 6, 0), HOME_BASE)).toBe(1735);
    expect(catalogueElo(snap(5, 5, 15, 0), HOME_BASE)).toBe(1758);
    expect(catalogueElo(snap(20, 20, 60, 0), HOME_BASE)).toBe(1795);
    expect(catalogueElo(snap(1, 0, 0, 3), HOME_BASE)).toBe(1493);
    expect(catalogueElo(snap(2, 0, 0, 6), HOME_BASE)).toBe(1485);
    expect(catalogueElo(snap(5, 0, 0, 15), HOME_BASE)).toBe(1463);
    expect(catalogueElo(snap(20, 0, 0, 60), HOME_BASE)).toBe(1425);
  });

  it("is invariant for 50% win rate and 0 GD regardless of played count", () => {
    for (const played of [1, 2, 5, 10, 20]) {
      expect(
        catalogueElo(snap(played, played / 2, played, played), HOME_BASE),
      ).toBe(1610);
    }
  });

  it("moves +2.5 Elo per extra +1 GD until the ±30 clamp, then freezes", () => {
    expect(catalogueElo(snap(1, 1, 2, 1), HOME_BASE)).toBe(1723);
    expect(catalogueElo(snap(2, 2, 4, 2), HOME_BASE)).toBe(1725);
    expect(catalogueElo(snap(5, 5, 10, 5), HOME_BASE)).toBe(1733);
    expect(catalogueElo(snap(20, 20, 40, 20), HOME_BASE)).toBe(1770);
    expect(catalogueElo(snap(1, 0, 0, 1), HOME_BASE)).toBe(1498);
    expect(catalogueElo(snap(2, 0, 0, 2), HOME_BASE)).toBe(1495);
    expect(catalogueElo(snap(5, 0, 0, 5), HOME_BASE)).toBe(1488);
    expect(catalogueElo(snap(20, 0, 0, 20), HOME_BASE)).toBe(1450);
  });

  it("low scoring 1-0 rates still hit the 100% win-rate term immediately", () => {
    expect(catalogueElo(snap(1, 1, 1, 0), HOME_BASE)).toBe(1723);
    expect(catalogueElo(snap(2, 2, 2, 0), HOME_BASE)).toBe(1725);
    expect(catalogueElo(snap(5, 5, 5, 0), HOME_BASE)).toBe(1733);
    expect(catalogueElo(snap(20, 20, 20, 0), HOME_BASE)).toBe(1770);
  });

  it("extreme scoring hits the ±30 GD clamp from a single match", () => {
    expect(catalogueElo(snap(1, 1, 30, 0), HOME_BASE)).toBe(1795);
    expect(catalogueElo(snap(2, 2, 60, 0), HOME_BASE)).toBe(1795);
    expect(catalogueElo(snap(20, 20, 600, 0), HOME_BASE)).toBe(1795);
    expect(catalogueElo(snap(1, 0, 0, 30), HOME_BASE)).toBe(1425);
    expect(catalogueElo(snap(20, 0, 0, 600), HOME_BASE)).toBe(1425);
  });

  it("is blind to team id, competition, and opponent once the snapshot exists", () => {
    const snapshot = snap(2, 2, 11, 0);
    const a = resolveEloWithProvenance(
      snapshot,
      "apex:api-football:team:17885",
      AWAY_BASE,
    );
    const b = resolveEloWithProvenance(
      snapshot,
      "apex:api-football:team:1728",
      AWAY_BASE,
    );
    expect(a.elo).toBe(b.elo);
    expect(a.elo).toBe(1688);
  });
});

describe("Sprint 5B.2 — 1/2/3-match extremes", () => {
  it("locks 1-match home Elos including clamp extremes", () => {
    expect(catalogueElo(snap(1, 1, 1, 0), HOME_BASE)).toBe(1723);
    expect(catalogueElo(snap(1, 1, 2, 0), HOME_BASE)).toBe(1725);
    expect(catalogueElo(snap(1, 1, 3, 0), HOME_BASE)).toBe(1728);
    expect(catalogueElo(snap(1, 1, 5, 0), HOME_BASE)).toBe(1733);
    expect(catalogueElo(snap(1, 0, 0, 1), HOME_BASE)).toBe(1498);
    expect(catalogueElo(snap(1, 0, 0, 2), HOME_BASE)).toBe(1495);
    expect(catalogueElo(snap(1, 0, 0, 3), HOME_BASE)).toBe(1493);
    expect(catalogueElo(snap(1, 0, 0, 5), HOME_BASE)).toBe(1488);
    expect(catalogueElo(snap(1, 1, 30, 0), HOME_BASE)).toBe(1795);
    expect(catalogueElo(snap(1, 0, 0, 30), HOME_BASE)).toBe(1425);
  });

  it("locks 2-match and 3-match home Elos", () => {
    expect(catalogueElo(snap(2, 2, 6, 0), HOME_BASE)).toBe(1735);
    expect(catalogueElo(snap(2, 0, 0, 6), HOME_BASE)).toBe(1485);
    expect(catalogueElo(snap(2, 1, 3, 3), HOME_BASE)).toBe(1610);
    expect(catalogueElo(snap(3, 3, 9, 0), HOME_BASE)).toBe(1743);
    expect(catalogueElo(snap(3, 0, 0, 9), HOME_BASE)).toBe(1478);
    expect(catalogueElo(snap(3, 2, 5, 4), HOME_BASE)).toBe(1649);
  });

  it("strongest/weakest catalogue Elo vs away base-prior from 1 match", () => {
    const strongest = peHomeVsAwayPrior(
      catalogueElo(snap(1, 1, 30, 0), HOME_BASE),
    );
    const weakest = peHomeVsAwayPrior(
      catalogueElo(snap(1, 0, 0, 30), HOME_BASE),
    );
    expect(strongest.homeElo).toBe(1795);
    expect(weakest.homeElo).toBe(1425);
    expect(strongest.hybridPct).toEqual([94, 2, 4]);
    expect(weakest.hybridPct).toEqual([21, 22, 57]);
    expect(strongest.xgHome).toBe(6);
    expect(strongest.band).toBe("high");
    expect(weakest.band).toBe("low");
  });

  it("a single 1-0 already produces a 91% home hybrid vs away base-prior", () => {
    const result = peHomeVsAwayPrior(catalogueElo(snap(1, 1, 1, 0), HOME_BASE));
    expect(result.homeElo).toBe(1723);
    expect(result.hybridPct).toEqual([91, 4, 5]);
    expect(result.band).toBe("medium");
    expect(result.xgHome).toBeCloseTo(4.6652, 3);
  });

  it("1-match away clamp vs home base-prior is weaker than the symmetric home clamp", () => {
    const awayMax = pePair(
      HOME_BASE,
      catalogueElo(snap(1, 1, 30, 0), AWAY_BASE),
    );
    const awayMin = pePair(
      HOME_BASE,
      catalogueElo(snap(1, 0, 0, 30), AWAY_BASE),
    );
    expect(awayMax.awayElo).toBe(1735);
    expect(awayMin.awayElo).toBe(1365);
    expect(awayMax.hybridPct).toEqual([13, 14, 73]);
    expect(awayMin.hybridPct).toEqual([92, 4, 5]);
    expect(awayMax.xgHome).toBeCloseTo(0.5941, 3);
    expect(awayMin.xgHome).toBeCloseTo(4.9988, 3);
  });
});

describe("Sprint 5B.2 — Bangladesh / Korea catalogue", () => {
  it("current 2-match diagnostic Elos stay 1460 / 1688", () => {
    const bangladesh = resolveEloWithProvenance(
      snap(2, 0, 0, 16),
      "apex:api-football:team:17885",
      HOME_BASE,
    );
    const korea = resolveEloWithProvenance(
      snap(2, 2, 11, 0),
      "apex:api-football:team:1728",
      AWAY_BASE,
    );
    expect(bangladesh.elo).toBe(1460);
    expect(korea.elo).toBe(1688);
    expect(bangladesh.elo - korea.elo).toBe(-228);
  });

  it("same rates at other played counts: Bangladesh 0% / −8 GD-per-match, Korea 100% / +5.5", () => {
    expect(catalogueElo(snap(1, 0, 0, 8), HOME_BASE)).toBe(1480);
    expect(catalogueElo(snap(2, 0, 0, 16), HOME_BASE)).toBe(1460);
    expect(catalogueElo(snap(3, 0, 0, 24), HOME_BASE)).toBe(1440);
    expect(catalogueElo(snap(5, 0, 0, 40), HOME_BASE)).toBe(1425);
    expect(catalogueElo(snap(10, 0, 0, 80), HOME_BASE)).toBe(1425);
    expect(catalogueElo(snap(20, 0, 0, 160), HOME_BASE)).toBe(1425);

    expect(catalogueElo(snap(1, 1, 6, 0), AWAY_BASE)).toBe(1675);
    expect(catalogueElo(snap(2, 2, 11, 0), AWAY_BASE)).toBe(1688);
    expect(catalogueElo(snap(3, 3, 17, 0), AWAY_BASE)).toBe(1703);
    expect(catalogueElo(snap(5, 5, 28, 0), AWAY_BASE)).toBe(1730);
    expect(catalogueElo(snap(10, 10, 55, 0), AWAY_BASE)).toBe(1735);
    expect(catalogueElo(snap(20, 20, 110, 0), AWAY_BASE)).toBe(1735);
  });

  it("current 1460 vs 1688 PE remains an away-heavy hybrid, not a 5B.1 hash artifact", () => {
    const result = pePair(1460, 1688);
    expect(result.delta).toBe(-228);
    expect(result.xgHome).toBeCloseTo(0.3903, 3);
    expect(result.xgAway).toBeCloseTo(4.2727, 3);
    expect(result.hybridPct).toEqual([8, 6, 86]);
    expect(result.band).toBe("medium");
    expect(result.confidence).toBeCloseTo(0.5378, 3);
  });
});

describe("Sprint 5B.2 — home/away role dependence", () => {
  it("identical snapshots receive +60 Elo solely from home vs away base", () => {
    const snapshot = snap(2, 1, 3, 3);
    const asHome = resolveEloWithProvenance(snapshot, TEAM, HOME_BASE);
    const asAway = resolveEloWithProvenance(snapshot, TEAM, AWAY_BASE);
    expect(asHome.elo - asAway.elo).toBe(60);
    expect(asHome.source).toBe("catalogue");
    expect(asAway.source).toBe("catalogue");
  });

  it("PE also applies independent HFA of 65 on top of the role bases", () => {
    const even = createEloPoissonHybridEngine().predict({
      homeElo: 1500,
      awayElo: 1500,
    });
    expect(even.oneXTwo.home).toBeGreaterThan(even.oneXTwo.away);
    expect(even.expectedGoals.home).toBeGreaterThan(even.expectedGoals.away);
  });

  it("equal catalogue snapshots as home vs away-prior vs as away vs home-prior are not symmetric", () => {
    const snapshot = snap(2, 2, 6, 0);
    const asHome = peHomeVsAwayPrior(catalogueElo(snapshot, HOME_BASE));
    const asAway = pePair(HOME_BASE, catalogueElo(snapshot, AWAY_BASE));
    expect(asHome.homeElo).toBe(1735);
    expect(asAway.awayElo).toBe(1675);
    expect(asHome.hybridPct[0]).toBeGreaterThan(asAway.hybridPct[0]);
  });
});

describe("Sprint 5B.2 — PE golden tables", () => {
  it("locks 1/2/3-match extremes vs away base-prior", () => {
    const table = [
      row("1-0", snap(1, 1, 1, 0), HOME_BASE, "away_prior"),
      row("2-0", snap(1, 1, 2, 0), HOME_BASE, "away_prior"),
      row("3-0", snap(1, 1, 3, 0), HOME_BASE, "away_prior"),
      row("5-0", snap(1, 1, 5, 0), HOME_BASE, "away_prior"),
      row("0-1", snap(1, 0, 0, 1), HOME_BASE, "away_prior"),
      row("0-2", snap(1, 0, 0, 2), HOME_BASE, "away_prior"),
      row("0-3", snap(1, 0, 0, 3), HOME_BASE, "away_prior"),
      row("0-5", snap(1, 0, 0, 5), HOME_BASE, "away_prior"),
      row("1x 30-0 clamp", snap(1, 1, 30, 0), HOME_BASE, "away_prior"),
      row("1x 0-30 clamp", snap(1, 0, 0, 30), HOME_BASE, "away_prior"),
      row("2x 3-0", snap(2, 2, 6, 0), HOME_BASE, "away_prior"),
      row("2x 0-3", snap(2, 0, 0, 6), HOME_BASE, "away_prior"),
      row("2x 1-1 mixed", snap(2, 1, 3, 3), HOME_BASE, "away_prior"),
      row("2x 5-0", snap(2, 2, 10, 0), HOME_BASE, "away_prior"),
      row("2x 0-5", snap(2, 0, 0, 10), HOME_BASE, "away_prior"),
      row("2x 30-0 clamp", snap(2, 2, 60, 0), HOME_BASE, "away_prior"),
      row("3x 3-0", snap(3, 3, 9, 0), HOME_BASE, "away_prior"),
      row("3x 0-3", snap(3, 0, 0, 9), HOME_BASE, "away_prior"),
      row("3x 2W 5-4", snap(3, 2, 5, 4), HOME_BASE, "away_prior"),
      row("3x 1W 4-5", snap(3, 1, 4, 5), HOME_BASE, "away_prior"),
      row("3x 5-0", snap(3, 3, 15, 0), HOME_BASE, "away_prior"),
      row("3x 0-5", snap(3, 0, 0, 15), HOME_BASE, "away_prior"),
      row("3x 30-0 clamp", snap(3, 3, 90, 0), HOME_BASE, "away_prior"),
    ];
    expect(table.map((r) => [r.label, r.elo, r.hybridPct, r.band])).toEqual([
      ["1-0", 1723, [91, 4, 5], "medium"],
      ["2-0", 1725, [91, 4, 5], "medium"],
      ["3-0", 1728, [91, 4, 5], "medium"],
      ["5-0", 1733, [91, 4, 5], "medium"],
      ["0-1", 1498, [38, 25, 36], "low"],
      ["0-2", 1495, [37, 26, 37], "low"],
      ["0-3", 1493, [37, 26, 38], "low"],
      ["0-5", 1488, [35, 26, 39], "low"],
      ["1x 30-0 clamp", 1795, [94, 2, 4], "high"],
      ["1x 0-30 clamp", 1425, [21, 22, 57], "low"],
      ["2x 3-0", 1735, [92, 4, 5], "medium"],
      ["2x 0-3", 1485, [34, 26, 40], "low"],
      ["2x 1-1 mixed", 1610, [72, 15, 13], "low"],
      ["2x 5-0", 1745, [92, 3, 5], "medium"],
      ["2x 0-5", 1475, [32, 26, 43], "low"],
      ["2x 30-0 clamp", 1795, [94, 2, 4], "high"],
      ["3x 3-0", 1743, [92, 3, 5], "medium"],
      ["3x 0-3", 1478, [33, 26, 42], "low"],
      ["3x 2W 5-4", 1649, [80, 10, 9], "low"],
      ["3x 1W 4-5", 1571, [61, 20, 20], "low"],
      ["3x 5-0", 1758, [93, 3, 4], "medium"],
      ["3x 0-5", 1463, [29, 26, 46], "low"],
      ["3x 30-0 clamp", 1795, [94, 2, 4], "high"],
    ]);
  });

  it("locks Bangladesh/Korea rate-preserving counterfactuals through frozen PE", () => {
    const pairs = (
      [
        [1, 0, 0, 8, 1, 1, 6, 0],
        [2, 0, 0, 16, 2, 2, 11, 0],
        [3, 0, 0, 24, 3, 3, 17, 0],
        [5, 0, 0, 40, 5, 5, 28, 0],
        [10, 0, 0, 80, 10, 10, 55, 0],
        [20, 0, 0, 160, 20, 20, 110, 0],
      ] as const
    ).map((t) => {
      const homeElo = catalogueElo(snap(t[0], t[1], t[2], t[3]), HOME_BASE);
      const awayElo = catalogueElo(snap(t[4], t[5], t[6], t[7]), AWAY_BASE);
      const pe = pePair(homeElo, awayElo);
      return {
        played: t[0],
        homeElo,
        awayElo,
        delta: pe.delta,
        hybridPct: pe.hybridPct,
        band: pe.band,
      };
    });
    expect(pairs).toEqual([
      {
        played: 1,
        homeElo: 1480,
        awayElo: 1675,
        delta: -195,
        hybridPct: [10, 9, 81],
        band: "low",
      },
      {
        played: 2,
        homeElo: 1460,
        awayElo: 1688,
        delta: -228,
        hybridPct: [8, 6, 86],
        band: "medium",
      },
      {
        played: 3,
        homeElo: 1440,
        awayElo: 1703,
        delta: -263,
        hybridPct: [7, 4, 89],
        band: "medium",
      },
      {
        played: 5,
        homeElo: 1425,
        awayElo: 1730,
        delta: -305,
        hybridPct: [6, 3, 91],
        band: "medium",
      },
      {
        played: 10,
        homeElo: 1425,
        awayElo: 1735,
        delta: -310,
        hybridPct: [5, 3, 91],
        band: "medium",
      },
      {
        played: 20,
        homeElo: 1425,
        awayElo: 1735,
        delta: -310,
        hybridPct: [5, 3, 91],
        band: "medium",
      },
    ]);
  });

  it("locks PE HFA on equal Elos and on 1580/1520 role bases", () => {
    const even = pePair(1500, 1500);
    const roleBases = pePair(HOME_BASE, AWAY_BASE);
    expect(even.hybridPct).toEqual([45, 24, 31]);
    expect(even.xgHome).toBeCloseTo(1.45, 4);
    expect(even.xgAway).toBeCloseTo(1.15, 4);
    expect(roleBases.hybridPct).toEqual([63, 19, 18]);
    expect(roleBases.xgHome).toBeCloseTo(2.0482, 3);
  });
});
