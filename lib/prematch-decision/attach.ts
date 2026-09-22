/**
 * Attach a frozen prematch ticket to published Match Analysis output.
 *
 * Lookup durable history first. Safety-net create only when Phase 1A is
 * actionable and the T-120..T-1 window is open. Never regenerate after kickoff.
 */

import type { MatchAnalysisData } from "@/lib/match-analysis/types";
import {
  evaluatePrematchActionability,
  type InjectedClock,
} from "@/lib/prematch-decision/actionability";
import { createPrematchDecisionTicket } from "@/lib/prematch-decision/create";
import {
  publishedSnapshotFromMatchAnalysis,
  type MatchAnalysisTicketExtras,
} from "@/lib/prematch-decision/from-match-analysis";
import {
  confirmDurableByFixtureId,
  getPrematchDecisionTicketStore,
  type PrematchDecisionTicketStore,
} from "@/lib/prematch-decision/store";
import { vendorFixtureId } from "@/lib/match-center/fixture-id";
import { isWithinCanonicalCaptureWindow } from "@/lib/prematch-decision/window";

export type AttachPrematchDecisionTicketOptions = MatchAnalysisTicketExtras & {
  nowUtc?: InjectedClock;
  asOf?: InjectedClock;
  store?: PrematchDecisionTicketStore;
};

export async function attachPrematchDecisionTicket(
  analysis: MatchAnalysisData,
  options: AttachPrematchDecisionTicketOptions = {},
): Promise<MatchAnalysisData> {
  const store = options.store ?? getPrematchDecisionTicketStore();
  const fixtureId = vendorFixtureId(analysis.matchId) ?? analysis.matchId;
  const existing = await confirmDurableByFixtureId(store, fixtureId);
  if (existing.confirmed) {
    return {
      ...analysis,
      frozenPrematchDecision: existing.ticket,
    };
  }
  if (existing.reason === "DURABLE_STORE_UNAVAILABLE") {
    return {
      ...analysis,
      frozenPrematchDecision: null,
    };
  }

  const clock = options.nowUtc ?? options.asOf;
  const actionability = evaluatePrematchActionability({
    vendorStatusShort: analysis.vendorStatusShort,
    kickoffUtc: analysis.kickoffAt,
    nowUtc: clock,
  });

  if (!actionability.isCurrentlyActionable) {
    return {
      ...analysis,
      frozenPrematchDecision: null,
    };
  }

  if (
    !isWithinCanonicalCaptureWindow({
      kickoffUtc: analysis.kickoffAt,
      nowUtc: clock,
    })
  ) {
    return {
      ...analysis,
      frozenPrematchDecision: null,
    };
  }

  const created = await createPrematchDecisionTicket({
    published: publishedSnapshotFromMatchAnalysis(analysis, options),
    clock,
    store,
  });

  return {
    ...analysis,
    frozenPrematchDecision: created.ok ? created.ticket : null,
  };
}

export async function lookupFrozenPrematchDecision(
  fixtureId: string,
  store?: PrematchDecisionTicketStore,
) {
  const proof = await confirmDurableByFixtureId(
    store ?? getPrematchDecisionTicketStore(),
    fixtureId,
  );
  return proof.confirmed ? proof.ticket : null;
}
