"use client";

import { ApiQuotaCard } from "@/components/app-shell/api-quota-card";
import { ErrorState } from "@/components/app-shell/states";
import { isApiFootballQuotaError } from "@/lib/data-platform/providers/api-football/quota";

type AppErrorFallbackProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * Shared error UI so route `error.tsx` files never fall through to the
 * Next.js runtime error page.
 */
export function AppErrorFallback({ error, reset }: AppErrorFallbackProps) {
  if (isApiFootballQuotaError(error)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <ApiQuotaCard onRetry={reset} />
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <ErrorState
        title="No se pudo cargar esta vista"
        description="Ha ocurrido un error inesperado. Puedes reintentar sin salir de APEX."
        action={
          <button
            type="button"
            onClick={reset}
            className="apex-focusable rounded-[var(--apex-radius-md)] bg-[var(--apex-accent)] px-4 py-2 text-sm font-medium text-[var(--apex-fg-inverse)] hover:bg-[var(--apex-accent-hover)]"
          >
            Reintentar
          </button>
        }
      />
    </div>
  );
}
