/**
 * Parse Copilot user prompts into intents. Does not invent a match.
 */

import type { CopilotIntent, CopilotIntentKind } from "@/lib/copilot/types";

function fold(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

const VERSUS = /\s+(?:vs\.?|v\.?|versus|contra)\s+/i;

export function extractTeamQuery(prompt: string): string | null {
  const trimmed = prompt.trim();
  if (!trimmed) return null;
  const versus = trimmed.split(VERSUS);
  if (versus.length >= 2) {
    const home = versus[0]!.replace(/^(analiza|analyze|resume|resumen|explica|explain)\s+/i, "").trim();
    const away = versus[1]!.replace(/[?.!].*$/, "").trim();
    if (home && away) return `${home} ${away}`;
  }
  return null;
}

export function parseCopilotIntent(prompt: string): CopilotIntent {
  const text = fold(prompt);
  const teamQuery = extractTeamQuery(prompt);

  let kind: CopilotIntentKind = "analyze_match";
  if (
    text.includes("valor") ||
    text.includes("value") ||
    text.includes("edge") ||
    text.includes("ev ") ||
    text.startsWith("ev")
  ) {
    kind = "value_scan";
  } else if (
    text.includes("stake") ||
    text.includes("unidad") ||
    text.includes("cuanto apostar") ||
    text.includes("cuánto apostar")
  ) {
    kind = "stake_advice";
  } else if (
    text.includes("explic") ||
    text.includes("por que") ||
    text.includes("porque") ||
    text.includes("probabilidad")
  ) {
    kind = "explain_prediction";
  } else if (
    text === "hola" ||
    text === "help" ||
    text.includes("que puedes") ||
    text.includes("qué puedes")
  ) {
    kind = "help";
  }

  return { kind, query: prompt.trim(), teamQuery };
}
