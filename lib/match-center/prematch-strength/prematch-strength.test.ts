/**
 * PE-3A — Prematch-safe team strength reconstruction core tests.
 * Offline only. Does not wire lifecycle or call providers.
 */

import { describe, expect, it } from "vitest";
import {
  catalogueEloFromPlayedStats,
  PRODUCTION_AWAY_ELO_BASE,
  PRODUCTION_HOME_ELO_BASE,
} from "@/lib/match-center/catalogue-elo";
import { resolveEloWithProvenance } from "@/lib/match-center/from-data-platform";
import {
  PREMATCH_STRENGTH_REGIME_C0_RECON_V1,
  resolvePrematchStrengthFromUniverse,
  type PrematchStrengthTarget,
  type PrematchStrengthUniverseFixture,
} from "@/lib/match-center/prematch-strength";
import { createEloPoissonHybridEngine } from "@/lib/intelligence/modules/probability";
import { EMPTY_MATCH_CENTER_ENRICHMENT } from "@/lib/match-center/enrich";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const TARGET_KICKOFF = "2026-09-20T15:00:00.000Z";
const BEFORE = "2026-09-10T15:00:00.000Z";
const SAME = "2026-09-20T15:00:00.000Z";
const AFTER = "2026-09-25T15:00:00.000Z";
const EVIDENCE_AS_OF = "2026-09-19T12:00:00.000Z";

const TARGET: PrematchStrengthTarget = {
  fixtureId: "fx-target",
  kickoffUtc: TARGET_KICKOFF,
  homeTeamId: "team-strong",
  awayTeamId: "team-weak",
  competitionId: "comp-1",
  season: "2026",
};

function prior(
  partial: Partial<PrematchStrengthUniverseFixture> &
    Pick<PrematchStrengthUniverseFixture, "fixtureId">,
): PrematchStrengthUniverseFixture {
  return {
    kickoffUtc: BEFORE,
    homeTeamId: "team-strong",
    awayTeamId: "team-other",
    competitionId: "comp-1",
    season: "2026",
    status: "FT",
    homeGoals: 2,
    awayGoals: 0,
    ...partial,
  };
}

describe("PE-3A catalogue Elo parity with resolveEloWithProvenance", () => {
  it("matches production catalogue formula for played > 0", () => {
    const cases = [
      { played: 1, wins: 1, goalsFor: 3, goalsAgainst: 0 },
      { played: 5, wins: 4, goalsFor: 12, goalsAgainst: 4 },
      { played: 10, wins: 2, goalsFor: 8, goalsAgainst: 20 },
      { played: 8, wins: 0, goalsFor: 1, goalsAgainst: 40 },
    ] as const;

    for (const row of cases) {
      for (const base of [PRODUCTION_HOME_ELO_BASE, PRODUCTION_AWAY_ELO_BASE]) {
        const shared = catalogueEloFromPlayedStats({ base, ...row });
        const viaResolver = resolveEloWithProvenance(
          {
            played: row.played,
            wins: row.wins,
            draws: 0,
            losses: row.played - row.wins,
            goalsFor: row.goalsFor,
            goalsAgainst: row.goalsAgainst,
          },
          "team-x",
          base,
        );
        expect(viaResolver.source).toBe("catalogue");
        expect(viaResolver.elo).toBe(shared);
      }
    }
  });

  it("keeps base_prior when played is 0", () => {
    const home = resolveEloWithProvenance(null, "any", PRODUCTION_HOME_ELO_BASE);
    const away = resolveEloWithProvenance(
      { played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 },
      "any",
      PRODUCTION_AWAY_ELO_BASE,
    );
    expect(home).toMatchObject({
      elo: PRODUCTION_HOME_ELO_BASE,
      source: "base_prior",
    });
    expect(away).toMatchObject({
      elo: PRODUCTION_AWAY_ELO_BASE,
      source: "base_prior",
    });
  });
});

