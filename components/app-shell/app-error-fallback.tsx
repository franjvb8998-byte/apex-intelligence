"use client";

import { useTranslations } from "next-intl";
import { ApiQuotaCard } from "@/components/app-shell/api-quota-card";
import { ErrorState } from "@/components/app-shell/states";
import { isQuotaError } from "@/lib/repositories";

type AppErrorFallbackProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export function AppErrorFallback({ error, reset }: AppErrorFallbackProps) {
  const t = useTranslations("errors");
  const common = useTranslations("common");

  if (isQuotaError(error)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <ApiQuotaCard onRetry={reset} />
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <ErrorState
        title={t("title")}
        description={t("description")}
        action={
          <button
            type="button"
            onClick={reset}
            className="apex-focusable rounded-[var(--apex-radius-md)] bg-[var(--apex-accent)] px-4 py-2 text-sm font-medium text-[var(--apex-fg-inverse)] hover:bg-[var(--apex-accent-hover)]"
          >
            {common("retry")}
          </button>
        }
      />
    </div>
  );
}
