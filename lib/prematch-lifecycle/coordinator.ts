/**
 * Server-only automatic durable prematch lifecycle coordinator.
 *
 * Creates canonical Scanner-path PrematchDecisionTickets during T-120
 * and finalizes ticketed fixtures with existing Phase 1C ingest.
 * L1 memory is never authoritative. No PE/odds after kickoff.
 */

import { createScannerMatchCenter } from "@/lib/apex-opportunities/scanner-canonical";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import { MAX_FIXTURES_PER_BATCH } from "@/lib/data-platform/providers/api-football/live-query";
import {
  classifyVendorFinalization,
  isNonScoreableTerminalStatus,
  isValidGoalCount,
} from "@/lib/final-evidence/finalization";
import { observationFromApexBundle } from "@/lib/final-evidence/capture";
import {
  getFinalFixtureEvidenceStore,
  type FinalFixtureEvidenceStore,
} from "@/lib/final-evidence/store";
import type { FinalEvidenceSource } from "@/lib/final-evidence/types";
import { ACTIONABLE_VENDOR_STATUS } from "@/lib/prematch-decision/actionability";
import type { InjectedClock } from "@/lib/prematch-decision/actionability";
import { captureScannerPrematchTicketFromCenter } from "@/lib/prematch-decision/from-scanner";
import {
  canonicalPrematchFixtureId,
} from "@/lib/prematch-decision/identity";
import {
  comparePrematchTicketListCursor,
  confirmDurableByFixtureId,
  getPrematchDecisionTicketStore,
  type PrematchDecisionTicketStore,
  type PrematchTicketListCursor,
} from "@/lib/prematch-decision/store";
import type { PrematchDecisionTicket } from "@/lib/prematch-decision/ticket";
import { evaluatePrematchCaptureWindow } from "@/lib/prematch-decision/window";
import { buildPrematchDecisionEvaluation } from "@/lib/prematch-evaluation/evaluate";
import { ingestAlreadyFetchedFinalObservation } from "@/lib/prematch-evaluation/opportunistic";
import { regulationSettlementScore } from "@/lib/prematch-evaluation/settlement";
import {
  getPrematchDecisionEvaluationStore,
  type PrematchDecisionEvaluationStore,
} from "@/lib/prematch-evaluation/store";
import { SETTLEMENT_POLICY_REGULATION_90_V1 } from "@/lib/prematch-evaluation/types";
import { isQuotaError } from "@/lib/repositories";
import {
  MAX_IDS_RECONCILE_PER_RUN,
  MAX_TICKET_LIST_PAGES_PER_RUN,
  PENDING_TICKET_EPOCH_UTC,
  TICKET_LIST_PAGE_SIZE,
  isNumericLifecycleFixtureId,
  readPrematchLifecycleConfig,
  type PrematchLifecycleConfig,
} from "@/lib/prematch-lifecycle/config";
import { bundleMatchesLifecycleLeagues } from "@/lib/prematch-lifecycle/leagues";
import {
  emptyPrematchLifecycleReport,
  type PrematchLifecycleReport,
} from "@/lib/prematch-lifecycle/report";
import { createPrematchLifecycleTransport } from "@/lib/prematch-lifecycle/transport";
import {
  addUtcDays,
  resolveLifecycleClock,
  utcCalendarDate,
  utcCalendarDatePlusDays,
} from "@/lib/prematch-lifecycle/utc";

export type PrematchLifecycleDependencies = {
  nowUtc?: InjectedClock;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  config?: PrematchLifecycleConfig;
  listFixturesByDate?: (date: string) => Promise<ApexMatchBundle[]>;
  attachOdds?: (bundle: ApexMatchBundle) => Promise<ApexMatchBundle>;
  fetchFixturesByIds?: (ids: string[]) => Promise<ApexMatchBundle[]>;
  ticketStore?: PrematchDecisionTicketStore;
  evidenceStore?: FinalFixtureEvidenceStore;
  evaluationStore?: PrematchDecisionEvaluationStore;
};

function clockIso(clock: Date): string {
  return clock.toISOString();
}

function fixtureIdOf(bundle: ApexMatchBundle): string | null {
  return canonicalPrematchFixtureId(
    bundle.match.externalRefs[0]?.externalId ?? bundle.match.id,
  );
}

function vendorStatusOf(bundle: ApexMatchBundle): string | null {
  return bundle.match.vendorStatusShort ?? null;
}

