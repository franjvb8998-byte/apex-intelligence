/**
 * PE-4B — Offline competition-scoped form & schedule evidence tests.
 * No provider / Supabase / production writes.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  resolvePrematchStrengthFromUniverse,
  type PrematchStrengthTarget,
  type PrematchStrengthUniverseFixture,
} from "@/lib/match-center/prematch-strength";
import {
  provenanceForBasePriorLifecycle,
  provenanceFromC0Strength,
  isPrematchInputProvenance,
} from "@/lib/prematch-decision/input-provenance";
import {
  digestPe4FormScheduleContextLayer,
  extractPe4FormScheduleEvidence,
  isPe4FormScheduleContextLayer,
  PE4_DEFAULT_LAST_N,
  PE4_FORM_SCHEDULE_CONTEXT_LAYER_KEY,
  PE4_FORM_SCHEDULE_LAYER_VERSION,
  readPe4FormScheduleContextLayer,
  withPe4FormScheduleContextLayer,
  type Pe4FormScheduleTarget,
} from "@/lib/prematch-decision/pe4-form-schedule";
import { PE3C_C0_RECON_ACTIVATION } from "@/lib/prematch-lifecycle/pe3-activation";

const TARGET_KICKOFF = "2026-09-20T15:00:00.000Z";
const COMP = "comp-1";
const SEASON = "2026";
const HOME = "team-home";
const AWAY = "team-away";
const OTHER = "team-other";

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
    kickoffUtc: "2026-09-10T15:00:00.000Z",
    homeTeamId: HOME,
    awayTeamId: OTHER,
    competitionId: COMP,
    season: SEASON,
    status: "FT",
    homeGoals: 2,
    awayGoals: 0,
    ...partial,
  };
}

function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  // Deterministic Fisher–Yates with fixed seed-ish swaps
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = (i * 7 + 3) % (i + 1);
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

describe("PE-4B activation / safety invariants", () => {
  it("keeps PE3C_C0_RECON_ACTIVATION false", () => {
    expect(PE3C_C0_RECON_ACTIVATION).toBe(false);
  });

  it("documents default last-N as 5 (Match Center recent window)", () => {
    expect(PE4_DEFAULT_LAST_N).toBe(5);
  });

  it("does not import provider or teams/statistics in pe4 module", () => {
    const root = join(process.cwd(), "lib/prematch-decision/pe4-form-schedule");
    for (const file of [
      "extract.ts",
      "digest.ts",
      "provenance.ts",
      "types.ts",
      "index.ts",
      "opponent-strength.ts",
    ]) {
      const src = readFileSync(join(root, file), "utf8");
      expect(src).not.toMatch(/api-football|getTeamLastFixtures|teams\/statistics|supabase/i);
    }
  });
});

describe("PE-4B temporal guards", () => {
  it("includes prior kickoff strictly before target", () => {
    const result = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: [
        prior({
          fixtureId: "1",
          kickoffUtc: "2026-09-19T15:00:00.000Z",
          homeGoals: 1,
          awayGoals: 0,
        }),
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.layer.home.actualLastN).toBe(1);
    expect(result.layer.home.selectedFixtureIds).toEqual(["1"]);
  });

  it("excludes same-kickoff fixtures", () => {
    const result = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: [
        prior({
          fixtureId: "same",
          kickoffUtc: TARGET_KICKOFF,
          homeGoals: 3,
          awayGoals: 0,
        }),
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.layer.home.actualLastN).toBe(0);
    expect(result.layer.home.components.recentForm).toEqual({
      status: "UNAVAILABLE",
      reason: "no_completed_priors",
    });
  });

  it("excludes future fixtures", () => {
    const result = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: [
        prior({
          fixtureId: "future",
          kickoffUtc: "2026-09-25T15:00:00.000Z",
        }),
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.layer.home.actualLastN).toBe(0);
  });

  it("excludes the target fixture itself", () => {
    const result = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: [
        prior({
          fixtureId: "fx-target",
          kickoffUtc: "2026-09-10T15:00:00.000Z",
        }),
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.layer.home.selectedFixtureIds).toEqual([]);
  });
});

describe("PE-4B status filters", () => {
  const cases: Array<{ status: string; include: boolean }> = [
    { status: "FT", include: true },
    { status: "AET", include: true },
    { status: "PEN", include: true },
    { status: "NS", include: false },
    { status: "LIVE", include: false },
    { status: "PST", include: false },
    { status: "CANC", include: false },
    { status: "ABD", include: false },
    { status: "AWD", include: false },
    { status: "WO", include: false },
  ];

  for (const row of cases) {
    it(`${row.status} → ${row.include ? "included" : "excluded"}`, () => {
      const result = extractPe4FormScheduleEvidence({
        target: TARGET,
        universe: [
          prior({
            fixtureId: `st-${row.status}`,
            status: row.status,
            homeGoals: 1,
            awayGoals: 0,
          }),
        ],
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.layer.home.actualLastN).toBe(row.include ? 1 : 0);
    });
  }
});

describe("PE-4B ordering / trajectory stability", () => {
  const universe = [
    prior({
      fixtureId: "c",
      kickoffUtc: "2026-09-12T15:00:00.000Z",
      homeGoals: 0,
      awayGoals: 1,
    }),
    prior({
      fixtureId: "a",
      kickoffUtc: "2026-09-05T15:00:00.000Z",
      homeGoals: 2,
      awayGoals: 2,
    }),
    prior({
      fixtureId: "b",
      kickoffUtc: "2026-09-10T15:00:00.000Z",
      homeGoals: 3,
      awayGoals: 1,
    }),
    // kickoff tie → fixtureId tie-break
    prior({
      fixtureId: "tie-b",
      kickoffUtc: "2026-09-08T15:00:00.000Z",
      awayTeamId: "team-x",
      homeGoals: 1,
      awayGoals: 0,
    }),
    prior({
      fixtureId: "tie-a",
      kickoffUtc: "2026-09-08T15:00:00.000Z",
      awayTeamId: "team-y",
      homeGoals: 1,
      awayGoals: 1,
    }),
  ];

  it("shuffled universe yields identical digest and ordered evidence", () => {
    const base = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe,
      lastN: 5,
    });
    const shuffled = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: shuffle(universe),
      lastN: 5,
    });
    expect(base.ok && shuffled.ok).toBe(true);
    if (!base.ok || !shuffled.ok) return;
    expect(shuffled.layer.evidenceDigest).toBe(base.layer.evidenceDigest);
    expect(shuffled.layer.home.orderedCompletedPriors.map((m) => m.fixtureId)).toEqual(
      base.layer.home.orderedCompletedPriors.map((m) => m.fixtureId),
    );
    expect(
      shuffled.layer.home.orderedCompletedPriors.map((m) => m.fixtureId),
    ).toEqual(["a", "tie-a", "tie-b", "b", "c"]);
  });

  it("resolves kickoff ties by fixtureId", () => {
    const result = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = result.layer.home.orderedCompletedPriors.map((m) => m.fixtureId);
    const iA = ids.indexOf("tie-a");
    const iB = ids.indexOf("tie-b");
    expect(iA).toBeGreaterThanOrEqual(0);
    expect(iB).toBeGreaterThan(iA);
  });
});

describe("PE-4B result / venue role evidence", () => {
  it("computes W/D/L and GF/GA/GD from team perspective", () => {
    const result = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: [
        prior({
          fixtureId: "h-win",
          kickoffUtc: "2026-09-01T15:00:00.000Z",
          homeTeamId: HOME,
          awayTeamId: OTHER,
          homeGoals: 2,
          awayGoals: 0,
        }),
        prior({
          fixtureId: "a-draw",
          kickoffUtc: "2026-09-05T15:00:00.000Z",
          homeTeamId: OTHER,
          awayTeamId: HOME,
          homeGoals: 1,
          awayGoals: 1,
        }),
        prior({
          fixtureId: "a-loss",
          kickoffUtc: "2026-09-08T15:00:00.000Z",
          homeTeamId: OTHER,
          awayTeamId: HOME,
          homeGoals: 3,
          awayGoals: 0,
        }),
      ],
      lastN: 5,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const agg = result.layer.home.lastNAggregate;
    expect(agg.wins).toBe(1);
    expect(agg.draws).toBe(1);
    expect(agg.losses).toBe(1);
    expect(agg.goalsFor).toBe(2 + 1 + 0);
    expect(agg.goalsAgainst).toBe(0 + 1 + 3);
    expect(agg.goalDifference).toBe(3 - 4);
    expect(
      result.layer.home.lastNMatches.map((m) => m.venueRole),
    ).toEqual(["HOME", "AWAY", "AWAY"]);
  });
});

describe("PE-4B last-N policy", () => {
  const many = [1, 2, 3, 4, 5, 6, 7].map((n) =>
    prior({
      fixtureId: `m${n}`,
      kickoffUtc: `2026-09-${String(n).padStart(2, "0")}T15:00:00.000Z`,
      homeGoals: 1,
      awayGoals: 0,
    }),
  );

  it("honors requested N and records actual N", () => {
    const result = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: many,
      lastN: 3,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.layer.requestedLastN).toBe(3);
    expect(result.layer.home.requestedLastN).toBe(3);
    expect(result.layer.home.actualLastN).toBe(3);
    expect(result.layer.home.selectedFixtureIds).toEqual(["m5", "m6", "m7"]);
    // chronological oldest→newest within last-N
    expect(
      result.layer.home.lastNMatches.map((m) => m.fixtureId),
    ).toEqual(["m5", "m6", "m7"]);
  });

  it("does not pad when fewer than requested N", () => {
    const result = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: many.slice(0, 2),
      lastN: 5,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.layer.home.requestedLastN).toBe(5);
    expect(result.layer.home.actualLastN).toBe(2);
    expect(result.layer.home.selectedFixtureIds).toHaveLength(2);
  });

  it("rejects invalid lastN", () => {
    const result = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: many,
      lastN: 0,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("invalid_last_n");
  });
});

describe("PE-4B rest / congestion windows", () => {
  it("selects previous completed and computes deterministic rest hours", () => {
    const prev = "2026-09-17T15:00:00.000Z"; // 72 hours before target
    const result = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: [
        prior({
          fixtureId: "prev",
          kickoffUtc: prev,
          homeGoals: 1,
          awayGoals: 0,
        }),
        prior({
          fixtureId: "older",
          kickoffUtc: "2026-09-01T15:00:00.000Z",
          homeGoals: 0,
          awayGoals: 0,
        }),
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.layer.home.previousCompletedKickoffUtc).toBe(prev);
    expect(result.layer.home.competitionScopedRestHoursSincePreviousCompleted).toBe(72);
  });

  it("applies inclusive lower-bound window edges for 7/14/21/28 days", () => {
    const exact7 = "2026-09-13T15:00:00.000Z"; // T − 7d
    const justInside7 = "2026-09-13T15:00:00.001Z";
    const justOutside7 = "2026-09-13T14:59:59.999Z";
    const exact14 = "2026-09-06T15:00:00.000Z";
    const exact21 = "2026-08-30T15:00:00.000Z";
    const exact28 = "2026-08-23T15:00:00.000Z";
    const outside28 = "2026-08-23T14:59:59.999Z";

    const result = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: [
        prior({ fixtureId: "e7", kickoffUtc: exact7 }),
        prior({ fixtureId: "i7", kickoffUtc: justInside7 }),
        prior({ fixtureId: "o7", kickoffUtc: justOutside7 }),
        prior({ fixtureId: "e14", kickoffUtc: exact14 }),
        prior({ fixtureId: "e21", kickoffUtc: exact21 }),
        prior({ fixtureId: "e28", kickoffUtc: exact28 }),
        prior({ fixtureId: "o28", kickoffUtc: outside28 }),
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const w = result.layer.home.competitionScopedMatchesInWindows;
    // 7d: exact7 + inside7 (outside7 is before lower bound)
    expect(w.previous7Days).toBe(2);
    // 14d: previous7 + exact14 + outside7 (outside7 is within 14d)
    expect(w.previous14Days).toBe(4); // e7,i7,o7,e14
    expect(w.previous21Days).toBe(5); // + e21
    expect(w.previous28Days).toBe(6); // + e28; o28 excluded
  });

  it("does not let postponed / non-completed fixtures affect rest or congestion", () => {
    const result = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: [
        prior({
          fixtureId: "real",
          kickoffUtc: "2026-09-10T15:00:00.000Z",
          homeGoals: 1,
          awayGoals: 0,
        }),
        prior({
          fixtureId: "pst",
          kickoffUtc: "2026-09-18T15:00:00.000Z",
          status: "PST",
          homeGoals: null,
          awayGoals: null,
        }),
        prior({
          fixtureId: "ns",
          kickoffUtc: "2026-09-19T15:00:00.000Z",
          status: "NS",
          homeGoals: null,
          awayGoals: null,
        }),
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.layer.home.previousCompletedKickoffUtc).toBe(
      "2026-09-10T15:00:00.000Z",
    );
    expect(result.layer.home.competitionScopedMatchesInWindows.previous28Days).toBe(1);
    expect(result.layer.home.actualLastN).toBe(1);
  });
});

describe("PE-4B duplicates", () => {
  it("counts exact duplicate rows once", () => {
    const row = prior({
      fixtureId: "dup",
      kickoffUtc: "2026-09-10T15:00:00.000Z",
      homeGoals: 2,
      awayGoals: 1,
    });
    const result = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: [row, { ...row }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.layer.home.actualLastN).toBe(1);
    expect(result.layer.home.orderedCompletedPriors).toHaveLength(1);
  });

  it("fails closed on conflicting duplicate evidence", () => {
    const result = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: [
        prior({
          fixtureId: "conflict",
          homeGoals: 2,
          awayGoals: 0,
        }),
        prior({
          fixtureId: "conflict",
          homeGoals: 0,
          awayGoals: 2,
        }),
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("conflicting_duplicate_fixture");
    expect(result.fixtureId).toBe("conflict");
  });
});

describe("PE-4B malformed evidence", () => {
  it("fails closed on malformed target", () => {
    const result = extractPe4FormScheduleEvidence({
      target: { ...TARGET, kickoffUtc: "not-a-date" },
      universe: [prior({ fixtureId: "1" })],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("malformed_target");
  });

  it("skips invalid kickoff / goals / identities without fabricating", () => {
    const result = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: [
        prior({
          fixtureId: "bad-kick",
          kickoffUtc: "bogus",
          homeGoals: 1,
          awayGoals: 0,
        }),
        prior({
          fixtureId: "bad-goals",
          homeGoals: Number.NaN,
          awayGoals: 0,
        }),
        prior({
          fixtureId: "neg-goals",
          homeGoals: -1,
          awayGoals: 0,
        }),
        prior({
          fixtureId: "same-teams",
          homeTeamId: HOME,
          awayTeamId: HOME,
          homeGoals: 1,
          awayGoals: 0,
        }),
        prior({
          fixtureId: "empty-status",
          status: "",
          homeGoals: 1,
          awayGoals: 0,
        }),
        prior({
          fixtureId: "good",
          homeGoals: 1,
          awayGoals: 0,
        }),
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.layer.home.selectedFixtureIds).toEqual(["good"]);
    expect(result.layer.home.actualLastN).toBe(1);
  });
});

describe("PE-4B provenance / digest", () => {
  const universe = [
    prior({
      fixtureId: "1",
      kickoffUtc: "2026-09-05T15:00:00.000Z",
      homeGoals: 2,
      awayGoals: 1,
    }),
    prior({
      fixtureId: "2",
      kickoffUtc: "2026-09-12T15:00:00.000Z",
      homeTeamId: OTHER,
      awayTeamId: HOME,
      homeGoals: 0,
      awayGoals: 0,
    }),
    prior({
      fixtureId: "away-1",
      kickoffUtc: "2026-09-08T15:00:00.000Z",
      homeTeamId: AWAY,
      awayTeamId: OTHER,
      homeGoals: 1,
      awayGoals: 3,
    }),
  ];

  it("builds valid context layer with crossCompetitionBlind", () => {
    const result = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe,
      evidenceAcquiredAtUtc: "2026-09-19T12:00:00.000Z",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(isPe4FormScheduleContextLayer(result.layer)).toBe(true);
    expect(result.layer.layerVersion).toBe(PE4_FORM_SCHEDULE_LAYER_VERSION);
    expect(result.layer.crossCompetitionBlind).toBe(true);
    expect(result.layer.scope).toBe("competition_season");
    // PE-4C: historical opponent strength is available on selected priors
    expect(result.layer.home.components.opponentAdjustedForm.status).toBe(
      "USED",
    );
    expect(result.layer.notes.opponentAdjustedForm).toBe(
      "historical_time_c0_evidence_pe4c",
    );
    expect(result.layer.notes.opponentStrengthNeverUsesTargetKickoff).toBe(
      true,
    );
    expect(result.layer.home.components.trajectoryClassification).toEqual({
      status: "UNAVAILABLE",
      reason: "trajectory_classification_deferred",
    });
    expect(result.layer.notes.neutralGroundUnavailableInSeasonUniverse).toBe(
      true,
    );
  });

  it("selected fixture ids reproduce last-N evidence", () => {
    const result = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe,
      lastN: 2,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.layer.home.selectedFixtureIds).toEqual(
      result.layer.home.lastNMatches.map((m) => m.fixtureId),
    );
  });

  it("digest is stable under shuffle and ignores evidenceAcquiredAtUtc", () => {
    const a = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe,
      evidenceAcquiredAtUtc: "2026-09-19T12:00:00.000Z",
    });
    const b = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: shuffle(universe),
      evidenceAcquiredAtUtc: "2026-09-19T18:00:00.000Z",
    });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.layer.evidenceDigest).toBe(b.layer.evidenceDigest);
    expect(digestPe4FormScheduleContextLayer(a.layer)).toBe(
      a.layer.evidenceDigest,
    );
    expect(a.layer.evidenceAcquiredAtUtc).not.toBe(b.layer.evidenceAcquiredAtUtc);
  });

  it("digest changes when material evidence changes", () => {
    const a = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe,
    });
    const b = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: [
        ...universe,
        prior({
          fixtureId: "extra",
          kickoffUtc: "2026-09-15T15:00:00.000Z",
          homeGoals: 5,
          awayGoals: 0,
        }),
      ],
    });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.layer.evidenceDigest).not.toBe(b.layer.evidenceDigest);
  });

  it("attaches to provenance without breaking PE-3 validation", () => {
    const extracted = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe,
    });
    expect(extracted.ok).toBe(true);
    if (!extracted.ok) return;
    const base = provenanceForBasePriorLifecycle({
      modelVersion: "elo-poisson-hybrid-0.1.0",
      evidenceAcquiredAtUtc: "2026-09-19T12:00:00.000Z",
    });
    expect(base.contextLayers).toEqual({});
    const withLayer = withPe4FormScheduleContextLayer(base, extracted.layer);
    expect(isPrematchInputProvenance(withLayer)).toBe(true);
    expect(readPe4FormScheduleContextLayer(withLayer)?.evidenceDigest).toBe(
      extracted.layer.evidenceDigest,
    );
    expect(withLayer.contextLayers[PE4_FORM_SCHEDULE_CONTEXT_LAYER_KEY]).toBe(
      extracted.layer,
    );
    // Absent PE-4 layer still valid PE-3
    expect(isPrematchInputProvenance(base)).toBe(true);
    expect(readPe4FormScheduleContextLayer(base)).toBeNull();
  });
});

describe("PE-4B PE-3 regression (C0 reconstruct unchanged)", () => {
  it("same universe still yields identical C0 Elo with PE-4 extractor present", () => {
    const universe: PrematchStrengthUniverseFixture[] = [
      prior({
        fixtureId: "h1",
        kickoffUtc: "2026-09-01T15:00:00.000Z",
        homeTeamId: HOME,
        awayTeamId: OTHER,
        homeGoals: 2,
        awayGoals: 0,
      }),
      prior({
        fixtureId: "a1",
        kickoffUtc: "2026-09-05T15:00:00.000Z",
        homeTeamId: OTHER,
        awayTeamId: AWAY,
        homeGoals: 0,
        awayGoals: 1,
      }),
      prior({
        fixtureId: "h2",
        kickoffUtc: "2026-09-10T15:00:00.000Z",
        homeTeamId: HOME,
        awayTeamId: AWAY,
        homeGoals: 1,
        awayGoals: 1,
      }),
    ];
    const c0Target: PrematchStrengthTarget = { ...TARGET };
    const strength = resolvePrematchStrengthFromUniverse({
      target: c0Target,
      universe,
      evidenceAcquiredAtUtc: "2026-09-19T12:00:00.000Z",
    });
    const pe4 = extractPe4FormScheduleEvidence({
      target: TARGET,
      universe: shuffle(universe),
      evidenceAcquiredAtUtc: "2026-09-19T12:00:00.000Z",
    });
    expect(pe4.ok).toBe(true);
    const strengthAgain = resolvePrematchStrengthFromUniverse({
      target: c0Target,
      universe,
      evidenceAcquiredAtUtc: "2026-09-19T12:00:00.000Z",
    });
    expect(strengthAgain.homeElo).toBe(strength.homeElo);
    expect(strengthAgain.awayElo).toBe(strength.awayElo);
    expect(strengthAgain.acceptedEvidenceDigest).toBe(
      strength.acceptedEvidenceDigest,
    );
    const provenance = provenanceFromC0Strength({
      strength,
      modelVersion: "elo-poisson-hybrid-0.1.0",
    });
    expect(provenance.contextLayers).toEqual({});
    expect(isPrematchInputProvenance(provenance)).toBe(true);
  });
});
