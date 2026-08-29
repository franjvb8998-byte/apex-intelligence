/**
 * Presentation-free formatters for Decision Engine rows.
 * Lives in lib so Feed/Lab loaders do not import components.
 */

import type { ApexTone } from "@/components/design-system/tokens";
import type { ApexDecisionVerdictKind } from "@/lib/decision-engine/types";
import type { ScoringTier } from "@/lib/scoring-engine/types";

export const VERDICT_BADGE_TONE: Record<ApexDecisionVerdictKind, ApexTone> = {
  elite_pick: "accent",
  strong_bet: "info",
  lean_bet: "warning",
  pass: "neutral",
  avoid: "danger",
};

export const SCORING_BADGE_TONE: Record<ScoringTier, ApexTone> = {
  Elite: "accent",
  "Strong Bet": "info",
  "Value Bet": "warning",
  Watch: "neutral",
  Avoid: "danger",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatKickoff(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  const date = new Date(ms);
  const weekday = WEEKDAYS[date.getUTCDay()] ?? "—";
  const month = MONTHS[date.getUTCMonth()] ?? "—";
  return `${weekday} ${date.getUTCDate()} ${month}, ${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`;
}

export function formatScanTime(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "n/d";
  const date = new Date(ms);
  return `${pad2(date.getUTCDate())}/${pad2(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}, ${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())} UTC`;
}

export function formatOdds(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "n/d";
  return value.toFixed(2);
}

export function formatSignedPct(value: number | null, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "n/d";
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(digits)}%`;
}

export function formatKelly(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "n/d";
  return `${value.toFixed(1)}%`;
}

export function formatScore(value: number): string {
  return String(Math.round(value));
}