function needsOddsFetch(bundle: ApexMatchBundle): boolean {
  return bundle.odds.length === 0;
}

function chunkIds(ids: string[], size: number): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    out.push(ids.slice(i, i + size));
  }
  return out;
}

function wrapSlice<T>(items: T[], start: number, count: number): T[] {
  if (items.length === 0 || count <= 0) return [];
  if (count >= items.length) return [...items];
  const origin = ((start % items.length) + items.length) % items.length;
  const out: T[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(items[(origin + i) % items.length]);
  }
  return out;
}

function rotatingListCursor(
  now: Date,
  fromUtc: string,
  toUtc: string,
): PrematchTicketListCursor {
  const from = Date.parse(fromUtc);
  const to = Date.parse(toUtc);
  const span = Math.max(1, to - from);
  const slot = Math.floor(now.getTime() / 3_600_000);
  const offset = (slot * 24 * 3_600_000) % span;
  return {
    kickoffUtc: new Date(from + offset).toISOString(),
    ticketId: "!",
  };
}

function idsReconcileOrigin(now: Date, length: number): number {
  if (length <= 0) return 0;
  const slot = Math.floor(now.getTime() / 3_600_000);
  return (slot * 15) % length;
}

function scoreableObservationComplete(bundle: ApexMatchBundle): boolean {
  const ft = bundle.match.score.periods?.ft;
  return isValidGoalCount(ft?.home) && isValidGoalCount(ft?.away);
}

function indexBundles(
  bundles: ApexMatchBundle[],
): Map<string, ApexMatchBundle> {
  const index = new Map<string, ApexMatchBundle>();
  for (const bundle of bundles) {
    const id = fixtureIdOf(bundle);
    if (!id || index.has(id)) continue;
    index.set(id, bundle);
  }
  return index;
}

function noteIsolatedError(report: PrematchLifecycleReport): void {
  report.errorCount += 1;
}

function noteFatalError(report: PrematchLifecycleReport): void {
  report.errorCount += 1;
  report.fatalErrorCount += 1;
}

async function discoverDateCatalogues(
  dates: string[],
  listFixturesByDate: (date: string) => Promise<ApexMatchBundle[]>,
  report: PrematchLifecycleReport,
): Promise<ApexMatchBundle[]> {
  const discovered: ApexMatchBundle[] = [];
  const seen = new Set<string>();
  let successfulDates = 0;
  for (const date of dates) {
    let rows: ApexMatchBundle[];
    try {
      rows = await listFixturesByDate(date);
      successfulDates += 1;
    } catch (error) {
      // Per-date catalogue failure: counted in errorCount. Run-level fatal
      // only when every discovery date fails (below) or quota stops the loop
      // with zero successful dates.
      report.errorCount += 1;
      if (isQuotaError(error)) {
        if (successfulDates === 0) report.fatalErrorCount += 1;
        break;
      }
      continue;
    }
    for (const bundle of rows) {
      const id = fixtureIdOf(bundle);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      discovered.push(bundle);
    }
  }
  if (dates.length > 0 && successfulDates === 0 && report.fatalErrorCount === 0) {
    report.fatalErrorCount += 1;
  }
  return discovered;
}

