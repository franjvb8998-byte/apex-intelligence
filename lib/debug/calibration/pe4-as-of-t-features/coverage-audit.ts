/**
 * PE-4I.17 — Coverage auditors for offline DEV feature dataset.
 */

import { calendarKickoffYear } from "@/lib/debug/calibration/pe4-acquisition/holdout";
import type { Pe4I15HistoricalMatchLedgerRow } from "@/lib/debug/calibration/pe4-as-of-t-features/ledger";
import type { Pe4I16OptionalXgVector } from "@/lib/debug/calibration/pe4-as-of-t-features/xg-vector";
import type { Pe4I17TargetEligibilityReport } from "@/lib/debug/calibration/pe4-as-of-t-features/target-eligibility";
import type {
  Pe4I17EmitWindowId,
  Pe4I17VenueMode,
} from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i17-protocol";

export type Pe4I17HistoryDepthBucket =
  | "0"
  | "1"
  | "2"
  | "3+"
  | "5+"
  | "8+"
  | "10+";

export type Pe4I17PathAAuditRow = {
  targetFixtureId: string;
  teamId: string;
  competition: string;
  windowId: Pe4I17EmitWindowId;
  venueMode: Pe4I17VenueMode;
  observationCount: number;
  historyFixtureIds: readonly string[];
  ambiguityExclusions: {
    regulationAmbiguousRejectedFromHistory: number;
  };
  availability: readonly {
    familyId: string;
    status: "AVAILABLE" | "PARTIAL" | "UNAVAILABLE";
  }[];
};

export type Pe4I17PathBAuditRow = {
  populationKey: string;
  competition: string;
  windowId: Pe4I17EmitWindowId;
  pathB: Pe4I16OptionalXgVector;
};

export type Pe4I17CoverageAudits = {
  byCompetition: Record<
    string,
    {
      targets: number;
      pathARows: number;
      pathBRows: number;
      seasons: Record<string, number>;
      calendarYears: Record<string, number>;
    }
  >;
  byWindow: Record<
    string,
    {
      pathARows: number;
      pathBRows: number;
      meanObservationCount: number;
      byVenueMode: Record<string, number>;
    }
  >;
  byTeam: {
    uniqueTeams: number;
    rowsPerTeamMin: number;
    rowsPerTeamMax: number;
    rowsPerTeamMean: number;
    topTeamsByRows: Array<{ teamId: string; rows: number }>;
  };
  byVenue: Record<string, number>;
  byFeatureFamily: Record<
    string,
    { AVAILABLE: number; PARTIAL: number; UNAVAILABLE: number }
  >;
  historyDepth: Record<Pe4I17HistoryDepthBucket, number>;
  sparseHistoryCases: Array<{
    targetFixtureId: string;
    teamId: string;
    windowId: Pe4I17EmitWindowId;
    venueMode: Pe4I17VenueMode;
    observationCount: number;
  }>;
  xgCoverage: {
    pathARowCount: number;
    pathBRowCount: number;
    pathBPreservesPathAPopulation: boolean;
    byCompetitionWindow: Record<
      string,
      {
        pathARows: number;
        xgFull: number;
        xgPartial: number;
        xgNone: number;
      }
    >;
  };
  aetPen: {
    ledgerAetPenCount: number;
    ledgerAetCount: number;
    ledgerPenCount: number;
    excludedAsDevTargets: number;
    historyAmbiguityRejectionsObserved: number;
  };
  holdoutFirewall: {
    rawCalendar2025PresentInLedger: number;
    devTargetsFrom2025: number;
    devHistoryFrom2025: number;
    sealed: boolean;
  };
};

export function populationKey(input: {
  targetFixtureId: string;
  teamId: string;
  windowId: string;
  venueMode: string;
}): string {
  return [
    input.targetFixtureId,
    input.teamId,
    input.windowId,
    input.venueMode,
  ].join("|");
}

function historyDepthBuckets(n: number): Pe4I17HistoryDepthBucket[] {
  const buckets: Pe4I17HistoryDepthBucket[] = [];
  if (n === 0) buckets.push("0");
  if (n === 1) buckets.push("1");
  if (n === 2) buckets.push("2");
  if (n >= 3) buckets.push("3+");
  if (n >= 5) buckets.push("5+");
  if (n >= 8) buckets.push("8+");
  if (n >= 10) buckets.push("10+");
  return buckets;
}

function emptyFamilyCounts(): {
  AVAILABLE: number;
  PARTIAL: number;
  UNAVAILABLE: number;
} {
  return { AVAILABLE: 0, PARTIAL: 0, UNAVAILABLE: 0 };
}

