/**
 * Individual 0–100 metric scores. Unavailable catalogue fields stay null.
 */

import { clamp, impliedProbability, roundScore } from "@/lib/match-rating/pricing";
import type {
  ApexRatingFormSide,
  ApexRatingInjury,
  ApexRatingInput,
  ApexRatingMetric,
  ApexRatingMetricKey,
  ApexRatingStanding,
} from "@/lib/match-rating/types";
import type { MatchOutcome } from "@/lib/intelligence/types";

export const APEX_RATING_WEIGHTS: Record<ApexRatingMetricKey, number> = {
  form: 0.12,
  attack: 0.12,
  defense: 0.12,
  injuries: 0.08,
  standings: 0.1,
  odds: 0.08,
  impliedProbability: 0.08,
  value: 0.14,
  homeAdvantage: 0.08,
  momentum: 0.08,
};

export const APEX_RATING_METRIC_LABELS: Record<ApexRatingMetricKey, string> = {
  form: "Forma",
  attack: "Ataque",
  defense: "Defensa",
  injuries: "Lesiones",
  standings: "Clasificación",
  odds: "Cuotas",
  impliedProbability: "Prob. implícita",
  value: "Value",
  homeAdvantage: "Factor local",
  momentum: "Momentum",
};

function metric(
  key: ApexRatingMetricKey,
  score: number | null,
  note: string,
): ApexRatingMetric {
  return {
    key,
    label: APEX_RATING_METRIC_LABELS[key],
    score: score == null ? null : roundScore(score),
    weight: APEX_RATING_WEIGHTS[key],
    available: score != null,
    note,
  };
}

function formLetters(side: ApexRatingFormSide): Array<"W" | "D" | "L"> {
  const fromRecent = side.recent
    .map((row) => row.result)
    .filter((result): result is "W" | "D" | "L" => result === "W" || result === "D" || result === "L");
  if (fromRecent.length > 0) return fromRecent;
  const raw = side.form?.toUpperCase().replace(/[^WDL]/g, "") ?? "";
  return [...raw].filter((ch): ch is "W" | "D" | "L" => ch === "W" || ch === "D" || ch === "L");
}

/** API-Football form is most-recent last; recency weights the tail higher. */
function formQuality(letters: Array<"W" | "D" | "L">): number | null {
  if (letters.length === 0) return null;
  let weighted = 0;
  let denom = 0;
  letters.forEach((letter, index) => {
    const w = 1 + index * 0.25;
    const pts = letter === "W" ? 1 : letter === "D" ? 0.45 : 0;
    weighted += pts * w;
    denom += w;
  });
  return denom > 0 ? weighted / denom : null;
}

function sideForPredicted(
  predicted: MatchOutcome,
  home: number,
  away: number,
): number {
  if (predicted === "home") return home;
  if (predicted === "away") return away;
  return (home + away) / 2;
}

export function scoreForm(input: ApexRatingInput): ApexRatingMetric {
  const homeQ = formQuality(formLetters(input.home));
  const awayQ = formQuality(formLetters(input.away));
  if (homeQ == null && awayQ == null) {
    return metric("form", null, "Sin serie de forma publicada. No se infiere.");
  }
  const home = homeQ ?? 0.45;
  const away = awayQ ?? 0.45;
  const favored = sideForPredicted(input.predictedOutcome, home, away);
  const gap = home - away;
  const relative =
    input.predictedOutcome === "home"
      ? 0.5 + gap * 0.5
      : input.predictedOutcome === "away"
        ? 0.5 - gap * 0.5
        : 1 - Math.abs(gap);
  const blended = favored * 0.7 + clamp(relative, 0, 1) * 0.3;
  return metric(
    "form",
    blended * 100,
    `Forma ponderada local ${(home * 100).toFixed(0)} · visitante ${(away * 100).toFixed(0)}.`,
  );
}

