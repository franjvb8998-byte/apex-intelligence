/**
 * PE-4C — Historical-time opponent strength evidence tests.
 * Offline only. Proves leakage invariant: post-M opponent results
 * must not alter opponentStrengthAsOfMatchKickoff for M.
 */

import { describe, expect, it } from "vitest";
import {
  resolvePrematchStrengthFromUniverse,
  type PrematchStrengthTarget,
  type PrematchStrengthUniverseFixture,
} from "@/lib/match-center/prematch-strength";
import {
  extractPe4FormScheduleEvidence,
  PE4C_OPPONENT_STRENGTH_RECONSTRUCTION_BASE,
  resolveHistoricalOpponentStrength,
  type Pe4FormScheduleTarget,
} from "@/lib/prematch-decision/pe4-form-schedule";
import { PE3C_C0_RECON_ACTIVATION } from "@/lib/prematch-lifecycle/pe3-activation";

const TARGET_KICKOFF = "2026-09-20T15:00:00.000Z";
const COMP = "comp-1";
const SEASON = "2026";
const HOME = "team-home";
const AWAY = "team-away";
const OPP = "team-opp";
const OTHER = "team-other";

const MATCH_M_KICKOFF = "2026-09-10T15:00:00.000Z";
const MATCH_M_ID = "match-M";

const TARGET: Pe4FormScheduleTarget = {
  fixtureId: "fx-target",
  kickoffUtc: TARGET_KICKOFF,
  homeTeamId: HOME,
  awayTeamId: AWAY,
  competitionId: COMP,
  season: SEASON,
};

function prior(
  partial: Partial<PrematchStrengthUniverseFixture> &
    Pick<PrematchStrengthUniverseFixture, "fixtureId">,
): PrematchStrengthUniverseFixture {
  return {
    kickoffUtc: "2026-09-01T15:00:00.000Z",
    homeTeamId: HOME,
    awayTeamId: OTHER,
    competitionId: COMP,
    season: SEASON,
    status: "FT",
    homeGoals: 1,
    awayGoals: 0,
    ...partial,
  };
}

function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = (i * 7 + 3) % (i + 1);
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/** Core universe: OPP has one win before M; HOME plays M vs OPP. */
function baseUniverse(): PrematchStrengthUniverseFixture[] {
  return [
    // OPP catalogue evidence before M
    prior({
      fixtureId: "opp-pre-1",
      kickoffUtc: "2026-09-01T15:00:00.000Z",
      homeTeamId: OPP,
      awayTeamId: OTHER,
      homeGoals: 2,
      awayGoals: 0,
    }),
    // Historical match M: HOME vs OPP
    prior({
      fixtureId: MATCH_M_ID,
      kickoffUtc: MATCH_M_KICKOFF,
      homeTeamId: HOME,
      awayTeamId: OPP,
      homeGoals: 1,
      awayGoals: 0,
    }),
  ];
}

describe("PE-4C activation safety", () => {
  it("keeps PE3C_C0_RECON_ACTIVATION false", () => {
    expect(PE3C_C0_RECON_ACTIVATION).toBe(false);
  });
});

