"use client";

import { useTranslations } from "next-intl";
import { DEFAULT_SCANNER_FILTERS, type ScannerFilters } from "@/lib/opportunity-scanner/filters";

const field =
  "mt-1 w-full rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] bg-black/40 px-2.5 py-1.5 text-xs text-[var(--apex-fg)]";

export function ScannerFilterBar({
  filters,
  leagues,
  countries,
  onChange,
}: {
  filters: ScannerFilters;
  leagues: string[];
  countries: string[];
  onChange: (next: ScannerFilters) => void;
}) {
  const t = useTranslations("scanner.filters");
  const common = useTranslations("common");

  function patch(partial: Partial<ScannerFilters>) {
    onChange({ ...filters, ...partial });
  }

  return (
    <div className="rounded-[var(--apex-radius-xl)] border border-[var(--apex-border)] bg-[var(--apex-surface)] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--apex-accent)]">
          {t("section")}
        </p>
        <button
          type="button"
          onClick={() =>
            onChange({
              ...DEFAULT_SCANNER_FILTERS,
              favoriteLeaguesOnly: filters.favoriteLeaguesOnly,
              favoriteTeamsOnly: filters.favoriteTeamsOnly,
            })
          }
          className="apex-focusable font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--apex-fg-muted)] hover:text-[var(--apex-fg)]"
        >
          {t("clear")}
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <label className="text-[10px] text-[var(--apex-fg-subtle)]">
          {t("league")}
          <select
            className={field}
            value={filters.league}
            onChange={(event) => patch({ league: event.target.value })}
          >
            <option value="all">{t("leagueAll")}</option>
            {leagues.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[10px] text-[var(--apex-fg-subtle)]">
          {t("country")}
          <select
            className={field}
            value={filters.country}
            onChange={(event) => patch({ country: event.target.value })}
          >
            <option value="all">{t("countryAll")}</option>
            {countries.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[10px] text-[var(--apex-fg-subtle)]">
          {t("market")}
          <select
            className={field}
            value={filters.market}
            onChange={(event) =>
              patch({ market: event.target.value as ScannerFilters["market"] })
            }
          >
            <option value="all">{t("marketAll")}</option>
            <option value="1x2">{t("market1x2")}</option>
          </select>
        </label>
        <label className="text-[10px] text-[var(--apex-fg-subtle)]">
          {t("oddsFrom")}
          <input
            className={field}
            type="number"
            min={1.01}
            step="0.1"
            placeholder={common("any")}
            value={filters.oddsMin ?? ""}
            onChange={(event) =>
              patch({
                oddsMin: event.target.value ? Number(event.target.value) : null,
              })
            }
          />
        </label>
        <label className="text-[10px] text-[var(--apex-fg-subtle)]">
          {t("oddsTo")}
          <input
            className={field}
            type="number"
            min={1.01}
            step="0.1"
            placeholder={common("any")}
            value={filters.oddsMax ?? ""}
            onChange={(event) =>
              patch({
                oddsMax: event.target.value ? Number(event.target.value) : null,
              })
            }
          />
        </label>
        <label className="text-[10px] text-[var(--apex-fg-subtle)]">
          {t("minEv")}
          <input
            className={field}
            type="number"
            step="0.5"
            placeholder={common("any")}
            value={
              filters.minEv == null ? "" : String(Math.round(filters.minEv * 1000) / 10)
            }
            onChange={(event) =>
              patch({
                minEv: event.target.value
                  ? Number(event.target.value) / 100
                  : null,
              })
            }
          />
        </label>
        <label className="text-[10px] text-[var(--apex-fg-subtle)]">
          {t("minConfidence")}
          <input
            className={field}
            type="number"
            min={0}
            max={100}
            value={filters.minConfidence}
            onChange={(event) =>
              patch({ minConfidence: Number(event.target.value) || 0 })
            }
          />
        </label>
        <label className="text-[10px] text-[var(--apex-fg-subtle)]">
          {t("risk")}
          <select
            className={field}
            value={filters.risk}
            onChange={(event) =>
              patch({ risk: event.target.value as ScannerFilters["risk"] })
            }
          >
            <option value="all">{t("riskAll")}</option>
            <option value="low">{t("riskLow")}</option>
            <option value="medium">{t("riskMedium")}</option>
            <option value="high">{t("riskHigh")}</option>
          </select>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-xs text-[var(--apex-fg-muted)]">
          <input
            type="checkbox"
            className="accent-[var(--apex-accent)]"
            checked={filters.favoriteLeaguesOnly}
            onChange={(event) =>
              patch({ favoriteLeaguesOnly: event.target.checked })
            }
          />
          {t("favoriteLeagues")}
        </label>
        <label className="flex items-center gap-2 text-xs text-[var(--apex-fg-muted)]">
          <input
            type="checkbox"
            className="accent-[var(--apex-accent)]"
            checked={filters.favoriteTeamsOnly}
            onChange={(event) =>
              patch({ favoriteTeamsOnly: event.target.checked })
            }
          />
          {t("favoriteTeams")}
        </label>
      </div>
    </div>
  );
}
