/**
 * PE-3G — Pure C0 live-acceptance evaluator (offline-deterministic).
 *
 * Durable ticket in → sanitized PASS/FAIL out.
 * No I/O. No provider. No PE recompute. No secrets.
 */

import { PROBABILITY_SUM_TOLERANCE } from "@/lib/debug/calibration/metrics";
import { prematchDecisionTicketId } from "@/lib/prematch-decision/identity";
import {
  isPrematchInputProvenance,
  REGIME_LIFECYCLE_C0_RECON_V1,
  type PrematchEloSideProvenance,
  type PrematchInputProvenance,
} from "@/lib/prematch-decision/input-provenance";
import type { PrematchDecisionTicket } from "@/lib/prematch-decision/ticket";

/** Canonical PE formula identity required for PE-3 C0 closure. */
export const PE3_C0_ACCEPTANCE_MODEL_VERSION =
  "elo-poisson-hybrid-0.1.0" as const;

/** SHA-256 hex (64 lowercase/uppercase hex digits). */
const SHA256_HEX = /^[a-fA-F0-9]{64}$/;

export const PE3_C0_ACCEPTANCE_CHECK_IDS = [
  "ticket_exists",
  "ticket_identity_present",
  "fixture_id_matches_request",
  "canonical_ticket_id_matches",
  "provenance_present",
  "input_regime_c0",
  "model_version",
  "historical_cutoff_present",
  "historical_cutoff_equals_kickoff",
  "accepted_evidence_digest_valid",
  "context_layers_empty",
  "home_provenance_present",
  "away_provenance_present",
  "home_elo_finite",
  "away_elo_finite",
  "home_source_played_surfaced",
  "away_source_played_surfaced",
  "team_specific_discrimination",
  "one_x_two_selections_present",
  "one_x_two_probabilities_finite_unit_interval",
  "one_x_two_probabilities_sum_to_one",
  "no_post_kickoff_contamination_semantics",
  "provenance_internally_coherent",
] as const;

export type Pe3C0AcceptanceCheckId =
  (typeof PE3_C0_ACCEPTANCE_CHECK_IDS)[number];

export type Pe3C0AcceptanceCheckResult = {
  id: Pe3C0AcceptanceCheckId;
  pass: boolean;
  detail: string;
};

export type Pe3C0AcceptanceSideSummary = {
  reconstructedElo: number | null;
  source: string | null;
  fallback: boolean | null;
  played: number | null;
  acceptedEvidenceCount: number | null;
};

export type Pe3C0AcceptanceOneXTwo = {
  home: number | null;
  draw: number | null;
  away: number | null;
};

export type Pe3C0AcceptanceResult = {
  fixtureIdRequested: string;
  fixtureId: string | null;
  ticketId: string | null;
  leagueId: string | null;
  season: string | null;
  kickoffUtc: string | null;
  historicalCutoffUtc: string | null;
  modelVersion: string | null;
  inputRegime: string | null;
  acceptedEvidenceDigest: string | null;
  home: Pe3C0AcceptanceSideSummary;
  away: Pe3C0AcceptanceSideSummary;
  oneXTwo: Pe3C0AcceptanceOneXTwo;
  checks: Pe3C0AcceptanceCheckResult[];
  PE3_C0_LIVE_ACCEPTANCE: "PASS" | "FAIL";
};

function emptySide(): Pe3C0AcceptanceSideSummary {
  return {
    reconstructedElo: null,
    source: null,
    fallback: null,
    played: null,
    acceptedEvidenceCount: null,
  };
}

function sideSummary(
  side: PrematchEloSideProvenance | null | undefined,
  ticketFallback: boolean | null,
): Pe3C0AcceptanceSideSummary {
  if (!side) return emptySide();
  return {
    reconstructedElo: side.elo,
    source: side.source,
    fallback: side.source === "base_prior" ? true : ticketFallback === true,
    played: side.played,
    acceptedEvidenceCount: side.played,
  };
}

