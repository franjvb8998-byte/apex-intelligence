import { Suspense, type ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/design-system";
import { FeedCardSkeleton } from "@/components/feed/feed-card";
import { FeedClock } from "@/components/feed/feed-clock";
import { FeedErrorBoundary } from "@/components/feed/feed-error-boundary";
import {
  IconAlert,
  IconBook,
  IconBolt,
  IconChart,
  IconClock,
  IconFlag,
  IconPulse,
  IconWallet,
} from "@/components/feed/feed-icons";
import { LiveBadge, NamedFeedCard } from "@/components/feed/named-card";
import { WatchlistCard } from "@/components/feed/watchlist-card";
import { formatScanTime } from "@/components/apex-opportunities/format";
import { cx } from "@/components/design-system/utils";
import {
  buildAlertCard,
  buildBankrollCard,
  buildConfidenceMovers,
  buildEliteCard,
  buildFinishedCard,
  buildMarketMovers,
  buildPerformanceCard,
  buildUpcomingCard,
} from "@/lib/feed/build";
import { loadFeedBook, loadFeedDesk, loadFeedMarket } from "@/lib/feed/load";

async function EliteIsland() {
  const t = await getTranslations("feed");
  const market = await loadFeedMarket();
  if (!market.ok) {
    return (
      <NamedFeedCard
        title={t("cards.elite")}
        eyebrow={t("eyebrowScan")}
        icon={<IconBolt />}
        status="error"
        errorTitle="scanUnavailable"
        errorDescription="quota"
      />
    );
  }
  const model = buildEliteCard(market.analyzed);
  return (
    <NamedFeedCard
      title={t("cards.elite")}
      eyebrow={t("eyebrowDecisionEngine")}
      icon={<IconBolt />}
      model={model}
      badge={<LiveBadge label="SCAN" />}
    />
  );
}

async function ConfidenceIsland() {
  const t = await getTranslations("feed");
  const market = await loadFeedMarket();
  if (!market.ok) {
    return (
      <NamedFeedCard
        title={t("cards.confidence")}
        eyebrow={t("eyebrowTape")}
        icon={<IconPulse />}
        status="error"
        errorTitle="scanUnavailable"
        errorDescription="quota"
      />
    );
  }
  return (
    <NamedFeedCard
      title={t("cards.confidence")}
      eyebrow={t("eyebrowTape")}
      icon={<IconPulse />}
      model={buildConfidenceMovers(market.analyzed)}
      badge={<Badge tone="info">{t("thisScan")}</Badge>}
    />
  );
}

async function MarketIsland() {
  const t = await getTranslations("feed");
  const market = await loadFeedMarket();
  if (!market.ok) {
    return (
      <NamedFeedCard
        title={t("cards.market")}
        eyebrow={t("eyebrowTape")}
        icon={<IconChart />}
        status="error"
        errorTitle="scanUnavailable"
        errorDescription="quota"
      />
    );
  }
  return (
    <NamedFeedCard
      title={t("cards.market")}
      eyebrow={t("eyebrowBook")}
      icon={<IconChart />}
      model={buildMarketMovers(market.analyzed)}
      badge={<Badge tone="accent">{t("vsBook")}</Badge>}
    />
  );
}

async function AlertsIsland() {
  const t = await getTranslations("feed");
  const [desk, market] = await Promise.all([loadFeedDesk(), loadFeedMarket()]);
  const analyzed = market.ok ? market.analyzed : [];
  return (
    <NamedFeedCard
      title={t("cards.alerts")}
      eyebrow={t("eyebrowDesk")}
      icon={<IconAlert />}
      model={buildAlertCard({
        injuries: desk.injuries,
        suspensions: desk.suspensions,
        featuredHref: desk.featuredHref,
        featuredLabel: desk.featuredLabel,
        analyzed,
      })}
      badge={<Badge tone="warning">{t("noWire")}</Badge>}
    />
  );
}

async function WatchlistIsland() {
  const market = await loadFeedMarket();
  return (
    <WatchlistCard
      analyzed={market.ok ? market.analyzed : []}
      error={!market.ok}
    />
  );
}

async function UpcomingIsland() {
  const t = await getTranslations("feed");
  const desk = await loadFeedDesk();
  const matches = [
    ...desk.dashboard.todayMatches,
    ...desk.dashboard.upcomingMatches,
  ];
  return (
    <NamedFeedCard
      title={t("cards.upcoming")}
      eyebrow={t("eyebrowCatalogue")}
      icon={<IconClock />}
      model={buildUpcomingCard(matches)}
      badge={<LiveBadge label="KO" />}
    />
  );
}

async function FinishedIsland() {
  const t = await getTranslations("feed");
  const [desk, book] = await Promise.all([loadFeedDesk(), loadFeedBook()]);
  return (
    <NamedFeedCard
      title={t("cards.finished")}
      eyebrow={t("eyebrowMarks")}
      icon={<IconFlag />}
      model={buildFinishedCard({
        matches: desk.dashboard.todayMatches,
        bets: book.data.bets,
        fixtures: book.fixtures,
      })}
    />
  );
}

async function PerformanceIsland() {
  const t = await getTranslations("feed");
  const book = await loadFeedBook();
  return (
    <NamedFeedCard
      title={t("cards.performance")}
      eyebrow={t("eyebrowBook")}
      icon={<IconBook />}
      model={buildPerformanceCard(book.data, book.report)}
    />
  );
}

async function BankrollIsland() {
  const t = await getTranslations("feed");
  const book = await loadFeedBook();
  return (
    <NamedFeedCard
      title={t("cards.bankroll")}
      eyebrow={t("eyebrowCash")}
      icon={<IconWallet />}
      model={buildBankrollCard(book.data, book.report)}
      badge={<LiveBadge label="SESSION" />}
    />
  );
}

async function HeaderIsland() {
  const t = await getTranslations("feed");
  const market = await loadFeedMarket();
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--apex-border)] pb-4">
      <div>
        <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--apex-accent)]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--apex-accent)]" />
          {t("eyebrow")}
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--apex-fg)] sm:text-3xl">
          {t("title")}
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-[var(--apex-fg-muted)]">
          {t("description")}
        </p>
      </div>
      <div className="text-right">
        <FeedClock />
        <p className="mt-1 font-mono text-[11px] text-[var(--apex-fg-subtle)]">
          {market.ok
            ? t("scan", { time: formatScanTime(market.generatedAt) })
            : t("scanOffline")}
        </p>
      </div>
    </header>
  );
}

