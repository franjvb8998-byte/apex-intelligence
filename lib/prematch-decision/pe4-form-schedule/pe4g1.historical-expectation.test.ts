/**
 * PE-4G.1 — Two-sided historical strength + expectation contract tests.
 * Offline only. No invented Elo→P/GD mappings.
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_HYBRID_CONFIG,
} from "@/lib/intelligence/modules/probability/hybrid/config";
import {
  extractPe4FormScheduleEvidence,
  isPe4FormScheduleContextLayer,
  PE4_COMMON_BASELINE_STRENGTH_SEMANTICS,
  PE4_FAIL_CLOSED_MATRIX,
  PE4_FORM_SCHEDULE_EVIDENCE_DIGEST_VERSION,
  PE4_HISTORICAL_EXPECTATION_ENGINE_REUSE_AUDIT,
  PE4_HISTORICAL_EXPECTATION_MODEL_VERSION,
  PE4_HISTORICAL_EXPECTATION_UNAVAILABLE_REASON,
  PE4C_OPPONENT_STRENGTH_RECONSTRUCTION_BASE,
  resolveHistoricalTargetStrength,
  resolvePe4HistoricalExpectation,
  type Pe4FormScheduleTarget,
} from "@/lib/prematch-decision/pe4-form-schedule";
import type { PrematchStrengthUniverseFixture } from "@/lib/match-center/prematch-strength/types";
import { PE3C_C0_RECON_ACTIVATION } from "@/lib/prematch-lifecycle/pe3-activation";

const TARGET_KICKOFF = "2026-09-20T15:00:00.000Z";
const COMP = "comp-g1";
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

function baseUniverse(): PrematchStrengthUniverseFixture[] {
  return [
    prior({
      fixtureId: "home-pre-1",
      kickoffUtc: "2026-09-01T15:00:00.000Z",
      homeTeamId: HOME,
      awayTeamId: OTHER,
      homeGoals: 2,
      awayGoals: 0,
    }),
    prior({
      fixtureId: "opp-pre-1",
      kickoffUtc: "2026-09-02T15:00:00.000Z",
      homeTeamId: OPP,
      awayTeamId: OTHER,
      homeGoals: 1,
      awayGoals: 0,
    }),
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

describe("PE-4G.1 activation / fail-closed", () => {
  it("keeps activation false", () => {
    expect(PE3C_C0_RECON_ACTIVATION).toBe(false);
  });

  it("extends fail-closed for expectation/residual unavailable", () => {
    expect(
      PE4_FAIL_CLOSED_MATRIX.expectation_model_unavailable.extractionFatal,
    ).toBe(false);
    expect(PE4_FAIL_CLOSED_MATRIX.residual_unavailable.pe3FallbackEligible).toBe(
      true,
    );
    expect(
      PE4_FAIL_CLOSED_MATRIX.target_historical_strength_unavailable
        .pe3FallbackEligible,
    ).toBe(true);
  });
});

describe("PE-4G.1 target historical strength", () => {
  it("includes pre-M target evidence; excludes M / same-kickoff / post-M", () => {
    const universe = [
      ...baseUniverse(),
      prior({
        fixtureId: "home-same-kick",
        kickoffUtc: MATCH_M_KICKOFF,
        homeTeamId: HOME,
        awayTeamId: OTHER,
      }),
      prior({
        fixtureId: "home-post-M",
        kickoffUtc: "2026-09-12T15:00:00.000Z",
        homeTeamId: HOME,
        awayTeamId: OTHER,
        homeGoals: 5,
        awayGoals: 0,
      }),
    ];
    const result = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe,
      lastN: 5,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const m = result.layer.home.orderedCompletedPriors.find(
      (r) => r.fixtureId === MATCH_M_ID,
    )!;
    expect(m.targetStrength.targetStrengthAvailable).toBe(true);
    expect(m.targetStrength.targetStrengthSource).toBe("catalogue");
    expect(m.targetStrength.targetStrengthPlayed).toBe(1);
    expect(m.targetStrength.targetStrengthCutoffUtc).toBe(MATCH_M_KICKOFF);
    expect(m.targetStrength.targetStrengthReconstructionBase).toBe(
      PE4C_OPPONENT_STRENGTH_RECONSTRUCTION_BASE,
    );
    expect(m.targetStrength.targetStrengthSemantics).toBe(
      PE4_COMMON_BASELINE_STRENGTH_SEMANTICS,
    );
    expect(m.targetStrength.comparableToVenueSpecificC0Elo).toBe(false);

    const lean = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: baseUniverse(),
      lastN: 5,
    });
    expect(lean.ok).toBe(true);
    if (!lean.ok) return;
    const mLean = lean.layer.home.orderedCompletedPriors.find(
      (r) => r.fixtureId === MATCH_M_ID,
    )!;
    expect(m.targetStrength.targetStrengthAsOfMatchKickoff).toBe(
      mLean.targetStrength.targetStrengthAsOfMatchKickoff,
    );
    expect(m.targetStrength.targetStrengthPlayed).toBe(
      mLean.targetStrength.targetStrengthPlayed,
    );
  });

  it("represents base_prior when no pre-M target evidence", () => {
    const universe = [
      prior({
        fixtureId: "opp-pre-1",
        kickoffUtc: "2026-09-02T15:00:00.000Z",
        homeTeamId: OPP,
        awayTeamId: OTHER,
      }),
      prior({
        fixtureId: MATCH_M_ID,
        kickoffUtc: MATCH_M_KICKOFF,
        homeTeamId: HOME,
        awayTeamId: OPP,
      }),
    ];
    const result = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe,
      lastN: 5,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const m = result.layer.home.lastNMatches[0]!;
    expect(m.targetStrength.targetStrengthSource).toBe("base_prior");
    expect(m.targetStrength.targetStrengthPlayed).toBe(0);
    expect(m.targetStrength.targetStrengthAvailable).toBe(true);
  });

  it("pre-M target evidence can change target strength", () => {
    const a = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: [
        prior({
          fixtureId: MATCH_M_ID,
          kickoffUtc: MATCH_M_KICKOFF,
          homeTeamId: HOME,
          awayTeamId: OPP,
        }),
      ],
      lastN: 5,
    });
    const b = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: baseUniverse(),
      lastN: 5,
    });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    const ma = a.layer.home.orderedCompletedPriors.find(
      (r) => r.fixtureId === MATCH_M_ID,
    )!;
    const mb = b.layer.home.orderedCompletedPriors.find(
      (r) => r.fixtureId === MATCH_M_ID,
    )!;
    expect(ma.targetStrength.targetStrengthPlayed).toBe(0);
    expect(mb.targetStrength.targetStrengthPlayed).toBe(1);
    expect(mb.targetStrength.targetStrengthAsOfMatchKickoff).not.toBe(
      ma.targetStrength.targetStrengthAsOfMatchKickoff,
    );
  });
});

describe("PE-4G.1 pairwise context", () => {
  it("uses identical common base; differential = target − opponent", () => {
    const result = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: baseUniverse(),
      lastN: 5,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const m = result.layer.home.orderedCompletedPriors.find(
      (r) => r.fixtureId === MATCH_M_ID,
    )!;
    const p = m.pairwiseHistoricalStrength;
    expect(p.commonReconstructionBase).toBe(
      m.opponentStrength.opponentStrengthReconstructionBase,
    );
    expect(p.commonReconstructionBase).toBe(
      m.targetStrength.targetStrengthReconstructionBase,
    );
    expect(p.pairwiseAvailable).toBe(true);
    expect(p.strengthDifferential).toBe(
      p.targetCommonIndex! - p.opponentCommonIndex!,
    );
    expect(p.targetVenueRole).toBe("HOME");
    expect(p.qualityKind).toBe("catalogue_catalogue");
    expect(p.semantics).toBe(PE4_COMMON_BASELINE_STRENGTH_SEMANTICS);
  });

  it("shuffled universe yields identical pairwise context", () => {
    const u = baseUniverse();
    const a = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: u,
      lastN: 5,
    });
    const b = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: shuffle(u),
      lastN: 5,
    });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.layer.home.orderedCompletedPriors.find((r) => r.fixtureId === MATCH_M_ID)!
      .pairwiseHistoricalStrength).toEqual(
      b.layer.home.orderedCompletedPriors.find((r) => r.fixtureId === MATCH_M_ID)!
        .pairwiseHistoricalStrength,
    );
    expect(a.layer.evidenceDigest).toBe(b.layer.evidenceDigest);
    expect(isPe4FormScheduleContextLayer(a.layer)).toBe(true);
  });

  it("represents mixed quality combinations", () => {
    // HOME catalogue, OPP base_prior
    const result = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: [
        prior({
          fixtureId: "home-pre-1",
          kickoffUtc: "2026-09-01T15:00:00.000Z",
          homeTeamId: HOME,
          awayTeamId: OTHER,
        }),
        prior({
          fixtureId: MATCH_M_ID,
          kickoffUtc: MATCH_M_KICKOFF,
          homeTeamId: HOME,
          awayTeamId: OPP,
        }),
      ],
      lastN: 5,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const p = result.layer.home.orderedCompletedPriors.find(
      (r) => r.fixtureId === MATCH_M_ID,
    )!.pairwiseHistoricalStrength;
    expect(p.qualityKind).toBe("catalogue_base_prior");
    expect(p.targetSource).toBe("catalogue");
    expect(p.opponentSource).toBe("base_prior");
  });
});

describe("PE-4G.1 leakage invariants", () => {
  it("post-M target results do not alter target strength at M", () => {
    const lean = baseUniverse();
    const trap = [
      ...lean,
      prior({
        fixtureId: "home-post",
        kickoffUtc: "2026-09-15T15:00:00.000Z",
        homeTeamId: HOME,
        awayTeamId: OTHER,
        homeGoals: 7,
        awayGoals: 0,
      }),
    ];
    const a = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: lean,
      lastN: 5,
    });
    const b = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: trap,
      lastN: 5,
    });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    const ma = a.layer.home.orderedCompletedPriors.find(
      (r) => r.fixtureId === MATCH_M_ID,
    )!;
    const mb = b.layer.home.orderedCompletedPriors.find(
      (r) => r.fixtureId === MATCH_M_ID,
    )!;
    expect(mb.targetStrength).toEqual(ma.targetStrength);
    expect(mb.pairwiseHistoricalStrength).toEqual(ma.pairwiseHistoricalStrength);
  });

  it("post-M opponent results do not alter opponent strength at M", () => {
    const lean = baseUniverse();
    const trap = [
      ...lean,
      prior({
        fixtureId: "opp-post",
        kickoffUtc: "2026-09-15T15:00:00.000Z",
        homeTeamId: OPP,
        awayTeamId: OTHER,
        homeGoals: 7,
        awayGoals: 0,
      }),
    ];
    const a = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: lean,
      lastN: 5,
    });
    const b = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: trap,
      lastN: 5,
    });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    const ma = a.layer.home.orderedCompletedPriors.find(
      (r) => r.fixtureId === MATCH_M_ID,
    )!;
    const mb = b.layer.home.orderedCompletedPriors.find(
      (r) => r.fixtureId === MATCH_M_ID,
    )!;
    expect(mb.opponentStrength).toEqual(ma.opponentStrength);
  });

  it("pre-M opponent evidence can alter opponent strength", () => {
    const thin = [
      prior({
        fixtureId: MATCH_M_ID,
        kickoffUtc: MATCH_M_KICKOFF,
        homeTeamId: HOME,
        awayTeamId: OPP,
      }),
    ];
    const thick = baseUniverse();
    const a = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: thin,
      lastN: 5,
    });
    const b = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: thick,
      lastN: 5,
    });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(
      a.layer.home.orderedCompletedPriors.find((r) => r.fixtureId === MATCH_M_ID)!
        .opponentStrength.opponentStrengthPlayed,
    ).toBe(0);
    expect(
      b.layer.home.orderedCompletedPriors.find((r) => r.fixtureId === MATCH_M_ID)!
        .opponentStrength.opponentStrengthPlayed,
    ).toBe(1);
  });

  it("M itself never enters target reconstruction", () => {
    const strength = resolveHistoricalTargetStrength({
      targetTeamId: HOME,
      matchFixtureId: MATCH_M_ID,
      matchKickoffUtc: MATCH_M_KICKOFF,
      competitionId: COMP,
      season: SEASON,
      universe: baseUniverse(),
    });
    // Only home-pre-1 before M; M excluded → played 1 not 2
    expect(strength.targetStrengthPlayed).toBe(1);
    expect(strength.targetStrengthAvailable).toBe(true);
  });
});

describe("PE-4G.1 expectation / residual contract", () => {
  it("documents EloPoisson not reusable; emits no numeric expectation", () => {
    expect(PE4_HISTORICAL_EXPECTATION_ENGINE_REUSE_AUDIT.eloPoissonHybridReusable).toBe(
      false,
    );
    expect(DEFAULT_HYBRID_CONFIG.homeAdvantageElo).toBe(65);
    const exp = resolvePe4HistoricalExpectation({
      targetStrengthCommon: 1600,
      opponentStrengthCommon: 1550,
      targetVenueRole: "HOME",
      pairwiseAvailable: true,
      historicalCutoffUtc: MATCH_M_KICKOFF,
      targetSource: "catalogue",
      opponentSource: "catalogue",
    });
    expect(exp.status).toBe("UNAVAILABLE");
    expect(exp.reason).toBe(PE4_HISTORICAL_EXPECTATION_UNAVAILABLE_REASON);
    expect(exp.modelVersion).toBe(PE4_HISTORICAL_EXPECTATION_MODEL_VERSION);
    expect(exp.expectedHomeWinProbability).toBeNull();
    expect(exp.expectedPointsFromTargetPerspective).toBeNull();
    expect(exp.expectedGoalDifferenceFromTargetPerspective).toBeNull();
    expect(exp.auditNotes.noArbitraryMappingEmitted).toBe(true);
  });

  it("extract emits UNAVAILABLE expectation and residual on every prior", () => {
    const result = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: baseUniverse(),
      lastN: 5,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const m of result.layer.home.orderedCompletedPriors) {
      expect(m.historicalExpectation.status).toBe("UNAVAILABLE");
      expect(m.historicalExpectation.reason).toBe(
        PE4_HISTORICAL_EXPECTATION_UNAVAILABLE_REASON,
      );
      expect(m.historicalResidual.status).toBe("UNAVAILABLE");
      expect(m.historicalResidual.resultResidual).toBeNull();
      expect(m.historicalResidual.goalDifferenceResidual).toBeNull();
      expect(m.historicalResidual.observedResultEncoding).toBeNull();
    }
    expect(result.layer.notes.historicalExpectationModel).toBe(
      "undefined_pending_compatible_mapping",
    );
  });
});

describe("PE-4G.1 digest", () => {
  it("includes target strength as material; post-M cannot change M digest slice", () => {
    expect(PE4_FORM_SCHEDULE_EVIDENCE_DIGEST_VERSION).toBe("3");
    const lean = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: baseUniverse(),
      lastN: 5,
      evidenceAcquiredAtUtc: "2026-09-19T00:00:00.000Z",
    });
    const trap = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: [
        ...baseUniverse(),
        prior({
          fixtureId: "home-post",
          kickoffUtc: "2026-09-18T15:00:00.000Z",
          homeTeamId: HOME,
          awayTeamId: OTHER,
          homeGoals: 9,
          awayGoals: 0,
        }),
      ],
      lastN: 5,
      evidenceAcquiredAtUtc: "2099-01-01T00:00:00.000Z",
    });
    expect(lean.ok && trap.ok).toBe(true);
    if (!lean.ok || !trap.ok) return;
    // Digests differ because trap has an extra prior for HOME overall,
    // but M's pairwise representation must be identical.
    const mLean = lean.layer.home.orderedCompletedPriors.find(
      (r) => r.fixtureId === MATCH_M_ID,
    )!;
    const mTrap = trap.layer.home.orderedCompletedPriors.find(
      (r) => r.fixtureId === MATCH_M_ID,
    )!;
    expect(mTrap.pairwiseHistoricalStrength).toEqual(
      mLean.pairwiseHistoricalStrength,
    );
    expect(mTrap.targetStrength).toEqual(mLean.targetStrength);

    // Pre-M evidence change alters pairwise / digest
    const thin = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: [
        prior({
          fixtureId: MATCH_M_ID,
          kickoffUtc: MATCH_M_KICKOFF,
          homeTeamId: HOME,
          awayTeamId: OPP,
        }),
      ],
      lastN: 5,
    });
    expect(thin.ok).toBe(true);
    if (!thin.ok) return;
    expect(thin.layer.evidenceDigest).not.toBe(lean.layer.evidenceDigest);
  });
});
