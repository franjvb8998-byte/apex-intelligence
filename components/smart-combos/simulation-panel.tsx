"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { ComboPanel } from "@/components/smart-combos/combo-panel";
import { simulateCombo } from "@/lib/smart-combos/simulate";
import type { ComboLeg } from "@/lib/smart-combos/types";

export function SimulationPanel({ legs }: { legs: ComboLeg[] }) {
  const t = useTranslations("smartCombos");
  const sim = useMemo(
    () => (legs.length === 0 ? null : simulateCombo(legs)),
    [legs],
  );
  const maxBar = sim ? Math.max(...sim.histogram, 1) : 1;

  return (
    <ComboPanel
      id="simulation"
      eyebrow={t("monteCarlo")}
      title={t("hitProbability")}
    >
      {!sim ? (
        <p className="text-sm text-[var(--apex-fg-muted)]">
          Load a combo to simulate independent (and copula-adjusted) trials.
        </p>
      ) : (
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] bg-black/30 px-2.5 py-2">
              <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--apex-fg-subtle)]">
                Hit rate
              </dt>
              <dd className="font-mono text-sm tabular-nums text-[var(--apex-accent)]">
                {(sim.hitRate * 100).toFixed(1)}%
              </dd>
            </div>
            <div className="rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] bg-black/30 px-2.5 py-2">
              <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--apex-fg-subtle)]">
                Independent
              </dt>
              <dd className="font-mono text-sm tabular-nums text-[var(--apex-fg)]">
                {(sim.independentHitRate * 100).toFixed(1)}%
              </dd>
            </div>
            <div className="rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] bg-black/30 px-2.5 py-2">
              <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--apex-fg-subtle)]">
                Trials
              </dt>
              <dd className="font-mono text-sm tabular-nums text-[var(--apex-fg)]">
                {sim.trials.toLocaleString("en-US")}
              </dd>
            </div>
            <div className="rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] bg-black/30 px-2.5 py-2">
              <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--apex-fg-subtle)]">
                Legs hit p50
              </dt>
              <dd className="font-mono text-sm tabular-nums text-[var(--apex-fg)]">
                {sim.p50}/{legs.length}
              </dd>
            </div>
          </dl>
          <div className="flex items-end gap-1.5" aria-label={t("legsHistogram")}>
            {sim.histogram.map((count, index) => (
              <div key={index} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-[var(--apex-radius-sm)] bg-[var(--apex-accent)]/80"
                  style={{ height: `${Math.max(6, (count / maxBar) * 88)}px` }}
                />
                <span className="font-mono text-[9px] text-[var(--apex-fg-subtle)]">
                  {index}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-[var(--apex-fg-muted)]">
            Each trial draws correlated uniforms from the structural ρ matrix,
            then marks a leg as hit when u &lt; the Decision Engine probability.
            Seed {sim.seed}.
          </p>
        </div>
      )}
    </ComboPanel>
  );
}
