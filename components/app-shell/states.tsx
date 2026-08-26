import type { ReactNode } from "react";
import { Badge } from "@/components/design-system";
import { cx } from "@/components/design-system/utils";

type LoadingStateProps = {
  label?: string;
  className?: string;
  rows?: number;
};

export function LoadingState({
  label = "Cargando…",
  className,
  rows = 3,
}: LoadingStateProps) {
  return (
    <div
      className={cx("w-full space-y-4", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--apex-accent)]" />
        <p className="text-sm text-[var(--apex-fg-muted)]">{label}</p>
      </div>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="h-16 animate-pulse rounded-[var(--apex-radius-xl)] border border-[var(--apex-border)] bg-[var(--apex-surface)]"
          style={{ animationDelay: `${index * 80}ms` }}
        />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cx(
        "flex flex-col items-center justify-center rounded-[var(--apex-radius-2xl)] border border-dashed border-[var(--apex-border-strong)] bg-[var(--apex-surface)] px-6 py-14 text-center",
        className,
      )}
    >
      <Badge tone="neutral">Vacío</Badge>
      <h2 className="mt-4 text-lg font-semibold text-[var(--apex-fg)]">{title}</h2>
      {description && (
        <p className="mt-2 max-w-md text-sm text-[var(--apex-fg-muted)]">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

type ErrorStateProps = {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function ErrorState({
  title = "Algo salió mal",
  description = "No pudimos cargar esta vista. Inténtalo de nuevo.",
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cx(
        "flex flex-col items-center justify-center rounded-[var(--apex-radius-2xl)] border border-red-500/30 bg-[var(--apex-danger-muted)] px-6 py-14 text-center",
        className,
      )}
      role="alert"
    >
      <Badge tone="danger">Error</Badge>
      <h2 className="mt-4 text-lg font-semibold text-[var(--apex-fg)]">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-[var(--apex-fg-muted)]">
        {description}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
