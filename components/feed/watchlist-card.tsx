"use client";

import { useTranslations } from "next-intl";
import { FeedCard } from "@/components/feed/feed-card";
import { IconStar } from "@/components/feed/feed-icons";
import { FeedRowLink } from "@/components/feed/feed-row";
import { LiveBadge } from "@/components/feed/named-card";
import { useWatchlist } from "@/components/apex-opportunities/use-watchlist";
import {
  discoveryRecommendation,
} from "@/lib/apex-opportunities/discovery";
import { opportunityAnalysisHref } from "@/lib/apex-opportunities/hrefs";
import { matchAnalysisHref, vendorFixtureId } from "@/lib/match-center/fixture-id";
import type { ApexOpportunity } from "@/lib/apex-opportunities/types";
import { VERDICT_BADGE_TONE } from "@/components/apex-opportunities/format";
import { formatKickoff } from "@/components/apex-opportunities/format";
import type { FeedRow } from "@/lib/feed/types";

type WatchlistCardProps = {
  analyzed: ApexOpportunity[];
  error?: boolean;
};

export function WatchlistCard({ analyzed, error = false }: WatchlistCardProps) {
  const t = useTranslations("feed");
  const watchlist = useWatchlist();
  const matched = analyzed.filter((row) => watchlist.has(row.fixtureId));
  const orphanIds = watchlist.ids.filter(
    (id) => !analyzed.some((row) => row.fixtureId === id),
  );

  const rows: FeedRow[] = [
    ...matched.map((row) => ({
      id: row.fixtureId,
      href: opportunityAnalysisHref(row.fixtureId),
      title: `${row.home.name} vs ${row.away.name}`,
      subtitle: `${row.leagueName} · ${formatKickoff(row.kickoffAt)}`,
      badge: {
        label: discoveryRecommendation(row),
        tone: VERDICT_BADGE_TONE[row.verdict],
      },
      confidence: row.confidence,
      kpis: [
        { label: "Score", value: String(Math.round(row.score)), tone: "accent" as const },
        { label: "Conf", value: String(Math.round(row.confidence)) },
      ],
    })),
    ...orphanIds.slice(0, 3).map((id) => ({
      id,
      href: matchAnalysisHref(vendorFixtureId(id) ?? id),
      title: t("fixtureId", { id: vendorFixtureId(id) ?? id }),
      subtitle: "watchlistOrphanSubtitle",
      badge: { label: "WATCH", tone: "warning" as const },
      kpis: [{ label: "ID", value: vendorFixtureId(id) ?? id }],
    })),
  ];

  const model = {
    kpis: [
      { label: "kpi.watching", value: String(watchlist.ids.length), tone: "warning" as const },
      { label: "kpi.inScan", value: String(matched.length), tone: "accent" as const },
      { label: "kpi.orphan", value: String(orphanIds.length) },
    ],
    rows,
    emptyTitle: "watchlistQuiet",
    emptyDescription: "watchlistQuietDescription",
    footerHref: "/opportunities",
    footerLabel: "footer.openOpportunities",
  };

  if (error) {
    return (
      <FeedCard
        title={t("watchlistUpdates")}
        eyebrow={t("eyebrowDesk")}
        icon={<IconStar />}
        status="error"
        errorTitle="scanUnavailable"
        errorDescription="watchlistScanError"
        badge={<LiveBadge label="LOCAL" />}
      />
    );
  }

  return (
    <FeedCard
      title={t("watchlistUpdates")}
      eyebrow={t("eyebrowDesk")}
      icon={<IconStar />}
      model={model}
      badge={<LiveBadge label="LOCAL" />}
    >
      {rows.map((row) => (
        <FeedRowLink key={row.id} row={row} />
      ))}
    </FeedCard>
  );
}
