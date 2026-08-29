import { clamp, component } from "@/lib/scoring-engine/normalizers";
import type { ScoringComponent, ScoringEngineInput } from "@/lib/scoring-engine/types";

/**
 * Risk Score is safety: 100 = low risk.
 * Upstream Decision Engine risk is raw (higher = riskier) and is inverted here.
 */
export function scoreRisk(input: ScoringEngineInput): ScoringComponent {
  const raw = input.risk;
  if (raw == null || !Number.isFinite(raw)) {
    return component(
      "risk",
      null,
      "No published Decision Engine risk block.",
    );
  }
  return component(
    "risk",
    clamp(100 - raw, 0, 100),
    `Safety from inverted raw risk ${Math.round(raw)}/100.`,
  );
}
