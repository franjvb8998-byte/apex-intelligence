/**
 * PE-3G — Deterministic offline C0 live-acceptance verifier tests.
 * No network. No Supabase. No provider.
 */

import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { PROBABILITY_SUM_TOLERANCE } from "@/lib/debug/calibration/metrics";
import { prematchDecisionTicketId } from "@/lib/prematch-decision/identity";
import {
  REGIME_LIFECYCLE_BASE_PRIOR_V1,
  REGIME_LIFECYCLE_C0_RECON_V1,
  PREMATCH_INPUT_PROVENANCE_VERSION,
  type PrematchInputProvenance,
} from "@/lib/prematch-decision/input-provenance";
import {
  PREMATCH_DECISION_TICKET_SCHEMA_VERSION,
  EMPTY_PREMATCH_EVIDENCE,
  type PrematchDecisionTicket,
} from "@/lib/prematch-decision/ticket";
import {
  PE3_C0_ACCEPTANCE_MODEL_VERSION,
  evaluatePe3C0LiveAcceptance,
} from "@/lib/prematch-lifecycle/c0-live-acceptance";
import { parseC0AcceptanceArgv } from "@/lib/prematch-lifecycle/c0-live-acceptance-cli";

const KICKOFF = "2033-06-01T15:00:00.000Z";
const FIXTURE = "1234567";
const DIGEST = createHash("sha256").update("pe3g-test-digest").digest("hex");
const CANONICAL_TICKET_ID = prematchDecisionTicketId(FIXTURE)!;

function side(
  overrides: Partial<PrematchInputProvenance["home"]> = {},
): PrematchInputProvenance["home"] {
  return {
    elo: 1520,
    source: "catalogue",
    base: 1500,
    played: 3,
    wins: 2,
    draws: 0,
    losses: 1,
    goalsFor: 5,
    goalsAgainst: 2,
    goalDifference: 3,
    ...overrides,
  };
}

function provenance(
  overrides: Partial<PrematchInputProvenance> = {},
): PrematchInputProvenance {
  return {
    provenanceVersion: PREMATCH_INPUT_PROVENANCE_VERSION,
    inputRegime: REGIME_LIFECYCLE_C0_RECON_V1,
    modelVersion: PE3_C0_ACCEPTANCE_MODEL_VERSION,
    home: side(),
    away: side({
      elo: 1480,
      played: 2,
      wins: 0,
      draws: 1,
      losses: 1,
      goalsFor: 1,
      goalsAgainst: 3,
      goalDifference: -2,
    }),
    evidenceAcquiredAtUtc: "2033-06-01T13:00:00.000Z",
    evidenceAsOfUtc: "2033-06-01T13:00:00.000Z",
    historicalCutoffUtc: KICKOFF,
    priorsInspected: 10,
    priorsAccepted: 5,
    acceptedEvidenceDigest: DIGEST,
    fallback: false,
    fallbackReason: null,
    contextLayers: {},
    ...overrides,
  };
}

function selection(
  selectionId: string,
  selectionLabel: string,
  modelProbability: number,
): PrematchDecisionTicket["selections"][number] {
  return {
    marketId: "1x2",
    marketLine: null,
    selectionId,
    selectionLabel,
    modelProbability,
    fairOdds: null,
    bookmaker: null,
    offeredOdds: null,
    impliedProbability: null,
    marketAsOfUtc: null,
  };
}