describe("PE-3A different teams produce different Elo", () => {
  it("strong home vs weak away diverge from 1580/1520 via exact C0", () => {
    const universe: PrematchStrengthUniverseFixture[] = [
      prior({
        fixtureId: "p1",
        homeTeamId: "team-strong",
        awayTeamId: "opp-a",
        homeGoals: 3,
        awayGoals: 0,
      }),
      prior({
        fixtureId: "p2",
        homeTeamId: "opp-b",
        awayTeamId: "team-strong",
        homeGoals: 0,
        awayGoals: 2,
      }),
      prior({
        fixtureId: "p3",
        homeTeamId: "team-strong",
        awayTeamId: "opp-c",
        homeGoals: 4,
        awayGoals: 1,
      }),
      prior({
        fixtureId: "p4",
        homeTeamId: "team-weak",
        awayTeamId: "opp-d",
        homeGoals: 0,
        awayGoals: 3,
      }),
      prior({
        fixtureId: "p5",
        homeTeamId: "opp-e",
        awayTeamId: "team-weak",
        homeGoals: 2,
        awayGoals: 0,
      }),
      prior({
        fixtureId: "p6",
        homeTeamId: "team-weak",
        awayTeamId: "opp-f",
        homeGoals: 1,
        awayGoals: 4,
      }),
    ];

    const result = resolvePrematchStrengthFromUniverse({
      target: TARGET,
      universe,
      evidenceAsOfUtc: EVIDENCE_AS_OF,
    });

    expect(result.fallback).toBe(false);
    expect(result.regime).toBe(PREMATCH_STRENGTH_REGIME_C0_RECON_V1);
    expect(result.home.evidence.played).toBe(3);
    expect(result.home.evidence.wins).toBe(3);
    expect(result.home.evidence.goalsFor).toBe(9);
    expect(result.home.evidence.goalsAgainst).toBe(1);
    expect(result.away.evidence.played).toBe(3);
    expect(result.away.evidence.wins).toBe(0);
    expect(result.away.evidence.goalsFor).toBe(1);
    expect(result.away.evidence.goalsAgainst).toBe(9);

    const expectedHome = catalogueEloFromPlayedStats({
      base: PRODUCTION_HOME_ELO_BASE,
      played: 3,
      wins: 3,
      goalsFor: 9,
      goalsAgainst: 1,
    });
    const expectedAway = catalogueEloFromPlayedStats({
      base: PRODUCTION_AWAY_ELO_BASE,
      played: 3,
      wins: 0,
      goalsFor: 1,
      goalsAgainst: 9,
    });
    expect(result.homeElo).toBe(expectedHome);
    expect(result.awayElo).toBe(expectedAway);
    expect(result.homeElo).not.toBe(PRODUCTION_HOME_ELO_BASE);
    expect(result.awayElo).not.toBe(PRODUCTION_AWAY_ELO_BASE);
    expect(result.homeElo).toBeGreaterThan(result.awayElo);

    // Parity with resolveEloWithProvenance snapshot path
    expect(
      resolveEloWithProvenance(
        {
          played: 3,
          wins: 3,
          draws: 0,
          losses: 0,
          goalsFor: 9,
          goalsAgainst: 1,
        },
        "team-strong",
        PRODUCTION_HOME_ELO_BASE,
      ).elo,
    ).toBe(result.homeElo);
  });
});

