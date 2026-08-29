"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  isNavId,
  isPlainNavKey,
  type BreadcrumbItem,
} from "@/lib/navigation";

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
};

function crumbLabel(
  t: ReturnType<typeof useTranslations<"nav">>,
  key: string,
): string {
  if (isPlainNavKey(key)) {
    return t(key);
  }
  if (isNavId(key)) {
    return t(`${key}.label`);
  }
  return key;
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  const t = useTranslations("nav");
  const chrome = useTranslations("chrome");
  if (items.length === 0) return null;

  return (
    <nav aria-label={chrome("breadcrumb")} className="min-w-0">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-[var(--apex-fg-subtle)]">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const label = crumbLabel(t, item.key);
          return (
            <li key={`${item.key}-${index}`} className="flex items-center gap-1.5">
              {index > 0 && (
                <span aria-hidden className="text-[var(--apex-fg-subtle)]">
                  /
                </span>
              )}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="truncate transition-colors hover:text-[var(--apex-accent)] apex-focusable rounded-sm"
                >
                  {label}
                </Link>
              ) : (
                <span
                  className="truncate text-[var(--apex-fg-muted)]"
                  aria-current={isLast ? "page" : undefined}
                >
                  {label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