describe("PE-4C temporal opponent strength", () => {
  it("includes pre-M opponent results in historical strength", () => {
    const result = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: baseUniverse(),
      lastN: 5,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const m = result.layer.home.orderedCompletedPriors.find(
      (row) => row.fixtureId === MATCH_M_ID,
    );
    expect(m).toBeDefined();
    expect(m!.opponentStrength.opponentStrengthAvailable).toBe(true);
    expect(m!.opponentStrength.opponentStrengthSource).toBe("catalogue");
    expect(m!.opponentStrength.opponentStrengthPlayed).toBe(1);
    expect(m!.opponentStrength.opponentStrengthCutoffUtc).toBe(MATCH_M_KICKOFF);
    expect(m!.opponentStrength.opponentStrengthAsOfMatchKickoff).toBeTypeOf(
      "number",
    );
    expect(m!.opponentStrength.opponentStrengthReconstructionBase).toBe(
      PE4C_OPPONENT_STRENGTH_RECONSTRUCTION_BASE,
    );
  });

  it("excludes M itself from opponent Y reconstruction", () => {
    // Only M exists for OPP — strength at kickoff(M) must be base_prior (0 played)
    const result = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: [
        prior({
          fixtureId: MATCH_M_ID,
          kickoffUtc: MATCH_M_KICKOFF,
          homeTeamId: HOME,
          awayTeamId: OPP,
          homeGoals: 1,
          awayGoals: 0,
        }),
      ],
      lastN: 5,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const m = result.layer.home.lastNMatches[0]!;
    expect(m.opponentStrength.opponentStrengthSource).toBe("base_prior");
    expect(m.opponentStrength.opponentStrengthPlayed).toBe(0);
    expect(m.opponentStrength.opponentStrengthAvailable).toBe(true);
  });

  it("excludes same-kickoff opponent results", () => {
    const withSameKickoff = [
      ...baseUniverse(),
      prior({
        fixtureId: "opp-same-kickoff",
        kickoffUtc: MATCH_M_KICKOFF,
        homeTeamId: OPP,
        awayTeamId: "team-z",
        homeGoals: 5,
        awayGoals: 0,
      }),
    ];
    const baseline = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: baseUniverse(),
      lastN: 5,
    });
    const withSame = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: withSameKickoff,
      lastN: 5,
    });
    expect(baseline.ok && withSame.ok).toBe(true);
    if (!baseline.ok || !withSame.ok) return;
    const a = baseline.layer.home.orderedCompletedPriors.find(
      (r) => r.fixtureId === MATCH_M_ID,
    )!;
    const b = withSame.layer.home.orderedCompletedPriors.find(
      (r) => r.fixtureId === MATCH_M_ID,
    )!;
    expect(b.opponentStrength.opponentStrengthAsOfMatchKickoff).toBe(
      a.opponentStrength.opponentStrengthAsOfMatchKickoff,
    );
    expect(b.opponentStrength.opponentStrengthPlayed).toBe(
      a.opponentStrength.opponentStrengthPlayed,
    );
  });

  it("excludes post-M opponent results (leakage invariant)", () => {
    const postMWins: PrematchStrengthUniverseFixture[] = [
      prior({
        fixtureId: "opp-post-1",
        kickoffUtc: "2026-09-12T15:00:00.000Z",
        homeTeamId: OPP,
        awayTeamId: OTHER,
        homeGoals: 4,
        awayGoals: 0,
      }),
      prior({
        fixtureId: "opp-post-2",
        kickoffUtc: "2026-09-15T15:00:00.000Z",
        homeTeamId: OTHER,
        awayTeamId: OPP,
        homeGoals: 0,
        awayGoals: 3,
      }),
      prior({
        fixtureId: "opp-post-3",
        kickoffUtc: "2026-09-18T15:00:00.000Z",
        homeTeamId: OPP,
        awayTeamId: "team-z",
        homeGoals: 2,
        awayGoals: 1,
      }),
    ];

    const withoutPost = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: baseUniverse(),
      lastN: 5,
    });
    const withPost = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: [...baseUniverse(), ...postMWins],
      lastN: 5,
    });
    expect(withoutPost.ok && withPost.ok).toBe(true);
    if (!withoutPost.ok || !withPost.ok) return;

    const m0 = withoutPost.layer.home.orderedCompletedPriors.find(
      (r) => r.fixtureId === MATCH_M_ID,
    )!;
    const m1 = withPost.layer.home.orderedCompletedPriors.find(
      (r) => r.fixtureId === MATCH_M_ID,
    )!;

    expect(m1.opponentStrength.opponentStrengthAsOfMatchKickoff).toBe(
      m0.opponentStrength.opponentStrengthAsOfMatchKickoff,
    );
    expect(m1.opponentStrength.opponentStrengthPlayed).toBe(
      m0.opponentStrength.opponentStrengthPlayed,
    );
    expect(m1.opponentStrength.opponentStrengthSource).toBe(
      m0.opponentStrength.opponentStrengthSource,
    );
    expect(m1.opponentStrength.opponentStrengthCutoffUtc).toBe(MATCH_M_KICKOFF);
  });

  it("allows pre-M opponent evidence to change strength attached to M", () => {
    const lean = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: baseUniverse(),
      lastN: 5,
    });
    const richer = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: [
        prior({
          fixtureId: "opp-pre-extra",
          kickoffUtc: "2026-09-05T15:00:00.000Z",
          homeTeamId: OPP,
          awayTeamId: OTHER,
          homeGoals: 3,
          awayGoals: 0,
        }),
        ...baseUniverse(),
      ],
      lastN: 5,
    });
    expect(lean.ok && richer.ok).toBe(true);
    if (!lean.ok || !richer.ok) return;
    const a = lean.layer.home.orderedCompletedPriors.find(
      (r) => r.fixtureId === MATCH_M_ID,
    )!;
    const b = richer.layer.home.orderedCompletedPriors.find(
      (r) => r.fixtureId === MATCH_M_ID,
    )!;
    expect(b.opponentStrength.opponentStrengthPlayed).toBe(2);
    expect(a.opponentStrength.opponentStrengthPlayed).toBe(1);
    expect(b.opponentStrength.opponentStrengthAsOfMatchKickoff).not.toBe(
      a.opponentStrength.opponentStrengthAsOfMatchKickoff,
    );
  });
});

