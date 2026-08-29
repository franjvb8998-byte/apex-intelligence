/**
 * Suggested stake from APEX recommendation + Kelly (if published).
 * Units only — Copilot never invents a cash bankroll.
 */

import type { CopilotMatchSnapshot, CopilotSuggestedStake } from "@/lib/copilot/types";

function roundUnits(value: number): number {
  const snapped = Math.round(value * 2) / 2;
  return Math.min(2, Math.max(0, snapped));
}

export function suggestedStake(snapshot: CopilotMatchSnapshot): CopilotSuggestedStake {
  const action = snapshot.recommendation.action;
  const kelly = snapshot.valueBet?.kellyFraction;

  if (action === "pass") {
    return {
      units: 0,
      label: "0u",
      rationale:
        "La recomendación APEX es pasar. No se sugiere stake mientras la señal 1X2 sea poco clara o el riesgo sea alto.",
    };
  }

  if (kelly != null && Number.isFinite(kelly) && kelly > 0) {
    const units = roundUnits(kelly * 4);
    const capped = action === "watch" ? Math.min(units, 0.5) : units;
    return {
      units: capped,
      label: `${capped}u`,
      rationale: `Kelly fraccional publicado por el motor de value (${(kelly * 100).toFixed(1)}% del bankroll). Se expresa en unidades APEX (1u = unidad de bankroll configurada). Acción: ${action}.`,
    };
  }

  if (action === "bet" && snapshot.confidence.band === "high") {
    return {
      units: 1,
      label: "1u",
      rationale:
        "Recomendación apostar con confianza alta del Probability Engine. Sin Kelly de mercado: stake base 1u.",
    };
  }

  if (action === "bet") {
    return {
      units: 1,
      label: "1u",
      rationale:
        "Recomendación apostar. Sin fracción Kelly en el snapshot: se usa 1u conservador.",
    };
  }

  if (action === "reduce_stake") {
    return {
      units: 0.5,
      label: "0.5u",
      rationale: "El motor pide reducir exposición. Stake sugerido: media unidad.",
    };
  }

  return {
    units: 0.5,
    label: "0.5u",
    rationale:
      "Señal de vigilancia (watch). Stake exploratorio 0.5u; no hay Kelly de mercado en el catálogo.",
  };
}