describe("PE-3A zero leakage", () => {
  const basePriorWin = prior({
    fixtureId: "past-win",
    homeTeamId: "team-strong",
    awayTeamId: "opp-z",
    homeGoals: 2,
    awayGoals: 0,
  });

  it("A) fixture before target contributes", () => {
    const result = resolvePrematchStrengthFromUniverse({
      target: TARGET,
      universe: [basePriorWin],
    });
    expect(result.priorsAccepted).toBe(1);
    expect(result.home.evidence.played).toBe(1);
    expect(result.home.evidence.wins).toBe(1);
    expect(result.fallback).toBe(false);
  });

  it("B) target fixture does NOT contribute", () => {
    const withTargetSelf = [
      basePriorWin,
      prior({
        fixtureId: "fx-target",
        kickoffUtc: BEFORE,
        homeTeamId: "team-strong",
        awayTeamId: "team-weak",
        homeGoals: 9,
        awayGoals: 0,
      }),
    ];
    const without = resolvePrematchStrengthFromUniverse({
      target: TARGET,
      universe: [basePriorWin],
    });
    const withSelf = resolvePrematchStrengthFromUniverse({
      target: TARGET,
      universe: withTargetSelf,
    });
    expect(withSelf.homeElo).toBe(without.homeElo);
    expect(withSelf.awayElo).toBe(without.awayElo);
    expect(withSelf.home.evidence.played).toBe(1);
  });

  it("C) fixture after target does NOT contribute", () => {
    const result = resolvePrematchStrengthFromUniverse({
      target: TARGET,
      universe: [
        basePriorWin,
        prior({
          fixtureId: "future",
          kickoffUtc: AFTER,
          homeTeamId: "team-strong",
          awayTeamId: "opp-z",
          homeGoals: 8,
          awayGoals: 0,
        }),
      ],
    });
    expect(result.home.evidence.played).toBe(1);
    expect(result.home.evidence.goalsFor).toBe(2);
  });

  it("D) same kickoff does NOT contribute", () => {
    const result = resolvePrematchStrengthFromUniverse({
      target: TARGET,
      universe: [
        basePriorWin,
        prior({
          fixtureId: "same-ko",
          kickoffUtc: SAME,
          homeTeamId: "team-strong",
          awayTeamId: "opp-z",
          homeGoals: 7,
          awayGoals: 0,
        }),
      ],
    });
    expect(result.home.evidence.played).toBe(1);
    expect(result.home.evidence.goalsFor).toBe(2);
  });

  it("E/F) changing or adding future fixtures does not change Elo", () => {
    const baseline = resolvePrematchStrengthFromUniverse({
      target: TARGET,
      universe: [basePriorWin],
    });
    const mutatedFuture = resolvePrematchStrengthFromUniverse({
      target: TARGET,
      universe: [
        basePriorWin,
        prior({
          fixtureId: "future-a",
          kickoffUtc: AFTER,
          homeTeamId: "team-strong",
          awayTeamId: "opp-z",
          homeGoals: 10,
          awayGoals: 0,
        }),
        prior({
          fixtureId: "future-b",
          kickoffUtc: AFTER,
          homeTeamId: "team-weak",
          awayTeamId: "opp-z",
          homeGoals: 0,
          awayGoals: 10,
        }),
      ],
    });
    expect(mutatedFuture.homeElo).toBe(baseline.homeElo);
    expect(mutatedFuture.awayElo).toBe(baseline.awayElo);
    expect(mutatedFuture.home.evidence).toEqual(baseline.home.evidence);
    expect(mutatedFuture.away.evidence).toEqual(baseline.away.evidence);
  });

  it("G) duplicate fixture IDs with identical evidence do not double-count", () => {
    const dup = prior({
      fixtureId: "dup",
      homeTeamId: "team-strong",
      awayTeamId: "opp-z",
      homeGoals: 2,
      awayGoals: 0,
    });
    const once = resolvePrematchStrengthFromUniverse({
      target: TARGET,
      universe: [dup],
    });
    const twice = resolvePrematchStrengthFromUniverse({
      target: TARGET,
      universe: [dup, { ...dup }],
    });
    expect(twice.home.evidence.played).toBe(1);
    expect(twice.homeElo).toBe(once.homeElo);
    expect(twice.priorsAccepted).toBe(1);
  });

  it("G2) conflicting duplicate fixture IDs fail closed", () => {
    const dup = prior({
      fixtureId: "dup",
      homeTeamId: "team-strong",
      awayTeamId: "opp-z",
      homeGoals: 2,
      awayGoals: 0,
    });
    expect(() =>
      resolvePrematchStrengthFromUniverse({
        target: TARGET,
        universe: [dup, { ...dup, homeGoals: 9 }],
      }),
    ).toThrow(/Conflicting duplicate/);
  });

  it("H) unfinished fixture does not contribute", () => {
    for (const status of ["NS", "LIVE", "1H", "HT", "2H", "PST", "CANC", "ABD"]) {
      const result = resolvePrematchStrengthFromUniverse({
        target: TARGET,
        universe: [
          prior({
            fixtureId: `unfinished-${status}`,
            status,
            homeTeamId: "team-strong",
            awayTeamId: "opp-z",
            homeGoals: 5,
            awayGoals: 0,
          }),
        ],
      });
      expect(result.fallback).toBe(true);
      expect(result.fallbackReason).toBe("no_completed_priors");
      expect(result.homeElo).toBe(PRODUCTION_HOME_ELO_BASE);
      expect(result.awayElo).toBe(PRODUCTION_AWAY_ELO_BASE);
    }
  });

  it("accepts AET and PEN as completed evidence", () => {
    const aet = resolvePrematchStrengthFromUniverse({
      target: TARGET,
      universe: [
        prior({
          fixtureId: "aet-1",
          status: "AET",
          homeTeamId: "team-strong",
          awayTeamId: "opp-z",
          homeGoals: 1,
          awayGoals: 0,
        }),
      ],
    });
    const pen = resolvePrematchStrengthFromUniverse({
      target: TARGET,
      universe: [
        prior({
          fixtureId: "pen-1",
          status: "PEN",
          homeTeamId: "team-strong",
          awayTeamId: "opp-z",
          homeGoals: 1,
          awayGoals: 0,
        }),
      ],
    });
    expect(aet.fallback).toBe(false);
    expect(pen.fallback).toBe(false);
    expect(aet.home.evidence.played).toBe(1);
    expect(pen.home.evidence.played).toBe(1);
  });
});

