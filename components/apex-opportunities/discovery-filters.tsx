"use client";

import { useTranslations } from "next-intl";
import { cx } from "@/components/design-system/utils";
import {
  DEFAULT_DISCOVERY_FILTERS,
  DISCOVERY_RECOMMENDATION_OPTIONS,
  DISCOVERY_SORT_OPTIONS,
  leagueOptions,
  type DiscoveryFilters,
  type DiscoverySort,
} from "@/lib/apex-opportunities/discovery";
import type {
  ApexOpportunity,
  OpportunityKickoffWindow,
  OpportunityRiskFilter,
} from "@/lib/apex-opportunities/types";

type DiscoveryFilterBarProps = {
  analyzed: ApexOpportunity[];
  filters: DiscoveryFilters;
  sort: DiscoverySort;
  onFilters: (next: DiscoveryFilters) => void;
  onSort: (next: DiscoverySort) => void;
};

const fieldClass =
  "apex-focusable w-full rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] bg-[#070b14] px-2.5 py-1.5 text-xs text-[var(--apex-fg)]";

const labelClass =
  "mb-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--apex-fg-subtle)]";

export function DiscoveryFilterBar({
  analyzed,
  filters,
  sort,
  onFilters,
  onSort,
}: DiscoveryFilterBarProps) {
  const t = useTranslations("opportunities");
  const scanner = useTranslations("scanner.filters");
  const leagues = leagueOptions(analyzed);

  return (
    <div
      className={cx(
        "sticky top-[3.35rem] z-20 -mx-4 border-y border-[var(--apex-border)] bg-[var(--apex-bg)]/95 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6",
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--apex-accent)]">
          {t("rankFilter")}
        </p>
        <button
          type="button"
          className="apex-focusable text-[11px] text-[var(--apex-fg-muted)] hover:text-[var(--apex-accent)]"
          onClick={() => {
            onFilters({ ...DEFAULT_DISCOVERY_FILTERS });
            onSort("score");
          }}
        >
          {t("resetRanking")}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
        <label>
          <span className={labelClass}>{t("sort")}</span>
          <select
            className={fieldClass}
            value={sort}
            onChange={(e) => onSort(e.target.value as DiscoverySort)}
          >
            {DISCOVERY_SORT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {t(
                  option.id === "score"
                    ? "sortScore"
                    : option.id === "ev"
                      ? "sortEv"
                      : option.id === "kelly"
                        ? "sortKelly"
                        : option.id === "risk"
                          ? "sortRisk"
                          : "sortKickoff",
                )}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={labelClass}>{scanner("league")}</span>
          <select
            className={fieldClass}
            value={filters.league}
            onChange={(e) => onFilters({ ...filters, league: e.target.value })}
          >
            <option value="all">{t("allLeagues")}</option>
            {leagues.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={labelClass}>{scanner("market")}</span>
          <select
            className={fieldClass}
            value={filters.market}
            onChange={(e) =>
              onFilters({
                ...filters,
                market: e.target.value as DiscoveryFilters["market"],
              })
            }
          >
            <option value="all">{t("allMarkets")}</option>
            <option value="1x2">1X2</option>
          </select>
        </label>
        <label>
          <span className={labelClass}>{t("minScore")}</span>
          <input
            className={fieldClass}
            type="number"
            min={0}
            max={100}
            step={1}
            value={filters.minScore}
            onChange={(e) =>
              onFilters({
                ...filters,
                minScore: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
              })
            }
          />
        </label>
        <label>
          <span className={labelClass}>{t("risk")}</span>
          <select
            className={fieldClass}
            value={filters.risk}
            onChange={(e) =>
              onFilters({
                ...filters,
                risk: e.target.value as OpportunityRiskFilter,
              })
            }
          >
            <option value="all">{t("allRisk")}</option>
            <option value="low">{t("riskLow")}</option>
            <option value="medium">{t("riskMedium")}</option>
            <option value="high">{t("riskHigh")}</option>
          </select>
        </label>
        <label>
          <span className={labelClass}>{t("recommendation")}</span>
          <select
            className={fieldClass}
            value={filters.recommendation}
            onChange={(e) =>
              onFilters({
                ...filters,
                recommendation: e.target.value as DiscoveryFilters["recommendation"],
              })
            }
          >
            <option value="all">{t("allRecommendations")}</option>
            {DISCOVERY_RECOMMENDATION_OPTIONS.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={labelClass}>{t("kickoff")}</span>
          <select
            className={fieldClass}
            value={filters.kickoff}
            onChange={(e) =>
              onFilters({
                ...filters,
                kickoff: e.target.value as OpportunityKickoffWindow,
              })
            }
          >
            <option value="all">{t("anyTime")}</option>
            <option value="morning">{t("morning")}</option>
            <option value="afternoon">{t("afternoon")}</option>
            <option value="evening">{t("evening")}</option>
          </select>
        </label>
        <label className="flex items-end">
          <span className="inline-flex w-full items-center gap-2 rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] bg-[#070b14] px-2.5 py-1.5 text-xs text-[var(--apex-fg)]">
            <input
              type="checkbox"
              className="accent-[var(--apex-accent)]"
              checked={filters.favoritesOnly}
              onChange={(e) =>
                onFilters({ ...filters, favoritesOnly: e.target.checked })
              }
            />
            {t("favoritesOnly")}
          </span>
        </label>
      </div>
    </div>
  );
}
