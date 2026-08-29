"use client";

import { useId, useState, type ReactNode } from "react";
import { cx } from "@/components/design-system/utils";

type ExplanationPanelProps = {
  title?: string;
  summary: string;
  children?: ReactNode;
  footnotes?: string[];
  defaultOpen?: boolean;
  className?: string;
};

/**
 * Expandable explanation surface. Content is provided by the parent —
 * no model or API calls inside the DS.
 */
export function ExplanationPanel({
  title = "Explanation",
  summary,
  children,
  footnotes,
  defaultOpen = false,
  className,
}: ExplanationPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section
      className={cx(
        "rounded-[var(--apex-radius-2xl)] border border-[var(--apex-border)] bg-[var(--apex-surface)] backdrop-blur-sm",
        className,
      )}
    >
      <button
        type="button"
        className="apex-focusable flex w-full items-center justify-between gap-4 rounded-[var(--apex-radius-2xl)] px-5 py-5 text-left transition-colors duration-[var(--apex-duration-normal)] hover:bg-slate-800/30 sm:px-6"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <div className="min-w-0">
          <h3 className="text-sm font-medium uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
            {title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">{summary}</p>
        </div>
        <span
          className={cx(
            "shrink-0 text-[var(--apex-accent)] transition-transform duration-[var(--apex-duration-normal)] ease-[var(--apex-ease-standard)]",
            open && "rotate-180",
          )}
          aria-hidden
        >
          ▾
        </span>
      </button>

      <div
        id={panelId}
        className={cx(
          "grid transition-[grid-template-rows] duration-[var(--apex-duration-slow)] ease-[var(--apex-ease-out)]",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-4 border-t border-[var(--apex-border)] px-5 py-5 sm:px-6">
            {children}
            {footnotes && footnotes.length > 0 && (
              <ul className="space-y-2">
                {footnotes.map((note) => (
                  <li
                    key={note}
                    className="text-xs leading-relaxed text-[var(--apex-fg-subtle)]"
                  >
                    • {note}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
