"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Badge } from "@/components/design-system";
import { cx } from "@/components/design-system/utils";
import {
  useNavDescription,
  useNavLabel,
} from "@/components/i18n/use-nav-label";
import type { ShellUser } from "@/components/app-shell/types";
import type { NavItem } from "@/lib/navigation";

export type { ShellUser } from "@/components/app-shell/types";

type ProfileMenuProps = {
  user: ShellUser | null;
};

export function ProfileMenu({ user }: ProfileMenuProps) {
  const t = useTranslations("chrome");
  const [open, setOpen] = useState(false);
  const initials = (user?.displayName ?? "AP")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="apex-focusable inline-flex items-center gap-2 rounded-[var(--apex-radius-full)] border border-[var(--apex-border)] bg-[var(--apex-surface)] py-1 pl-1 pr-3 text-sm text-[var(--apex-fg)] transition-colors hover:border-[var(--apex-accent-border)]"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--apex-accent-muted)] text-[11px] font-semibold text-[var(--apex-accent)]">
          {initials}
        </span>
        <span className="hidden max-w-[8rem] truncate sm:inline">
          {user?.displayName ?? t("guest")}
        </span>
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label={t("closeProfile")}
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-64 rounded-[var(--apex-radius-xl)] border border-[var(--apex-border)] bg-[var(--apex-bg-elevated)] p-3 shadow-[var(--apex-shadow-md)]"
          >
            <div className="mb-3 border-b border-[var(--apex-border)] pb-3">
              <p className="text-sm font-medium text-[var(--apex-fg)]">
                {user?.displayName ?? t("guest")}
              </p>
              <p className="mt-0.5 truncate text-xs text-[var(--apex-fg-subtle)]">
                {user?.email ?? t("noSession")}
              </p>
              <div className="mt-2">
                <Badge tone={user ? "accent" : "warning"}>
                  {user ? t("authenticated") : t("public")}
                </Badge>
              </div>
            </div>
            <div className="space-y-1">
              <Link
                role="menuitem"
                href="/scanner"
                className="block rounded-[var(--apex-radius-md)] px-2 py-2 text-sm text-[var(--apex-fg-muted)] hover:bg-slate-800/60 hover:text-[var(--apex-fg)]"
                onClick={() => setOpen(false)}
              >
                {t("goScanner")}
              </Link>
              <Link
                role="menuitem"
                href="/feed"
                className="block rounded-[var(--apex-radius-md)] px-2 py-2 text-sm text-[var(--apex-fg-muted)] hover:bg-slate-800/60 hover:text-[var(--apex-fg)]"
                onClick={() => setOpen(false)}
              >
                {t("goFeed")}
              </Link>
              <Link
                role="menuitem"
                href="/dashboard"
                className="block rounded-[var(--apex-radius-md)] px-2 py-2 text-sm text-[var(--apex-fg-muted)] hover:bg-slate-800/60 hover:text-[var(--apex-fg)]"
                onClick={() => setOpen(false)}
              >
                {t("goDashboard")}
              </Link>
              {!user && (
                <Link
                  role="menuitem"
                  href="/login"
                  className="block rounded-[var(--apex-radius-md)] px-2 py-2 text-sm text-[var(--apex-accent)] hover:bg-[var(--apex-accent-muted)]"
                  onClick={() => setOpen(false)}
                >
                  {t("signIn")}
                </Link>
              )}
              {user && (
                <div className="pt-2" onClick={() => setOpen(false)}>
                  <SignOutButton />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

type AppSidebarProps = {
  open: boolean;
  onClose: () => void;
  primary: NavItem[];
  secondary: NavItem[];
};

export function AppSidebar({
  open,
  onClose,
  primary,
  secondary,
}: AppSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("chrome");
  const navLabel = useNavLabel();
  const navDescription = useNavDescription();

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label={t("closeNav")}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        id="apex-sidebar"
        className={cx(
          "fixed inset-y-0 left-0 z-50 flex w-[16.5rem] flex-col border-r border-[var(--apex-border)] bg-[var(--apex-bg-elevated)] transition-transform duration-[var(--apex-duration-normal)] ease-[var(--apex-ease-out)] lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-2 border-b border-[var(--apex-border)] px-4 py-4">
          <Link
            href="/scanner"
            className="text-sm font-semibold tracking-tight apex-focusable rounded-sm"
            onClick={onClose}
          >
            <span className="text-[var(--apex-accent)]">APEX</span>{" "}
            <span className="text-[var(--apex-fg)]">Intelligence</span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label={t("primaryNav")}>
          <p className="px-2 pb-2 text-[11px] font-medium uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
            {t("product")}
          </p>
          <ul className="space-y-1">
            {primary.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "apex-focusable block rounded-[var(--apex-radius-md)] px-3 py-2.5 transition-colors",
                      active
                        ? "bg-[var(--apex-accent-muted)] text-[var(--apex-fg)]"
                        : "text-[var(--apex-fg-muted)] hover:bg-slate-800/50 hover:text-[var(--apex-fg)]",
                    )}
                  >
                    <span className="block text-sm font-medium">{navLabel(item.id)}</span>
                    <span className="mt-0.5 block text-xs text-[var(--apex-fg-subtle)]">
                      {navDescription(item.id)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <p className="mt-5 px-2 pb-2 text-[11px] font-medium uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
            {t("system")}
          </p>
          <ul className="space-y-1">
            {secondary.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "apex-focusable block rounded-[var(--apex-radius-md)] px-3 py-2.5 text-sm transition-colors",
                      active
                        ? "bg-[var(--apex-accent-muted)] text-[var(--apex-fg)]"
                        : "text-[var(--apex-fg-muted)] hover:bg-slate-800/50 hover:text-[var(--apex-fg)]",
                    )}
                  >
                    {navLabel(item.id)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}
