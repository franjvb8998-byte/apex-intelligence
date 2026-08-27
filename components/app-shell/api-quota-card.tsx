"use client";

import { useRouter } from "next/navigation";
import { Badge, Card } from "@/components/design-system";

type ApiQuotaCardProps = {
  onRetry?: () => void;
};

/**
 * In-app quota state — never the Next.js runtime error overlay.
 */
export function ApiQuotaCard({ onRetry }: ApiQuotaCardProps) {
  const router = useRouter();
  const retry = onRetry ?? (() => router.refresh());

  return (
    <Card
      padding="lg"
      className="mx-auto max-w-xl"
      role="status"
      aria-live="polite"
    >
      <Badge tone="warning">API-Football</Badge>
      <h2 className="mt-4 text-xl font-semibold tracking-tight text-[var(--apex-fg)]">
        Cuota gratuita agotada
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-[var(--apex-fg-muted)]">
        El plan gratuito de API-Football ha alcanzado el límite diario de
        peticiones. Cuando APEX ya tiene datos en caché, se muestran esos
        datos en lugar de interrumpir la sesión. Si no hay caché para esta
        vista, espera a que la cuota se renueve o vuelve a intentarlo.
      </p>
      <button
        type="button"
        onClick={retry}
        className="apex-focusable mt-6 rounded-[var(--apex-radius-md)] bg-[var(--apex-accent)] px-4 py-2 text-sm font-medium text-[var(--apex-fg-inverse)] hover:bg-[var(--apex-accent-hover)]"
      >
        Reintentar
      </button>
    </Card>
  );
}
