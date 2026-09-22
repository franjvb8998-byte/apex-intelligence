/**
 * Zero-extra-provider-call opportunistic evaluation.
 * Uses already-fetched catalogue / Match Center / Vision payloads.
 * Does not call PE and does not backfill missing tickets.
 */

import {
  classifyVendorFinalization,
  isNonScoreableTerminalStatus,
} from "@/lib/final-evidence/finalization";
import {
  observationFromApexBundle,
  observationFromVisionTerminal,
} from "@/lib/final-evidence/capture";
import {
  getFinalFixtureEvidenceStore,
  type FinalFixtureEvidenceStore,
} from "@/lib/final-evidence/store";
import type { FinalFixtureObservation } from "@/lib/final-evidence/types";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import {
  getPrematchDecisionTicketStore,
  type PrematchDecisionTicketStore,
} from "@/lib/prematch-decision/store";
import { buildPrematchDecisionEvaluation } from "@/lib/prematch-evaluation/evaluate";
import { regulationSettlementScore } from "@/lib/prematch-evaluation/settlement";
import {
  getPrematchDecisionEvaluationStore,
  type PrematchDecisionEvaluationStore,
} from "@/lib/prematch-evaluation/store";
import type {
  EvaluatePrematchDecisionResult,
  PrematchDecisionEvaluation,
} from "@/lib/prematch-evaluation/types";

export type OpportunisticIngestStores = {
  ticketStore?: PrematchDecisionTicketStore;
  evidenceStore?: FinalFixtureEvidenceStore;
  evaluationStore?: PrematchDecisionEvaluationStore;
  clock?: string;
};

export type OpportunisticIngestResult = {
  evidenceCreated: boolean;
  evaluationCreated: boolean;
  result: EvaluatePrematchDecisionResult;
};

function stores(input: OpportunisticIngestStores = {}) {
  return {
    tickets: input.ticketStore ?? getPrematchDecisionTicketStore(),
    evidence: input.evidenceStore ?? getFinalFixtureEvidenceStore(),
    evaluations: input.evaluationStore ?? getPrematchDecisionEvaluationStore(),
    clock: input.clock,
  };
}

export async function ingestAlreadyFetchedFinalObservation(
  observation: FinalFixtureObservation,
  input: OpportunisticIngestStores = {},
): Promise<OpportunisticIngestResult> {
  const { tickets, evidence, evaluations, clock } = stores(input);
  const klass = classifyVendorFinalization(observation.vendorStatusShort);
  if (klass === "NOT_FINAL") {
    return {
      evidenceCreated: false,
      evaluationCreated: false,
      result: { ok: false, state: "rejected_not_final", evaluation: null },
    };
  }

  const ticket = await tickets.getByFixtureId(observation.fixtureId);
  const observed = await evidence.observe({
    ...observation,
    ticketId: ticket?.ticketId ?? observation.ticketId ?? null,
    observedAtUtc: observation.observedAtUtc ?? clock,
  });
  if (!observed.ok) {
    return {
      evidenceCreated: false,
      evaluationCreated: false,
      result: {
        ok: false,
        state:
          observed.reason === "DURABLE_STORE_UNAVAILABLE"
            ? "durable_unavailable"
            : "rejected_not_final",
        evaluation: null,
      },
    };
  }

  if (!ticket) {
    return {
      evidenceCreated: observed.created,
      evaluationCreated: false,
      result: {
        ok: false,
        state: "rejected_missing_ticket",
        evaluation: null,
      },
    };
  }

  if (isNonScoreableTerminalStatus(observed.evidence.vendorStatusShort)) {
    return {
      evidenceCreated: observed.created,
      evaluationCreated: false,
      result: {
        ok: false,
        state: "void_non_scoreable",
        evaluation: null,
      },
    };
  }

  if (!regulationSettlementScore(observed.evidence)) {
    return {
      evidenceCreated: observed.created,
      evaluationCreated: false,
      result: {
        ok: false,
        state: "rejected_invalid_score",
        evaluation: null,
      },
    };
  }

  const built = buildPrematchDecisionEvaluation({
    ticket,
    evidence: observed.evidence,
    clock,
  });
  if (!built) {
    return {
      evidenceCreated: observed.created,
      evaluationCreated: false,
      result: { ok: false, state: "rejected_invalid_score", evaluation: null },
    };
  }

  const inserted = await evaluations.insertIfAbsent(built);
  if (inserted.unavailable || !inserted.evaluation) {
    return {
      evidenceCreated: observed.created,
      evaluationCreated: false,
      result: { ok: false, state: "durable_unavailable", evaluation: null },
    };
  }

  return {
    evidenceCreated: observed.created,
    evaluationCreated: inserted.created,
    result: {
      ok: true,
      created: inserted.created,
      state: "evaluated",
      evaluation: inserted.evaluation,
    },
  };
}

export async function ingestCatalogueFinalBundle(
  bundle: ApexMatchBundle,
  input: OpportunisticIngestStores = {},
): Promise<OpportunisticIngestResult | null> {
  const observation = observationFromApexBundle(bundle, "catalogue");
  if (!observation) return null;
  return ingestAlreadyFetchedFinalObservation(observation, input);
}

export async function ingestMatchCenterFinalBundle(
  bundle: ApexMatchBundle,
  input: OpportunisticIngestStores = {},
): Promise<OpportunisticIngestResult | null> {
  const observation = observationFromApexBundle(bundle, "match-center");
  if (!observation) return null;
  return ingestAlreadyFetchedFinalObservation(observation, input);
}

export async function ingestVisionTerminalFinal(
  payload: Parameters<typeof observationFromVisionTerminal>[0],
  input: OpportunisticIngestStores = {},
): Promise<OpportunisticIngestResult | null> {
  const observation = observationFromVisionTerminal(payload);
  if (!observation) return null;
  return ingestAlreadyFetchedFinalObservation(observation, input);
}

export function shouldSkipScannerPrematchEngine(bundle: {
  match: { status: string; vendorStatusShort?: string | null };
}): boolean {
  const klass = classifyVendorFinalization(bundle.match.vendorStatusShort);
  if (klass === "SCOREABLE_FINAL" || klass === "NON_SCOREABLE_TERMINAL") {
    return true;
  }
  return bundle.match.status === "finished" || bundle.match.status === "cancelled";
}

export type { PrematchDecisionEvaluation };
