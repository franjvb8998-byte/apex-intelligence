"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import { EmptyState } from "@/components/app-shell/states";
import { DiscoveryCard } from "@/components/apex-opportunities/discovery-card";
import { DiscoveryFilterBar } from "@/components/apex-opportunities/discovery-filters";
import { DiscoverySummary } from "@/components/apex-opportunities/discovery-summary";
import { formatScanTime } from "@/components/apex-opportunities/format";
import { useWatchlist } from "@/components/apex-opportunities/use-watchlist";
import {
  DEFAULT_DISCOVERY_FILTERS,
  discoveryDashboardStats,
  filterDiscovery,
  type DiscoveryFilters,
  type DiscoverySort,
} from "@/lib/apex-opportunities/discovery";
import type { ApexOpportunity } from "@/lib/apex-opportunities/types";

type DiscoveryViewProps = {
  analyzed: ApexOpportunity[];
  generatedAt: string;
};

export function DiscoveryView({ analyzed, generatedAt }: DiscoveryViewProps) {
  const t = useTranslations("opportunities");
  const reduceMotion = useReducedMotion();
  const watchlist = useWatchlist();
  const [filters, setFilters] = useState<DiscoveryFilters>(
    DEFAULT_DISCOVERY_FILTERS,
  );
  const [sort, setSort] = useState<DiscoverySort>("score");
  const stats = useMemo(() => discoveryDashboardStats(analyzed), [analyzed]);
  const ranked = useMemo(
    () => filterDiscovery(analyzed, filters, watchlist.ids, sort),
    [analyzed, filters, watchlist.ids, sort],
  );

  return (
    <div className="w-full space-y-6">
      <motion.header
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.35 }}
        className="space-y-3"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--apex-accent)]">
          {t("eyebrow")}
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--apex-fg)] sm:text-3xl">
          {t("title")}
        </h2>
        <p className="max-w-2xl text-sm text-[var(--apex-fg-muted)]">
          {t("description")}
        </p>
        <p className="font-mono text-[11px] text-[var(--apex-fg-subtle)]">
          {t("scanShowing", {
            time: formatScanTime(generatedAt),
            shown: ranked.length,
            total: analyzed.length,
          })}
        </p>
      </motion.header>

      <DiscoverySummary stats={stats} />
      <DiscoveryFilterBar
        analyzed={analyzed}
        filters={filters}
        sort={sort}
        onFilters={setFilters}
        onSort={setSort}
      />

      {analyzed.length === 0 ? (
        <EmptyScan />
      ) : ranked.length === 0 ? (
        <EmptyFilters favorites={filters.favoritesOnly} />
      ) : (
        <ol className="space-y-4">
          {ranked.map((row, index) => (
            <li key={row.fixtureId}>
              <DiscoveryCard
                row={row}
                rank={index + 1}
                watched={watchlist.has(row.fixtureId)}
                onWatch={() => watchlist.toggle(row.fixtureId)}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function EmptyScan() {
  const t = useTranslations("opportunities");
  const common = useTranslations("common");
  return (
    <EmptyState
      title={t("emptyTitle")}
      description={t("emptyDescription")}
      action={
        <Link
          href="/match-center"
          className="apex-focusable text-sm text-[var(--apex-accent)] hover:text-[var(--apex-accent-hover)]"
        >
          {common("openMatchCenter")}
        </Link>
      }
    />
  );
}

function EmptyFilters({ favorites }: { favorites: boolean }) {
  const t = useTranslations("opportunities");
  const common = useTranslations("common");
  return (
    <EmptyState
      title={favorites ? t("emptyWatchlist") : t("emptyFilters")}
      description={t("emptyFiltersDescription")}
      action={
        <Link
          href="/match-center"
          className="apex-focusable text-sm text-[var(--apex-accent)] hover:text-[var(--apex-accent-hover)]"
        >
          {common("openMatchCenter")}
        </Link>
      }
    />
  );
}