function check(
  id: Pe3C0AcceptanceCheckId,
  pass: boolean,
  detail: string,
): Pe3C0AcceptanceCheckResult {
  return { id, pass, detail };
}

function isValidProb(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function sameUtcInstant(left: string, right: string): boolean {
  const a = Date.parse(left);
  const b = Date.parse(right);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return a === b;
}

function readOneXTwo(
  ticket: PrematchDecisionTicket | null,
): { home: number | null; draw: number | null; away: number | null; complete: boolean } {
  if (!ticket) {
    return { home: null, draw: null, away: null, complete: false };
  }
  const rows = ticket.selections.filter((s) => s.marketId === "1x2");
  if (rows.length === 0) {
    return { home: null, draw: null, away: null, complete: false };
  }
  const byId = new Map(
    rows.map((s) => [s.selectionId, s.modelProbability] as const),
  );
  const home = byId.has("home") ? (byId.get("home") as number) : null;
  const draw = byId.has("draw") ? (byId.get("draw") as number) : null;
  const away = byId.has("away") ? (byId.get("away") as number) : null;
  return {
    home,
    draw,
    away,
    complete: home != null && draw != null && away != null,
  };
}

function sideDiscriminates(side: PrematchEloSideProvenance | undefined): boolean {
  return Boolean(side && side.source === "catalogue" && side.played >= 1);
}

function contextLayersEmpty(layers: unknown): boolean {
  if (layers == null || typeof layers !== "object" || Array.isArray(layers)) {
    return false;
  }
  return Object.keys(layers as Record<string, unknown>).length === 0;
}

function digestStructurallyValid(digest: unknown): digest is string {
  return typeof digest === "string" && SHA256_HEX.test(digest);
}

/**
 * Pure PE-3 C0 live-acceptance evaluation.
 * Pass `ticket=null` when the durable store has no row for the fixture.
 */
export function evaluatePe3C0LiveAcceptance(input: {
  fixtureIdRequested: string;
  ticket: PrematchDecisionTicket | null;
}): Pe3C0AcceptanceResult {
  const requested = input.fixtureIdRequested.trim();
  const ticket = input.ticket;
  const prov: PrematchInputProvenance | null | undefined =
    ticket?.inputProvenance;
  const oneXTwo = readOneXTwo(ticket);

  const checks: Pe3C0AcceptanceCheckResult[] = [];

  const ticketExists = ticket != null;
  checks.push(
    check(
      "ticket_exists",
      ticketExists,
      ticketExists
        ? "Durable ticket found for fixtureId"
        : "No durable ticket for fixtureId",
    ),
  );

  const identityOk = Boolean(
    ticket &&
      typeof ticket.ticketId === "string" &&
      ticket.ticketId.length > 0 &&
      typeof ticket.fixtureId === "string" &&
      ticket.fixtureId.length > 0,
  );
  checks.push(
    check(
      "ticket_identity_present",
      identityOk,
      identityOk
        ? "ticketId and fixtureId present"
        : "Missing ticketId and/or fixtureId",
    ),
  );

  const fixtureIdMatches = Boolean(
    ticket && ticket.fixtureId === requested,
  );
  checks.push(
    check(
      "fixture_id_matches_request",
      fixtureIdMatches,
      fixtureIdMatches
        ? `durable fixtureId matches request (${requested})`
        : `durable fixtureId=${ticket?.fixtureId ?? "absent"} !== requested=${requested}`,
    ),
  );

  const expectedTicketId = prematchDecisionTicketId(requested);
  const canonicalTicketIdMatches = Boolean(
    ticket &&
      expectedTicketId != null &&
      ticket.ticketId === expectedTicketId,
  );
  checks.push(
    check(
      "canonical_ticket_id_matches",
      canonicalTicketIdMatches,
      canonicalTicketIdMatches
        ? `ticketId matches canonical ${expectedTicketId}`
        : `ticketId=${ticket?.ticketId ?? "absent"} !== canonical=${expectedTicketId ?? "unresolvable"}`,
    ),
  );

  const provenancePresent = prov != null;
  checks.push(
    check(
      "provenance_present",
      provenancePresent,
      provenancePresent
        ? "inputProvenance present"
        : "inputProvenance missing",
    ),
  );

  const regimeOk = prov?.inputRegime === REGIME_LIFECYCLE_C0_RECON_V1;
  checks.push(
    check(
      "input_regime_c0",
      regimeOk,
      regimeOk
        ? `inputRegime=${REGIME_LIFECYCLE_C0_RECON_V1}`
        : `inputRegime=${prov?.inputRegime ?? "absent"} (need ${REGIME_LIFECYCLE_C0_RECON_V1})`,
    ),
  );

  const modelOk = prov?.modelVersion === PE3_C0_ACCEPTANCE_MODEL_VERSION;
  checks.push(
    check(
      "model_version",
      modelOk,
      modelOk
        ? `modelVersion=${PE3_C0_ACCEPTANCE_MODEL_VERSION}`
        : `modelVersion=${prov?.modelVersion ?? "absent"} (need ${PE3_C0_ACCEPTANCE_MODEL_VERSION})`,
    ),
  );

  const cutoffPresent =
    typeof prov?.historicalCutoffUtc === "string" &&
    prov.historicalCutoffUtc.trim().length > 0;
  checks.push(
    check(
      "historical_cutoff_present",
      cutoffPresent,
      cutoffPresent
        ? "historicalCutoffUtc present"
        : "historicalCutoffUtc missing",
    ),
  );

  const cutoffEqualsKickoff = Boolean(
    ticket &&
      cutoffPresent &&
      sameUtcInstant(prov!.historicalCutoffUtc!, ticket.kickoffUtc),
  );
  checks.push(
    check(
      "historical_cutoff_equals_kickoff",
      cutoffEqualsKickoff,
      cutoffEqualsKickoff
        ? "historicalCutoffUtc equals kickoffUtc (exclusive cutoff semantics)"
        : "historicalCutoffUtc does not equal kickoffUtc",
    ),
  );

  const digestOk = digestStructurallyValid(prov?.acceptedEvidenceDigest);
  checks.push(
    check(
      "accepted_evidence_digest_valid",
      digestOk,
      digestOk
        ? "acceptedEvidenceDigest is SHA-256 hex"
        : "acceptedEvidenceDigest missing or not SHA-256 hex",
    ),
  );

  const layersOk = Boolean(prov && contextLayersEmpty(prov.contextLayers));
  checks.push(
    check(
      "context_layers_empty",
      layersOk,
      layersOk
        ? "contextLayers is empty object"
        : "contextLayers missing or non-empty",
    ),
  );

  const homePresent = Boolean(prov?.home);
  const awayPresent = Boolean(prov?.away);
  checks.push(
    check(
      "home_provenance_present",
      homePresent,
      homePresent ? "home provenance present" : "home provenance missing",
    ),
  );
  checks.push(
    check(
      "away_provenance_present",
      awayPresent,
      awayPresent ? "away provenance present" : "away provenance missing",
    ),
  );

  const homeEloOk = Boolean(
    prov?.home && Number.isFinite(prov.home.elo),
  );
  const awayEloOk = Boolean(
    prov?.away && Number.isFinite(prov.away.elo),
  );
  checks.push(
    check(
      "home_elo_finite",
      homeEloOk,
      homeEloOk ? "home Elo finite" : "home Elo missing or non-finite",
    ),
  );
  checks.push(
    check(
      "away_elo_finite",
      awayEloOk,
      awayEloOk ? "away Elo finite" : "away Elo missing or non-finite",
    ),
  );

  const homeSurfaced = Boolean(
    prov?.home &&
      (prov.home.source === "catalogue" || prov.home.source === "base_prior") &&
      Number.isFinite(prov.home.played),
  );
  const awaySurfaced = Boolean(
    prov?.away &&
      (prov.away.source === "catalogue" || prov.away.source === "base_prior") &&
      Number.isFinite(prov.away.played),
  );
  checks.push(
    check(
      "home_source_played_surfaced",
      homeSurfaced,
      homeSurfaced
        ? `home source=${prov!.home.source} played=${prov!.home.played}`
        : "home source/played not surfaced",
    ),
  );
  checks.push(
    check(
      "away_source_played_surfaced",
      awaySurfaced,
      awaySurfaced
        ? `away source=${prov!.away.source} played=${prov!.away.played}`
        : "away source/played not surfaced",
    ),
  );

  const discriminationOk =
    sideDiscriminates(prov?.home) || sideDiscriminates(prov?.away);
  checks.push(
    check(
      "team_specific_discrimination",
      discriminationOk,
      discriminationOk
        ? "At least one side has source=catalogue and played>=1"
        : "Both sides lack catalogue discrimination (base_prior/fallback-only fails PE-3 closure)",
    ),
  );

  checks.push(
    check(
      "one_x_two_selections_present",
      oneXTwo.complete,
      oneXTwo.complete
        ? "1X2 home/draw/away selections present"
        : "Missing 1X2 home/draw/away selections",
    ),
  );

  const probsFinite =
    isValidProb(oneXTwo.home) &&
    isValidProb(oneXTwo.draw) &&
    isValidProb(oneXTwo.away);
  checks.push(
    check(
      "one_x_two_probabilities_finite_unit_interval",
      probsFinite,
      probsFinite
        ? "1X2 probabilities finite and in [0,1]"
        : "1X2 probabilities missing, non-finite, or outside [0,1]",
    ),
  );

  const sumOk =
    probsFinite &&
    Math.abs(
      (oneXTwo.home as number) +
        (oneXTwo.draw as number) +
        (oneXTwo.away as number) -
        1,
    ) <= PROBABILITY_SUM_TOLERANCE;
  checks.push(
    check(
      "one_x_two_probabilities_sum_to_one",
      sumOk,
      sumOk
        ? `1X2 sum within tolerance ${PROBABILITY_SUM_TOLERANCE}`
        : `1X2 sum outside tolerance ${PROBABILITY_SUM_TOLERANCE}`,
    ),
  );

  // Durable ticket does not store individual priors; exclusive cutoff
  // equality is the representable contamination guard.
  const noContamination = cutoffEqualsKickoff && digestOk;
  checks.push(
    check(
      "no_post_kickoff_contamination_semantics",
      noContamination,
      noContamination
        ? "Cutoff=kickoff + valid digest encode exclusive prior semantics"
        : "Cannot confirm exclusive prior semantics from durable fields",
    ),
  );

  const coherent = Boolean(
    provenancePresent &&
      isPrematchInputProvenance(prov) &&
      regimeOk &&
      modelOk &&
      layersOk &&
      homeEloOk &&
      awayEloOk,
  );
  checks.push(
    check(
      "provenance_internally_coherent",
      coherent,
      coherent
        ? "Provenance structure/regime/version coherent"
        : "Provenance malformed or internally incoherent",
    ),
  );

  const allPass = checks.every((c) => c.pass);

  return {
    fixtureIdRequested: requested,
    fixtureId: ticket?.fixtureId ?? null,
    ticketId: ticket?.ticketId ?? null,
    leagueId: ticket?.leagueId ?? null,
    season: ticket?.season ?? null,
    kickoffUtc: ticket?.kickoffUtc ?? null,
    historicalCutoffUtc: prov?.historicalCutoffUtc ?? null,
    modelVersion: prov?.modelVersion ?? null,
    inputRegime: prov?.inputRegime ?? null,
    acceptedEvidenceDigest: prov?.acceptedEvidenceDigest ?? null,
    home: sideSummary(prov?.home, prov?.fallback ?? null),
    away: sideSummary(prov?.away, prov?.fallback ?? null),
    oneXTwo: {
      home: oneXTwo.home,
      draw: oneXTwo.draw,
      away: oneXTwo.away,
    },
    checks,
    PE3_C0_LIVE_ACCEPTANCE: allPass ? "PASS" : "FAIL",
  };
}
