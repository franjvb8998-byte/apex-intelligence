/**
 * PE-4D — Fail-closed contract, goldens, PE-3 stability, provenance,
 * digest, no-mutation, and historical opponent-base audit.
 * Offline only.
 */

import { describe, expect, it } from "vitest";
import {
  catalogueEloFromPlayedStats,
  PRODUCTION_AWAY_ELO_BASE,
  PRODUCTION_HOME_ELO_BASE,
} from "@/lib/match-center/catalogue-elo";
import {
  resolvePrematchStrengthFromUniverse,
  type PrematchStrengthTarget,
  type PrematchStrengthUniverseFixture,
} from "@/lib/match-center/prematch-strength";
import {
  digestPe4FormScheduleContextLayer,
  extractPe4FormScheduleEvidence,
  isPe4FormScheduleContextLayer,
  PE4_EXTRACTION_FATAL_CASES,
  PE4_FAIL_CLOSED_MATRIX,
  PE4_OPPONENT_STRENGTH_SEMANTICS,
  PE4C_OPPONENT_STRENGTH_RECONSTRUCTION_BASE,
  resolveHistoricalOpponentStrength,
} from "@/lib/prematch-decision/pe4-form-schedule";
import {
  GOLDEN_HOME,
  GOLDEN_TARGET,
  GOLDEN_TARGET_KICKOFF,
  goldenANormalMidSeason,
  goldenBEarlySeason,
  goldenCTemporalTrap,
  goldenDCorruptedUniverse,
  goldenECrossCompetitionBlindness,
} from "@/lib/prematch-decision/pe4-form-schedule/goldens";
import { PE3C_C0_RECON_ACTIVATION } from "@/lib/prematch-lifecycle/pe3-activation";

function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = (i * 11 + 5) % (i + 1);
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

function deepFreeze<T>(value: T): T {
  if (value == null || typeof value !== "object") return value;
  Object.freeze(value);
  for (const child of Object.values(value as object)) {
    deepFreeze(child);
  }
  return value;
}

describe("PE-4D fail-closed contract matrix", () => {
  it("keeps activation false", () => {
    expect(PE3C_C0_RECON_ACTIVATION).toBe(false);
  });

  it("marks corruption cases as extraction-fatal and PE-3-fallback-eligible", () => {
    for (const key of PE4_EXTRACTION_FATAL_CASES) {
      const entry = PE4_FAIL_CLOSED_MATRIX[key];
      expect(entry.extractionFatal).toBe(true);
      expect(entry.pe3FallbackEligible).toBe(true);
      expect(entry.outcome).toBe("extraction_fatal");
    }
  });

  it("does not treat thin history as extraction-fatal", () => {
    expect(PE4_FAIL_CLOSED_MATRIX.no_completed_priors.extractionFatal).toBe(
      false,
    );
    expect(
      PE4_FAIL_CLOSED_MATRIX.early_season_actual_last_n_lt_requested
        .extractionFatal,
    ).toBe(false);
    expect(
      PE4_FAIL_CLOSED_MATRIX.opponent_historical_base_prior.extractionFatal,
    ).toBe(false);
    expect(
      PE4_FAIL_CLOSED_MATRIX.cross_competition_blind_schedule.extractionFatal,
    ).toBe(false);
  });
});

