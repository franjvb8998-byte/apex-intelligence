"use client";

import { useTranslations } from "next-intl";
import { formatKickoff, formatSignedPct } from "@/lib/apex-opportunities/display";
import type { ScannerRankingBoard } from "@/lib/opportunity-scanner/ranking";
import { cx } from "@/components/design-system/utils";

export function ScannerRankings({
  boards,
  catalogEmpty,
  onFocus,
}: {
  boards: ScannerRankingBoard[];
  catalogEmpty?: boolean;
  onFocus: (fixtureId: string) => void;
}) {
  const t = useTranslations("scanner.rankings");

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {boards.map((board) => (
        <section
          key={board.kind}
          className="rounded-[var(--apex-radius-lg)] border border-[var(--apex-border)] bg-black/30 p-4"
        >
          <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--apex-accent)]">
            {t(board.kind)}
          </h3>
          {board.items.length === 0 ? (
            <p className="mt-3 text-xs leading-relaxed text-[var(--apex-fg-muted)]">
              {catalogEmpty ? t("empty.quiet") : t(`empty.${board.kind}`)}
            </p>
          ) : (
            <ol className="mt-3 space-y-1.5">
              {board.items.slice(0, 5).map((row, index) => (
                <li key={row.fixtureId}>
                  <button
                    type="button"
                    onClick={() => onFocus(row.fixtureId)}
                    className={cx(
                      "apex-focusable flex w-full items-baseline justify-between gap-2 rounded px-1 py-0.5 text-left hover:bg-[var(--apex-accent-muted)]/40",
                    )}
                  >
                    <span className="truncate text-[11px] text-[var(--apex-fg)]">
                      <span className="font-mono text-[var(--apex-fg-subtle)]">
                        {index + 1}.
                      </span>{" "}
                      {row.selectionLabel}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-[var(--apex-fg-subtle)]">
                      {row.score} · {formatSignedPct(row.expectedValue)}
                    </span>
                  </button>
                  <p className="truncate pl-5 font-mono text-[9px] text-[var(--apex-fg-subtle)]">
                    {row.leagueName} · {formatKickoff(row.kickoffAt)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>
      ))}
    </div>
  );
}
