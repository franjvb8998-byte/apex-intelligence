/**
 * Immutable observed final-result evidence.
 * Separate from PrematchDecisionTicket and PrematchDecisionEvaluation.
 * Never written back onto a ticket. Future LiveDecisionSnapshot is unrelated.
 */

export const FINAL_FIXTURE_EVIDENCE_SCHEMA_VERSION = "1.0.0";

export const FINAL_FIXTURE_EVIDENCE_ID_PREFIX = "apex:final-evidence:v1";

export type FinalEvidenceSource =
  | "catalogue"
  | "match-center"
  | "vision-terminal"
  | "reconcile";

export type FinalizationClass =
  | "SCOREABLE_FINAL"
  | "NON_SCOREABLE_TERMINAL"
  | "NOT_FINAL";

export type FinalFixtureObservation = {
  fixtureId: string;
  ticketId?: string | null;
  observedAtUtc?: string;
  source: FinalEvidenceSource;
  vendorStatusShort: string;
  goalsHome: number | null;
  goalsAway: number | null;
  fulltimeHome: number | null;
  fulltimeAway: number | null;
  extratimeHome: number | null;
  extratimeAway: number | null;
  penaltyHome: number | null;
  penaltyAway: number | null;
  winnerHome: boolean | null;
  winnerAway: boolean | null;
};

export type FinalFixtureEvidence = {
  schemaVersion: typeof FINAL_FIXTURE_EVIDENCE_SCHEMA_VERSION;
  evidenceId: string;
  fixtureId: string;
  ticketId: string | null;
  observedAtUtc: string;
  source: FinalEvidenceSource;
  vendorStatusShort: string;
  finalizationClass: FinalizationClass;
  goalsHome: number | null;
  goalsAway: number | null;
  fulltimeHome: number | null;
  fulltimeAway: number | null;
  extratimeHome: number | null;
  extratimeAway: number | null;
  penaltyHome: number | null;
  penaltyAway: number | null;
  winnerHome: boolean | null;
  winnerAway: boolean | null;
  observationRevision: number;
};

export type ObserveFinalEvidenceResult =
  | {
      ok: true;
      created: boolean;
      evidence: FinalFixtureEvidence;
    }
  | {
      ok: false;
      reason:
        | "NOT_FINAL"
        | "FIXTURE_IDENTITY_MISSING"
        | "DURABLE_STORE_UNAVAILABLE";
      evidence: FinalFixtureEvidence | null;
    };
