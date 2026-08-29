"use client";

import { useTranslations } from "next-intl";
import { ScannerHint } from "@/components/opportunity-scanner/hint";
import { SCANNER_MODES, type ScannerMode } from "@/lib/opportunity-scanner/modes";
import { cx } from "@/components/design-system/utils";

export function ScannerModeBar({
  mode,
  onMode,
}: {
  mode: ScannerMode;
  onMode: (mode: ScannerMode) => void;
}) {
  const t = useTranslations("scanner.modes");

  return (
    <div>
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--apex-fg-subtle)]">
        {t("section")}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {SCANNER_MODES.map((item) => {
          const active = item.id === mode;
          const label = t(`${item.id}.label`);
          const hint = t(`${item.id}.hint`);
          return (
            <ScannerHint key={item.id} hint={hint}>
              <button
                type="button"
                aria-label={`${label}. ${hint}`}
                onClick={() => onMode(item.id)}
                className={cx(
                  "apex-focusable rounded-[var(--apex-radius-sm)] border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em]",
                  active
                    ? "border-[var(--apex-accent-border)] bg-[var(--apex-accent-muted)] text-[var(--apex-accent)]"
                    : "border-[var(--apex-border)] text-[var(--apex-fg-muted)] hover:border-[var(--apex-accent-border)] hover:text-[var(--apex-fg)]",
                )}
              >
                {label}
              </button>
            </ScannerHint>
          );
        })}
      </div>
    </div>
  );
}