function Pane({
  title,
  span,
  children,
}: {
  title: string;
  span?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx("h-full min-h-[18rem]", span)}>
      <FeedErrorBoundary title={title}>
        <Suspense fallback={<FeedCardSkeleton title={title} />}>
          {children}
        </Suspense>
      </FeedErrorBoundary>
    </div>
  );
}

export async function FeedView() {
  const t = await getTranslations("feed");
  return (
    <div className="w-full space-y-5">
      <FeedErrorBoundary title={t("headerBoundary")}>
        <Suspense
          fallback={
            <div className="h-24 animate-pulse rounded-[var(--apex-radius-xl)] border border-[var(--apex-border)] bg-[var(--apex-surface)]" />
          }
        >
          <HeaderIsland />
        </Suspense>
      </FeedErrorBoundary>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-12">
        <Pane title={t("cards.elite")} span="lg:col-span-8">
          <EliteIsland />
        </Pane>
        <Pane title={t("cards.bankroll")} span="lg:col-span-4">
          <BankrollIsland />
        </Pane>
        <Pane title={t("cards.confidence")} span="lg:col-span-4">
          <ConfidenceIsland />
        </Pane>
        <Pane title={t("cards.market")} span="lg:col-span-4">
          <MarketIsland />
        </Pane>
        <Pane title={t("cards.alerts")} span="lg:col-span-4">
          <AlertsIsland />
        </Pane>
        <Pane title={t("cards.watchlist")} span="lg:col-span-4">
          <WatchlistIsland />
        </Pane>
        <Pane title={t("cards.upcoming")} span="lg:col-span-4">
          <UpcomingIsland />
        </Pane>
        <Pane title={t("cards.finished")} span="lg:col-span-4">
          <FinishedIsland />
        </Pane>
        <Pane title={t("cards.performance")} span="lg:col-span-12">
          <PerformanceIsland />
        </Pane>
      </div>
    </div>
  );
}
