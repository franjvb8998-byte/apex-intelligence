/**
 * PE-4I.19 — Offline as-of-M common-baseline opponent-strength catalogue.
 * Research only. Zero provider calls. No fitting. No outcome tuning.
 */

import { createHash } from "node:crypto";

import type { PrematchStrengthUniverseFixture } from "@/lib/match-center/prematch-strength/types";
import {
  createPe4HistoricalStrengthMemo,
  PE4_COMMON_BASELINE_RECONSTRUCTION_BASE,
  resolveHistoricalCommonBaselineStrength,
} from "@/lib/prematch-decision/pe4-form-schedule/historical-strength";
import { PE4_COMMON_BASELINE_STRENGTH_SEMANTICS } from "@/lib/prematch-decision/pe4-form-schedule/types";
import {
  assertCalendar2025OutcomeExcludedFromResearchPools,
  classifyHoldoutForResearch,
  type Pe4I15HoldoutClassification,
} from "@/lib/debug/calibration/pe4-as-of-t-features/holdout-firewall";
import type { Pe4I15HistoricalMatchLedgerRow } from "@/lib/debug/calibration/pe4-as-of-t-features/ledger";

export const PE4I19_PROTOCOL_VERSION =
  "PE4I19_AS_OF_M_STRENGTH_CATALOGUE_V1" as const;
export const PE4I19_PRODUCTION_WIRING = false as const;

export type Pe4I19StrengthEvidence = {
  strengthAsOfKickoffM: number;
  source: "catalogue" | "base_prior";
  played: number;
  reconstructionBase: typeof PE4_COMMON_BASELINE_RECONSTRUCTION_BASE;
  semantics: typeof PE4_COMMON_BASELINE_STRENGTH_SEMANTICS;
  comparableToVenueSpecificC0Elo: false;
};

export type Pe4I19StrengthCatalogueRow = {
  fixtureId: string;
  kickoffUtc: string;
  competition: string;
  providerSeason: string;
  homeTeamId: string;
  awayTeamId: string;
  home: Pe4I19StrengthEvidence;
  away: Pe4I19StrengthEvidence;
  historicalCutoffUtc: string;
  holdoutClassification: "dev_or_conf_eligible";
  targetRegulationAmbiguity: boolean;
  priorRegulationAmbiguityCandidateCount: number;
  evidenceUniverseFixtureIds: string[];
  evidenceUniverseDigest: string;
  ledgerProvenance: Pe4I15HistoricalMatchLedgerRow["provenance"];
  protocolVersion: typeof PE4I19_PROTOCOL_VERSION;
};

export type Pe4I19StrengthJoinValue = Pe4I19StrengthEvidence & {
  teamId: string;
  fixtureId: string;
  cutoffUtc: string;
};

export type Pe4I19StrengthCatalogue = {
  rows: Pe4I19StrengthCatalogueRow[];
  strengthByTeamAndKickoffM: Map<string, Pe4I19StrengthJoinValue>;
  excludedHoldoutCounts: Record<Pe4I15HoldoutClassification, number>;
  identicalDuplicateFixtureCount: number;
  conflictedStrengthKeyCount: number;
  targetRegulationAmbiguityCount: number;
  priorRegulationAmbiguityCandidateCount: number;
  digest: string;
  providerCallsMade: 0;
  productionWiring: false;
};

