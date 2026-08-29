/**
 * Daily Smart Combos — four curated slips from today's Decision Engine scan.
 */

import { buildCombo } from "@/lib/smart-combos/build";
import type { ApexOpportunity } from "@/lib/apex-opportunities/types";
import type {
  DailyComboKind,
  DailySmartCombo,
  DailySmartCombosBoard,
} from "@/lib/smart-combos/types";

const TITLES: Record<DailyComboKind, { title: string; subtitle: string }> = {
  conservative: {
    title: "Conservative",
    subtitle: "Short fold, high probability, low structural correlation.",
  },
  value: {
    title: "Value",
    subtitle: "Positive-EV Decision Engine legs, still a readable accumulator.",
  },
  aggressive: {
    title: "Aggressive",
    subtitle: "More legs and a taller price. Hit rate falls quickly.",
  },
  jackpot: {
    title: "Jackpot",
    subtitle: "Long shot. Only shown when the scan can price a tall fold honestly.",
  },
};

export function buildDailySmartCombos(
  analyzed: ApexOpportunity[],
  generatedAt: string,
): DailySmartCombosBoard {
  const items: DailySmartCombo[] = [];
  const unavailable: DailySmartCombosBoard["unavailable"] = [];

  const attempts: Array<{
    kind: DailyComboKind;
    spec: Parameters<typeof buildCombo>[1];
  }> = [
    {
      kind: "conservative",
      spec: {
        legCount: 2,
        riskProfile: "conservative",
        oddsMax: 4.8,
      },
    },
    {
      kind: "value",
      spec: {
        legCount: Math.min(3, Math.max(2, analyzed.length)),
        riskProfile: "balanced",
        requirePositiveEv: true,
      },
    },
    {
      kind: "aggressive",
      spec: {
        legCount: Math.min(4, Math.max(3, analyzed.length)),
        riskProfile: "aggressive",
        oddsMin: 4,
      },
    },
    {
      kind: "jackpot",
      spec: {
        legCount: Math.min(5, Math.max(4, analyzed.length)),
        riskProfile: "aggressive",
        oddsMin: 12,
      },
    },
  ];

  for (const attempt of attempts) {
    const result = buildCombo(analyzed, attempt.spec);
    if (result.ok) {
      items.push({
        kind: attempt.kind,
        ...TITLES[attempt.kind],
        analysis: result.analysis,
      });
    } else {
      unavailable.push({ kind: attempt.kind, reason: result.reason });
    }
  }

  return { generatedAt, items, unavailable };
}
