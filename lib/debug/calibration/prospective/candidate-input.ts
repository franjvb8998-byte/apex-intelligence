/**
 * Prospective catalogue input. Reuses exact C0/C7 5B.11 mechanics.
 */

import { resolveInputGeometryElo } from "@/lib/debug/calibration/ig-5b11-formula";
import type {
  InputPolicy,
  ProspectiveEvidence,
} from "@/lib/debug/calibration/prospective/candidate-types";

export function inputArmId(policy: InputPolicy): "C0" | "C7" {
  return policy === "PRODUCTION_C0" ? "C0" : "C7";
}

export function resolveCandidateElos(
  policy: InputPolicy,
  evidence: ProspectiveEvidence,
): { homeElo: number; awayElo: number } {
  const armId = inputArmId(policy);
  return {
    homeElo: resolveInputGeometryElo({
      armId,
      side: "home",
      played: evidence.homePlayedBefore,
      wins: evidence.homeWinsBefore,
      goalsFor: evidence.homeGfBefore,
      goalsAgainst: evidence.homeGaBefore,
    }),
    awayElo: resolveInputGeometryElo({
      armId,
      side: "away",
      played: evidence.awayPlayedBefore,
      wins: evidence.awayWinsBefore,
      goalsFor: evidence.awayGfBefore,
      goalsAgainst: evidence.awayGaBefore,
    }),
  };
}
