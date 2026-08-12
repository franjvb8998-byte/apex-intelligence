import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "@/components/design-system/utils";

type CardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  as?: "section" | "div" | "article";
  padding?: "sm" | "md" | "lg";
  interactive?: boolean;
};

const paddingClass = {
  sm: "p-4",
  md: "p-5 sm:p-6",
  lg: "p-6 sm:p-8",
} as const;

/**
 * Surface container — default building block for DS layouts.
 * No business logic; pure presentation.
 */
export function Card({
  children,
  as: Tag = "section",
  padding = "md",
  interactive = false,
  className,
  ...props
}: CardProps) {
  return (
    <Tag
      className={cx(
        "rounded-[var(--apex-radius-2xl)] border border-[var(--apex-border)] bg-[var(--apex-surface)] shadow-[var(--apex-shadow-sm)] backdrop-blur-sm",
        paddingClass[padding],
        interactive &&
          "transition-[border-color,background-color] duration-[var(--apex-duration-normal)] ease-[var(--apex-ease-standard)] hover:border-[var(--apex-accent-border)] hover:bg-slate-900/70",
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}

type CardHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function CardHeader({
  title,
  description,
  action,
  className,
}: CardHeaderProps) {
  return (
    <div
      className={cx(
        "mb-5 flex flex-wrap items-start justify-between gap-3",
        className,
      )}
    >
      <div>
        <h3 className="text-sm font-medium uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
          {title}
        </h3>
        {description && (
          <p className="mt-1 text-sm text-[var(--apex-fg-muted)]">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
