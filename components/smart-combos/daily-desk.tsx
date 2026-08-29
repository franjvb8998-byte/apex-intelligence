"use client";

import { Badge } from "@/components/design-system";
import { useTranslations } from "next-intl";
import { VERDICT_BADGE_TONE, formatOdds, formatSignedPct } from "@/lib/apex-opportunities/display";
import { ComboPanel } from "@/components/smart-combos/combo-panel";
import type { DailySmartCombo, DailySmartCombosBoard } from "@/lib/smart-combos/types";

export function DailyDesk({
  board,
  onUse,
}: {
  board: DailySmartCombosBoard;
  onUse: (combo: DailySmartCombo) => void;
}) {
  const t = useTranslations("smartCombos");
  return (
    <ComboPanel
      id="daily"
      eyebrow={t("dailyTitle")}
      title={t("curated")}
    >
      {board.items.length === 0 ? (
        <p className="text-sm text-[var(--apex-fg-muted)]">
          Not enough priced selections today to publish a combination. Open Match
          Center when more fixtures are in the catalogue.
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {board.items.map((item) => (
            <article
              key={item.kind}
              className="rounded-[var(--apex-radius-xl)] border border-[var(--apex-border)] bg-black/30 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--apex-accent)]">
                    {item.kind}
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-[var(--apex-fg)]">
                    {item.title}
                  </h4>
                  <p className="mt-1 text-xs text-[var(--apex-fg-muted)]">
                    {item.subtitle}
                  </p>
                </div>
                <Badge tone={VERDICT_BADGE_TONE[item.analysis.verdict.kind]}>
                  {item.analysis.verdict.label}
                </Badge>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px] tabular-nums text-[var(--apex-fg)]">
                <div>
                  <dt className="text-[var(--apex-fg-subtle)]">Health</dt>
                  <dd>{item.analysis.healthScore}</dd>
                </div>
                <div>
                  <dt className="text-[var(--apex-fg-subtle)]">APEX score</dt>
                  <dd>
                    {Math.round(
                      item.analysis.legs.reduce((sum, leg) => sum + leg.score, 0) /
                        item.analysis.legs.length,
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--apex-fg-subtle)]">Odds</dt>
                  <dd>{formatOdds(item.analysis.combinedOdds)}</dd>
                </div>
                <div>
                  <dt className="text-[var(--apex-fg-subtle)]">EV</dt>
                  <dd>{formatSignedPct(item.analysis.expectedValue)}</dd>
                </div>
                <div>
                  <dt className="text-[var(--apex-fg-subtle)]">Confidence</dt>
                  <dd>{item.analysis.confidence}</dd>
                </div>
                <div>
                  <dt className="text-[var(--apex-fg-subtle)]">Risk</dt>
                  <dd className="capitalize">{item.analysis.riskBand}</dd>
                </div>
              </dl>
              <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-[var(--apex-fg-muted)]">
                {item.analysis.explanation}
              </p>
              <button
                type="button"
                onClick={() => onUse(item)}
                className="apex-focusable mt-4 w-full rounded-[var(--apex-radius-md)] bg-[var(--apex-accent)] px-3 py-2 text-sm font-medium text-[var(--apex-fg-inverse)] hover:bg-[var(--apex-accent-hover)]"
              >
                Analyse this combo
              </button>
            </article>
          ))}
        </div>
      )}

      {board.unavailable.length > 0 && (
        <ul className="mt-4 space-y-1">
          {board.unavailable.map((row) => (
            <li
              key={row.kind}
              className="font-mono text-[11px] text-[var(--apex-fg-subtle)]"
            >
              {row.kind}: {row.reason}
            </li>
          ))}
        </ul>
      )}
    </ComboPanel>
  );
}