export async function runPrematchLifecycle(
  deps: PrematchLifecycleDependencies = {},
): Promise<PrematchLifecycleReport> {
  const now = resolveLifecycleClock(deps.nowUtc);
  const nowIso = clockIso(now);
  const env = deps.env ?? process.env;
  const config = deps.config ?? readPrematchLifecycleConfig(env);
  const report = emptyPrematchLifecycleReport(
    nowIso,
    config.leagueIds.length,
  );
  report.leagueAllowlistInvalid = config.leagueAllowlistInvalid;
  if (config.leagueAllowlistInvalid) {
    noteFatalError(report);
  }

  const transport =
    deps.listFixturesByDate && deps.attachOdds && deps.fetchFixturesByIds
      ? null
      : createPrematchLifecycleTransport(env);
  const listFixturesByDate =
    deps.listFixturesByDate ?? transport!.listFixturesByDate;
  const attachOdds = deps.attachOdds ?? transport!.attachOdds;
  const fetchFixturesByIds =
    deps.fetchFixturesByIds ?? transport!.fetchFixturesByIds;

  const ticketStore = deps.ticketStore ?? getPrematchDecisionTicketStore();
  const evidenceStore = deps.evidenceStore ?? getFinalFixtureEvidenceStore();
  const evaluationStore =
    deps.evaluationStore ?? getPrematchDecisionEvaluationStore();

  const today = utcCalendarDate(now);
  const tomorrow = utcCalendarDatePlusDays(now, 1);
  const discovered = await discoverDateCatalogues(
    [today, tomorrow],
    listFixturesByDate,
    report,
  );
  report.discoveredFixtureCount = discovered.length;
  const discoveredById = indexBundles(discovered);

  const eligible: ApexMatchBundle[] = [];
  if (config.leagueIds.length > 0) {
    for (const bundle of discovered) {
      if (!bundleMatchesLifecycleLeagues(bundle, config.leagueIds)) {
        report.skippedCount += 1;
        continue;
      }
      if (vendorStatusOf(bundle) !== ACTIONABLE_VENDOR_STATUS) {
        report.skippedCount += 1;
        continue;
      }
      const window = evaluatePrematchCaptureWindow({
        kickoffUtc: bundle.match.kickoffAt,
        nowUtc: now,
      });
      if (!window.inWindow) {
        report.skippedCount += 1;
        continue;
      }
      eligible.push(bundle);
    }
  } else {
    report.skippedCount += discovered.length;
  }
  report.eligibleT120Count = eligible.length;

  const missing: ApexMatchBundle[] = [];
  for (const bundle of eligible) {
    const fixtureId = fixtureIdOf(bundle);
    if (!fixtureId) {
      report.skippedCount += 1;
      continue;
    }
    const proof = await confirmDurableByFixtureId(ticketStore, fixtureId);
    if (proof.confirmed) {
      report.alreadyTicketedCount += 1;
      continue;
    }
    if (proof.reason === "DURABLE_STORE_UNAVAILABLE") {
      noteFatalError(report);
      continue;
    }
    missing.push(bundle);
  }

  missing.sort((a, b) => {
    const kickoff =
      a.match.kickoffAt.localeCompare(b.match.kickoffAt) ||
      (fixtureIdOf(a) ?? "").localeCompare(fixtureIdOf(b) ?? "");
    return kickoff;
  });
  const capped = missing.slice(0, config.maxNewTicketsPerRun);
  report.skippedCount += missing.length - capped.length;
  report.newTicketAttempts = capped.length;

  for (const bundle of capped) {
    const fixtureId = fixtureIdOf(bundle);
    if (!fixtureId) {
      noteIsolatedError(report);
      continue;
    }
    const proof = await confirmDurableByFixtureId(ticketStore, fixtureId);
    if (proof.confirmed) {
      report.newTicketsIdempotent += 1;
      continue;
    }
    if (proof.reason === "DURABLE_STORE_UNAVAILABLE") {
      noteFatalError(report);
      continue;
    }
    try {
      if (needsOddsFetch(bundle)) report.oddsRequests += 1;
      const withOdds = await attachOdds(bundle);
      report.peComputations += 1;
      const center = createScannerMatchCenter(withOdds);
      const captured = await captureScannerPrematchTicketFromCenter({
        center,
        leagueId: bundle.league?.id ?? null,
        season: bundle.league?.season ?? null,
        clock: now,
        store: ticketStore,
      });
      if (!captured) {
        noteIsolatedError(report);
        continue;
      }
      if (!captured.ok) {
        if (captured.status === "durable_unavailable") {
          noteFatalError(report);
        } else {
          report.skippedCount += 1;
        }
        continue;
      }
      if (captured.status === "created") report.newTicketsCreated += 1;
      else report.newTicketsIdempotent += 1;
    } catch (error) {
      if (isQuotaError(error)) {
        noteFatalError(report);
        break;
      }
      noteIsolatedError(report);
    }
  }

  await finalizeTicketedFixtures({
    now,
    nowIso,
    discoveredById,
    fetchFixturesByIds,
    ticketStore,
    evidenceStore,
    evaluationStore,
    report,
  });

  report.completedAtUtc = new Date().toISOString();
  return report;
}

