"use client";

import { useTranslations } from "next-intl";

const SECTION_KEYS = [
  { id: "daily", key: "dailyNav" },
  { id: "analyzer", key: "analyzer" },
  { id: "builder", key: "builderNav" },
  { id: "optimizer", key: "optimizerNav" },
  { id: "correlation", key: "correlationNav" },
  { id: "simulation", key: "simulationNav" },
] as const satisfies ReadonlyArray<{
  id: string;
  key:
    | "dailyNav"
    | "analyzer"
    | "builderNav"
    | "optimizerNav"
    | "correlationNav"
    | "simulationNav";
}>;

export function ComboDeskNav() {
  const t = useTranslations("smartCombos");
  return (
    <nav
      aria-label={t("sectionsAria")}
      className="sticky top-0 z-10 -mx-1 overflow-x-auto bg-[var(--apex-bg)]/90 px-1 py-2 backdrop-blur"
    >
      <ul className="flex min-w-max gap-1">
        {SECTION_KEYS.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className="apex-focusable inline-flex rounded-[var(--apex-radius-sm)] border border-[var(--apex-border)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--apex-fg-muted)] hover:border-[var(--apex-accent-border)] hover:text-[var(--apex-fg)]"
            >
              {t(section.key)}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
