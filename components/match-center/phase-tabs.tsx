"use client";

import { useTranslations } from "next-intl";
import type { MatchCenterPhase } from "@/lib/match-center/types";
import { cx } from "@/components/design-system";

type PhaseTabsProps = {
  active: MatchCenterPhase;
  onChange: (phase: MatchCenterPhase) => void;
};

/**
 * Phase switcher for Match Center™ — presentational; parent owns state.
 */
export function PhaseTabs({ active, onChange }: PhaseTabsProps) {
  const t = useTranslations("matchCenter");
  const phases: Array<{ id: MatchCenterPhase; label: string; hint: string }> = [
    { id: "preview", label: t("preview"), hint: t("previewHint") },
    { id: "live", label: t("live"), hint: t("liveHint") },
    { id: "post", label: t("post"), hint: t("postHint") },
  ];
  return (
    <div
      role="tablist"
      aria-label={t("phasesAria")}
      className="grid grid-cols-3 gap-2 rounded-[var(--apex-radius-2xl)] border border-[var(--apex-border)] bg-[var(--apex-surface)] p-1.5"
    >
      {phases.map((phase) => {
        const selected = active === phase.id;
        return (
          <button
            key={phase.id}
            type="button"
            role="tab"
            aria-selected={selected}
            id={`match-center-tab-${phase.id}`}
            className={cx(
              "apex-focusable min-h-11 rounded-[var(--apex-radius-xl)] px-3 py-2.5 text-center transition-[background-color,color,border-color] duration-[var(--apex-duration-normal)] ease-[var(--apex-ease-standard)]",
              selected
                ? "border border-[var(--apex-accent-border)] bg-[var(--apex-accent-muted)] text-[var(--apex-accent)]"
                : "border border-transparent text-[var(--apex-fg-muted)] hover:bg-slate-800/40 hover:text-slate-200",
            )}
            onClick={() => onChange(phase.id)}
          >
            <span className="block text-sm font-semibold">{phase.label}</span>
            <span
              className={cx(
                "mt-0.5 block text-[11px]",
                selected ? "text-[var(--apex-accent)]/80" : "text-[var(--apex-fg-subtle)]",
              )}
            >
              {phase.hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}
