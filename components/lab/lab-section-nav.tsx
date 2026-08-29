"use client";

import { useTranslations } from "next-intl";
import { LAB_SECTIONS } from "@/lib/lab/registry";

const SECTION_KEY: Record<
  (typeof LAB_SECTIONS)[number]["id"],
  | "library"
  | "backtest"
  | "strategy"
  | "comparison"
  | "simulation"
  | "reports"
  | "explainability"
  | "features"
  | "decision"
  | "versions"
> = {
  library: "library",
  backtest: "backtest",
  strategy: "strategy",
  compare: "comparison",
  simulate: "simulation",
  reports: "reports",
  explain: "explainability",
  features: "features",
  decision: "decision",
  versions: "versions",
};

export function LabSectionNav() {
  const t = useTranslations("lab");
  return (
    <nav
      aria-label={t("sectionsAria")}
      className="sticky top-0 z-10 -mx-1 overflow-x-auto bg-[var(--apex-bg)]/90 px-1 py-2 backdrop-blur"
    >
      <ul className="flex min-w-max gap-1">
        {LAB_SECTIONS.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className="apex-focusable inline-flex rounded-[var(--apex-radius-sm)] border border-[var(--apex-border)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--apex-fg-muted)] hover:border-[var(--apex-accent-border)] hover:text-[var(--apex-fg)]"
            >
              {t(SECTION_KEY[section.id])}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
