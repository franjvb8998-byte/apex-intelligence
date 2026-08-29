"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/design-system";
import { cx } from "@/components/design-system/utils";
import {
  PRODUCT_NOTIFICATIONS,
  type AppNotification,
  type CommandItem,
} from "@/lib/navigation";

type NotificationsPanelProps = {
  items?: AppNotification[];
};

export function NotificationsPanel({
  items = PRODUCT_NOTIFICATIONS,
}: NotificationsPanelProps) {
  const t = useTranslations("chrome");
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<AppNotification[]>(items);
  const unread = notes.filter((n) => !n.read).length;

  useEffect(() => {
    setNotes(items);
  }, [items]);

  function markAllRead() {
    setNotes((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={
          unread > 0 ? t("notificationsUnread", { count: unread }) : t("notifications")
        }
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="apex-focusable relative rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] bg-[var(--apex-surface)] px-2.5 py-2 text-xs text-[var(--apex-fg-muted)] transition-colors hover:border-[var(--apex-accent-border)] hover:text-[var(--apex-fg)]"
      >
        {t("alerts")}
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--apex-accent)] px-1 text-[10px] font-semibold text-[var(--apex-fg-inverse)]">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            aria-label={t("closeNotifications")}
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,22rem)] rounded-[var(--apex-radius-xl)] border border-[var(--apex-border)] bg-[var(--apex-bg-elevated)] shadow-[var(--apex-shadow-md)]">
            <div className="flex items-center justify-between border-b border-[var(--apex-border)] px-3 py-2.5">
              <p className="text-sm font-medium text-[var(--apex-fg)]">
                {t("notifications")}
              </p>
              {notes.length > 0 && (
                <button
                  type="button"
                  className="text-xs text-[var(--apex-accent)] hover:text-[var(--apex-accent-hover)]"
                  onClick={markAllRead}
                >
                  {t("markRead")}
                </button>
              )}
            </div>
            <ul className="max-h-80 overflow-y-auto p-2">
              {notes.length === 0 ? (
                <li className="px-2 py-6 text-center text-sm text-[var(--apex-fg-muted)]">
                  {t("noNotifications")}
                </li>
              ) : (
                notes.map((note) => (
                  <li key={note.id}>
                    <Link
                      href={note.href ?? "/dashboard"}
                      onClick={() => {
                        setNotes((prev) =>
                          prev.map((n) =>
                            n.id === note.id ? { ...n, read: true } : n,
                          ),
                        );
                        setOpen(false);
                      }}
                      className={cx(
                        "block rounded-[var(--apex-radius-md)] px-2.5 py-2.5 transition-colors hover:bg-slate-800/60",
                        !note.read && "bg-[var(--apex-accent-muted)]/40",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-[var(--apex-fg)]">
                          {note.title}
                        </p>
                        {!note.read && <Badge tone="accent">{t("new")}</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-[var(--apex-fg-muted)]">
                        {note.body}
                      </p>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CommandItem[];
  onNavigate: (href: string) => void;
};

export function CommandPalette({
  open,
  onOpenChange,
  items,
  onNavigate,
}: CommandPaletteProps) {
  const t = useTranslations("chrome");
  const tNav = useTranslations("nav");
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  function labelFor(item: CommandItem): string {
    if (item.navId) return tNav(`${item.navId}.label`);
    if (item.actionKey) return t(`actions.${item.actionKey}`);
    return item.id;
  }

  function hintFor(item: CommandItem): string | undefined {
    if (item.navId) return tNav(`${item.navId}.description`);
    if (item.actionKey) return t(`actions.${item.actionKey}Hint`);
    return undefined;
  }

  function groupFor(item: CommandItem): string {
    return t(`groups.${item.group}`);
  }

  const resolved = useMemo(
    () =>
      items.map((item) => ({
        item,
        label: labelFor(item),
        hint: hintFor(item),
        group: groupFor(item),
      })),
    [items, t, tNav],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return resolved;
    return resolved.filter(
      (row) =>
        row.label.toLowerCase().includes(q) ||
        row.hint?.toLowerCase().includes(q) ||
        row.group.toLowerCase().includes(q),
    );
  }, [resolved, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const id = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

  function runItem(index: number) {
    const row = filtered[index];
    if (!row?.item.href) return;
    onNavigate(row.item.href);
    onOpenChange(false);
  }

  const groups = Array.from(new Set(filtered.map((row) => row.group)));

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0"
        aria-label={t("closePalette")}
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("paletteAria")}
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-[var(--apex-radius-2xl)] border border-[var(--apex-border-strong)] bg-[var(--apex-bg-elevated)] shadow-[var(--apex-shadow-lg)]"
      >
        <div className="border-b border-[var(--apex-border)] px-3 py-2">
          <label className="sr-only" htmlFor="apex-command-input">
            {t("searchCommands")}
          </label>
          <input
            id="apex-command-input"
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                onOpenChange(false);
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                runItem(activeIndex);
              }
            }}
            placeholder={t("goToPage")}
            className="w-full bg-transparent px-2 py-2.5 text-sm text-[var(--apex-fg)] outline-none placeholder:text-[var(--apex-fg-subtle)]"
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-[var(--apex-fg-muted)]">
              {t("noResults", { query })}
            </p>
          ) : (
            groups.map((group) => (
              <div key={group} className="mb-2">
                <p className="px-2 py-1 text-[11px] uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
                  {group}
                </p>
                <ul>
                  {filtered
                    .map((row, index) => ({ row, index }))
                    .filter(({ row }) => row.group === group)
                    .map(({ row, index }) => (
                      <li key={row.item.id}>
                        <button
                          type="button"
                          onClick={() => runItem(index)}
                          onMouseEnter={() => setActiveIndex(index)}
                          className={cx(
                            "flex w-full items-start justify-between gap-3 rounded-[var(--apex-radius-md)] px-2.5 py-2 text-left text-sm transition-colors",
                            index === activeIndex
                              ? "bg-[var(--apex-accent-muted)] text-[var(--apex-fg)]"
                              : "text-[var(--apex-fg-muted)] hover:bg-slate-800/50",
                          )}
                        >
                          <span>
                            <span className="block font-medium">{row.label}</span>
                            {row.hint && (
                              <span className="mt-0.5 block text-xs text-[var(--apex-fg-subtle)]">
                                {row.hint}
                              </span>
                            )}
                          </span>
                          {row.item.href && (
                            <span className="shrink-0 text-[11px] text-[var(--apex-fg-subtle)]">
                              {row.item.href}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            ))
          )}
        </div>
        <div className="border-t border-[var(--apex-border)] px-3 py-2 text-[11px] text-[var(--apex-fg-subtle)]">
          {t("paletteFooter")}
        </div>
      </div>
    </div>
  );
}

type GlobalSearchProps = {
  onOpenPalette: () => void;
};

export function GlobalSearch({ onOpenPalette }: GlobalSearchProps) {
  const t = useTranslations("chrome");
  return (
    <button
      type="button"
      onClick={onOpenPalette}
      className="apex-focusable hidden min-w-[12rem] items-center gap-2 rounded-[var(--apex-radius-lg)] border border-[var(--apex-border)] bg-[var(--apex-surface)] px-3 py-2 text-left text-sm text-[var(--apex-fg-subtle)] transition-colors hover:border-[var(--apex-accent-border)] md:inline-flex lg:min-w-[16rem]"
    >
      <span className="flex-1 truncate">{t("goToPage")}</span>
      <kbd className="rounded border border-[var(--apex-border-strong)] bg-[var(--apex-bg)] px-1.5 py-0.5 text-[10px] text-[var(--apex-fg-muted)]">
        {t("shortcut")}
      </kbd>
    </button>
  );
}
