/**
 * Snapshot already-published prematch output onto a ticket.
 * Does not call the Probability Engine, Decision Engine, or Vision.
 */

import type { PrematchActionability } from "@/lib/prematch-decision/actionability";
import {
  canonicalPrematchFixtureId,
  prematchDecisionTicketId,
} from "@/lib/prematch-decision/identity";
import {
  EMPTY_PREMATCH_EVIDENCE,
  PREMATCH_DECISION_TICKET_SCHEMA_VERSION,
  type PrematchDecisionTicket,
  type PrematchEvidenceAvailability,
  type PrematchPublishedQuote,
  type PrematchPublishedSnapshot,
  type PrematchTicketMarketId,
  type PrematchTicketSelection,
  type PrematchTicketScoring,
} from "@/lib/prematch-decision/ticket";

function finiteOrNull(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value;
}

function offeredOddsOrNull(value: number | null | undefined): number | null {
  const odds = finiteOrNull(value);
  if (odds == null || odds <= 1) return null;
  return odds;
}

function impliedProbabilityOrNull(
  offeredOdds: number | null,
  published: number | null | undefined,
): number | null {
  const implied = finiteOrNull(published);
  if (implied != null && implied > 0) return implied;
  if (offeredOdds != null && offeredOdds > 1) return 1 / offeredOdds;
  return null;
}

function fairOddsFromProbability(probability: number): number | null {
  if (!Number.isFinite(probability) || probability <= 0) return null;
  return 1 / probability;
}

function quoteKey(
  marketId: PrematchTicketMarketId,
  selectionId: string,
): string {
  return `${marketId}:${selectionId.trim().toLowerCase()}`;
}

function indexQuotes(
  quotes: PrematchPublishedQuote[] | undefined,
): Map<string, PrematchPublishedQuote> {
  const index = new Map<string, PrematchPublishedQuote>();
  for (const quote of quotes ?? []) {
    const key = quoteKey(quote.marketId, quote.selectionId);
    const odds = offeredOddsOrNull(quote.offeredOdds);
    const existing = index.get(key);
    if (!existing) {
      index.set(key, quote);
      continue;
    }
    const existingOdds = offeredOddsOrNull(existing.offeredOdds);
    if (existingOdds == null && odds != null) {
      index.set(key, quote);
    }
  }
  return index;
}

function snapshotSelection(
  marketId: PrematchTicketMarketId,
  marketLine: number | null,
  selectionId: string,
  selectionLabel: string,
  modelProbability: number,
  quote: PrematchPublishedQuote | undefined,
  scoring: PrematchTicketScoring | null,
): PrematchTicketSelection {
  const isPrimary =
    scoring?.selectionId != null &&
    quoteKey(marketId, selectionId) ===
      quoteKey("1x2", scoring.selectionId);
  const offeredOdds =
    offeredOddsOrNull(quote?.offeredOdds) ??
    (isPrimary ? offeredOddsOrNull(scoring?.offeredOdds) : null);
  const impliedProbability =
    impliedProbabilityOrNull(offeredOdds, quote?.impliedProbability) ??
    (isPrimary
      ? impliedProbabilityOrNull(offeredOdds, scoring?.impliedProbability)
      : null);
  const bookmaker =
    quote?.bookmaker ?? (isPrimary ? scoring?.bookmaker ?? null : null);
  const marketAsOfUtc = quote?.marketAsOfUtc ?? null;

  return {
    marketId,
    marketLine,
    selectionId,
    selectionLabel,
    modelProbability,
    fairOdds: fairOddsFromProbability(modelProbability),
    bookmaker: bookmaker && bookmaker.trim() ? bookmaker : null,
    offeredOdds,
    impliedProbability,
    marketAsOfUtc,
  };
}

function snapshotEvidence(
  published: PrematchPublishedSnapshot,
): PrematchEvidenceAvailability {
  return {
    ...EMPTY_PREMATCH_EVIDENCE,
    ...published.evidence,
  };
}

export function snapshotPrematchDecisionTicket(
  published: PrematchPublishedSnapshot,
  actionability: PrematchActionability,
): PrematchDecisionTicket {
  const fixtureId = canonicalPrematchFixtureId(published.fixtureId);
  const ticketId = prematchDecisionTicketId(published.fixtureId);
  if (!fixtureId || !ticketId || !actionability.kickoffUtc) {
    throw new Error("Prematch ticket snapshot requires fixture identity and kickoff.");
  }

  const quotes = indexQuotes(published.quotes);
  const scoring = published.scoring ?? null;
  const selections: PrematchTicketSelection[] = [];
  for (const market of published.markets) {
    for (const selection of market.selections) {
      selections.push(
        snapshotSelection(
          market.marketId,
          market.marketLine,
          selection.selectionId,
          selection.selectionLabel,
          selection.modelProbability,
          quotes.get(quoteKey(market.marketId, selection.selectionId)),
          scoring,
        ),
      );
    }
  }

  return {
    schemaVersion: PREMATCH_DECISION_TICKET_SCHEMA_VERSION,
    ticketId,
    fixtureId,
    leagueId: published.leagueId ?? null,
    season: published.season ?? null,
    homeTeamId: published.homeTeamId,
    awayTeamId: published.awayTeamId,
    homeTeamName: published.homeTeamName,
    awayTeamName: published.awayTeamName,
    kickoffUtc: actionability.kickoffUtc,
    capturedAtUtc: actionability.nowUtc,
    asOfUtc: published.asOfUtc ?? actionability.nowUtc,
    vendorStatusShort: actionability.fixtureStatus,
    actionability: {
      actionable: true,
      reason: actionability.reason,
    },
    sourceMode: published.sourceMode,
    model: {
      version: published.modelVersion ?? null,
      expectedGoals: published.expectedGoals ?? null,
    },
    selections,
    scoring,
    evidence: snapshotEvidence(published),
    ...(published.inputProvenance != null
      ? { inputProvenance: published.inputProvenance }
      : {}),
  };
}