async function listPendingTicketsPaged(input: {
  now: Date;
  ticketStore: PrematchDecisionTicketStore;
  report: PrematchLifecycleReport;
}): Promise<PrematchDecisionTicket[] | null> {
  const fromUtc = PENDING_TICKET_EPOCH_UTC;
  const toUtc = clockIso(addUtcDays(input.now, 2));
  const start = rotatingListCursor(input.now, fromUtc, toUtc);
  const collected: PrematchDecisionTicket[] = [];
  const seen = new Set<string>();

  const pullPage = async (
    after: PrematchTicketListCursor | null,
  ): Promise<PrematchDecisionTicket[] | null> => {
    const listed = await input.ticketStore.listByKickoffRange(
      fromUtc,
      toUtc,
      TICKET_LIST_PAGE_SIZE,
      after,
    );
    if (!listed.ok) {
      noteFatalError(input.report);
      return null;
    }
    input.report.ticketListPages += 1;
    return listed.tickets;
  };

  const consume = (
    rows: PrematchDecisionTicket[],
    stopBefore: PrematchTicketListCursor | null,
  ): { halt: boolean; last: PrematchTicketListCursor | null } => {
    let last: PrematchTicketListCursor | null = null;
    for (const ticket of rows) {
      if (
        stopBefore &&
        comparePrematchTicketListCursor(ticket, stopBefore) >= 0
      ) {
        return { halt: true, last };
      }
      last = { kickoffUtc: ticket.kickoffUtc, ticketId: ticket.ticketId };
      if (seen.has(ticket.ticketId)) continue;
      seen.add(ticket.ticketId);
      collected.push(ticket);
    }
    return { halt: false, last };
  };

  let after: PrematchTicketListCursor | null = start;
  while (input.report.ticketListPages < MAX_TICKET_LIST_PAGES_PER_RUN) {
    const rows = await pullPage(after);
    if (rows == null) return null;
    if (rows.length === 0) break;
    const { last } = consume(rows, null);
    if (!last || rows.length < TICKET_LIST_PAGE_SIZE) break;
    after = last;
  }

  if (input.report.ticketListPages < MAX_TICKET_LIST_PAGES_PER_RUN) {
    after = null;
    while (input.report.ticketListPages < MAX_TICKET_LIST_PAGES_PER_RUN) {
      const rows = await pullPage(after);
      if (rows == null) return null;
      if (rows.length === 0) break;
      const { halt, last } = consume(rows, start);
      if (halt || !last || rows.length < TICKET_LIST_PAGE_SIZE) break;
      after = last;
    }
  }

  return collected;
}

async function finalizeTicketedFixtures(input: {
  now: Date;
  nowIso: string;
  discoveredById: Map<string, ApexMatchBundle>;
  fetchFixturesByIds: (ids: string[]) => Promise<ApexMatchBundle[]>;
  ticketStore: PrematchDecisionTicketStore;
  evidenceStore: FinalFixtureEvidenceStore;
  evaluationStore: PrematchDecisionEvaluationStore;
  report: PrematchLifecycleReport;
}): Promise<void> {
  const listed = await listPendingTicketsPaged(input);
  if (!listed) return;

  const pendingFetch: PrematchDecisionTicket[] = [];
  for (const ticket of listed) {
    try {
      const evidence = await input.evidenceStore.getCanonicalByFixtureId(
        ticket.fixtureId,
      );
      if (evidence) {
        // F3 accepted limitation: revision 1 remains canonical. This
        // coordinator does not re-observe provider corrections.
        await completeEvaluationFromEvidence({
          ticket,
          evidence,
          nowIso: input.nowIso,
          evaluationStore: input.evaluationStore,
          report: input.report,
        });
        continue;
      }
      input.report.finalizationCandidates += 1;
      const discovered = input.discoveredById.get(ticket.fixtureId);
      if (discovered) {
        await ingestTerminalBundle({
          bundle: discovered,
          source: "catalogue",
          nowIso: input.nowIso,
          ticketStore: input.ticketStore,
          evidenceStore: input.evidenceStore,
          evaluationStore: input.evaluationStore,
          report: input.report,
        });
        continue;
      }
      if (!isNumericLifecycleFixtureId(ticket.fixtureId)) {
        input.report.invalidFixtureIdCount += 1;
        input.report.skippedCount += 1;
        continue;
      }
      pendingFetch.push(ticket);
    } catch {
      noteIsolatedError(input.report);
    }
  }

  const uniquePending = [
    ...new Map(
      pendingFetch.map((ticket) => [ticket.fixtureId, ticket]),
    ).values(),
  ].sort(
    (a, b) =>
      comparePrematchTicketListCursor(a, b) ||
      a.fixtureId.localeCompare(b.fixtureId, "en"),
  );
  const fetchTickets = wrapSlice(
    uniquePending,
    idsReconcileOrigin(input.now, uniquePending.length),
    MAX_IDS_RECONCILE_PER_RUN,
  );
  const fetchIds = fetchTickets.map((ticket) => ticket.fixtureId);
  for (const batch of chunkIds(fetchIds, MAX_FIXTURES_PER_BATCH)) {
    if (batch.length === 0) continue;
    input.report.finalizationBatchRequests += 1;
    let bundles: ApexMatchBundle[] = [];
    try {
      bundles = await input.fetchFixturesByIds(batch);
    } catch (error) {
      if (isQuotaError(error)) {
        noteFatalError(input.report);
        break;
      }
      noteIsolatedError(input.report);
      continue;
    }
    const byId = indexBundles(bundles);
    for (const id of batch) {
      const bundle = byId.get(id);
      if (!bundle) continue;
      if (fixtureIdOf(bundle) !== id) continue;
      try {
        await ingestTerminalBundle({
          bundle,
          source: "reconcile",
          nowIso: input.nowIso,
          ticketStore: input.ticketStore,
          evidenceStore: input.evidenceStore,
          evaluationStore: input.evaluationStore,
          report: input.report,
        });
      } catch {
        noteIsolatedError(input.report);
      }
    }
  }
}

