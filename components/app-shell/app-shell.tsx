"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Breadcrumbs } from "@/components/app-shell/breadcrumbs";
import {
  CommandPalette,
  GlobalSearch,
  NotificationsPanel,
} from "@/components/app-shell/chrome";
import { PageTransition } from "@/components/app-shell/page-transition";
import {
  AppSidebar,
  ProfileMenu,
} from "@/components/app-shell/sidebar";
import type { ShellUser } from "@/components/app-shell/types";
import {
  ALL_NAV,
  PRIMARY_NAV,
  SECONDARY_NAV,
  breadcrumbsForPath,
  buildCommandItems,
  titleForPath,
} from "@/lib/navigation";

type AppHeaderProps = {
  user: ShellUser | null;
  onMenuOpen: () => void;
  onOpenPalette: () => void;
};

function AppHeader({ user, onMenuOpen, onOpenPalette }: AppHeaderProps) {
  const pathname = usePathname();
  const crumbs = breadcrumbsForPath(pathname);
  const title = titleForPath(pathname);

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--apex-border)] bg-[var(--apex-bg)]/90 backdrop-blur-md">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        <button
          type="button"
          className="apex-focusable rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] px-2.5 py-2 text-xs text-[var(--apex-fg-muted)] lg:hidden"
          onClick={onMenuOpen}
          aria-controls="apex-sidebar"
        >
          Menú
        </button>

        <div className="min-w-0 flex-1 space-y-1">
          <Breadcrumbs items={crumbs} />
          <h1 className="truncate text-base font-semibold tracking-tight text-[var(--apex-fg)] sm:text-lg">
            {title}
          </h1>
        </div>

        <GlobalSearch onOpenPalette={onOpenPalette} />
        <button
          type="button"
          onClick={onOpenPalette}
          className="apex-focusable rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] px-2.5 py-2 text-xs text-[var(--apex-fg-muted)] md:hidden"
          aria-label="Abrir buscador"
        >
          Buscar
        </button>
        <NotificationsPanel />
        <ProfileMenu user={user} />
      </div>
    </header>
  );
}

export type AppShellProps = {
  children: ReactNode;
  user: ShellUser | null;
  /** Full-bleed content (e.g. Copilot) without max-width padding. */
  flush?: boolean;
};

export function AppShell({ children, user, flush = false }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const commands = useMemo(() => buildCommandItems(), []);
  const isCopilot = pathname.startsWith("/copilot");
  const contentFlush = flush || isCopilot;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-[100dvh] bg-[var(--apex-bg)] text-[var(--apex-fg)]">
      <a
        href="#apex-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[70] focus:rounded-[var(--apex-radius-md)] focus:bg-[var(--apex-accent)] focus:px-3 focus:py-2 focus:text-sm focus:text-[var(--apex-fg-inverse)]"
      >
        Saltar al contenido
      </a>

      <AppSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        primary={PRIMARY_NAV}
        secondary={SECONDARY_NAV}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          user={user}
          onMenuOpen={() => setSidebarOpen(true)}
          onOpenPalette={() => setPaletteOpen(true)}
        />

        <main
          id="apex-main"
          className={
            contentFlush
              ? "flex min-h-0 flex-1 flex-col"
              : "mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8"
          }
        >
          <PageTransition>{children}</PageTransition>
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        items={commands}
        onNavigate={(href) => router.push(href)}
      />

      <nav className="sr-only" aria-hidden>
        {ALL_NAV.map((item) => (
          <a key={item.id} href={item.href}>
            {item.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
