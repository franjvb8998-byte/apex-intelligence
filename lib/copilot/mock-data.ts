/**
 * APEX Copilot — mock conversation data (UI only, no OpenAI).
 */

import { getMockExplainablePrediction } from "@/lib/explainable-ai/mock";
import type { ExplainablePrediction } from "@/lib/explainable-ai/types";

export type CopilotRole = "user" | "assistant" | "system";

export type CopilotCardKind = "analysis" | "prediction" | "explainable";

export type CopilotAnalysisCardData = {
  kind: "analysis";
  matchLabel: string;
  league: string;
  summary: string;
  risk: "low" | "medium" | "high";
  factors: string[];
};

export type CopilotPredictionCardData = {
  kind: "prediction";
  matchLabel: string;
  outcome: string;
  confidence: number;
  oneXTwo: { home: number; draw: number; away: number };
  valueNote: string;
};

export type CopilotExplainableCardData = {
  kind: "explainable";
  matchLabel: string;
  explainable: ExplainablePrediction;
};

export type CopilotCardData =
  | CopilotAnalysisCardData
  | CopilotPredictionCardData
  | CopilotExplainableCardData;

export type CopilotMessage = {
  id: string;
  role: CopilotRole;
  content: string;
  createdAt: string;
  card?: CopilotCardData;
};

export type CopilotChatSummary = {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
};

export const COPILOT_SUGGESTED_PROMPTS = [
  "¿Quién tiene más valor hoy?",
  "Analiza Real Madrid vs Barcelona.",
  "¿Por qué bajó la probabilidad?",
  "Resume este partido.",
  "Explícame esta predicción.",
] as const;

export const COPILOT_WELCOME =
  "Hola, soy APEX Copilot. Pregúntame por valor, análisis táctico o el porqué de una probabilidad — esta demo responde con datos mock, sin OpenAI.";

export const MOCK_RECENT_CHATS: CopilotChatSummary[] = [
  {
    id: "chat-valor-hoy",
    title: "Valor del día",
    preview: "¿Quién tiene más valor hoy?",
    updatedAt: "2026-08-12T14:10:00.000Z",
  },
  {
    id: "chat-el-clasico",
    title: "Real Madrid vs Barcelona",
    preview: "Analiza Real Madrid vs Barcelona.",
    updatedAt: "2026-08-12T12:40:00.000Z",
  },
  {
    id: "chat-probabilidad",
    title: "Caída de probabilidad",
    preview: "¿Por qué bajó la probabilidad?",
    updatedAt: "2026-08-11T19:05:00.000Z",
  },
];

/** Seed threads keyed by chat id (simulated history). */
export const MOCK_CHAT_THREADS: Record<string, CopilotMessage[]> = {
  "chat-valor-hoy": [
    {
      id: "m1",
      role: "user",
      content: "¿Quién tiene más valor hoy?",
      createdAt: "2026-08-12T14:10:00.000Z",
    },
    {
      id: "m2",
      role: "assistant",
      content:
        "Con el catálogo mock de hoy, el mejor edge aparece en Arsenal (local) frente a Chelsea. La cuota implícita queda por detrás de la probabilidad del modelo.",
      createdAt: "2026-08-12T14:10:08.000Z",
      card: {
        kind: "prediction",
        matchLabel: "Arsenal vs Chelsea",
        outcome: "Victoria local",
        confidence: 0.64,
        oneXTwo: { home: 0.52, draw: 0.26, away: 0.22 },
        valueNote: "Edge estimado +4.8 pp (mock)",
      },
    },
  ],
  "chat-el-clasico": [
    {
      id: "m3",
      role: "user",
      content: "Analiza Real Madrid vs Barcelona.",
      createdAt: "2026-08-12T12:40:00.000Z",
    },
    {
      id: "m4",
      role: "assistant",
      content:
        "Lectura mock del Clásico: partido de alto tempo, ligera inclinación madridista por xG y Elo simulado. Riesgo medio por masa de empate.",
      createdAt: "2026-08-12T12:40:12.000Z",
      card: {
        kind: "analysis",
        matchLabel: "Real Madrid vs Barcelona",
        league: "La Liga",
        summary:
          "Señal moderada a favor del local. Vigilar alineaciones y ritmo de pressing.",
        risk: "medium",
        factors: [
          "xG local superior (+0.28)",
          "Empate en ~29%",
          "Sin feed de lesiones en esta demo",
        ],
      },
    },
  ],
  "chat-probabilidad": [
    {
      id: "m5",
      role: "user",
      content: "¿Por qué bajó la probabilidad?",
      createdAt: "2026-08-11T19:05:00.000Z",
    },
    {
      id: "m6",
      role: "assistant",
      content:
        "En esta simulación, la probabilidad local cayó tras un evento de timeline (tarjeta + cambio de momentum). El PE no se recalcula aquí: es narrativa mock del Copilot UI.",
      createdAt: "2026-08-11T19:05:09.000Z",
    },
  ],
};

