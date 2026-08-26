import type { MatchAnalysisData } from "@/lib/match-analysis/types";
import { getMockExplainablePrediction } from "@/lib/explainable-ai/mock";

/**
 * Simulated Match Analysis payload.
 * TODO(core-wire): map HybridProbabilityResult + ExplainabilityModule → MatchAnalysisData
 */
export function getMockMatchAnalysis(): MatchAnalysisData {
  const explainable = getMockExplainablePrediction({
    matchId: "apex:mock:match:demo-1001",
    homeName: "Northbridge FC",
    awayName: "Southport United",
  });

  return {
    matchId: "apex:mock:match:demo-1001",
    leagueName: "Premier League",
    kickoffAt: "2026-08-15T18:00:00.000Z",
    status: "scheduled",
    homeTeam: {
      id: "apex:mock:team:home",
      name: "Northbridge FC",
      shortName: "NOR",
    },
    awayTeam: {
      id: "apex:mock:team:away",
      name: "Southport United",
      shortName: "SOU",
    },
    oneXTwo: {
      home: 0.48,
      draw: 0.27,
      away: 0.25,
    },
    predictedOutcome: "home",
    confidence: {
      value: 0.62,
      band: "medium",
    },
    apexScore: {
      value: 71,
      label: "Señal moderada a favor del local",
      components: [
        { key: "model", label: "Convicción del modelo", value: 74, weight: 0.4 },
        { key: "edge", label: "Claridad 1X2", value: 68, weight: 0.3 },
        { key: "stability", label: "Estabilidad de factores", value: 70, weight: 0.3 },
      ],
    },
    markets: [
      {
        id: "m-1x2",
        label: "Resultado final (1X2)",
        type: "1x2",
        line: null,
        selections: [
          { key: "home", label: "Local", probability: 0.48, decimalOdds: 2.05 },
          { key: "draw", label: "Empate", probability: 0.27, decimalOdds: 3.4 },
          { key: "away", label: "Visitante", probability: 0.25, decimalOdds: 3.6 },
        ],
      },
      {
        id: "m-ou25",
        label: "Over / Under 2.5",
        type: "over_under",
        line: 2.5,
        selections: [
          { key: "over", label: "Over 2.5", probability: 0.54, decimalOdds: 1.85 },
          { key: "under", label: "Under 2.5", probability: 0.46, decimalOdds: 2.0 },
        ],
      },
      {
        id: "m-btts",
        label: "Ambos marcan (BTTS)",
        type: "btts",
        line: null,
        selections: [
          { key: "yes", label: "Sí", probability: 0.57, decimalOdds: 1.72 },
          { key: "no", label: "No", probability: 0.43, decimalOdds: 2.15 },
        ],
      },
    ],
    keyFactors: [
      {
        key: "home-form",
        label: "Forma local",
        direction: "supports",
        weight: 0.28,
        detail: "Northbridge suma 10 de 12 puntos posibles en casa.",
      },
      {
        key: "xg-edge",
        label: "Ventaja de xG",
        direction: "supports",
        weight: 0.22,
        detail: "Promedio de 1.7 xG a favor vs 1.1 en contra en los últimos 5.",
      },
      {
        key: "away-travel",
        label: "Desgaste visitante",
        direction: "supports",
        weight: 0.14,
        detail: "Southport encadena el tercer partido fuera en 8 días.",
      },
      {
        key: "injuries",
        label: "Bajas en mediocampo",
        direction: "against",
        weight: 0.18,
        detail: "Northbridge duda de su pivote titular; reduce control esperado.",
      },
      {
        key: "draw-rate",
        label: "Tendencia a empates",
        direction: "neutral",
        weight: 0.12,
        detail: "El H2H reciente tiene 2 empates en 5 enfrentamientos.",
      },
    ],
    risks: [
      {
        id: "r1",
        severity: "medium",
        title: "Confianza media",
        detail:
          "El modelo no alcanza el umbral alto; el margen local–empate es moderado.",
      },
      {
        id: "r2",
        severity: "high",
        title: "Incertidumbre por alineación",
        detail:
          "Si cae el pivote local, la probabilidad de empate sube de forma material.",
      },
      {
        id: "r3",
        severity: "low",
        title: "Cuotas aún sin calibrar",
        detail:
          "Las odds mostradas son simuladas; el edge de mercado no está validado.",
      },
    ],
    explanation: {
      summary:
        "APEX favorece la victoria local con convicción media, impulsada por forma en casa y ventaja de xG, atenuada por bajas en el mediocampo.",
      factors: [],
      caveats: [
        "Datos simulados — no conectados al Intelligence Core.",
        "No constituye consejo financiero ni garantía de resultado.",
      ],
      narrative:
        "El motor híbrido (Elo × Poisson, versión mock) proyecta λ_home ≈ 1.55 y λ_away ≈ 1.10, lo que concentra masa en marcadores 1-0, 2-0 y 2-1. " +
        "La distribución 1X2 resultante deja a Northbridge como outcome más probable, pero el empate retiene ~27% por la paridad histórica y el riesgo de alineación. " +
        "Over 2.5 queda ligeramente por encima del umbral neutro gracias al volumen ofensivo local, no por debilidad extrema de Southport. " +
        "En conjunto, la lectura de APEX es: señal a favor del local con disciplina — tamaño de stake reducido mientras la confianza no suba de banda media.",
    },
    explainable,
    modelVersion: "elo-poisson-hybrid-0.1.0+mock-ui",
    source: "mock",
  };
}
