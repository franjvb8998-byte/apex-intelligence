import type { ReactNode } from "react";
import { cx } from "@/components/design-system/utils";

export function ComboPanel({
  id,
  eyebrow,
  title,
  action,
  children,
  className,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cx(
        "scroll-mt-24 rounded-[var(--apex-radius-2xl)] border border-[var(--apex-border)] bg-[var(--apex-surface)] p-4 sm:p-5",
        className,
      )}
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--apex-accent)]">
            {eyebrow}
          </p>
          <h3 className="mt-1 text-sm font-semibold tracking-tight text-[var(--apex-fg)]">
            {title}
          </h3>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