describe("PE-4C source quality / base_prior", () => {
  it("represents catalogue vs base_prior explicitly", () => {
    const catalogue = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: baseUniverse(),
      lastN: 5,
    });
    const basePriorOnly = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: [
        prior({
          fixtureId: MATCH_M_ID,
          kickoffUtc: MATCH_M_KICKOFF,
          homeTeamId: HOME,
          awayTeamId: OPP,
          homeGoals: 1,
          awayGoals: 0,
        }),
      ],
      lastN: 5,
    });
    expect(catalogue.ok && basePriorOnly.ok).toBe(true);
    if (!catalogue.ok || !basePriorOnly.ok) return;

    const c = catalogue.layer.home.lastNMatches[0]!.opponentStrength;
    const b = basePriorOnly.layer.home.lastNMatches[0]!.opponentStrength;
    expect(c.opponentStrengthSource).toBe("catalogue");
    expect(c.opponentStrengthPlayed).toBeGreaterThan(0);
    expect(b.opponentStrengthSource).toBe("base_prior");
    expect(b.opponentStrengthPlayed).toBe(0);
    expect(catalogue.layer.home.components.opponentAdjustedForm).toMatchObject({
      status: "USED",
      coverage: "all_catalogue",
    });
    expect(basePriorOnly.layer.home.components.opponentAdjustedForm).toMatchObject(
      {
        status: "USED",
        coverage: "all_base_prior",
      },
    );
  });

  it("marks mixed catalogue + base_prior coverage", () => {
    const result = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: [
        // M1: OPP has no history → base_prior
        prior({
          fixtureId: "m1",
          kickoffUtc: "2026-09-03T15:00:00.000Z",
          homeTeamId: HOME,
          awayTeamId: "fresh-opp",
          homeGoals: 1,
          awayGoals: 0,
        }),
        // Give known OPP history then M2
        prior({
          fixtureId: "opp-pre-1",
          kickoffUtc: "2026-09-05T15:00:00.000Z",
          homeTeamId: OPP,
          awayTeamId: OTHER,
          homeGoals: 2,
          awayGoals: 0,
        }),
        prior({
          fixtureId: "m2",
          kickoffUtc: "2026-09-10T15:00:00.000Z",
          homeTeamId: HOME,
          awayTeamId: OPP,
          homeGoals: 0,
          awayGoals: 0,
        }),
      ],
      lastN: 5,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.layer.home.components.opponentAdjustedForm).toMatchObject({
      status: "USED",
      coverage: "mixed_catalogue_base_prior",
    });
    expect(result.layer.home.opponentStrengthCoverage.catalogueCount).toBe(1);
    expect(result.layer.home.opponentStrengthCoverage.basePriorCount).toBe(1);
  });
});

