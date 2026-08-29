"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Badge, Card } from "@/components/design-system";

type ApiQuotaCardProps = {
  onRetry?: () => void;
};

export function ApiQuotaCard({ onRetry }: ApiQuotaCardProps) {
  const t = useTranslations("errors");
  const common = useTranslations("common");
  const router = useRouter();
  const retry = onRetry ?? (() => router.refresh());

  return (
    <Card
      padding="lg"
      className="mx-auto max-w-xl"
      role="status"
      aria-live="polite"
    >
      <Badge tone="warning">{t("quotaBadge")}</Badge>
      <h2 className="mt-4 text-xl font-semibold tracking-tight text-[var(--apex-fg)]">
        {t("quotaTitle")}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-[var(--apex-fg-muted)]">
        {t("quotaDescription")}
      </p>
      <button
        type="button"
        onClick={retry}
        className="apex-focusable mt-6 rounded-[var(--apex-radius-md)] bg-[var(--apex-accent)] px-4 py-2 text-sm font-medium text-[var(--apex-fg-inverse)] hover:bg-[var(--apex-accent-hover)]"
      >
        {common("retry")}
      </button>
    </Card>
  );
}
