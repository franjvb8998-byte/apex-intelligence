/**
 * Build FinalFixtureEvidence from already-fetched observations.
 * Does not call API-Football or PE. Never substitutes 0 for a missing score.
 */

import { normalizeVendorStatusShort } from "@/lib/prematch-decision/actionability";
import { canonicalPrematchFixtureId } from "@/lib/prematch-decision/identity";
import { classifyVendorFinalization } from "@/lib/final-evidence/finalization";
import { finalFixtureEvidenceId } from "@/lib/final-evidence/identity";
import {
  FINAL_FIXTURE_EVIDENCE_SCHEMA_VERSION,
  type FinalFixtureEvidence,
  type FinalFixtureObservation,
} from "@/lib/final-evidence/types";

function asNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asNullableBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export function buildFinalFixtureEvidence(
  observation: FinalFixtureObservation,
  revision: number,
  clock?: string,
): FinalFixtureEvidence | null {
  const fixtureId = canonicalPrematchFixtureId(observation.fixtureId);
  const evidenceId = finalFixtureEvidenceId(observation.fixtureId, revision);
  const vendorStatusShort = normalizeVendorStatusShort(
    observation.vendorStatusShort,
  );
  if (!fixtureId || !evidenceId || !vendorStatusShort) return null;
  if (!Number.isInteger(revision) || revision < 1) return null;

  return {
    schemaVersion: FINAL_FIXTURE_EVIDENCE_SCHEMA_VERSION,
    evidenceId,
    fixtureId,
    ticketId: observation.ticketId ?? null,
    observedAtUtc: observation.observedAtUtc ?? clock ?? new Date().toISOString(),
    source: observation.source,
    vendorStatusShort,
    finalizationClass: classifyVendorFinalization(vendorStatusShort),
    goalsHome: asNullableNumber(observation.goalsHome),
    goalsAway: asNullableNumber(observation.goalsAway),
    fulltimeHome: asNullableNumber(observation.fulltimeHome),
    fulltimeAway: asNullableNumber(observation.fulltimeAway),
    extratimeHome: asNullableNumber(observation.extratimeHome),
    extratimeAway: asNullableNumber(observation.extratimeAway),
    penaltyHome: asNullableNumber(observation.penaltyHome),
    penaltyAway: asNullableNumber(observation.penaltyAway),
    winnerHome: asNullableBoolean(observation.winnerHome),
    winnerAway: asNullableBoolean(observation.winnerAway),
    observationRevision: revision,
  };
}

export function observationFromApexBundle(
  bundle: {
    match: {
      id: string;
      vendorStatusShort?: string | null;
      score: {
        home: number | null;
        away: number | null;
        periods?: {
          ft?: { home: number | null; away: number | null };
        };
      };
      externalRefs?: Array<{ externalId?: string | null }>;
    };
  },
  source: FinalFixtureObservation["source"],
): FinalFixtureObservation | null {
  const fixtureId =
    bundle.match.externalRefs?.[0]?.externalId ?? bundle.match.id;
  const status = bundle.match.vendorStatusShort;
  if (!fixtureId || !status) return null;
  return {
    fixtureId,
    source,
    vendorStatusShort: status,
    goalsHome: bundle.match.score.home,
    goalsAway: bundle.match.score.away,
    fulltimeHome: bundle.match.score.periods?.ft?.home ?? null,
    fulltimeAway: bundle.match.score.periods?.ft?.away ?? null,
    extratimeHome: null,
    extratimeAway: null,
    penaltyHome: null,
    penaltyAway: null,
    winnerHome: null,
    winnerAway: null,
  };
}

export function observationFromVisionTerminal(input: {
  fixtureId: string;
  vendorStatusShort: string | null | undefined;
  goalsHome: number | null;
  goalsAway: number | null;
  fulltimeHome?: number | null;
  fulltimeAway?: number | null;
  extratimeHome?: number | null;
  extratimeAway?: number | null;
  penaltyHome?: number | null;
  penaltyAway?: number | null;
}): FinalFixtureObservation | null {
  if (!input.vendorStatusShort) return null;
  return {
    fixtureId: input.fixtureId,
    source: "vision-terminal",
    vendorStatusShort: input.vendorStatusShort,
    goalsHome: input.goalsHome,
    goalsAway: input.goalsAway,
    fulltimeHome: input.fulltimeHome ?? null,
    fulltimeAway: input.fulltimeAway ?? null,
    extratimeHome: input.extratimeHome ?? null,
    extratimeAway: input.extratimeAway ?? null,
    penaltyHome: input.penaltyHome ?? null,
    penaltyAway: input.penaltyAway ?? null,
    winnerHome: null,
    winnerAway: null,
  };
}
