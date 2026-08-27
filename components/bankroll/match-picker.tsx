"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { TeamLogo } from "@/components/design-system";
import { cx } from "@/components/design-system/utils";
import { formatKickoff } from "@/lib/bankroll/format";
import { filterFixturesByTeam, matchLabel } from "@/lib/bankroll/match-search";
import type { BankrollFixture } from "@/lib/bankroll/types";
import { fixtureIdFromMatch } from "@/lib/match-center/fixture-id";

type MatchPickerProps = {
  fixtures: BankrollFixture[];
  selectedId: string;
  onSelect: (match: BankrollFixture) => void;
};

export function MatchPicker({
  fixtures,
  selectedId,
  onSelect,
}: MatchPickerProps) {
  const listId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const selected = fixtures.find(
    (match) => fixtureIdFromMatch(match) === selectedId,
  );
  const filtered = useMemo(
    () => filterFixturesByTeam(fixtures, query) as BankrollFixture[],
    [fixtures, query],
  );

  useEffect(() => {
    setActive(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => searchRef.current?.focus(), 20);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  function pick(match: BankrollFixture) {
    onSelect(match);
    setQuery("");
    setOpen(false);
  }

  function onSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const match = filtered[active];
      if (match) pick(match);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        onClick={() => setOpen((value) => !value)}
        className={cx(
          "apex-focusable flex min-h-12 w-full items-center gap-2 rounded-[var(--apex-radius-md)] border bg-slate-950/50 px-3 py-2 text-left text-sm outline-none transition-colors",
          open
            ? "border-[var(--apex-accent-border)]"
            : "border-[var(--apex-border)] hover:border-[var(--apex-accent-border)]",
        )}
      >
        {selected ? (
          <MatchRow match={selected} />
        ) : (
          <span className="text-[var(--apex-fg-subtle)]">
            Buscar equipo o elegir fixture…
          </span>
        )}
      </button>

      {open ? (
        <div className="mt-1 overflow-hidden rounded-[var(--apex-radius-lg)] border border-[var(--apex-border-strong)] bg-slate-950/80 shadow-[var(--apex-shadow-md)]">
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onSearchKey}
            placeholder="Buscar por equipo"
            className="h-11 w-full border-b border-[var(--apex-border)] bg-transparent px-3 text-sm text-[var(--apex-fg)] outline-none placeholder:text-[var(--apex-fg-subtle)]"
            aria-autocomplete="list"
            aria-controls={listId}
          />
          <ul
            id={listId}
            role="listbox"
            className="max-h-52 overflow-y-auto overscroll-contain p-1"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-[var(--apex-fg-muted)]">
                {fixtures.length === 0
                  ? "No hay fixtures de Match Center."
                  : `Sin equipos para “${query}”.`}
              </li>
            ) : (
              filtered.map((match, index) => {
                const id = fixtureIdFromMatch(match) ?? match.id;
                const isActive = index === active;
                const isSelected = id === selectedId;
                return (
                  <li key={id} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => pick(match)}
                      className={cx(
                        "flex w-full rounded-[var(--apex-radius-md)] px-2 py-2 text-left transition-colors",
                        isActive || isSelected
                          ? "bg-[var(--apex-accent-muted)]/50"
                          : "hover:bg-slate-800/60",
                      )}
                    >
                      <MatchRow match={match} />
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function MatchRow({ match }: { match: BankrollFixture }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      {match.leagueLogoUrl ? (
        <TeamLogo
          src={match.leagueLogoUrl}
          name={match.leagueName ?? "Liga"}
          size="sm"
        />
      ) : null}
      <TeamLogo
        src={match.homeTeam.logoUrl}
        name={match.homeTeam.name}
        shortName={match.homeTeam.shortName}
        size="sm"
      />
      <TeamLogo
        src={match.awayTeam.logoUrl}
        name={match.awayTeam.name}
        shortName={match.awayTeam.shortName}
        size="sm"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-[var(--apex-fg)]">
          {matchLabel(match)}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-[var(--apex-fg-muted)]">
          {match.leagueName ?? "Liga"} · {formatKickoff(match.kickoffAt)}
        </span>
      </span>
    </span>
  );
}