export function scoreAttack(input: ApexRatingInput): ApexRatingMetric {
  const xg = input.expectedGoals;
  if (!Number.isFinite(xg.home) || !Number.isFinite(xg.away)) {
    return metric("attack", null, "Sin xG del Probability Engine.");
  }
  const home = clamp(xg.home / 2.4, 0, 1);
  const away = clamp(xg.away / 2.4, 0, 1);
  const gfHome =
    input.home.played && input.home.goalsFor != null
      ? input.home.goalsFor / input.home.played
      : null;
  const gfAway =
    input.away.played && input.away.goalsFor != null
      ? input.away.goalsFor / input.away.played
      : null;
  const gfH = gfHome != null ? clamp(gfHome / 2.2, 0, 1) : home;
  const gfA = gfAway != null ? clamp(gfAway / 2.2, 0, 1) : away;
  const homeMix = home * 0.7 + gfH * 0.3;
  const awayMix = away * 0.7 + gfA * 0.3;
  const favored = sideForPredicted(input.predictedOutcome, homeMix, awayMix);
  return metric(
    "attack",
    favored * 100,
    `xG ${xg.home.toFixed(2)}–${xg.away.toFixed(2)} (total ${xg.total.toFixed(2)}).`,
  );
}

export function scoreDefense(input: ApexRatingInput): ApexRatingMetric {
  const xg = input.expectedGoals;
  if (!Number.isFinite(xg.home) || !Number.isFinite(xg.away)) {
    return metric("defense", null, "Sin xG del Probability Engine.");
  }
  const homeDef = clamp((2.3 - xg.away) / 2.3, 0, 1);
  const awayDef = clamp((2.3 - xg.home) / 2.3, 0, 1);
  const gaHome =
    input.home.played && input.home.goalsAgainst != null
      ? input.home.goalsAgainst / input.home.played
      : null;
  const gaAway =
    input.away.played && input.away.goalsAgainst != null
      ? input.away.goalsAgainst / input.away.played
      : null;
  const mixH = gaHome != null ? homeDef * 0.65 + clamp(1 - gaHome / 2.0, 0, 1) * 0.35 : homeDef;
  const mixA = gaAway != null ? awayDef * 0.65 + clamp(1 - gaAway / 2.0, 0, 1) * 0.35 : awayDef;
  const favored = sideForPredicted(input.predictedOutcome, mixH, mixA);
  return metric(
    "defense",
    favored * 100,
    "Defensa del lado favorecido: menos xG en contra y menos goles concedidos (si el catálogo los publica).",
  );
}

export function scoreInjuries(input: ApexRatingInput): ApexRatingMetric {
  const list = input.injuries;
  const homeN = list.filter((row) => row.teamSide === "home").length;
  const awayN = list.filter((row) => row.teamSide === "away").length;
  const unknown = list.filter((row) => row.teamSide === "unknown").length;
  const total = list.length;
  const base = clamp(100 - total * 12, 35, 92);
  const net = awayN - homeN;
  const tilt =
    input.predictedOutcome === "home"
      ? net * 6
      : input.predictedOutcome === "away"
        ? -net * 6
        : 0;
  const note =
    total === 0
      ? "Sin bajas publicadas en el catálogo. No se infiere un XI completo."
      : `${total} baja(s) listadas (local ${homeN}, visitante ${awayN}${unknown ? `, sin lado ${unknown}` : ""}).`;
  return metric("injuries", clamp(base + tilt, 0, 100), note);
}

function standingQuality(row: ApexRatingStanding | null): number | null {
  if (!row || !Number.isFinite(row.rank) || row.rank < 1) return null;
  const field = 20;
  return clamp(100 - (row.rank - 1) * (100 / field), 8, 100);
}

export function scoreStandings(input: ApexRatingInput): ApexRatingMetric {
  const home = standingQuality(input.standings.home);
  const away = standingQuality(input.standings.away);
  if (home == null && away == null) {
    return metric("standings", null, "Sin clasificación publicada. No se infiere.");
  }
  const h = home ?? 50;
  const a = away ?? 50;
  const favored = sideForPredicted(input.predictedOutcome, h / 100, a / 100) * 100;
  const ranks = [
    input.standings.home?.rank,
    input.standings.away?.rank,
  ].filter((n): n is number => n != null);
  return metric(
    "standings",
    favored,
    ranks.length === 2
      ? `Puestos ${ranks[0]} vs ${ranks[1]}.`
      : "Clasificación parcial del catálogo.",
  );
}

