/**
 * Sprint 5A — removable Probability Engine diagnostic instrumentation.
 *
 * Observability only. Does not change Elo, Poisson, blend, confidence,
 * Decision Engine, scoring, or vendor I/O. No-ops unless an env flag is set.
 *
 * Remove: delete this file and the `maybeEmitProbabilityDiagnostic` call site
 * in `createMatchCenterFromApexBundle`.
 */

import { confidenceFromHybrid } from "@/lib/intelligence/modules/probability/confidence-from-hybrid";
import type { HybridProbabilityResult } from "@/lib/intelligence/modules/probability/hybrid/types";
import { matchesFixtureId } from "@/lib/match-center/fixture-id";

export type ProbabilityDiagnosticContext =
  | "scanner"
  | "match_center"
  | "match_analysis"
  | "unknown";

export type EloSource =
  | "catalogue"
  | "estimated_hash"
  | "explicit"
  | "unknown";

export type EloDerivation = {
  elo: number;
  source: EloSource;
  /** Base passed into catalogue / hash derivation; null when Elo was explicit. */
  base: number | null;
  played: number | null;
  wins: number | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
  /** Value used by catalogue Elo: (GF ?? 0) − (GA ?? 0). Null on other sources. */
  goalDifference: number | null;
  /** `elo - base` when source is estimated_hash; not a re-hash of the team id. */
  hashOffset: number | null;
};

export type ProbabilityDiagnosticSide = EloDerivation & {
  teamName: string;
  canonicalTeamId: string;
  providerTeamId: string | null;
};

export type ProbabilityDiagnostic = {
  kind: "apex.probability_diagnostic";
  context: ProbabilityDiagnosticContext;
  matchId: string;
  providerFixtureId: string | null;
  competition: string | null;
  season: string | null;
  homeName: string;
  awayName: string;
  home: ProbabilityDiagnosticSide;
  away: ProbabilityDiagnosticSide;
  homeElo: number;
  awayElo: number;
  eloDifference: number;
  expectedGoals: { home: number; away: number };
  eloOneXTwo: { home: number; draw: number; away: number };
  poissonOneXTwo: { home: number; draw: number; away: number };
  hybridOneXTwo: { home: number; draw: number; away: number };
  poissonBlendWeight: number;
  confidence: number;
  confidenceBand: "low" | "medium" | "high";
};

export type ProbabilityDiagnosticEnv = Record<string, string | undefined>;

export type ProbabilityDiagnosticLog = (
  message: string,
  record: ProbabilityDiagnostic,
) => void;

const DIAGNOSTIC_FLAG = "APEX_PROBABILITY_DIAGNOSTIC";
const DIAGNOSTIC_FIXTURE = "APEX_PROBABILITY_DIAGNOSTIC_FIXTURE";

const GLOBAL_SLOT = Symbol.for("apex.probabilityDiagnosticLog");

type DiagnosticGlobal = typeof globalThis & {
  [GLOBAL_SLOT]?: ProbabilityDiagnosticLog | null;
};

function readBoundLog(): ProbabilityDiagnosticLog | null {
  return (globalThis as DiagnosticGlobal)[GLOBAL_SLOT] ?? null;
}

export function bindProbabilityDiagnosticLog(
  log: ProbabilityDiagnosticLog | null,
): void {
  (globalThis as DiagnosticGlobal)[GLOBAL_SLOT] = log;
}

function isTruthyFlag(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "on"
  );
}

export function isProbabilityDiagnosticEnabled(
  env: ProbabilityDiagnosticEnv = process.env,
): boolean {
  if (env[DIAGNOSTIC_FIXTURE]?.trim()) return true;
  return isTruthyFlag(env[DIAGNOSTIC_FLAG]);
}

export function shouldEmitProbabilityDiagnostic(
  match: { id: string; externalId?: string | null },
  env: ProbabilityDiagnosticEnv = process.env,
): boolean {
  if (!isProbabilityDiagnosticEnabled(env)) return false;
  const fixture = env[DIAGNOSTIC_FIXTURE]?.trim();
  if (fixture) return matchesFixtureId(match, fixture);
  return true;
}

function copyTriple(value: {
  home: number;
  draw: number;
  away: number;
}): { home: number; draw: number; away: number } {
  return { home: value.home, draw: value.draw, away: value.away };
}

