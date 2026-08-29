"use client";

import { formatSignedPct } from "@/lib/apex-opportunities/display";
import { useTranslations } from "next-intl";
import { ComboPanel } from "@/components/smart-combos/combo-panel";
import type { ComboOptimization } from "@/lib/smart-combos/types";

export function OptimizerPanel({
  optimization,
  onApply,
}: {
  optimization: ComboOptimization | null;
  onApply: (fixtureIds: string[]) => void;
}) {
  const t = useTranslations("smartCombos");
  return (
    <ComboPanel
      id="optimizer"
      eyebrow={t("optimizer")}
      title={t("optimizerTitle")}
    >
      {!optimization || optimization.current.legs.length < 2 ? (
        <p className="text-sm text-[var(--apex-fg-muted)]">
          Analyse at least two Decision Engine legs to see structural edits.
        </p>
      ) : optimization.suggestions.length === 0 ? (
        <p className="text-sm text-[var(--apex-fg-muted)]">
          No safer or higher-value swap exists in today&apos;s scan. The weakest
          leg can still be removed.
        </p>
      ) : (
        <ul className="space-y-3">
          {optimization.suggestions.map((row) => (
            <li
              key={`${row.kind}-${row.removed.fixtureId}-${row.added?.fixtureId ?? "none"}`}
              className="rounded-[var(--apex-radius-lg)] border border-[var(--apex-border)] bg-black/25 p-3"
            >
              <p className="text-sm font-medium text-[var(--apex-fg)]">{row.title}</p>
              <p className="mt-1 text-xs text-[var(--apex-fg-muted)]">{row.detail}</p>
              <p className="mt-2 font-mono text-[11px] text-[var(--apex-fg-subtle)]">
                Hit Δ{" "}
                {row.deltaHitPct == null
                  ? "n/d"
                  : `${row.deltaHitPct >= 0 ? "+" : ""}${row.deltaHitPct.toFixed(1)} pp`}
                {" · "}EV {formatSignedPct(row.analysis.expectedValue)}
                {" · "}health {row.analysis.healthScore}
              </p>
              <button
                type="button"
                onClick={() =>
                  onApply(row.analysis.legs.map((leg) => leg.fixtureId))
                }
                className="apex-focusable mt-3 rounded-[var(--apex-radius-sm)] border border-[var(--apex-accent-border)] px-3 py-1.5 text-xs text-[var(--apex-accent)] hover:bg-[var(--apex-accent-muted)]"
              >
                Apply
              </button>
            </li>
          ))}
        </ul>
      )}
    </ComboPanel>
  );
}
