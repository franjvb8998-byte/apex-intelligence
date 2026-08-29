"use client";

import { useTranslations } from "next-intl";
import { ComboPanel } from "@/components/smart-combos/combo-panel";
import type { ComboCorrelationReport } from "@/lib/smart-combos/types";

export function CorrelationPanel({
  report,
}: {
  report: ComboCorrelationReport | null;
}) {
  const t = useTranslations("smartCombos");
  return (
    <ComboPanel
      id="correlation"
      eyebrow={t("correlation")}
      title={t("howLegsMove")}
    >
      {!report || report.pairs.length === 0 ? (
        <p className="text-sm text-[var(--apex-fg-muted)]">
          {report?.summary ?? t("addTwo")}
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-[var(--apex-fg-muted)]">{report.summary}</p>
          <ul className="space-y-2">
            {report.pairs.map((pair) => (
              <li
                key={`${pair.kind}-${pair.leftFixtureId}-${pair.rightFixtureId}`}
                className="rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] bg-black/25 px-3 py-2"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--apex-accent)]">
                  {pair.kind.replaceAll("_", " ")} · ρ {pair.rho.toFixed(2)}
                </p>
                <p className="mt-1 text-sm text-[var(--apex-fg)]">{pair.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ComboPanel>
  );
}
