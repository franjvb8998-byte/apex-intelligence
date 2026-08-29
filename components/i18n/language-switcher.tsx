"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setAppLocale } from "@/app/actions/locale";
import { cx } from "@/components/design-system/utils";
import { locales, type Locale } from "@/lib/i18n/config";

export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations("language");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === locale) return;
    startTransition(async () => {
      await setAppLocale(next);
      router.refresh();
    });
  }

  return (
    <div
      role="group"
      aria-label={t("label")}
      className="inline-flex rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] bg-[var(--apex-surface)] p-0.5"
    >
      {locales.map((code) => {
        const active = locale === code;
        return (
          <button
            key={code}
            type="button"
            disabled={pending}
            aria-pressed={active}
            aria-label={t("switchTo", { language: t(code) })}
            onClick={() => choose(code)}
            className={cx(
              "apex-focusable min-w-[2.25rem] rounded-[calc(var(--apex-radius-md)-2px)] px-2 py-1.5 text-[10px] font-semibold tracking-[0.08em]",
              active
                ? "bg-[var(--apex-accent-muted)] text-[var(--apex-accent)]"
                : "text-[var(--apex-fg-subtle)] hover:text-[var(--apex-fg)]",
            )}
          >
            {code.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
