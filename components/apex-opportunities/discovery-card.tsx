"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Badge, TeamLogo } from "@/components/design-system";
import { cx } from "@/components/design-system/utils";
import { OpportunityActions } from "@/components/apex-opportunities/opportunity-actions";
import { OpportunityScoreViz } from "@/components/apex-opportunities/discovery-score";
import { RecommendationBadge } from "@/components/apex-opportunities/recommendation-badge";
import {
  Stars,
  VERDICT_CARD_CLASS,
  formatKickoff,
  formatKelly,
  formatOdds,
  formatSignedPct,
} from "@/components/apex-opportunities/format";
import { opportunityBlurb } from "@/lib/apex-opportunities/blurb";
import {
  discoveryPriority,
  marketDisplayName,
} from "@/lib/apex-opportunities/discovery";
import type { ApexOpportunity } from "@/lib/apex-opportunities/types";

type DiscoveryCardProps = {
  row: ApexOpportunity;
  rank: number;
  watched: boolean;
  onWatch: () => void;
};

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] bg-black/25 px-2.5 py-2">
      <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--apex-fg-subtle)]">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-sm tabular-nums text-[var(--apex-fg)]">
        {value}
      </dd>
    </div>
  );
}

export function DiscoveryCard({
  row,
  rank,
  watched,
  onWatch,
}: DiscoveryCardProps) {
  const reduceMotion = useReducedMotion();
  const priority = discoveryPriority(row);
  const riskLabel = row.riskBand.charAt(0).toUpperCase() + row.riskBand.slice(1);

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduceMotion ? 0 : 0.32,
        delay: reduceMotion ? 0 : Math.min(rank - 1, 8) * 0.04,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={cx(
        "rounded-[var(--apex-radius-2xl)] border p-4 shadow-[var(--apex-shadow-sm)] sm:p-5",
        VERDICT_CARD_CLASS[row.verdict],
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="font-mono text-xs tabular-nums text-[var(--apex-fg-subtle)]">
            #{rank}
          </span>
          <TeamLogo
            src={row.home.logoUrl}
            name={row.home.name}
            shortName={row.home.shortName}
            size="md"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--apex-fg)] sm:text-base">
              {row.home.name} vs {row.away.name}
            </p>
            <p className="truncate text-xs text-[var(--apex-fg-muted)]">
              {row.leagueName} · {formatKickoff(row.kickoffAt)}
            </p>
          </div>
          <TeamLogo
            src={row.away.logoUrl}
            name={row.away.name}
            shortName={row.away.shortName}
            size="md"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 font-mono text-[11px] text-[var(--apex-accent)]">
            <Stars filled={priority.stars} />
            <span className="tracking-[0.08em]">{priority.label}</span>
          </span>
          <RecommendationBadge row={row} />
        </div>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-[minmax(8.5rem,11rem)_minmax(0,1fr)]">
        <OpportunityScoreViz row={row} />
        <div className="min-w-0 space-y-4">
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Metric label="Confidence" value={String(Math.round(row.confidence))} />
            <Metric label="Expected Value" value={formatSignedPct(row.expectedValue)} />
            <Metric
              label="Kelly Stake"
              value={`${formatKelly(row.kellyPct)} · ${row.stakeLabel}`}
            />
            <Metric label="Risk" value={riskLabel} />
            <Metric label="Market" value={marketDisplayName(row.market)} />
            <Metric label="Current Odds" value={formatOdds(row.bookmakerOdds)} />
          </dl>
          <p className="text-sm leading-relaxed text-[var(--apex-fg-muted)]">
            {opportunityBlurb(row)}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{row.selectionLabel}</Badge>
            <OpportunityActions row={row} watched={watched} onWatch={onWatch} />
          </div>
        </div>
      </div>
    </motion.article>
  );
}
