/**
 * Offline Elo candidate policies.
 * Production resolver is invoked as-is. Shrinkage lives only here.
 *
 * k=8 / tau=6 / capScale=50 are EXPERIMENTAL PLACEHOLDERS for the harness.
 * They are not selected production parameters.
 */

import { resolveEloWithProvenance } from "@/lib/match-center/from-data-platform";
import {
  CALIBRATION_AWAY_BASE,
  CALIBRATION_HOME_BASE,
  type CalibrationRow,
  type EloPolicyId,
} from "@/lib/debug/calibration/types";
import type { MatchAnalysisTeamStatSnapshot } from "@/lib/match-analysis/analysis-types";

export type EloPolicyParams = {
  linearK: number;
  exponentialTau: number;
  bayesianK: number;
  capK: number;
  capScale: number;
};

/** Experimental placeholders only. Do not treat as a fitted production choice. */
export const EXPERIMENTAL_PLACEHOLDER_ELO_POLICY_PARAMS: EloPolicyParams = {
  linearK: 8,
  exponentialTau: 6,
  bayesianK: 8,
  capK: 8,
  capScale: 50,
};

/** @deprecated Use EXPERIMENTAL_PLACEHOLDER_ELO_POLICY_PARAMS. Not a production fit. */
export const DEFAULT_ELO_POLICY_PARAMS = EXPERIMENTAL_PLACEHOLDER_ELO_POLICY_PARAMS;

export type ResolvedSideElo = {
  elo: number;
  source: string;
  played: number;
  base: number;
};

export type EloPolicy = {
  id: EloPolicyId;
  label: string;
  resolve(row: CalibrationRow, side: "home" | "away"): ResolvedSideElo;
};

function snapshotFromRow(
  row: CalibrationRow,
  side: "home" | "away",
): MatchAnalysisTeamStatSnapshot {
  if (side === "home") {
    return {
      played: row.homePlayedBefore,
      wins: row.homeWinsBefore,
      goalsFor: row.homeGfBefore,
      goalsAgainst: row.homeGaBefore,
    };
  }
  return {
    played: row.awayPlayedBefore,
    wins: row.awayWinsBefore,
    goalsFor: row.awayGfBefore,
    goalsAgainst: row.awayGaBefore,
  };
}

function sideMeta(row: CalibrationRow, side: "home" | "away") {
  return {
    teamId: side === "home" ? row.homeTeamId : row.awayTeamId,
    base: side === "home" ? CALIBRATION_HOME_BASE : CALIBRATION_AWAY_BASE,
    played: side === "home" ? row.homePlayedBefore : row.awayPlayedBefore,
    snapshot: snapshotFromRow(row, side),
  };
}

function productionResolve(
  row: CalibrationRow,
  side: "home" | "away",
): ResolvedSideElo {
  const meta = sideMeta(row, side);
  const derived = resolveEloWithProvenance(
    meta.snapshot,
    meta.teamId,
    meta.base,
  );
  return {
    elo: derived.elo,
    source: derived.source,
    played: meta.played,
    base: meta.base,
  };
}

function mixTowardBase(catalogueElo: number, base: number, weight: number): number {
  const w = Math.min(1, Math.max(0, weight));
  return Math.round((1 - w) * base + w * catalogueElo);
}

export function createCurrentCataloguePolicy(): EloPolicy {
  return {
    id: "current_catalogue",
    label: "Current production catalogue / base_prior",
    resolve: productionResolve,
  };
}

export function createBasePriorPolicy(): EloPolicy {
  return {
    id: "base_prior",
    label: "Role bases only (1580 / 1520)",
    resolve(row, side) {
      const meta = sideMeta(row, side);
      const derived = resolveEloWithProvenance(null, meta.teamId, meta.base);
      return {
        elo: derived.elo,
        source: derived.source,
        played: meta.played,
        base: meta.base,
      };
    },
  };
}