async function completeEvaluationFromEvidence(input: {
  ticket: PrematchDecisionTicket;
  evidence: Awaited<
    ReturnType<FinalFixtureEvidenceStore["getCanonicalByFixtureId"]>
  >;
  nowIso: string;
  evaluationStore: PrematchDecisionEvaluationStore;
  report: PrematchLifecycleReport;
}): Promise<void> {
  if (!input.evidence) return;
  if (isNonScoreableTerminalStatus(input.evidence.vendorStatusShort)) {
    return;
  }
  if (!regulationSettlementScore(input.evidence)) return;
  const existing = await input.evaluationStore.getByIdentity(
    input.ticket.ticketId,
    SETTLEMENT_POLICY_REGULATION_90_V1,
    input.evidence.observationRevision,
  );
  if (existing) {
    input.report.evaluationsIdempotent += 1;
    return;
  }
  const built = buildPrematchDecisionEvaluation({
    ticket: input.ticket,
    evidence: input.evidence,
    clock: input.nowIso,
  });
  if (!built) return;
  const inserted = await input.evaluationStore.insertIfAbsent(built);
  if (inserted.unavailable || !inserted.evaluation) {
    noteFatalError(input.report);
    return;
  }
  if (inserted.created) input.report.evaluationsCreated += 1;
  else input.report.evaluationsIdempotent += 1;
}

async function ingestTerminalBundle(input: {
  bundle: ApexMatchBundle;
  source: FinalEvidenceSource;
  nowIso: string;
  ticketStore: PrematchDecisionTicketStore;
  evidenceStore: FinalFixtureEvidenceStore;
  evaluationStore: PrematchDecisionEvaluationStore;
  report: PrematchLifecycleReport;
}): Promise<"ingested" | "not_final" | "skipped"> {
  const klass = classifyVendorFinalization(vendorStatusOf(input.bundle));
  if (klass === "NOT_FINAL") return "not_final";
  if (klass === "SCOREABLE_FINAL" && !scoreableObservationComplete(input.bundle)) {
    return "skipped";
  }
  const observation = observationFromApexBundle(input.bundle, input.source);
  if (!observation) return "skipped";
  const ingested = await ingestAlreadyFetchedFinalObservation(observation, {
    ticketStore: input.ticketStore,
    evidenceStore: input.evidenceStore,
    evaluationStore: input.evaluationStore,
    clock: input.nowIso,
  });
  if (ingested.evidenceCreated) input.report.evidenceCreated += 1;
  else if (ingested.result.state !== "rejected_not_final") {
    input.report.evidenceIdempotent += 1;
  }
  if (ingested.result.state === "void_non_scoreable") {
    input.report.voidTerminalCount += 1;
  }
  if (ingested.evaluationCreated) input.report.evaluationsCreated += 1;
  else if (ingested.result.state === "evaluated") {
    input.report.evaluationsIdempotent += 1;
  }
  if (ingested.result.state === "durable_unavailable") {
    noteFatalError(input.report);
  }
  return "ingested";
}
