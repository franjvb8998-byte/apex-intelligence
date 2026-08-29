"use client";

import { useTranslations } from "next-intl";
import { Badge, TeamLogo } from "@/components/design-system";
import { cx } from "@/components/design-system/utils";
import { ScannerRecBadge } from "@/components/opportunity-scanner/rec-badge";
import {
  formatKickoff,
  formatOdds,
  formatSignedPct,
} from "@/lib/apex-opportunities/display";
import { marketDisplayName } from "@/lib/apex-opportunities/discovery";
import type { ApexOpportunity } from "@/lib/apex-opportunities/types";

export function ScannerRow({
  row,
  rank,
  selected,
  expanded,
  favoriteLeague,
  favoriteTeam,
  onSelect,
  onExpand,
  onToggleLeague,
  onToggleTeam,
}: {
  row: ApexOpportunity;
  rank: number;
  selected: boolean;
  expanded: boolean;
  favoriteLeague: boolean;
  favoriteTeam: boolean;
  onSelect: () => void;
  onExpand: () => void;
  onToggleLeague: () => void;
  onToggleTeam: () => void;
}) {
  const t = useTranslations("scanner.combo");
  return (
    <div
      id={`scan-${row.fixtureId}`}
      className={cx(
        "border-b border-[var(--apex-border)] bg-black/20",
        expanded && "bg-[var(--apex-accent-muted)]/15",
      )}
    >
      <div className="grid grid-cols-[auto_auto_minmax(0,1.6fr)_minmax(0,0.9fr)_repeat(6,minmax(3.2rem,1fr))_auto] items-center gap-2 px-2 py-2 sm:px-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          aria-label={t("addAria", { selection: row.selectionLabel })}
          className="accent-[var(--apex-accent)]"
        />
        <span className="font-mono text-[10px] tabular-nums text-[var(--apex-fg-subtle)]">
          {rank}
        </span>
        <button
          type="button"
          onClick={onExpand}
          className="apex-focusable min-w-0 text-left"
        >
          <span className="flex items-center gap-2">
            <TeamLogo
              src={row.home.logoUrl}
              name={row.home.name}
              shortName={row.home.shortName}
              size="sm"
            />
            <span className="truncate text-sm text-[var(--apex-fg)]">
              {row.home.shortName}–{row.away.shortName}
            </span>
            <TeamLogo
              src={row.away.logoUrl}
              name={row.away.name}
              shortName={row.away.shortName}
              size="sm"
            />
          </span>
          <span className="mt-0.5 block truncate font-mono text-[10px] text-[var(--apex-accent)]">
            {row.selectionLabel}
          </span>
        </button>
        <div className="min-w-0">
          <p className="truncate text-[11px] text-[var(--apex-fg-muted)]">
            {row.leagueName}
          </p>
          <p className="truncate font-mono text-[10px] text-[var(--apex-fg-subtle)]">
            {row.country ?? "—"} · {formatKickoff(row.kickoffAt)}
          </p>
        </div>
        <span className="font-mono text-[11px] text-[var(--apex-fg-muted)]">
          {marketDisplayName(row.market)}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-[var(--apex-fg)]">
          {formatOdds(row.bookmakerOdds)}
        </span>
        <span className="font-mono text-sm tabular-nums text-[var(--apex-accent)]">
          {Math.round(row.score)}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-[var(--apex-fg)]">
          {Math.round(row.confidence)}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-[var(--apex-fg)]">
          {formatSignedPct(row.expectedValue)}
        </span>
        <Badge
          tone={
            row.riskBand === "high"
              ? "danger"
              : row.riskBand === "medium"
                ? "warning"
                : "success"
          }
          size="sm"
        >
          {row.riskBand}
        </Badge>
        <div className="flex flex-wrap items-center justify-end gap-1">
          <ScannerRecBadge row={row} />
          <button
            type="button"
            onClick={onToggleLeague}
            className="apex-focusable font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--apex-fg-subtle)] hover:text-[var(--apex-accent)]"
          >
            {favoriteLeague ? "League ★" : "League"}
          </button>
          <button
            type="button"
            onClick={onToggleTeam}
            className="apex-focusable font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--apex-fg-subtle)] hover:text-[var(--apex-accent)]"
          >
            {favoriteTeam ? "Team ★" : "Team"}
          </button>
        </div>
      </div>
    </div>
  );
}