describe("PE-4C ordering / digest", () => {
  it("shuffled universe yields identical historical opponent evidence + digest", () => {
    const universe = [
      ...baseUniverse(),
      prior({
        fixtureId: "home-earlier",
        kickoffUtc: "2026-09-04T15:00:00.000Z",
        homeTeamId: HOME,
        awayTeamId: OTHER,
        homeGoals: 0,
        awayGoals: 1,
      }),
    ];
    const a = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe,
      lastN: 5,
    });
    const b = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: shuffle(universe),
      lastN: 5,
      evidenceAcquiredAtUtc: "2099-01-01T00:00:00.000Z",
    });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(b.layer.evidenceDigest).toBe(a.layer.evidenceDigest);
    const mA = a.layer.home.orderedCompletedPriors.find(
      (r) => r.fixtureId === MATCH_M_ID,
    )!;
    const mB = b.layer.home.orderedCompletedPriors.find(
      (r) => r.fixtureId === MATCH_M_ID,
    )!;
    expect(mB.opponentStrength).toEqual(mA.opponentStrength);
  });

  it("post-M opponent results do not change M representation or force digest change via M", () => {
    const withoutPost = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: baseUniverse(),
      lastN: 5,
    });
    const withPost = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: [
        ...baseUniverse(),
        prior({
          fixtureId: "opp-post",
          kickoffUtc: "2026-09-14T15:00:00.000Z",
          homeTeamId: OPP,
          awayTeamId: OTHER,
          homeGoals: 9,
          awayGoals: 0,
        }),
      ],
      lastN: 5,
    });
    expect(withoutPost.ok && withPost.ok).toBe(true);
    if (!withoutPost.ok || !withPost.ok) return;

    const m0 = withoutPost.layer.home.orderedCompletedPriors.find(
      (r) => r.fixtureId === MATCH_M_ID,
    )!;
    const m1 = withPost.layer.home.orderedCompletedPriors.find(
      (r) => r.fixtureId === MATCH_M_ID,
    )!;
    expect(m1.opponentStrength).toEqual(m0.opponentStrength);

    // Focused: resolveHistoricalOpponentStrength alone must be identical
    const direct0 = resolveHistoricalOpponentStrength({
      opponentTeamId: OPP,
      matchFixtureId: MATCH_M_ID,
      matchKickoffUtc: MATCH_M_KICKOFF,
      competitionId: COMP,
      season: SEASON,
      universe: baseUniverse(),
    });
    const direct1 = resolveHistoricalOpponentStrength({
      opponentTeamId: OPP,
      matchFixtureId: MATCH_M_ID,
      matchKickoffUtc: MATCH_M_KICKOFF,
      competitionId: COMP,
      season: SEASON,
      universe: [
        ...baseUniverse(),
        prior({
          fixtureId: "opp-post",
          kickoffUtc: "2026-09-14T15:00:00.000Z",
          homeTeamId: OPP,
          awayTeamId: OTHER,
          homeGoals: 9,
          awayGoals: 0,
        }),
      ],
    });
    expect(direct1).toEqual(direct0);
  });

  it("material pre-M opponent change changes digest", () => {
    const a = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: baseUniverse(),
      lastN: 5,
    });
    const b = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: [
        prior({
          fixtureId: "opp-pre-extra",
          kickoffUtc: "2026-09-05T15:00:00.000Z",
          homeTeamId: OPP,
          awayTeamId: OTHER,
          homeGoals: 3,
          awayGoals: 0,
        }),
        ...baseUniverse(),
      ],
      lastN: 5,
    });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.layer.evidenceDigest).not.toBe(b.layer.evidenceDigest);
  });

  it("evidenceAcquiredAtUtc does not affect digest", () => {
    const a = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: baseUniverse(),
      evidenceAcquiredAtUtc: "2026-09-19T00:00:00.000Z",
    });
    const b = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: baseUniverse(),
      evidenceAcquiredAtUtc: "2026-09-19T23:59:59.000Z",
    });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.layer.evidenceDigest).toBe(b.layer.evidenceDigest);
  });
});

describe("PE-4C PE-4B regression", () => {
  it("preserves WDL/GF/GA/venue/rest/windows/last-N and crossCompetitionBlind", () => {
    const universe = baseUniverse();
    const result = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe,
      lastN: 5,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.layer.crossCompetitionBlind).toBe(true);
    expect(result.layer.home.actualLastN).toBe(1);
    expect(result.layer.home.lastNAggregate.wins).toBe(1);
    expect(result.layer.home.lastNAggregate.goalsFor).toBe(1);
    expect(result.layer.home.lastNAggregate.goalsAgainst).toBe(0);
    expect(result.layer.home.lastNMatches[0]!.venueRole).toBe("HOME");
    expect(result.layer.home.previousCompletedKickoffUtc).toBe(MATCH_M_KICKOFF);
    expect(result.layer.home.competitionScopedRestHoursSincePreviousCompleted).toBe(240);
    expect(result.layer.home.competitionScopedMatchesInWindows.previous28Days).toBe(1);
  });
});

describe("PE-4C PE-3 regression", () => {
  it("does not change C0 reconstruction for the same universe", () => {
    const universe = baseUniverse();
    const c0Target: PrematchStrengthTarget = { ...TARGET };
    const s1 = resolvePrematchStrengthFromUniverse({
      target: c0Target,
      universe,
      evidenceAcquiredAtUtc: "2026-09-19T12:00:00.000Z",
    });
    const pe4 = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: shuffle(universe),
    });
    expect(pe4.ok).toBe(true);
    const s2 = resolvePrematchStrengthFromUniverse({
      target: c0Target,
      universe,
      evidenceAcquiredAtUtc: "2026-09-19T12:00:00.000Z",
    });
    expect(s2.homeElo).toBe(s1.homeElo);
    expect(s2.awayElo).toBe(s1.awayElo);
    expect(s2.acceptedEvidenceDigest).toBe(s1.acceptedEvidenceDigest);
  });
});
