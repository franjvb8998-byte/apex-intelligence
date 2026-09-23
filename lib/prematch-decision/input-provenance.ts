/**
 * Prematch input provenance — durable, versioned, extensible.
 *
 * Additive on tickets (payload JSON). Missing field ⇒ legacy
 * REGIME_LIFECYCLE_BASE_PRIOR_V1 interpretation (never rewrite old rows).
 *
 * Present-but-malformed or unknown future regime ⇒ INVALID / UNKNOWN
 * (fail closed for cohorts — never silent BASE).
 *
 * Does not change PE math. Distinguishes MODEL VERSION from INPUT REGIME.
 */

import type { PrematchStrengthResult } from "@/lib/match-center/prematch-strength";
import {
  PREMATCH_STRENGTH_REGIME_C0_RECON_V1,
  type PrematchStrengthEloSource,
  type PrematchStrengthFallbackReason,
} from "@/lib/match-center/prematch-strength";

/** Semantic input regime for lifecycle PE inputs (not PE formula version). */
export const REGIME_LIFECYCLE_BASE_PRIOR_V1 =
  "REGIME_LIFECYCLE_BASE_PRIOR_V1" as const;
export const REGIME_LIFECYCLE_C0_RECON_V1 = PREMATCH_STRENGTH_REGIME_C0_RECON_V1;

export type PrematchInputRegime =
  | typeof REGIME_LIFECYCLE_BASE_PRIOR_V1
  | typeof REGIME_LIFECYCLE_C0_RECON_V1;

/** Provenance document version (independent of ticket schemaVersion). */
export const PREMATCH_INPUT_PROVENANCE_VERSION = "1.0.0" as const;

export type PrematchEloSideProvenance = {
  elo: number;
  source: PrematchStrengthEloSource;
  base: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
};

/**
 * Versioned input provenance frozen with a ticket.
 *
 * `contextLayers` reserved for future prematch-safe intelligence
 * (form, fatigue, lineups, …). Empty object in PE-3; unknown keys forward-compatible.
 */
export type PrematchInputProvenance = {
  provenanceVersion: typeof PREMATCH_INPUT_PROVENANCE_VERSION;
  inputRegime: PrematchInputRegime;
  /** Canonical PE modelVersion string (formula identity). */
  modelVersion: string | null;
  home: PrematchEloSideProvenance;
  away: PrematchEloSideProvenance;
  /**
   * Acquisition / prediction clock when evidence was reconstructed.
   * NOT a provider historical snapshot timestamp.
   */
  evidenceAcquiredAtUtc: string | null;
  /**
   * @deprecated Alias of evidenceAcquiredAtUtc (same acquisition-clock semantics).
   * Kept so older readers still see a timestamp field.
   */
  evidenceAsOfUtc: string | null;
  historicalCutoffUtc: string | null;
  priorsInspected: number | null;
  priorsAccepted: number | null;
  /** Versioned digest of accepted priors; null on legacy BASE helper path. */
  acceptedEvidenceDigest: string | null;
  fallback: boolean;
  fallbackReason: PrematchStrengthFallbackReason | "legacy_absent" | null;
  /**
   * Future extensibility slot. PE-3 always `{}`.
   * Later phases may add keyed layer snapshots without breaking readers.
   */
  contextLayers: Record<string, unknown>;
};

const KNOWN_REGIMES = new Set<string>([
  REGIME_LIFECYCLE_BASE_PRIOR_V1,
  REGIME_LIFECYCLE_C0_RECON_V1,
]);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isEloSide(value: unknown): value is PrematchEloSideProvenance {
  if (value == null || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    isFiniteNumber(row.elo) &&
    (row.source === "catalogue" || row.source === "base_prior") &&
    isFiniteNumber(row.base) &&
    isFiniteNumber(row.played) &&
    isFiniteNumber(row.wins) &&
    isFiniteNumber(row.draws) &&
    isFiniteNumber(row.losses) &&
    isFiniteNumber(row.goalsFor) &&
    isFiniteNumber(row.goalsAgainst) &&
    isFiniteNumber(row.goalDifference)
  );
}

/**
 * Structural validation for trustworthy cohort identity.
 * Does not require speculative future contextLayers keys.
 */