describe("PE-4D golden A — normal mid-season", () => {
  it("extracts valid layer with catalogue/mixed opponent coverage", () => {
    const universe = goldenANormalMidSeason();
    const result = extractPe4FormScheduleEvidence({
      target: GOLDEN_TARGET,
      universe,
      lastN: 5,
      evidenceAcquiredAtUtc: "2026-09-19T12:00:00.000Z",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(isPe4FormScheduleContextLayer(result.layer)).toBe(true);
    expect(result.layer.crossCompetitionBlind).toBe(true);
    expect(result.layer.scope).toBe("competition_season");
    expect(result.layer.home.actualLastN).toBe(3);
    expect(result.layer.away.actualLastN).toBe(2);
    expect(result.layer.home.components.scheduleCompetitionScoped.status).toBe(
      "USED",
    );
    expect(result.layer.home.components.recentForm.status).toBe("USED");
    // HOME has catalogue (opp-a) and base_prior (opp-b) → mixed
    expect(result.layer.home.components.opponentAdjustedForm).toMatchObject({
      status: "USED",
      coverage: "mixed_catalogue_base_prior",
    });
    const digest = result.layer.evidenceDigest;
    const again = extractPe4FormScheduleEvidence({
      target: GOLDEN_TARGET,
      universe: shuffle(universe),
      lastN: 5,
    });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.layer.evidenceDigest).toBe(digest);
  });
});

describe("PE-4D golden B — early season", () => {
  it("exposes actualLastN < requestedLastN without padding; base_prior opponents", () => {
    const result = extractPe4FormScheduleEvidence({
      target: GOLDEN_TARGET,
      universe: goldenBEarlySeason(),
      lastN: 5,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.layer.home.requestedLastN).toBe(5);
    expect(result.layer.home.actualLastN).toBe(1);
    expect(result.layer.home.selectedFixtureIds).toHaveLength(1);
    expect(
      result.layer.home.lastNMatches[0]!.opponentStrength.opponentStrengthSource,
    ).toBe("base_prior");
    expect(result.layer.home.components.opponentAdjustedForm).toMatchObject({
      status: "USED",
      coverage: "all_base_prior",
    });
    expect(isPe4FormScheduleContextLayer(result.layer)).toBe(true);
  });
});

describe("PE-4D golden C — temporal trap", () => {
  it("excludes same-kickoff, post-M, future, and postponed correctly", () => {
    const { universe, matchMId, matchMKickoff } = goldenCTemporalTrap();
    const withTrap = extractPe4FormScheduleEvidence({
      target: GOLDEN_TARGET,
      universe,
      lastN: 5,
    });
    const lean = extractPe4FormScheduleEvidence({
      target: GOLDEN_TARGET,
      universe: universe.filter(
        (r) =>
          r.fixtureId === "c-opp-pre" ||
          r.fixtureId === matchMId,
      ),
      lastN: 5,
    });
    expect(withTrap.ok && lean.ok).toBe(true);
    if (!withTrap.ok || !lean.ok) return;

    const mTrap = withTrap.layer.home.orderedCompletedPriors.find(
      (m) => m.fixtureId === matchMId,
    )!;
    const mLean = lean.layer.home.orderedCompletedPriors.find(
      (m) => m.fixtureId === matchMId,
    )!;
    expect(mTrap.opponentStrength).toEqual(mLean.opponentStrength);
    expect(mTrap.opponentStrength.opponentStrengthCutoffUtc).toBe(matchMKickoff);

    // Future + PST not in completed priors
    expect(
      withTrap.layer.home.orderedCompletedPriors.map((m) => m.fixtureId),
    ).toEqual([matchMId]);
    expect(withTrap.layer.home.previousCompletedKickoffUtc).toBe(matchMKickoff);
  });
});

describe("PE-4D golden D — corrupted universe", () => {
  it("fails closed on conflicting duplicates", () => {
    const result = extractPe4FormScheduleEvidence({
      target: GOLDEN_TARGET,
      universe: goldenDCorruptedUniverse(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("conflicting_duplicate_fixture");
    expect(result.fixtureId).toBe("dup");
  });
});

describe("PE-4D golden E — cross-competition blindness", () => {
  it("reports long competition-scoped rest but never claims global rest", () => {
    const result = extractPe4FormScheduleEvidence({
      target: GOLDEN_TARGET,
      universe: goldenECrossCompetitionBlindness(),
      lastN: 5,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.layer.crossCompetitionBlind).toBe(true);
    expect(result.layer.notes.competitionScopedRestIsNotGlobalRest).toBe(true);
    expect(result.layer.notes.scheduleRestIsCompetitionSeasonOnly).toBe(true);
    expect(result.layer.scope).toBe("competition_season");
    // 19 days = 456 hours competition-scoped only
    expect(
      result.layer.home.competitionScopedRestHoursSincePreviousCompleted,
    ).toBe(19 * 24);
    expect(result.layer.home.components.scheduleCompetitionScoped.status).toBe(
      "USED",
    );
    // Validator rejects claiming blindness false
    const forged = {
      ...result.layer,
      crossCompetitionBlind: false as unknown as true,
    };
    expect(isPe4FormScheduleContextLayer(forged)).toBe(false);
  });
});

describe("PE-4D PE-3 stability / no mutation", () => {
  it("leaves C0 reconstruct outputs and digest unchanged; does not mutate input", () => {
    const universe = deepFreeze(
      goldenANormalMidSeason().map((r) => deepFreeze({ ...r })),
    );
    const target: PrematchStrengthTarget = { ...GOLDEN_TARGET };
    deepFreeze(target);

    const before = resolvePrematchStrengthFromUniverse({
      target,
      universe,
      evidenceAcquiredAtUtc: "2026-09-19T12:00:00.000Z",
    });

    const pe4a = extractPe4FormScheduleEvidence({
      target: GOLDEN_TARGET,
      universe,
      lastN: 5,
    });
    const pe4b = extractPe4FormScheduleEvidence({
      target: GOLDEN_TARGET,
      universe: shuffle([...universe]),
      lastN: 5,
    });
    expect(pe4a.ok && pe4b.ok).toBe(true);
    if (!pe4a.ok || !pe4b.ok) return;
    expect(pe4b.layer.evidenceDigest).toBe(pe4a.layer.evidenceDigest);
    expect(JSON.stringify(pe4a.layer.home.lastNMatches)).toBe(
      JSON.stringify(pe4b.layer.home.lastNMatches),
    );

    const after = resolvePrematchStrengthFromUniverse({
      target,
      universe,
      evidenceAcquiredAtUtc: "2026-09-19T12:00:00.000Z",
    });
    expect(after.homeElo).toBe(before.homeElo);
    expect(after.awayElo).toBe(before.awayElo);
    expect(after.acceptedEvidenceDigest).toBe(before.acceptedEvidenceDigest);
    expect(JSON.stringify(after.home)).toBe(JSON.stringify(before.home));
    expect(JSON.stringify(after.away)).toBe(JSON.stringify(before.away));
  });
});

describe("PE-4D historical opponent base audit", () => {
  it("documents common fixed baseline 1580 as relative index, not venue Elo", () => {
    expect(PE4C_OPPONENT_STRENGTH_RECONSTRUCTION_BASE).toBe(
      PRODUCTION_HOME_ELO_BASE,
    );
    expect(PRODUCTION_HOME_ELO_BASE - PRODUCTION_AWAY_ELO_BASE).toBe(60);

    const stats = { played: 4, wins: 3, goalsFor: 8, goalsAgainst: 2 };
    const atHomeBase = catalogueEloFromPlayedStats({
      base: PRODUCTION_HOME_ELO_BASE,
      ...stats,
    });
    const atAwayBase = catalogueEloFromPlayedStats({
      base: PRODUCTION_AWAY_ELO_BASE,
      ...stats,
    });
    // C0 formula is additive in base → exact 60-point shift
    expect(atHomeBase - atAwayBase).toBe(60);

    // Relative ranking across opponents preserved under shared baseline
    const strong = catalogueEloFromPlayedStats({
      base: PRODUCTION_HOME_ELO_BASE,
      played: 5,
      wins: 5,
      goalsFor: 12,
      goalsAgainst: 1,
    });
    const weak = catalogueEloFromPlayedStats({
      base: PRODUCTION_HOME_ELO_BASE,
      played: 5,
      wins: 0,
      goalsFor: 1,
      goalsAgainst: 12,
    });
    const strongAlt = catalogueEloFromPlayedStats({
      base: PRODUCTION_AWAY_ELO_BASE,
      played: 5,
      wins: 5,
      goalsFor: 12,
      goalsAgainst: 1,
    });
    const weakAlt = catalogueEloFromPlayedStats({
      base: PRODUCTION_AWAY_ELO_BASE,
      played: 5,
      wins: 0,
      goalsFor: 1,
      goalsAgainst: 12,
    });
    expect(strong > weak).toBe(true);
    expect(strongAlt > weakAlt).toBe(true);
    expect(strong - weak).toBe(strongAlt - weakAlt);

    const evidence = resolveHistoricalOpponentStrength({
      opponentTeamId: GOLDEN_HOME,
      matchFixtureId: "m",
      matchKickoffUtc: GOLDEN_TARGET_KICKOFF,
      competitionId: GOLDEN_TARGET.competitionId,
      season: GOLDEN_TARGET.season,
      universe: goldenECrossCompetitionBlindness(),
    });
    expect(evidence.opponentStrengthSemantics).toBe(
      PE4_OPPONENT_STRENGTH_SEMANTICS,
    );
    expect(evidence.comparableToVenueSpecificC0Elo).toBe(false);
  });
});

describe("PE-4D provenance validation rejects malformed claims", () => {
  it("rejects wrong version/scope/blindness and inconsistent side evidence", () => {
    const ok = extractPe4FormScheduleEvidence({
      target: GOLDEN_TARGET,
      universe: goldenBEarlySeason(),
      lastN: 5,
    });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    const layer = ok.layer;

    expect(
      isPe4FormScheduleContextLayer({ ...layer, layerVersion: "nope" }),
    ).toBe(false);
    expect(
      isPe4FormScheduleContextLayer({ ...layer, scope: "global" }),
    ).toBe(false);
    expect(
      isPe4FormScheduleContextLayer({
        ...layer,
        crossCompetitionBlind: false,
      }),
    ).toBe(false);
    expect(
      isPe4FormScheduleContextLayer({
        ...layer,
        historicalCutoffUtc: "not-a-date",
      }),
    ).toBe(false);
    expect(
      isPe4FormScheduleContextLayer({
        ...layer,
        evidenceDigest: "deadbeef",
      }),
    ).toBe(false);

    const badSide = {
      ...layer,
      home: {
        ...layer.home,
        actualLastN: 99,
        requestedLastN: 5,
      },
    };
    expect(isPe4FormScheduleContextLayer(badSide)).toBe(false);

    const badSelected = {
      ...layer,
      home: {
        ...layer.home,
        selectedFixtureIds: ["not-the-match"],
      },
    };
    expect(isPe4FormScheduleContextLayer(badSelected)).toBe(false);

    const match = layer.home.lastNMatches[0]!;
    const badCutoff = {
      ...layer,
      home: {
        ...layer.home,
        lastNMatches: [
          {
            ...match,
            opponentStrength: {
              ...match.opponentStrength,
              opponentStrengthCutoffUtc: "2000-01-01T00:00:00.000Z",
            },
          },
        ],
        orderedCompletedPriors: [
          {
            ...match,
            opponentStrength: {
              ...match.opponentStrength,
              opponentStrengthCutoffUtc: "2000-01-01T00:00:00.000Z",
            },
          },
        ],
        selectedFixtureIds: [match.fixtureId],
      },
    };
    expect(isPe4FormScheduleContextLayer(badCutoff)).toBe(false);

    const catalogueLie = {
      ...layer,
      home: {
        ...layer.home,
        lastNMatches: [
          {
            ...match,
            opponentStrength: {
              ...match.opponentStrength,
              opponentStrengthSource: "catalogue" as const,
              opponentStrengthPlayed: 0,
            },
          },
        ],
        orderedCompletedPriors: [
          {
            ...match,
            opponentStrength: {
              ...match.opponentStrength,
              opponentStrengthSource: "catalogue" as const,
              opponentStrengthPlayed: 0,
            },
          },
        ],
      },
    };
    expect(isPe4FormScheduleContextLayer(catalogueLie)).toBe(false);

    // Tampered digest fails recomputation check
    const badDigest = {
      ...layer,
      evidenceDigest: "a".repeat(64),
    };
    expect(isPe4FormScheduleContextLayer(badDigest)).toBe(false);
    expect(digestPe4FormScheduleContextLayer(layer)).toBe(layer.evidenceDigest);
  });
});

describe("PE-4D digest contract", () => {
  it("ignores evidenceAcquiredAtUtc and input order; changes on material evidence", () => {
    const universe = goldenANormalMidSeason();
    const a = extractPe4FormScheduleEvidence({
      target: GOLDEN_TARGET,
      universe,
      evidenceAcquiredAtUtc: "2026-09-19T01:00:00.000Z",
    });
    const b = extractPe4FormScheduleEvidence({
      target: GOLDEN_TARGET,
      universe: shuffle(universe),
      evidenceAcquiredAtUtc: "2026-09-19T23:00:00.000Z",
    });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.layer.evidenceDigest).toBe(b.layer.evidenceDigest);

    const mutated = [
      ...universe,
      {
        fixtureId: "extra-material",
        kickoffUtc: "2026-09-14T15:00:00.000Z",
        homeTeamId: GOLDEN_HOME,
        awayTeamId: "x",
        competitionId: GOLDEN_TARGET.competitionId,
        season: GOLDEN_TARGET.season,
        status: "FT",
        homeGoals: 1,
        awayGoals: 0,
      } satisfies PrematchStrengthUniverseFixture,
    ];
    const c = extractPe4FormScheduleEvidence({
      target: GOLDEN_TARGET,
      universe: mutated,
    });
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.layer.evidenceDigest).not.toBe(a.layer.evidenceDigest);
  });
});
