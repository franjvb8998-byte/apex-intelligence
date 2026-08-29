"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { FeedClock } from "@/components/feed/feed-clock";
import { formatScanTime } from "@/lib/apex-opportunities/display";
import { ComboDeskNav } from "@/components/smart-combos/desk-nav";
import { ComboLegList } from "@/components/smart-combos/combo-leg-list";
import { ComboPanel } from "@/components/smart-combos/combo-panel";
import { ComboVerdictCard } from "@/components/smart-combos/combo-verdict";
import { CorrelationPanel } from "@/components/smart-combos/correlation-panel";
import { DailyDesk } from "@/components/smart-combos/daily-desk";
import { BuilderDesk } from "@/components/smart-combos/builder-desk";
import { OptimizerPanel } from "@/components/smart-combos/optimizer-panel";
import { SimulationPanel } from "@/components/smart-combos/simulation-panel";
import { analyzeCombo } from "@/lib/smart-combos/analyze";
import { opportunityToComboLeg } from "@/lib/smart-combos/legs";
import { optimizeCombo } from "@/lib/smart-combos/optimize";
import { readComboSlip } from "@/lib/smart-combos/slip-storage";
import type { ApexOpportunity } from "@/lib/apex-opportunities/types";
import type { DailySmartCombo, DailySmartCombosBoard } from "@/lib/smart-combos/types";

type SmartCombosViewProps = {
  analyzed: ApexOpportunity[];
  leagues: string[];
  generatedAt: string;
  daily: DailySmartCombosBoard;
  quotaExhausted?: boolean;
};

export function SmartCombosView({
  analyzed,
  leagues,
  generatedAt,
  daily,
  quotaExhausted = false,
}: SmartCombosViewProps) {
  const t = useTranslations("smartCombos");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const universe = useMemo(
    () => analyzed.map(opportunityToComboLeg),
    [analyzed],
  );

  useEffect(() => {
    const fromSlip = readComboSlip().filter((id) =>
      analyzed.some((row) => row.fixtureId === id),
    );
    if (fromSlip.length === 0) return;
    // Client-only slip; empty on the server so the first paint matches SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage hydrate
    setSelectedIds(fromSlip);
  }, [analyzed]);
  const selectedLegs = useMemo(
    () => universe.filter((leg) => selectedIds.includes(leg.fixtureId)),
    [selectedIds, universe],
  );
  const analysis = useMemo(
    () => (selectedLegs.length === 0 ? null : analyzeCombo(selectedLegs)),
    [selectedLegs],
  );
  const optimization = useMemo(
    () => (analysis ? optimizeCombo(analysis, analyzed) : null),
    [analysis, analyzed],
  );

  function toggle(fixtureId: string) {
    setSelectedIds((current) =>
      current.includes(fixtureId)
        ? current.filter((id) => id !== fixtureId)
        : [...current, fixtureId],
    );
  }

  function useCombo(combo: DailySmartCombo) {
    setSelectedIds(combo.analysis.legs.map((leg) => leg.fixtureId));
  }

  return (
    <div className="w-full space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--apex-border)] pb-4">
        <div>
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--apex-accent)]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--apex-accent)]" />
            {t("eyebrow")}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--apex-fg)] sm:text-3xl">
            {t("title")}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--apex-fg-muted)]">
            {t("description")}
          </p>
        </div>
        <div className="text-right">
          <FeedClock />
          <p className="mt-1 font-mono text-[11px] text-[var(--apex-fg-subtle)]">
            Scan {formatScanTime(generatedAt)}
          </p>
        </div>
      </header>

      <ComboDeskNav />

      {quotaExhausted && (
        <p
          className="rounded-[var(--apex-radius-lg)] border border-amber-500/30 bg-[var(--apex-warning-muted)] px-4 py-3 text-sm text-[var(--apex-fg)]"
          role="status"
        >
          API-Football quota is exhausted. The desk stays open; Daily Smart
          Combos and the working slip wait for the next scan.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-4">
          <ComboPanel
            eyebrow={t("workingSlip")}
            title={t("tapSelections")}
            action={
              selectedIds.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="apex-focusable font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--apex-fg-muted)] hover:text-[var(--apex-fg)]"
                >
                  Clear
                </button>
              ) : null
            }
          >
            {universe.length === 0 ? (
              <p className="text-sm text-[var(--apex-fg-muted)]">
                The Decision Engine did not publish priced selections today.
              </p>
            ) : (
              <ComboLegList
                legs={universe}
                selectable
                selectedIds={selectedIds}
                onToggle={toggle}
              />
            )}
          </ComboPanel>
        </div>

        <div className="space-y-4 xl:col-span-8">
          <DailyDesk board={daily} onUse={useCombo} />
          {analysis ? (
            <ComboVerdictCard analysis={analysis} />
          ) : (
            <ComboPanel
              id="analyzer"
              eyebrow={t("comboAnalyzer")}
              title={t("waitingSlip")}
            >
              <p className="text-sm text-[var(--apex-fg-muted)]">
                Select two or more fixtures, generate a builder fold, or load a
                daily smart combo. A single selection is analysed as a one-fold
                so you can still see EV and Kelly.
              </p>
            </ComboPanel>
          )}
          <BuilderDesk
            analyzed={analyzed}
            leagues={leagues}
            onBuilt={setSelectedIds}
          />
          <OptimizerPanel
            optimization={optimization}
            onApply={setSelectedIds}
          />
          <CorrelationPanel report={analysis?.correlation ?? null} />
          <SimulationPanel legs={selectedLegs} />
        </div>
      </div>
    </div>
  );
}