function ticket(
  overrides: Partial<PrematchDecisionTicket> = {},
): PrematchDecisionTicket {
  return {
    schemaVersion: PREMATCH_DECISION_TICKET_SCHEMA_VERSION,
    ticketId: CANONICAL_TICKET_ID,
    fixtureId: FIXTURE,
    leagueId: "apex:api-football:league:39",
    season: "2024",
    homeTeamId: "apex:api-football:team:33",
    awayTeamId: "apex:api-football:team:34",
    homeTeamName: "Home",
    awayTeamName: "Away",
    kickoffUtc: KICKOFF,
    capturedAtUtc: "2033-06-01T13:00:00.000Z",
    asOfUtc: "2033-06-01T13:00:00.000Z",
    vendorStatusShort: "NS",
    actionability: { actionable: true, reason: "ACTIONABLE_PREMATCH" },
    sourceMode: "scanner",
    model: {
      version: PE3_C0_ACCEPTANCE_MODEL_VERSION,
      expectedGoals: { home: 1.4, away: 1.1, total: 2.5 },
    },
    selections: [
      selection("home", "Home", 0.42),
      selection("draw", "Draw", 0.28),
      selection("away", "Away", 0.3),
    ],
    scoring: null,
    evidence: EMPTY_PREMATCH_EVIDENCE,
    inputProvenance: provenance(),
    ...overrides,
  };
}

function failedIds(result: ReturnType<typeof evaluatePe3C0LiveAcceptance>): string[] {
  return result.checks.filter((c) => !c.pass).map((c) => c.id);
}

describe("PE-3G CLI argv parse", () => {
  it("requires --fixture-id and rejects positional / invalid ids", () => {
    expect(parseC0AcceptanceArgv([]).ok).toBe(false);
    expect(parseC0AcceptanceArgv(["1234567"]).ok).toBe(false);
    expect(parseC0AcceptanceArgv(["--fixture-id"]).ok).toBe(false);
    expect(parseC0AcceptanceArgv(["--fixture-id", "abc"]).ok).toBe(false);
    const ok = parseC0AcceptanceArgv(["--fixture-id", FIXTURE]);
    expect(ok).toEqual({ ok: true, fixtureId: FIXTURE });
    expect(parseC0AcceptanceArgv([`--fixture-id=${FIXTURE}`])).toEqual({
      ok: true,
      fixtureId: FIXTURE,
    });
  });
});

describe("PE-3G evaluatePe3C0LiveAcceptance PASS", () => {
  it("passes a valid catalogue-discriminating C0 ticket", () => {
    const result = evaluatePe3C0LiveAcceptance({
      fixtureIdRequested: FIXTURE,
      ticket: ticket(),
    });
    expect(result.PE3_C0_LIVE_ACCEPTANCE).toBe("PASS");
    expect(failedIds(result)).toEqual([]);
    expect(result.fixtureIdRequested).toBe(FIXTURE);
    expect(result.fixtureId).toBe(FIXTURE);
    expect(result.ticketId).toBe(CANONICAL_TICKET_ID);
    expect(result.inputRegime).toBe(REGIME_LIFECYCLE_C0_RECON_V1);
    expect(result.modelVersion).toBe(PE3_C0_ACCEPTANCE_MODEL_VERSION);
    expect(result.acceptedEvidenceDigest).toBe(DIGEST);
    expect(result.historicalCutoffUtc).toBe(KICKOFF);
    expect(result.oneXTwo).toEqual({ home: 0.42, draw: 0.28, away: 0.3 });
    expect(result.home.source).toBe("catalogue");
    expect(result.home.played).toBe(3);
    expect(PROBABILITY_SUM_TOLERANCE).toBe(1e-6);
  });

  it("passes when only one side is catalogue with played>=1", () => {
    const result = evaluatePe3C0LiveAcceptance({
      fixtureIdRequested: FIXTURE,
      ticket: ticket({
        inputProvenance: provenance({
          away: side({ source: "base_prior", played: 0, elo: 1460 }),
          fallback: false,
        }),
      }),
    });
    expect(result.PE3_C0_LIVE_ACCEPTANCE).toBe("PASS");
  });
});