export function isPrematchInputProvenance(
  value: unknown,
): value is PrematchInputProvenance {
  if (value == null || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (row.provenanceVersion !== PREMATCH_INPUT_PROVENANCE_VERSION) return false;
  if (
    row.inputRegime !== REGIME_LIFECYCLE_BASE_PRIOR_V1 &&
    row.inputRegime !== REGIME_LIFECYCLE_C0_RECON_V1
  ) {
    return false;
  }
  if (!(row.modelVersion === null || typeof row.modelVersion === "string")) {
    return false;
  }
  if (!isEloSide(row.home) || !isEloSide(row.away)) return false;

  const acquiredOk =
    row.evidenceAcquiredAtUtc === undefined ||
    row.evidenceAcquiredAtUtc === null ||
    typeof row.evidenceAcquiredAtUtc === "string";
  const asOfOk =
    row.evidenceAsOfUtc === undefined ||
    row.evidenceAsOfUtc === null ||
    typeof row.evidenceAsOfUtc === "string";
  if (!acquiredOk || !asOfOk) return false;
  // At least one acquisition-clock field must be present (string or null).
  if (
    !("evidenceAcquiredAtUtc" in row) &&
    !("evidenceAsOfUtc" in row)
  ) {
    return false;
  }

  if (
    !(
      row.historicalCutoffUtc === null ||
      typeof row.historicalCutoffUtc === "string"
    )
  ) {
    return false;
  }
  if (
    !(
      row.priorsInspected === null ||
      isFiniteNumber(row.priorsInspected)
    )
  ) {
    return false;
  }
  if (
    !(
      row.priorsAccepted === null ||
      isFiniteNumber(row.priorsAccepted)
    )
  ) {
    return false;
  }
  if (
    !(
      row.acceptedEvidenceDigest === undefined ||
      row.acceptedEvidenceDigest === null ||
      typeof row.acceptedEvidenceDigest === "string"
    )
  ) {
    return false;
  }
  if (typeof row.fallback !== "boolean") return false;
  if (
    row.contextLayers == null ||
    typeof row.contextLayers !== "object" ||
    Array.isArray(row.contextLayers)
  ) {
    return false;
  }
  return true;
}

export type TicketInputRegimeResolution =
  | {
      kind: "legacy_absent";
      regime: typeof REGIME_LIFECYCLE_BASE_PRIOR_V1;
    }
  | { kind: "valid"; regime: PrematchInputRegime }
  | { kind: "invalid" }
  | { kind: "unknown"; regimeLabel: string };

/**
 * Fail-closed regime resolution for calibration / analytics.
 * Absent provenance → legacy BASE. Present malformed → invalid.
 * Present unknown regime string → unknown. Never maps C/D to BASE.
 */
export function resolveTicketInputRegimeResolution(ticket: {
  inputProvenance?: unknown;
}): TicketInputRegimeResolution {
  const raw = ticket.inputProvenance;
  if (raw == null) {
    return { kind: "legacy_absent", regime: REGIME_LIFECYCLE_BASE_PRIOR_V1 };
  }
  if (typeof raw !== "object") {
    return { kind: "invalid" };
  }
  const row = raw as Record<string, unknown>;
  const regime = row.inputRegime;
  if (typeof regime === "string" && !KNOWN_REGIMES.has(regime)) {
    return { kind: "unknown", regimeLabel: regime };
  }
  if (isPrematchInputProvenance(raw)) {
    return { kind: "valid", regime: raw.inputRegime };
  }
  return { kind: "invalid" };
}

/**
 * Safe cohort label when resolution is legacy or valid.
 * Throws on invalid / unknown — do not use for silent pooling.
 */
export function resolveTicketInputRegime(ticket: {
  inputProvenance?: unknown;
}): PrematchInputRegime {
  const resolved = resolveTicketInputRegimeResolution(ticket);
  if (resolved.kind === "legacy_absent" || resolved.kind === "valid") {
    return resolved.regime;
  }
  if (resolved.kind === "unknown") {
    throw new Error(
      `Cannot resolve ticket input regime: unknown regime ${resolved.regimeLabel}`,
    );
  }
  throw new Error("Cannot resolve ticket input regime: malformed provenance");
}

/** Guard: never pool distinct regimes or invalid/unknown in one calibration cohort. */
export function assertSameInputRegimeCohort(
  regimes: readonly PrematchInputRegime[],
): PrematchInputRegime {
  if (regimes.length === 0) {
    throw new Error("Calibration cohort requires at least one ticket regime");
  }
  const first = regimes[0]!;
  for (const regime of regimes) {
    if (regime !== first) {
      throw new Error(
        `Calibration cohort mixes input regimes: ${first} vs ${regime}`,
      );
    }
  }
  return first;
}

/**
 * Build a cohort from ticket resolutions; refuses INVALID/UNKNOWN.
 */
export function assertCohortFromTicketResolutions(
  resolutions: readonly TicketInputRegimeResolution[],
): PrematchInputRegime {
  const regimes: PrematchInputRegime[] = [];
  for (const resolved of resolutions) {
    if (resolved.kind === "invalid") {
      throw new Error("Calibration cohort refuses INVALID provenance");
    }
    if (resolved.kind === "unknown") {
      throw new Error(
        `Calibration cohort refuses UNKNOWN regime ${resolved.regimeLabel}`,
      );
    }
    regimes.push(resolved.regime);
  }
  return assertSameInputRegimeCohort(regimes);
}

export function provenanceFromC0Strength(input: {
  strength: PrematchStrengthResult;
  modelVersion: string | null;
}): PrematchInputProvenance {
  const { strength, modelVersion } = input;
  const acquired =
    strength.evidenceAcquiredAtUtc ?? strength.evidenceAsOfUtc ?? null;
  return {
    provenanceVersion: PREMATCH_INPUT_PROVENANCE_VERSION,
    inputRegime: REGIME_LIFECYCLE_C0_RECON_V1,
    modelVersion,
    home: {
      elo: strength.home.elo,
      source: strength.home.source,
      base: strength.home.base,
      played: strength.home.evidence.played,
      wins: strength.home.evidence.wins,
      draws: strength.home.evidence.draws,
      losses: strength.home.evidence.losses,
      goalsFor: strength.home.evidence.goalsFor,
      goalsAgainst: strength.home.evidence.goalsAgainst,
      goalDifference: strength.home.evidence.goalDifference,
    },
    away: {
      elo: strength.away.elo,
      source: strength.away.source,
      base: strength.away.base,
      played: strength.away.evidence.played,
      wins: strength.away.evidence.wins,
      draws: strength.away.evidence.draws,
      losses: strength.away.evidence.losses,
      goalsFor: strength.away.evidence.goalsFor,
      goalsAgainst: strength.away.evidence.goalsAgainst,
      goalDifference: strength.away.evidence.goalDifference,
    },
    evidenceAcquiredAtUtc: acquired,
    evidenceAsOfUtc: acquired,
    historicalCutoffUtc: strength.historicalCutoffUtc,
    priorsInspected: strength.priorsInspected,
    priorsAccepted: strength.priorsAccepted,
    acceptedEvidenceDigest: strength.acceptedEvidenceDigest,
    fallback: strength.fallback,
    fallbackReason: strength.fallbackReason,
    contextLayers: {},
  };
}

export function provenanceForBasePriorLifecycle(input: {
  modelVersion: string | null;
  homeElo?: number;
  awayElo?: number;
  evidenceAcquiredAtUtc?: string | null;
  /** @deprecated Prefer evidenceAcquiredAtUtc. */
  evidenceAsOfUtc?: string | null;
}): PrematchInputProvenance {
  const homeElo = input.homeElo ?? 1580;
  const awayElo = input.awayElo ?? 1520;
  const acquired =
    input.evidenceAcquiredAtUtc ?? input.evidenceAsOfUtc ?? null;
  return {
    provenanceVersion: PREMATCH_INPUT_PROVENANCE_VERSION,
    inputRegime: REGIME_LIFECYCLE_BASE_PRIOR_V1,
    modelVersion: input.modelVersion,
    home: {
      elo: homeElo,
      source: "base_prior",
      base: 1580,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
    },
    away: {
      elo: awayElo,
      source: "base_prior",
      base: 1520,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
    },
    evidenceAcquiredAtUtc: acquired,
    evidenceAsOfUtc: acquired,
    historicalCutoffUtc: null,
    priorsInspected: null,
    priorsAccepted: null,
    acceptedEvidenceDigest: null,
    fallback: true,
    fallbackReason: "legacy_absent",
    contextLayers: {},
  };
}
