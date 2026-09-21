/**
 * Snapshot already-published Scanner / Match Center output.
 * Does not call the Probability Engine or any provider.
 */

import type { MatchCenterData } from "@/lib/match-center/types";
import {
  createPrematchDecisionTicket,
  type CreatePrematchDecisionTicketResult,
} from "@/lib/prematch-decision/create";
import { publishedSnapshotFromMatchAnalysis } from "@/lib/prematch-decision/from-match-analysis";
import type { InjectedClock } from "@/lib/prematch-decision/actionability";
import type { PrematchDecisionTicketStore } from "@/lib/prematch-decision/store";
import type { PrematchPublishedSnapshot } from "@/lib/prematch-decision/ticket";

export function publishedSnapshotFromMatchCenter(
  data: MatchCenterData,
  extras: {
    leagueId?: string | null;
    season?: string | null;
  } = {},
): PrematchPublishedSnapshot {
  return publishedSnapshotFromMatchAnalysis(data.preview.analysis, {
    leagueId: extras.leagueId ?? null,
    season: extras.season ?? null,
    odds: data.preview.dashboard.odds,
    injuries: data.preview.dashboard.injuries,
    homeForm: data.preview.dashboard.form.home,
    awayForm: data.preview.dashboard.form.away,
    sourceMode: "scanner",
  });
}

function logTicketCaptureFailure(): void {
  console.error("[prematch-decision] durable ticket capture failed");
}

let loggedUnavailable = false;

function logDurableUnavailable(): void {
  if (process.env.VITEST === "true" || process.env.NODE_ENV === "test") return;
  if (loggedUnavailable) return;
  loggedUnavailable = true;
  console.error("[prematch-decision] durable ticket store unavailable");
}

export async function captureScannerPrematchTicket(input: {
  published: PrematchPublishedSnapshot;
  clock?: InjectedClock;
  store?: PrematchDecisionTicketStore;
}): Promise<CreatePrematchDecisionTicketResult | null> {
  try {
    const result = await createPrematchDecisionTicket({
      published: {
        ...input.published,
        sourceMode: "scanner",
      },
      clock: input.clock,
      store: input.store,
    });
    if (!result.ok && result.status === "durable_unavailable") {
      logDurableUnavailable();
    }
    return result;
  } catch {
    logTicketCaptureFailure();
    return null;
  }
}

export async function captureScannerPrematchTicketFromCenter(input: {
  center: MatchCenterData;
  leagueId?: string | null;
  season?: string | null;
  clock?: InjectedClock;
  store?: PrematchDecisionTicketStore;
}): Promise<CreatePrematchDecisionTicketResult | null> {
  return captureScannerPrematchTicket({
    published: publishedSnapshotFromMatchCenter(input.center, {
      leagueId: input.leagueId,
      season: input.season,
    }),
    clock: input.clock,
    store: input.store,
  });
}
