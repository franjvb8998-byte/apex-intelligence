"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/app-shell/states";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard]", error);
  }, [error]);

  return (
    <ErrorState
      title="No se pudo cargar el Dashboard"
      description={error.message}
      action={
        <button
          type="button"
          onClick={reset}
          className="rounded-[var(--apex-radius-md)] bg-[var(--apex-accent)] px-4 py-2 text-sm font-medium text-[var(--apex-fg-inverse)]"
        >
          Reintentar
        </button>
      }
    />
  );
}
