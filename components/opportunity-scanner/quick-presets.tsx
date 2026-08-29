"use client";

import { useTranslations } from "next-intl";
import { ScannerHint } from "@/components/opportunity-scanner/hint";
import {
  SCANNER_PRESETS,
  type ScannerPresetId,
} from "@/lib/opportunity-scanner/presets";
import { cx } from "@/components/design-system/utils";

export function ScannerQuickPresets({
  active,
  onSelect,
}: {
  active: ScannerPresetId | null;
  onSelect: (id: ScannerPresetId) => void;
}) {
  const t = useTranslations("scanner.presets");

  return (
    <div>
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--apex-fg-subtle)]">
        {t("section")}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {SCANNER_PRESETS.map((preset) => {
          const selected = preset.id === active;
          const label = t(`${preset.id}.label`);
          const hint = t(`${preset.id}.hint`);
          return (
            <ScannerHint key={preset.id} hint={hint}>
              <button
                type="button"
                aria-pressed={selected}
                aria-label={`${label}. ${hint}`}
                onClick={() => onSelect(preset.id)}
                className={cx(
                  "apex-focusable rounded-full border px-3 py-1.5 text-xs",
                  selected
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