export function scoreOdds(input: ApexRatingInput): ApexRatingMetric {
  if (input.decimalOdds == null) {
    return metric("odds", null, "Sin cuota de mercado para la selección del modelo.");
  }
  const books = Math.max(1, input.bookmakerCount);
  const depth = clamp(55 + books * 12, 55, 95);
  return metric(
    "odds",
    depth,
    `Cuota ${input.decimalOdds.toFixed(2)} · ${books} casa(s) en el tablero.`,
  );
}

export function scoreImpliedProbability(input: ApexRatingInput): ApexRatingMetric {
  const pModel = input.oneXTwo[input.predictedOutcome];
  const implied = impliedProbability(input.decimalOdds);
  if (implied == null) {
    return metric(
      "impliedProbability",
      null,
      "Sin cuota → no hay probabilidad implícita de mercado.",
    );
  }
  const agreement = 1 - clamp(Math.abs(pModel - implied) * 2.2, 0, 1);
  return metric(
    "impliedProbability",
    agreement * 100,
    `P_modelo ${(pModel * 100).toFixed(0)}% vs implícita ${(implied * 100).toFixed(0)}%.`,
  );
}

export function scoreValue(input: ApexRatingInput, ev: number | null): ApexRatingMetric {
  if (ev == null) {
    return metric("value", null, "Sin cuota no hay EV real. No se fabrica un edge.");
  }
  const mapped = clamp((ev + 0.12) / 0.32, 0, 1) * 100;
  const sign = ev >= 0 ? "+" : "";
  return metric(
    "value",
    mapped,
    `EV ${sign}${(ev * 100).toFixed(1)} pp sobre la selección del PE.`,
  );
}

export function scoreHomeAdvantage(input: ApexRatingInput): ApexRatingMetric {
  const p = input.oneXTwo;
  const elo = input.eloWinExpectancyHome;
  const hfa = elo != null && Number.isFinite(elo) ? elo : p.home;
  const delta = p.home - p.away;
  let score: number;
  if (input.predictedOutcome === "home") {
    score = clamp(50 + delta * 90 + (hfa - 0.5) * 40, 0, 100);
  } else if (input.predictedOutcome === "away") {
    score = clamp(50 - delta * 70, 0, 100);
  } else {
    score = clamp(55 - Math.abs(delta) * 40, 0, 100);
  }
  return metric(
    "homeAdvantage",
    score,
    `P(local) ${(p.home * 100).toFixed(0)}% · Elo home ${(hfa * 100).toFixed(0)}%.`,
  );
}

export function scoreMomentum(input: ApexRatingInput): ApexRatingMetric {
  if (input.visionMomentum != null && Number.isFinite(input.visionMomentum)) {
    const mapped = clamp((input.visionMomentum + 100) / 2, 0, 100);
    return metric(
      "momentum",
      mapped,
      `Momentum APEX Vision ${input.visionMomentum.toFixed(0)} (−100…+100).`,
    );
  }
  const homeLetters = formLetters(input.home).slice(-3);
  const awayLetters = formLetters(input.away).slice(-3);
  const homeQ = formQuality(homeLetters);
  const awayQ = formQuality(awayLetters);
  if (homeQ == null && awayQ == null) {
    return metric(
      "momentum",
      null,
      "Sin últimos partidos ni feed Vision. No se infiere momentum.",
    );
  }
  const favored = sideForPredicted(
    input.predictedOutcome,
    homeQ ?? 0.45,
    awayQ ?? 0.45,
  );
  return metric(
    "momentum",
    favored * 100,
    "Momentum de forma: últimos 3 resultados publicados (Vision no disponible).",
  );
}

export function buildRatingMetrics(
  input: ApexRatingInput,
  ev: number | null,
): ApexRatingMetric[] {
  return [
    scoreForm(input),
    scoreAttack(input),
    scoreDefense(input),
    scoreInjuries(input),
    scoreStandings(input),
    scoreOdds(input),
    scoreImpliedProbability(input),
    scoreValue(input, ev),
    scoreHomeAdvantage(input),
    scoreMomentum(input),
  ];
}
