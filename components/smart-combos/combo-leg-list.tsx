import Link from "next/link";
import { Badge, TeamLogo } from "@/components/design-system";
import { cx } from "@/components/design-system/utils";
import { VERDICT_BADGE_TONE, formatOdds } from "@/lib/apex-opportunities/display";
import { matchAnalysisHref } from "@/lib/match-center/fixture-id";
import type { ComboLeg } from "@/lib/smart-combos/types";

export function ComboLegList({
  legs,
  weakestId,
  selectable,
  selectedIds,
  onToggle,
}: {
  legs: ComboLeg[];
  weakestId?: string | null;
  selectable?: boolean;
  selectedIds?: string[];
  onToggle?: (fixtureId: string) => void;
}) {
  if (legs.length === 0) {
    return (
      <p className="text-sm text-[var(--apex-fg-muted)]">
        No Decision Engine selections on the slip yet.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {legs.map((leg) => {
        const selected = selectedIds?.includes(leg.fixtureId) ?? false;
        const weakest = weakestId === leg.fixtureId;
        const body = (
          <>
            <TeamLogo
              src={leg.home.logoUrl}
              name={leg.home.name}
              shortName={leg.home.shortName}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--apex-fg)]">
                {leg.selectionLabel}
                <span className="ml-2 font-mono text-[11px] text-[var(--apex-fg-subtle)]">
                  {formatOdds(leg.decimalOdds)}
                </span>
              </p>
              <p className="truncate text-[11px] text-[var(--apex-fg-muted)]">
                {leg.home.shortName} vs {leg.away.shortName} · {leg.leagueName}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge tone={VERDICT_BADGE_TONE[leg.verdict]} size="sm">
                {leg.verdictLabel}
              </Badge>
              <span className="font-mono text-[10px] tabular-nums text-[var(--apex-fg-subtle)]">
                {leg.apexProbability == null
                  ? "p n/d"
                  : `p ${(leg.apexProbability * 100).toFixed(0)}%`}
                {weakest ? " · weakest" : ""}
              </span>
            </div>
          </>
        );

        if (selectable && onToggle) {
          return (
            <li key={leg.fixtureId}>
              <button
                type="button"
                onClick={() => onToggle(leg.fixtureId)}
                className={cx(
                  "apex-focusable flex w-full items-center gap-3 rounded-[var(--apex-radius-lg)] border px-3 py-2.5 text-left",
                  selected
                    ? "border-[var(--apex-accent-border)] bg-[var(--apex-accent-muted)]/40"
                    : "border-[var(--apex-border)] bg-black/25 hover:border-[var(--apex-accent-border)]",
                )}
              >
                {body}
              </button>
            </li>
          );
        }

        return (
          <li key={leg.fixtureId}>
            <Link
              href={matchAnalysisHref(leg.fixtureId)}
              className={cx(
                "apex-focusable flex items-center gap-3 rounded-[var(--apex-radius-lg)] border px-3 py-2.5",
                weakest
                  ? "border-amber-500/40 bg-amber-500/[0.06]"
                  : "border-[var(--apex-border)] bg-black/25 hover:border-[var(--apex-accent-border)]",
              )}
            >
              {body}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