describe("PE-3A determinism", () => {
  it("is invariant to fixture order", () => {
    const universe: PrematchStrengthUniverseFixture[] = [
      prior({
        fixtureId: "z-last",
        kickoffUtc: "2026-09-12T15:00:00.000Z",
        homeTeamId: "team-strong",
        awayTeamId: "opp-a",
        homeGoals: 2,
        awayGoals: 1,
      }),
      prior({
        fixtureId: "a-first",
        kickoffUtc: "2026-09-08T15:00:00.000Z",
        homeTeamId: "team-weak",
        awayTeamId: "opp-b",
        homeGoals: 0,
        awayGoals: 3,
      }),
      prior({
        fixtureId: "m-mid",
        kickoffUtc: "2026-09-11T15:00:00.000Z",
        homeTeamId: "opp-c",
        awayTeamId: "team-strong",
        homeGoals: 0,
        awayGoals: 1,
      }),
    ];
    const forward = resolvePrematchStrengthFromUniverse({
      target: TARGET,
      universe,
      evidenceAsOfUtc: EVIDENCE_AS_OF,
    });
    const reversed = resolvePrematchStrengthFromUniverse({
      target: TARGET,
      universe: [...universe].reverse(),
      evidenceAsOfUtc: EVIDENCE_AS_OF,
    });
    const shuffled = resolvePrematchStrengthFromUniverse({
      target: TARGET,
      universe: [universe[2]!, universe[0]!, universe[1]!],
      evidenceAsOfUtc: EVIDENCE_AS_OF,
    });
    expect(reversed).toEqual(forward);
    expect(shuffled).toEqual(forward);
  });
});

