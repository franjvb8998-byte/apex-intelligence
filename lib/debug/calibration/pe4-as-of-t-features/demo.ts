/**
 * PE-4I.16 — Deterministic offline demo on a few NON-holdout eligible targets.
 * Prints vectors + provenance. No metrics / fitting / provider HTTP.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import {
  materializeOfflineLedger,
  pe4I16ArtifactDir,
  pe4I16LocalCachePresent,
} from "@/lib/debug/calibration/pe4-as-of-t-features/ledger-materialize";
import {
  countTeamPerspective,
  expandTeamPerspectiveHistory,
  teamHistoryFor,
} from "@/lib/debug/calibration/pe4-as-of-t-features/team-perspective";
import { buildAsOfTFeatureVector } from "@/lib/debug/calibration/pe4-as-of-t-features/feature-vector";
import { PE4I15_WINDOW_CONTRACT } from "@/lib/debug/calibration/pe4-as-of-t-features/window-contract";
import { pe4I16Protocol } from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i16-protocol";
import type { Pe4I15HistoricalMatchLedgerRow } from "@/lib/debug/calibration/pe4-as-of-t-features/ledger";
import type { Pe4I16AsOfTFeatureVector } from "@/lib/debug/calibration/pe4-as-of-t-features/feature-vector";

export type Pe4I16DemoResult = {
  protocol: ReturnType<typeof pe4I16Protocol>;
  providerCallsMade: 0;
  noMetricsComputed: true;
  fixtureIdsUsed: string[];
  teamPerspectiveCounts: ReturnType<typeof countTeamPerspective>;
  vectors: Pe4I16AsOfTFeatureVector[];
  materialization: {
    ledgerRowCount: number;
    ledgerDigest: string;
    aetPenCount: number;
    calendar2025InLedger: number;
  };
  note: string;
};

const DEMO_WINDOW =
  PE4I15_WINDOW_CONTRACT.find((w) => w.kind === "last_n" && w.n === 5) ??
  PE4I15_WINDOW_CONTRACT[1]!;

/**
 * Pick deterministic NON-holdout FT targets with enough prior history potential.
 */
export function pickDemoTargets(
  ledger: readonly Pe4I15HistoricalMatchLedgerRow[],
  limit = 3,
): Pe4I15HistoricalMatchLedgerRow[] {
  const eligible = ledger
    .filter(
      (r) =>
        r.holdoutClassification === "dev_or_conf_eligible" &&
        (r.status ?? "").toUpperCase() === "FT" &&
        !r.regulationAmbiguity &&
        r.home.goals.presence === "present" &&
        r.away.goals.presence === "present",
    )
    .sort((a, b) => {
      const k = a.kickoffUtc.localeCompare(b.kickoffUtc);
      if (k !== 0) return k;
      return a.fixtureId.localeCompare(b.fixtureId);
    });

  // Prefer mid/late corpus so last-N history is non-empty.
  const start = Math.max(0, Math.floor(eligible.length * 0.6));
  const slice = eligible.slice(start);
  const picked: Pe4I15HistoricalMatchLedgerRow[] = [];
  for (const row of slice) {
    picked.push(row);
    if (picked.length >= limit) break;
  }
  // Fallback: take from end if mid-slice empty.
  if (picked.length < limit) {
    for (let i = eligible.length - 1; i >= 0 && picked.length < limit; i--) {
      const row = eligible[i]!;
      if (!picked.some((p) => p.fixtureId === row.fixtureId)) {
        picked.push(row);
      }
    }
  }
  return picked.sort((a, b) => a.fixtureId.localeCompare(b.fixtureId));
}

export function runPe4I16OfflineDemo(input?: {
  cwd?: string;
  writeArtifacts?: boolean;
  limit?: number;
}): Pe4I16DemoResult {
  const cwd = input?.cwd ?? process.cwd();
  if (!pe4I16LocalCachePresent(cwd)) {
    throw new Error(
      "PE-4I.16 demo requires offline cache (universe + 1094/1094 statistics)",
    );
  }

  const { rows, report } = materializeOfflineLedger({
    cwd,
    writeArtifacts: input?.writeArtifacts !== false,
  });

  const perspective = expandTeamPerspectiveHistory(rows);
  const counts = countTeamPerspective(perspective, rows.length);
  const targets = pickDemoTargets(rows, input?.limit ?? 3);

  const vectors: Pe4I16AsOfTFeatureVector[] = [];
  for (const target of targets) {
    // Home team perspective for the demo.
    const hist = teamHistoryFor(perspective, target.homeTeamId);
    const built = buildAsOfTFeatureVector({
      teamId: target.homeTeamId,
      teamHistory: hist,
      target: {
        fixtureId: target.fixtureId,
        kickoffUtc: target.kickoffUtc,
      },
      window: DEMO_WINDOW,
      venueFilter: "all",
      minObservations: 3,
    });
    if (built.ok) vectors.push(built.value);
  }

  const result: Pe4I16DemoResult = {
    protocol: pe4I16Protocol(),
    providerCallsMade: 0,
    noMetricsComputed: true,
    fixtureIdsUsed: vectors.map((v) => v.targetFixtureId),
    teamPerspectiveCounts: counts,
    vectors,
    materialization: {
      ledgerRowCount: report.ledgerRowCount,
      ledgerDigest: report.ledgerDigest,
      aetPenCount: report.aetPenCount,
      calendar2025InLedger: report.calendar2025InLedger,
    },
    note: "Offline demonstration only — vectors + provenance printed; no metrics, fitting, weights, odds/EV, or predictive comparison.",
  };

  if (input?.writeArtifacts !== false) {
    const dir = pe4I16ArtifactDir(cwd);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, "demo-vectors.json"),
      JSON.stringify(result, null, 2) + "\n",
      "utf8",
    );
    writeFileSync(
      path.join(dir, "team-perspective-counts.json"),
      JSON.stringify(counts, null, 2) + "\n",
      "utf8",
    );
  }

  return result;
}
