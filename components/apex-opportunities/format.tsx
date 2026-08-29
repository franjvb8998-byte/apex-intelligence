/**
 * APEX Opportunities — presentation helpers.
 * Numeric formatters live in lib so loaders stay presentation-free.
 */

import type { ApexDecisionVerdictKind } from "@/lib/decision-engine/types";

export {
  VERDICT_BADGE_TONE,
  formatKickoff,
  formatKelly,
  formatOdds,
  formatScanTime,
  formatScore,
  formatSignedPct,
} from "@/lib/apex-opportunities/display";

export const VERDICT_ROW_CLASS: Record<ApexDecisionVerdictKind, string> = {
  elite_pick:
    "border-l-[3px] border-l-emerald-400 bg-emerald-500/[0.07] hover:bg-emerald-500/[0.11]",
  strong_bet:
    "border-l-[3px] border-l-sky-400 bg-sky-500/[0.08] hover:bg-sky-500/[0.12]",
  lean_bet:
    "border-l-[3px] border-l-amber-400 bg-amber-500/[0.08] hover:bg-amber-500/[0.12]",
  pass: "border-l-[3px] border-l-slate-400 bg-slate-500/[0.06] hover:bg-slate-500/[0.1]",
  avoid:
    "border-l-[3px] border-l-red-500 bg-red-500/[0.08] hover:bg-red-500/[0.12]",
};

export const VERDICT_CARD_CLASS: Record<ApexDecisionVerdictKind, string> = {
  elite_pick:
    "border-emerald-400/40 bg-[linear-gradient(180deg,rgba(16,185,129,0.12),transparent_42%),#070b14]",
  strong_bet:
    "border-sky-400/40 bg-[linear-gradient(180deg,rgba(56,189,248,0.12),transparent_42%),#070b14]",
  lean_bet:
    "border-amber-400/40 bg-[linear-gradient(180deg,rgba(251,191,36,0.12),transparent_42%),#070b14]",
  pass: "border-slate-500/40 bg-[linear-gradient(180deg,rgba(148,163,184,0.08),transparent_42%),#070b14]",
  avoid:
    "border-red-500/40 bg-[linear-gradient(180deg,rgba(248,113,113,0.12),transparent_42%),#070b14]",
};

export function Stars({ filled }: { filled: number }) {
  const n = Math.min(5, Math.max(1, Math.round(filled)));
  return (
    <span
      className="font-mono tracking-[0.18em] text-[var(--apex-accent)]"
      aria-label={`${n} of 5 stars`}
    >
      {"★★★★★☆☆☆☆☆".slice(5 - n, 10 - n)}
    </span>
  );
}