function xgClass(pathB: Pe4I16OptionalXgVector): "full" | "partial" | "none" {
  if (!pathB.anyXgPresent) return "none";
  const forObs = pathB.expectedGoalsFor.obsCount;
  const againstObs = pathB.expectedGoalsAgainst.obsCount;
  const forMiss =
    pathB.expectedGoalsFor.missingCount + pathB.expectedGoalsFor.ambiguousCount;
  const againstMiss =
    pathB.expectedGoalsAgainst.missingCount +
    pathB.expectedGoalsAgainst.ambiguousCount;
  if (forObs > 0 && againstObs > 0 && forMiss === 0 && againstMiss === 0) {
    return "full";
  }
  return "partial";
}

export function auditCoverage(input: {
  ledger: readonly Pe4I15HistoricalMatchLedgerRow[];
  pathARecords: readonly Pe4I17PathAAuditRow[];
  pathBRecords: readonly Pe4I17PathBAuditRow[];
  pathAPopulationKeys: readonly string[];
  eligibility: Pe4I17TargetEligibilityReport;
}): Pe4I17CoverageAudits {
  const byCompetition: Pe4I17CoverageAudits["byCompetition"] = {};
  const byWindow: Pe4I17CoverageAudits["byWindow"] = {};
  const byVenue: Record<string, number> = {};
  const byFeatureFamily: Pe4I17CoverageAudits["byFeatureFamily"] = {};
  const historyDepth: Record<Pe4I17HistoryDepthBucket, number> = {
    "0": 0,
    "1": 0,
    "2": 0,
    "3+": 0,
    "5+": 0,
    "8+": 0,
    "10+": 0,
  };
  const sparseHistoryCases: Pe4I17CoverageAudits["sparseHistoryCases"] = [];
  const teamRowCounts = new Map<string, number>();
  const pathAKeys = new Set(input.pathAPopulationKeys);
  const pathBKeys = new Set(input.pathBRecords.map((r) => r.populationKey));
  const byCompetitionWindow: Pe4I17CoverageAudits["xgCoverage"]["byCompetitionWindow"] =
    {};
  let historyAmbiguityRejectionsObserved = 0;
  let devHistoryFrom2025 = 0;

  const eligibleSet = new Set(input.eligibility.eligibleFixtureIds);
  const targetsById = new Map(
    input.ledger
      .filter((r) => eligibleSet.has(r.fixtureId))
      .map((r) => [r.fixtureId, r]),
  );
  const ledgerById = new Map(input.ledger.map((r) => [r.fixtureId, r]));

  for (const id of input.eligibility.eligibleFixtureIds) {
    const t = targetsById.get(id);
    if (!t) continue;
    const comp = t.competition || "unknown";
    if (!byCompetition[comp]) {
      byCompetition[comp] = {
        targets: 0,
        pathARows: 0,
        pathBRows: 0,
        seasons: {},
        calendarYears: {},
      };
    }
    byCompetition[comp]!.targets += 1;
    const season = t.providerSeason || "unknown";
    byCompetition[comp]!.seasons[season] =
      (byCompetition[comp]!.seasons[season] ?? 0) + 1;
    const year = String(calendarKickoffYear(t.kickoffUtc) ?? "unknown");
    byCompetition[comp]!.calendarYears[year] =
      (byCompetition[comp]!.calendarYears[year] ?? 0) + 1;
  }

  for (const r of input.pathARecords) {
    byVenue[r.venueMode] = (byVenue[r.venueMode] ?? 0) + 1;
    teamRowCounts.set(r.teamId, (teamRowCounts.get(r.teamId) ?? 0) + 1);
    historyAmbiguityRejectionsObserved +=
      r.ambiguityExclusions.regulationAmbiguousRejectedFromHistory;

    if (!byWindow[r.windowId]) {
      byWindow[r.windowId] = {
        pathARows: 0,
        pathBRows: 0,
        meanObservationCount: 0,
        byVenueMode: {},
      };
    }
    byWindow[r.windowId]!.pathARows += 1;
    byWindow[r.windowId]!.byVenueMode[r.venueMode] =
      (byWindow[r.windowId]!.byVenueMode[r.venueMode] ?? 0) + 1;
    byWindow[r.windowId]!.meanObservationCount += r.observationCount;

    const comp = r.competition || "unknown";
    if (!byCompetition[comp]) {
      byCompetition[comp] = {
        targets: 0,
        pathARows: 0,
        pathBRows: 0,
        seasons: {},
        calendarYears: {},
      };
    }
    byCompetition[comp]!.pathARows += 1;

    for (const b of historyDepthBuckets(r.observationCount)) {
      historyDepth[b] += 1;
    }
    if (r.observationCount < 3) {
      sparseHistoryCases.push({
        targetFixtureId: r.targetFixtureId,
        teamId: r.teamId,
        windowId: r.windowId,
        venueMode: r.venueMode,
        observationCount: r.observationCount,
      });
    }

    for (const a of r.availability) {
      if (!byFeatureFamily[a.familyId]) {
        byFeatureFamily[a.familyId] = emptyFamilyCounts();
      }
      byFeatureFamily[a.familyId]![a.status] += 1;
    }

    for (const hid of r.historyFixtureIds) {
      const hist = ledgerById.get(hid);
      if (hist?.holdoutClassification === "calendar_2025_sealed_outcome") {
        devHistoryFrom2025 += 1;
      }
    }
  }

  for (const r of input.pathBRecords) {
    if (byWindow[r.windowId]) byWindow[r.windowId]!.pathBRows += 1;
    const comp = r.competition || "unknown";
    if (byCompetition[comp]) byCompetition[comp]!.pathBRows += 1;

    const cwKey = `${comp}|${r.windowId}`;
    if (!byCompetitionWindow[cwKey]) {
      byCompetitionWindow[cwKey] = {
        pathARows: 0,
        xgFull: 0,
        xgPartial: 0,
        xgNone: 0,
      };
    }
    byCompetitionWindow[cwKey]!.pathARows += 1;
    const cls = xgClass(r.pathB);
    if (cls === "full") byCompetitionWindow[cwKey]!.xgFull += 1;
    else if (cls === "partial") byCompetitionWindow[cwKey]!.xgPartial += 1;
    else byCompetitionWindow[cwKey]!.xgNone += 1;
  }

  for (const w of Object.values(byWindow)) {
    w.meanObservationCount =
      w.pathARows === 0 ? 0 : w.meanObservationCount / w.pathARows;
  }

  let rawCalendar2025 = 0;
  let ledgerAet = 0;
  let ledgerPen = 0;
  for (const row of input.ledger) {
    if (row.holdoutClassification === "calendar_2025_sealed_outcome") {
      rawCalendar2025 += 1;
    }
    const st = (row.status ?? "").toUpperCase();
    if (st === "AET") ledgerAet += 1;
    if (st === "PEN") ledgerPen += 1;
  }

  const excludedAsDevTargets =
    input.eligibility.exclusionCounts
      .aet_pen_ambiguous_regulation_default_exclude;

  const teamCounts = [...teamRowCounts.values()];
  const sortedTeams = [...teamRowCounts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });

  const pathBPreservesPathAPopulation =
    pathAKeys.size === pathBKeys.size &&
    [...pathAKeys].every((k) => pathBKeys.has(k)) &&
    input.pathARecords.length === input.pathBRecords.length;

  sparseHistoryCases.sort((a, b) => {
    const ka = [a.targetFixtureId, a.teamId, a.windowId, a.venueMode].join(
      "|",
    );
    const kb = [b.targetFixtureId, b.teamId, b.windowId, b.venueMode].join(
      "|",
    );
    return ka.localeCompare(kb);
  });

  const devTargetsFrom2025 = input.eligibility.eligibleFixtureIds.filter(
    (id) => {
      const t = targetsById.get(id);
      return t?.holdoutClassification === "calendar_2025_sealed_outcome";
    },
  ).length;

  return {
    byCompetition,
    byWindow,
    byTeam: {
      uniqueTeams: teamRowCounts.size,
      rowsPerTeamMin: teamCounts.length ? Math.min(...teamCounts) : 0,
      rowsPerTeamMax: teamCounts.length ? Math.max(...teamCounts) : 0,
      rowsPerTeamMean:
        teamCounts.length === 0
          ? 0
          : teamCounts.reduce((s, n) => s + n, 0) / teamCounts.length,
      topTeamsByRows: sortedTeams.slice(0, 25).map(([teamId, rows]) => ({
        teamId,
        rows,
      })),
    },
    byVenue,
    byFeatureFamily,
    historyDepth,
    sparseHistoryCases: sparseHistoryCases.slice(0, 500),
    xgCoverage: {
      pathARowCount: input.pathARecords.length,
      pathBRowCount: input.pathBRecords.length,
      pathBPreservesPathAPopulation,
      byCompetitionWindow,
    },
    aetPen: {
      ledgerAetPenCount: ledgerAet + ledgerPen,
      ledgerAetCount: ledgerAet,
      ledgerPenCount: ledgerPen,
      excludedAsDevTargets,
      historyAmbiguityRejectionsObserved,
    },
    holdoutFirewall: {
      rawCalendar2025PresentInLedger: rawCalendar2025,
      devTargetsFrom2025,
      devHistoryFrom2025,
      sealed: devTargetsFrom2025 === 0 && devHistoryFrom2025 === 0,
    },
  };
}