export function buildProbabilityDiagnostic(input: {
  context: ProbabilityDiagnosticContext;
  matchId: string;
  providerFixtureId: string | null;
  competition: string | null;
  season: string | null;
  home: ProbabilityDiagnosticSide;
  away: ProbabilityDiagnosticSide;
  hybrid: HybridProbabilityResult;
}): ProbabilityDiagnostic {
  const confidence = confidenceFromHybrid(input.hybrid);
  return {
    kind: "apex.probability_diagnostic",
    context: input.context,
    matchId: input.matchId,
    providerFixtureId: input.providerFixtureId,
    competition: input.competition,
    season: input.season,
    homeName: input.home.teamName,
    awayName: input.away.teamName,
    home: input.home,
    away: input.away,
    homeElo: input.home.elo,
    awayElo: input.away.elo,
    eloDifference: input.home.elo - input.away.elo,
    expectedGoals: {
      home: input.hybrid.expectedGoals.home,
      away: input.hybrid.expectedGoals.away,
    },
    eloOneXTwo: copyTriple(input.hybrid.elo.oneXTwo),
    poissonOneXTwo: copyTriple(input.hybrid.poisson.oneXTwo),
    hybridOneXTwo: copyTriple(input.hybrid.oneXTwo),
    poissonBlendWeight: input.hybrid.meta.poissonBlendWeight,
    confidence: confidence.value,
    confidenceBand: confidence.band,
  };
}

function fmtStat(value: number | null): string {
  return value == null ? "unavailable" : String(value);
}

function fmtSigned(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function fmtProb(value: number): string {
  return value.toFixed(4);
}

function fmtXg(value: number): string {
  return value.toFixed(4);
}

function roundedTriple(p: {
  home: number;
  draw: number;
  away: number;
}): string {
  return `${Math.round(p.home * 100)}/${Math.round(p.draw * 100)}/${Math.round(p.away * 100)}`;
}

function formatSide(label: string, side: ProbabilityDiagnosticSide): string {
  const lines = [
    label,
    `Team: ${side.teamName}`,
    `Canonical id: ${side.canonicalTeamId}`,
    `Provider id: ${side.providerTeamId ?? "unavailable"}`,
    `Elo: ${side.elo}`,
    `Source: ${side.source}`,
    `Base: ${fmtStat(side.base)}`,
    `Played: ${fmtStat(side.played)}`,
    `Wins: ${fmtStat(side.wins)}`,
    `GF: ${fmtStat(side.goalsFor)}`,
    `GA: ${fmtStat(side.goalsAgainst)}`,
  ];
  if (side.source === "catalogue") {
    lines.push(`Goal difference: ${fmtStat(side.goalDifference)}`);
  }
  if (side.source === "estimated_hash" && side.hashOffset != null) {
    lines.push(`Hash offset: ${fmtSigned(side.hashOffset)}`);
  }
  return lines.join("\n");
}

export function formatProbabilityDiagnostic(
  record: ProbabilityDiagnostic,
): string {
  return [
    "=========================",
    "APEX Probability Diagnostic",
    "=========================",
    `Match: ${record.homeName} vs ${record.awayName}`,
    `Fixture: ${record.providerFixtureId ?? "unavailable"}`,
    `Canonical match id: ${record.matchId}`,
    `Competition: ${record.competition ?? "unavailable"}`,
    `Season: ${record.season ?? "unavailable"}`,
    `Context: ${record.context}`,
    "",
    formatSide("HOME", record.home),
    "",
    formatSide("AWAY", record.away),
    "",
    `Elo difference: ${fmtSigned(record.eloDifference)}`,
    `Expected goals: ${fmtXg(record.expectedGoals.home)} / ${fmtXg(record.expectedGoals.away)}`,
    `Elo 1X2: ${fmtProb(record.eloOneXTwo.home)} / ${fmtProb(record.eloOneXTwo.draw)} / ${fmtProb(record.eloOneXTwo.away)} (${roundedTriple(record.eloOneXTwo)})`,
    `Poisson 1X2: ${fmtProb(record.poissonOneXTwo.home)} / ${fmtProb(record.poissonOneXTwo.draw)} / ${fmtProb(record.poissonOneXTwo.away)} (${roundedTriple(record.poissonOneXTwo)})`,
    `Hybrid 1X2: ${fmtProb(record.hybridOneXTwo.home)} / ${fmtProb(record.hybridOneXTwo.draw)} / ${fmtProb(record.hybridOneXTwo.away)} (${roundedTriple(record.hybridOneXTwo)})`,
    `Blend: ${record.poissonBlendWeight}`,
    `Confidence: ${fmtProb(record.confidence)} (${record.confidenceBand})`,
    "=========================",
  ].join("\n");
}

export function maybeEmitProbabilityDiagnostic(
  record: ProbabilityDiagnostic,
  options: {
    env?: ProbabilityDiagnosticEnv;
    log?: ProbabilityDiagnosticLog;
  } = {},
): boolean {
  try {
    const env = options.env ?? process.env;
    const match = {
      id: record.matchId,
      externalId: record.providerFixtureId,
    };
    if (!shouldEmitProbabilityDiagnostic(match, env)) return false;
    const message = formatProbabilityDiagnostic(record);
    const log =
      options.log ??
      readBoundLog() ??
      ((text: string) => {
        console.info(text);
      });
    log(message, record);
    return true;
  } catch {
    return false;
  }
}