describe("PE-3G fixture / ticket identity binding", () => {
  it("requested fixture 1234567 with payload fixture 456 => FAIL", () => {
    const result = evaluatePe3C0LiveAcceptance({
      fixtureIdRequested: FIXTURE,
      ticket: ticket({
        fixtureId: "456",
        ticketId: prematchDecisionTicketId("456")!,
      }),
    });
    expect(result.PE3_C0_LIVE_ACCEPTANCE).toBe("FAIL");
    expect(failedIds(result)).toContain("fixture_id_matches_request");
    expect(result.fixtureIdRequested).toBe(FIXTURE);
    expect(result.fixtureId).toBe("456");
  });

  it("correct fixture but noncanonical ticketId => FAIL", () => {
    const result = evaluatePe3C0LiveAcceptance({
      fixtureIdRequested: FIXTURE,
      ticket: ticket({
        ticketId: "not-a-canonical-ticket-id",
      }),
    });
    expect(result.PE3_C0_LIVE_ACCEPTANCE).toBe("FAIL");
    expect(failedIds(result)).toContain("canonical_ticket_id_matches");
    expect(failedIds(result)).not.toContain("fixture_id_matches_request");
  });

  it("fully consistent identity => PASS predicates", () => {
    const result = evaluatePe3C0LiveAcceptance({
      fixtureIdRequested: FIXTURE,
      ticket: ticket(),
    });
    expect(result.checks.find((c) => c.id === "fixture_id_matches_request")?.pass).toBe(
      true,
    );
    expect(
      result.checks.find((c) => c.id === "canonical_ticket_id_matches")?.pass,
    ).toBe(true);
    expect(result.PE3_C0_LIVE_ACCEPTANCE).toBe("PASS");
  });
});