function sha(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function toPrematchUniverseFixture(
  row: Pe4I15HistoricalMatchLedgerRow,
): PrematchStrengthUniverseFixture {
  return {
    fixtureId: row.fixtureId,
    kickoffUtc: row.kickoffUtc,
    homeTeamId: row.homeTeamId,
    awayTeamId: row.awayTeamId,
    competitionId: row.competition,
    season: row.providerSeason,
    status: row.status,
    homeGoals: row.home.goals.presence === "present" ? row.home.goals.value : null,
    awayGoals: row.away.goals.presence === "present" ? row.away.goals.value : null,
  };
}

function canonicalLedgerIdentity(row: Pe4I15HistoricalMatchLedgerRow): string {
  return JSON.stringify(toPrematchUniverseFixture(row));
}

function normalizeLedgerRows(rows: readonly Pe4I15HistoricalMatchLedgerRow[]): {
  rows: Pe4I15HistoricalMatchLedgerRow[];
  identicalDuplicateFixtureCount: number;
} {
  const byFixture = new Map<string, Pe4I15HistoricalMatchLedgerRow>();
  let identicalDuplicateFixtureCount = 0;
  for (const row of rows) {
    const previous = byFixture.get(row.fixtureId);
    if (!previous) {
      byFixture.set(row.fixtureId, row);
      continue;
    }
    if (canonicalLedgerIdentity(previous) !== canonicalLedgerIdentity(row)) {
      throw new Error(`PE-4I.19 conflicting duplicate fixture ${row.fixtureId}`);
    }
    identicalDuplicateFixtureCount += 1;
  }
  return {
    rows: [...byFixture.values()].sort((a, b) =>
      a.kickoffUtc.localeCompare(b.kickoffUtc) || a.fixtureId.localeCompare(b.fixtureId),
    ),
    identicalDuplicateFixtureCount,
  };
}

function evidenceFrom(
  resolved: ReturnType<typeof resolveHistoricalCommonBaselineStrength>,
  fixtureId: string,
  side: "home" | "away",
): Pe4I19StrengthEvidence {
  if (
    !resolved.available ||
    resolved.strengthAsOfCutoff == null ||
    resolved.source == null ||
    resolved.played == null ||
    resolved.reconstructionBase !== PE4_COMMON_BASELINE_RECONSTRUCTION_BASE
  ) {
    throw new Error(
      `PE-4I.19 ${side} common-baseline reconstruction unavailable fixture=${fixtureId}`,
    );
  }
  return {
    strengthAsOfKickoffM: resolved.strengthAsOfCutoff,
    source: resolved.source,
    played: resolved.played,
    reconstructionBase: PE4_COMMON_BASELINE_RECONSTRUCTION_BASE,
    semantics: PE4_COMMON_BASELINE_STRENGTH_SEMANTICS,
    comparableToVenueSpecificC0Elo: false,
  };
}

export function pe4I19StrengthJoinKey(teamId: string, kickoffUtc: string): string {
  return `${teamId}\0${kickoffUtc}`;
}

/** Materialize common-baseline team strengths strictly as of each match M. */
export function materializePe4I19StrengthCatalogue(
  ledgerRows: readonly Pe4I15HistoricalMatchLedgerRow[],
): Pe4I19StrengthCatalogue {
  const normalized = normalizeLedgerRows(ledgerRows);
  const ordered = normalized.rows;
  const memo = createPe4HistoricalStrengthMemo();
  const rows: Pe4I19StrengthCatalogueRow[] = [];
  const strengthByTeamAndKickoffM = new Map<string, Pe4I19StrengthJoinValue>();
  const conflictedStrengthKeys = new Set<string>();
  const excludedHoldoutCounts: Record<Pe4I15HoldoutClassification, number> = {
    dev_or_conf_eligible: 0,
    calendar_2025_sealed_outcome: 0,
    provider_season_2025_forbidden: 0,
    unknown_kickoff: 0,
  };
  let targetRegulationAmbiguityCount = 0;
  let priorRegulationAmbiguityCandidateCount = 0;

  for (const targetRow of ordered) {
    const holdout = classifyHoldoutForResearch({
      kickoffUtc: targetRow.kickoffUtc,
      providerSeasonId: targetRow.providerSeason,
    });
    const firewall = assertCalendar2025OutcomeExcludedFromResearchPools({
      kickoffUtc: targetRow.kickoffUtc,
      providerSeasonId: targetRow.providerSeason,
      pool: "FEATURE_SELECTION",
    });
    if (!firewall.ok || holdout !== "dev_or_conf_eligible") {
      excludedHoldoutCounts[holdout] += 1;
      continue;
    }

    const scopedRows = ordered.filter(
      (candidate) =>
        candidate.competition === targetRow.competition &&
        candidate.providerSeason === targetRow.providerSeason,
    );
    const scopedUniverse = scopedRows.map(toPrematchUniverseFixture);
    const commonInput = {
      matchFixtureId: targetRow.fixtureId,
      matchKickoffUtc: targetRow.kickoffUtc,
      competitionId: targetRow.competition,
      season: targetRow.providerSeason,
      universe: scopedUniverse,
      memo,
    };
    const home = evidenceFrom(
      resolveHistoricalCommonBaselineStrength({
        ...commonInput,
        teamId: targetRow.homeTeamId,
      }),
      targetRow.fixtureId,
      "home",
    );
    const away = evidenceFrom(
      resolveHistoricalCommonBaselineStrength({
        ...commonInput,
        teamId: targetRow.awayTeamId,
      }),
      targetRow.fixtureId,
      "away",
    );

    const evidenceRows = scopedRows.filter(
      (candidate) =>
        candidate.fixtureId !== targetRow.fixtureId &&
        candidate.kickoffUtc < targetRow.kickoffUtc,
    );
    const evidenceUniverseFixtureIds = evidenceRows
      .map((candidate) => candidate.fixtureId)
      .sort((a, b) => a.localeCompare(b));
    const ambiguousCandidates = evidenceRows.filter(
      (candidate) => candidate.regulationAmbiguity,
    ).length;
    priorRegulationAmbiguityCandidateCount += ambiguousCandidates;
    if (targetRow.regulationAmbiguity) targetRegulationAmbiguityCount += 1;

    const row: Pe4I19StrengthCatalogueRow = {
      fixtureId: targetRow.fixtureId,
      kickoffUtc: targetRow.kickoffUtc,
      competition: targetRow.competition,
      providerSeason: targetRow.providerSeason,
      homeTeamId: targetRow.homeTeamId,
      awayTeamId: targetRow.awayTeamId,
      home,
      away,
      historicalCutoffUtc: targetRow.kickoffUtc,
      holdoutClassification: "dev_or_conf_eligible",
      targetRegulationAmbiguity: targetRow.regulationAmbiguity,
      priorRegulationAmbiguityCandidateCount: ambiguousCandidates,
      evidenceUniverseFixtureIds,
      evidenceUniverseDigest: sha(
        evidenceRows.map((candidate) => toPrematchUniverseFixture(candidate)),
      ),
      ledgerProvenance: targetRow.provenance,
      protocolVersion: PE4I19_PROTOCOL_VERSION,
    };
    rows.push(row);

    for (const [teamId, evidence] of [
      [targetRow.homeTeamId, home],
      [targetRow.awayTeamId, away],
    ] as const) {
      const key = pe4I19StrengthJoinKey(teamId, targetRow.kickoffUtc);
      if (conflictedStrengthKeys.has(key)) continue;
      if (strengthByTeamAndKickoffM.has(key)) {
        strengthByTeamAndKickoffM.delete(key);
        conflictedStrengthKeys.add(key);
        continue;
      }
      strengthByTeamAndKickoffM.set(key, {
        ...evidence,
        teamId,
        fixtureId: targetRow.fixtureId,
        cutoffUtc: targetRow.kickoffUtc,
      });
    }
  }

  return {
    rows,
    strengthByTeamAndKickoffM,
    excludedHoldoutCounts,
    identicalDuplicateFixtureCount: normalized.identicalDuplicateFixtureCount,
    conflictedStrengthKeyCount: conflictedStrengthKeys.size,
    targetRegulationAmbiguityCount,
    priorRegulationAmbiguityCandidateCount,
    digest: sha(rows),
    providerCallsMade: 0,
    productionWiring: PE4I19_PRODUCTION_WIRING,
  };
}
