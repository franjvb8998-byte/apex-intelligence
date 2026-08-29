import type { DashboardMatchSummary } from "@/lib/dashboard/types";
import { matchLabel } from "@/lib/bankroll/match-search";

export const COPILOT_WELCOME =
  "Hola, soy APEX Copilot. Analizo partidos con el Probability Engine, estadísticas, forma, lesiones y cuotas APEX. No invento datos que el catálogo no publica.";

export function copilotSuggestedPrompts(
  fixtures: DashboardMatchSummary[],
): string[] {
  const first = fixtures[0];
  const label = first ? matchLabel(first) : "el partido del catálogo";
  return [
    `Analiza ${label}.`,
    "¿Quién tiene más valor hoy?",
    `Explícame la predicción de ${label}.`,
    "¿Qué stake sugiere APEX?",
    `Resume ${label}.`,
  ];
}