describe("PE-3A explicit base_prior fallback", () => {
  it("empty universe → 1580/1520 with fallback marker", () => {
    const result = resolvePrematchStrengthFromUniverse({
      target: TARGET,
      universe: [],
      evidenceAsOfUtc: EVIDENCE_AS_OF,
    });
    expect(result).toMatchObject({
      homeElo: PRODUCTION_HOME_ELO_BASE,
      awayElo: PRODUCTION_AWAY_ELO_BASE,
      source: "base_prior",
      fallback: true,
      fallbackReason: "empty_universe",
      regime: PREMATCH_STRENGTH_REGIME_C0_RECON_V1,
      evidenceAsOfUtc: EVIDENCE_AS_OF,
    });
  });

  it("only future fixtures → no_completed_priors fallback", () => {
    const result = resolvePrematchStrengthFromUniverse({
      target: TARGET,
      universe: [
        prior({
          fixtureId: "fut",
          kickoffUtc: AFTER,
          homeTeamId: "team-strong",
          awayTeamId: "opp-z",
          homeGoals: 5,
          awayGoals: 0,
        }),
      ],
    });
    expect(result.fallback).toBe(true);
    expect(result.fallbackReason).toBe("no_completed_priors");
    expect(result.homeElo).toBe(PRODUCTION_HOME_ELO_BASE);
    expect(result.awayElo).toBe(PRODUCTION_AWAY_ELO_BASE);
  });

  it("only unfinished fixtures → no_completed_priors fallback", () => {
    const result = resolvePrematchStrengthFromUniverse({
      target: TARGET,
      universe: [
        prior({
          fixtureId: "live",
          status: "LIVE",
          homeTeamId: "team-strong",
          awayTeamId: "opp-z",
          homeGoals: 1,
          awayGoals: 0,
        }),
      ],
    });
    expect(result.fallbackReason).toBe("no_completed_priors");
    expect(result.homeElo).toBe(PRODUCTION_HOME_ELO_BASE);
    expect(result.awayElo).toBe(PRODUCTION_AWAY_ELO_BASE);
  });

  it("malformed target → malformed_target fallback", () => {
    const result = resolvePrematchStrengthFromUniverse({
      target: {
        ...TARGET,
        kickoffUtc: "not-a-date",
      },
      universe: [prior({ fixtureId: "p1" })],
    });
    expect(result.fallback).toBe(true);
    expect(result.fallbackReason).toBe("malformed_target");
    expect(result.homeElo).toBe(PRODUCTION_HOME_ELO_BASE);
    expect(result.awayElo).toBe(PRODUCTION_AWAY_ELO_BASE);
  });
});

describe("PE-3A through canonical PE normalization", () => {
  it("reconstructed Elo yields normalized 1X2", () => {
    const strength = resolvePrematchStrengthFromUniverse({
      target: TARGET,
      universe: [
        prior({
          fixtureId: "p1",
          homeTeamId: "team-strong",
          awayTeamId: "opp-a",
          homeGoals: 3,
          awayGoals: 0,
        }),
        prior({
          fixtureId: "p2",
          homeTeamId: "team-weak",
          awayTeamId: "opp-b",
          homeGoals: 0,
          awayGoals: 2,
        }),
      ],
    });
    const hybrid = createEloPoissonHybridEngine().predict({
      homeElo: strength.homeElo,
      awayElo: strength.awayElo,
    });
    expect(hybrid.oneXTwo.home).toBeGreaterThanOrEqual(0);
    expect(hybrid.oneXTwo.draw).toBeGreaterThanOrEqual(0);
    expect(hybrid.oneXTwo.away).toBeGreaterThanOrEqual(0);
    expect(
      hybrid.oneXTwo.home + hybrid.oneXTwo.draw + hybrid.oneXTwo.away,
    ).toBeCloseTo(1, 12);
  });
});

describe("PE-3A production wiring remains inactive by default", () => {
  it("createScannerMatchCenter source still hard-wires EMPTY_MATCH_CENTER_ENRICHMENT", () => {
    const src = readFileSync(
      join(process.cwd(), "lib/apex-opportunities/scanner-canonical.ts"),
      "utf8",
    );
    expect(src).toContain("enrichment: EMPTY_MATCH_CENTER_ENRICHMENT");
    expect(src).not.toContain("resolvePrematchStrengthFromUniverse");
    expect(EMPTY_MATCH_CENTER_ENRICHMENT.teamStats).toBeUndefined();
  });

  it("lifecycle default path still uses Scanner empty enrichment (C0 only via peInputMode seam)", () => {
    const src = readFileSync(
      join(process.cwd(), "lib/prematch-lifecycle/coordinator.ts"),
      "utf8",
    );
    expect(src).toContain("createScannerMatchCenter");
    expect(src).toContain("peInputMode");
    expect(src).not.toContain("resolvePrematchStrengthFromUniverse");
  });
});