export type MockReply = {
  content: string;
  card?: CopilotCardData;
};

/**
 * Deterministic mock replies for the Copilot UI demo.
 */
export function getMockCopilotReply(prompt: string): MockReply {
  const text = prompt
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");

  if (text.includes("valor")) {
    return {
      content:
        "Hoy el mayor valor mock está en la línea 1X2 del favorito local del catálogo demo. No hay llamada a OpenAI: es una respuesta simulada del Copilot.",
      card: {
        kind: "prediction",
        matchLabel: "Northbridge FC vs Southport United",
        outcome: "Victoria local",
        confidence: 0.61,
        oneXTwo: { home: 0.48, draw: 0.27, away: 0.25 },
        valueNote: "Value mock · sin cuotas live",
      },
    };
  }

  if (text.includes("madrid") || text.includes("barcelona") || text.includes("analiza")) {
    return {
      content:
        "Análisis mock listo. APEX Copilot resume fortalezas, riesgo y lectura táctica sin conectar el Intelligence Layer ni OpenAI.",
      card: {
        kind: "analysis",
        matchLabel: "Real Madrid vs Barcelona",
        league: "La Liga",
        summary: "Partido abierto con ligera ventaja local (simulado).",
        risk: "medium",
        factors: [
          "Tempo alto (xG total ~2.9)",
          "Claridad 1X2 media",
          "Recomendación: observar",
        ],
      },
    };
  }

  if (text.includes("probabilidad") || text.includes("bajó") || text.includes("bajo")) {
    return {
      content:
        "La caída mock se atribuye a un evento en vivo (falta / pérdida de posesión en zona 3). En producto real esto vendría del Vision feed + PE; aquí solo ilustramos la UI.",
    };
  }

  if (text.includes("explic") || text.includes("por qué") || text.includes("porque")) {
    const explainable = getMockExplainablePrediction({
      homeName: "Northbridge FC",
      awayName: "Southport United",
      matchId: "apex:mock:explainable:copilot",
    });
    return {
      content:
        "Aquí va la explicación estructurada generada por reglas sobre el Probability Engine (Sprint 10). Sin OpenAI: factores, confianza, evidencias y score de calidad.",
      card: {
        kind: "explainable",
        matchLabel: "Northbridge FC vs Southport United",
        explainable,
      },
    };
  }

  if (text.includes("resume") || text.includes("resumen") || text.includes("partido")) {
    return {
      content:
        "Resumen mock: 2–1 al descanso narrativo, Over 2.5 con probabilidad >55%, y recomendación de vigilancia sobre el favorito. Datos de demostración.",
      card: {
        kind: "analysis",
        matchLabel: "Partido demo APEX",
        league: "Premier League",
        summary: "Local controla el ritmo; visitante peligroso a la contra.",
        risk: "low",
        factors: ["Forma local WWDLW", "Sin lesiones reportadas", "Edge O/U leve"],
      },
    };
  }

  return {
    content:
      "Recibido. En esta demo del Copilot respondo con contenido mock. Prueba un prompt sugerido para ver tarjetas de análisis o predicción.",
  };
}