describe("PE-3G evaluatePe3C0LiveAcceptance FAIL", () => {
  it("missing ticket", () => {
    const result = evaluatePe3C0LiveAcceptance({
      fixtureIdRequested: FIXTURE,
      ticket: null,
    });
    expect(result.PE3_C0_LIVE_ACCEPTANCE).toBe("FAIL");
    expect(failedIds(result)).toContain("ticket_exists");
  });

  it("missing provenance", () => {
    const t = ticket();
    delete t.inputProvenance;
    const result = evaluatePe3C0LiveAcceptance({
      fixtureIdRequested: FIXTURE,
      ticket: t,
    });
    expect(result.PE3_C0_LIVE_ACCEPTANCE).toBe("FAIL");
    expect(failedIds(result)).toContain("provenance_present");
  });

  it("wrong regime", () => {
    const result = evaluatePe3C0LiveAcceptance({
      fixtureIdRequested: FIXTURE,
      ticket: ticket({
        inputProvenance: provenance({
          inputRegime: REGIME_LIFECYCLE_BASE_PRIOR_V1,
        }),
      }),
    });
    expect(failedIds(result)).toContain("input_regime_c0");
  });

  it("wrong modelVersion", () => {
    const result = evaluatePe3C0LiveAcceptance({
      fixtureIdRequested: FIXTURE,
      ticket: ticket({
        inputProvenance: provenance({ modelVersion: "other-0.0.0" }),
      }),
    });
    expect(failedIds(result)).toContain("model_version");
  });

  it("cutoff mismatch", () => {
    const result = evaluatePe3C0LiveAcceptance({
      fixtureIdRequested: FIXTURE,
      ticket: ticket({
        inputProvenance: provenance({
          historicalCutoffUtc: "2033-06-01T14:00:00.000Z",
        }),
      }),
    });
    expect(failedIds(result)).toContain("historical_cutoff_equals_kickoff");
  });

  it("missing/invalid digest", () => {
    const missing = evaluatePe3C0LiveAcceptance({
      fixtureIdRequested: FIXTURE,
      ticket: ticket({
        inputProvenance: provenance({ acceptedEvidenceDigest: null }),
      }),
    });
    expect(failedIds(missing)).toContain("accepted_evidence_digest_valid");

    const bad = evaluatePe3C0LiveAcceptance({
      fixtureIdRequested: FIXTURE,
      ticket: ticket({
        inputProvenance: provenance({ acceptedEvidenceDigest: "not-a-digest" }),
      }),
    });
    expect(failedIds(bad)).toContain("accepted_evidence_digest_valid");
  });

  it("both sides base_prior/fallback only", () => {
    const result = evaluatePe3C0LiveAcceptance({
      fixtureIdRequested: FIXTURE,
      ticket: ticket({
        inputProvenance: provenance({
          home: side({ source: "base_prior", played: 0, elo: 1500 }),
          away: side({ source: "base_prior", played: 0, elo: 1460 }),
          fallback: true,
          fallbackReason: "no_completed_priors",
        }),
      }),
    });
    expect(result.PE3_C0_LIVE_ACCEPTANCE).toBe("FAIL");
    expect(failedIds(result)).toContain("team_specific_discrimination");
  });

  it("catalogue side with played=0 fails discrimination", () => {
    const result = evaluatePe3C0LiveAcceptance({
      fixtureIdRequested: FIXTURE,
      ticket: ticket({
        inputProvenance: provenance({
          home: side({ source: "catalogue", played: 0 }),
          away: side({ source: "base_prior", played: 0, elo: 1460 }),
        }),
      }),
    });
    expect(failedIds(result)).toContain("team_specific_discrimination");
  });

  it("malformed/non-finite Elo", () => {
    const result = evaluatePe3C0LiveAcceptance({
      fixtureIdRequested: FIXTURE,
      ticket: ticket({
        inputProvenance: provenance({
          home: side({ elo: Number.NaN }),
        }),
      }),
    });
    expect(failedIds(result)).toContain("home_elo_finite");
  });

  it("missing 1X2 selection", () => {
    const result = evaluatePe3C0LiveAcceptance({
      fixtureIdRequested: FIXTURE,
      ticket: ticket({ selections: [] }),
    });
    expect(failedIds(result)).toContain("one_x_two_selections_present");
  });

  it("probability outside [0,1]", () => {
    const t = ticket({
      selections: [
        selection("home", "Home", 1.5),
        selection("draw", "Draw", 0.28),
        selection("away", "Away", 0.3),
      ],
    });
    const result = evaluatePe3C0LiveAcceptance({
      fixtureIdRequested: FIXTURE,
      ticket: t,
    });
    expect(failedIds(result)).toContain(
      "one_x_two_probabilities_finite_unit_interval",
    );
  });

  it("probabilities do not sum approximately to 1", () => {
    const t = ticket({
      selections: [
        selection("home", "Home", 0.5),
        selection("draw", "Draw", 0.5),
        selection("away", "Away", 0.5),
      ],
    });
    const result = evaluatePe3C0LiveAcceptance({
      fixtureIdRequested: FIXTURE,
      ticket: t,
    });
    expect(failedIds(result)).toContain("one_x_two_probabilities_sum_to_one");
  });

  it("malformed provenance / non-empty contextLayers", () => {
    const result = evaluatePe3C0LiveAcceptance({
      fixtureIdRequested: FIXTURE,
      ticket: ticket({
        inputProvenance: provenance({
          contextLayers: { form: "not-allowed-in-pe3" },
        }),
      }),
    });
    expect(failedIds(result)).toContain("context_layers_empty");
    expect(failedIds(result)).toContain("provenance_internally_coherent");
  });

  it("sanitized output excludes odds/EV/secret-like fields", () => {
    const result = evaluatePe3C0LiveAcceptance({
      fixtureIdRequested: FIXTURE,
      ticket: ticket(),
    });
    const blob = JSON.stringify(result);
    expect(blob).not.toMatch(/expectedValue|offeredOdds|bookmaker|API_KEY|SERVICE_ROLE/i);
    expect(result).not.toHaveProperty("scoring");
    expect(result).not.toHaveProperty("quotes");
  });
});
