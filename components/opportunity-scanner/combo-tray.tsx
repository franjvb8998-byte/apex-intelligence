"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { formatOdds, formatSignedPct } from "@/lib/apex-opportunities/display";
import type { ComboAnalysis } from "@/lib/smart-combos/types";

export function ScannerComboTray({
  count,
  analysis,
  onOpen,
  onClear,
}: {
  count: number;
  analysis: ComboAnalysis | null;
  onOpen: () => void;
  onClear: () => void;
}) {
  const t = useTranslations("scanner.combo");
  if (count === 0) return null;

  return (
    <div className="sticky bottom-3 z-20 rounded-[var(--apex-radius-xl)] border border-[var(--apex-accent-border)] bg-[var(--apex-bg-elevated)]/95 p-3 shadow-[var(--apex-shadow-sm)] backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--apex-accent)]">
            {t("title", { count })}
          </p>
          {analysis ? (
            <p className="mt-1 text-xs text-[var(--apex-fg-muted)]">
              {analysis.verdict.label} · {t("odds")} {formatOdds(analysis.combinedOdds)} ·{" "}
              {t("ev")} {formatSignedPct(analysis.expectedValue)} · {t("health")}{" "}
              {analysis.healthScore}
            </p>
          ) : (
            <p className="mt-1 text-xs text-[var(--apex-fg-muted)]">
              {t("addAnother")}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onClear}
            className="apex-focusable rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] px-3 py-1.5 text-xs text-[var(--apex-fg-muted)]"
          >
            {t("clear")}
          </button>
          <button
            type="button"
            onClick={onOpen}
            disabled={count < 2}
            className="apex-focusable rounded-[var(--apex-radius-md)] bg-[var(--apex-accent)] px-3 py-1.5 text-xs font-medium text-[var(--apex-fg-inverse)] disabled:opacity-40"
          >
            {t("open")}
          </button>
          <Link
            href="/smart-combos"
            className="apex-focusable rounded-[var(--apex-radius-md)] border border-[var(--apex-accent-border)] px-3 py-1.5 text-xs text-[var(--apex-accent)]"
          >
            {t("builder")}
          </Link>
        </div>
      </div>
    </div>
  );
}