export function createLinearShrinkagePolicy(
  params: EloPolicyParams = EXPERIMENTAL_PLACEHOLDER_ELO_POLICY_PARAMS,
): EloPolicy {
  return {
    id: "linear_shrinkage",
    label: `Linear mix toward base, k=${params.linearK}`,
    resolve(row, side) {
      const produced = productionResolve(row, side);
      const n = produced.played;
      const w = n / (n + params.linearK);
      return {
        ...produced,
        elo: mixTowardBase(produced.elo, produced.base, w),
        source: "linear_shrinkage",
      };
    },
  };
}

export function createExponentialShrinkagePolicy(
  params: EloPolicyParams = EXPERIMENTAL_PLACEHOLDER_ELO_POLICY_PARAMS,
): EloPolicy {
  return {
    id: "exponential_shrinkage",
    label: `Exponential mix toward base, tau=${params.exponentialTau}`,
    resolve(row, side) {
      const produced = productionResolve(row, side);
      const n = produced.played;
      const w = n <= 0 ? 0 : 1 - Math.exp(-n / params.exponentialTau);
      return {
        ...produced,
        elo: mixTowardBase(produced.elo, produced.base, w),
        source: "exponential_shrinkage",
      };
    },
  };
}

export function createPseudoMatchBayesianPolicy(
  params: EloPolicyParams = EXPERIMENTAL_PLACEHOLDER_ELO_POLICY_PARAMS,
): EloPolicy {
  return {
    id: "pseudo_match_bayesian",
    label: `Pseudo-match prior, k=${params.bayesianK}`,
    resolve(row, side) {
      const meta = sideMeta(row, side);
      if (meta.played <= 0) {
        const derived = resolveEloWithProvenance(null, meta.teamId, meta.base);
        return {
          elo: derived.elo,
          source: derived.source,
          played: 0,
          base: meta.base,
        };
      }
      const k = params.bayesianK;
      const shrink = meta.played / (meta.played + k);
      const wins =
        side === "home" ? row.homeWinsBefore : row.awayWinsBefore;
      const gf = side === "home" ? row.homeGfBefore : row.awayGfBefore;
      const ga = side === "home" ? row.homeGaBefore : row.awayGaBefore;
      const derived = resolveEloWithProvenance(
        {
          played: meta.played + k,
          wins: wins + 0.5 * k,
          goalsFor: gf * shrink,
          goalsAgainst: ga * shrink,
        },
        meta.teamId,
        meta.base,
      );
      return {
        elo: derived.elo,
        source: "pseudo_match_bayesian",
        played: meta.played,
        base: meta.base,
      };
    },
  };
}

export function createShrinkagePlusCapPolicy(
  params: EloPolicyParams = EXPERIMENTAL_PLACEHOLDER_ELO_POLICY_PARAMS,
): EloPolicy {
  return {
    id: "shrinkage_plus_cap",
    label: `Linear k=${params.capK} plus ±${params.capScale}√n cap`,
    resolve(row, side) {
      const produced = productionResolve(row, side);
      const n = produced.played;
      if (n <= 0) {
        return { ...produced, elo: produced.base, source: "shrinkage_plus_cap" };
      }
      const w = n / (n + params.capK);
      const cap = params.capScale * Math.sqrt(n);
      const mixed = w * (produced.elo - produced.base);
      const clipped = Math.min(cap, Math.max(-cap, mixed));
      return {
        ...produced,
        elo: Math.round(produced.base + clipped),
        source: "shrinkage_plus_cap",
      };
    },
  };
}

export function createDefaultEloPolicies(
  params: EloPolicyParams = EXPERIMENTAL_PLACEHOLDER_ELO_POLICY_PARAMS,
): EloPolicy[] {
  return [
    createCurrentCataloguePolicy(),
    createBasePriorPolicy(),
    createLinearShrinkagePolicy(params),
    createExponentialShrinkagePolicy(params),
    createPseudoMatchBayesianPolicy(params),
    createShrinkagePlusCapPolicy(params),
  ];
}
