"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card } from "@/components/design-system";

export function ScannerStandby({ quota }: { quota: boolean }) {
  const t = useTranslations("scanner.standby");
  const actions = [
    { href: "/match-center", label: t("matchCenter") },
    { href: "/match-analysis", label: t("analyzeFixture") },
    { href: "/smart-combos", label: t("smartCombos") },
    { href: "/match-analysis", label: t("teamIntelligence") },
  ];

  return (
    <Card padding="lg" className="border-dashed" aria-label={t("aria")}>
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--apex-accent)]">
        {t("eyebrow")}
      </p>
      <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--apex-fg)]">
        {t("title")}
      </h3>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--apex-fg-muted)]">
        {quota ? t("quotaBody") : t("normalBody")}
      </p>
      <p className="mt-5 text-sm text-[var(--apex-fg)]">{t("meanwhile")}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="apex-focusable rounded-[var(--apex-radius-md)] border border-[var(--apex-accent-border)] px-3 py-2 text-xs font-medium text-[var(--apex-accent)] hover:bg-[var(--apex-accent-muted)]"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </Card>
  );
}
