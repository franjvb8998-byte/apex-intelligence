"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ScannerDailyBriefing } from "@/components/opportunity-scanner/daily-briefing";
import { ScannerDailyInsight } from "@/components/opportunity-scanner/daily-insight";
import { ScannerFilterBar } from "@/components/opportunity-scanner/filter-bar";
import { ScannerFilterEmpty } from "@/components/opportunity-scanner/filter-empty";
import { ScannerModeBar } from "@/components/opportunity-scanner/mode-bar";
import { ScannerQuickPresets } from "@/components/opportunity-scanner/quick-presets";
import { ScannerRankings } from "@/components/opportunity-scanner/rankings";
import { ScannerComboTray } from "@/components/opportunity-scanner/combo-tray";
import { ScannerDetail } from "@/components/opportunity-scanner/scanner-detail";
import { ScannerRow } from "@/components/opportunity-scanner/scanner-row";
import { ScannerStandby } from "@/components/opportunity-scanner/scanner-standby";
import { ScannerStatus } from "@/components/opportunity-scanner/scanner-status";
import { useWatchlist } from "@/components/apex-opportunities/use-watchlist";
import { useScannerFavorites } from "@/components/opportunity-scanner/use-favorites";
import type { ApexOpportunity } from "@/lib/apex-opportunities/types";
import {
  buildScannerBriefing,
  buildScannerInsight,
} from "@/lib/opportunity-scanner/briefing";
import {
  DEFAULT_SCANNER_FILTERS,
  filterScanner,
  type ScannerFilters,
} from "@/lib/opportunity-scanner/filters";
import type { ScannerMode } from "@/lib/opportunity-scanner/modes";
import {
  applyScannerPreset,
  matchingScannerPreset,
  type ScannerPresetId,
} from "@/lib/opportunity-scanner/presets";
import type { ScannerRankingBoard } from "@/lib/opportunity-scanner/ranking";
import { scannerDeskStatus } from "@/lib/opportunity-scanner/status";
import { analyzeCombo } from "@/lib/smart-combos/analyze";
import { opportunityToComboLeg } from "@/lib/smart-combos/legs";
import { writeComboSlip } from "@/lib/smart-combos/slip-storage";

type ScannerViewProps = {
  analyzed: ApexOpportunity[];
  generatedAt: string;
  leagues: string[];
  countries: string[];
  rankings: ScannerRankingBoard[];
  quotaExhausted?: boolean;
};

function pickTeamName(row: ApexOpportunity): string {
  return row.predicted === "away" ? row.away.name : row.home.name;
}

export function ScannerView({
  analyzed,
  generatedAt,
  leagues,
  countries,
  rankings,
  quotaExhausted = false,
}: ScannerViewProps) {
  const t = useTranslations("scanner");
  const router = useRouter();
  const watchlist = useWatchlist();
  const favorites = useScannerFavorites();
  const [filters, setFilters] = useState<ScannerFilters>(DEFAULT_SCANNER_FILTERS);
  const [mode, setMode] = useState<ScannerMode>("ranked");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const briefing = useMemo(
    () => buildScannerBriefing(analyzed, generatedAt, quotaExhausted),
    [analyzed, generatedAt, quotaExhausted],
  );
  const insight = useMemo(() => buildScannerInsight(briefing), [briefing]);
  const ranked = useMemo(
    () =>
      filterScanner(
        analyzed,
        filters,
        mode,
        favorites.leagues,
        favorites.teams,
      ),
    [analyzed, filters, mode, favorites.leagues, favorites.teams],
  );
  const status = useMemo(
    () =>
      scannerDeskStatus(
        analyzed,
        ranked,
        filters,
        mode,
        favorites.leagues,
        favorites.teams,
        quotaExhausted,
      ),
    [
      analyzed,
      ranked,
      filters,
      mode,
      favorites.leagues,
      favorites.teams,
      quotaExhausted,
    ],
  );
  const activePreset = matchingScannerPreset(mode, filters);

  const selectedRows = useMemo(
    () => analyzed.filter((row) => selectedIds.includes(row.fixtureId)),
    [analyzed, selectedIds],
  );
  const analysis = useMemo(() => {
    if (selectedRows.length === 0) return null;
    return analyzeCombo(selectedRows.map(opportunityToComboLeg));
  }, [selectedRows]);

  function applyPreset(id: ScannerPresetId) {
    const next = applyScannerPreset(id, filters);
    setMode(next.mode);
    setFilters(next.filters);
  }

  function toggleSelect(fixtureId: string) {
    setSelectedIds((current) =>
      current.includes(fixtureId)
        ? current.filter((id) => id !== fixtureId)
        : [...current, fixtureId],
    );
  }

  function focusFixture(fixtureId: string) {
    setExpandedId(fixtureId);
    window.requestAnimationFrame(() => {
      document
        .getElementById(`scan-${fixtureId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function openCombo() {
    if (selectedIds.length < 2) return;
    writeComboSlip(selectedIds);
    router.push("/smart-combos");
  }

  return (
    <div className="w-full space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--apex-accent)]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--apex-accent)]" />
            {t("eyebrow")}
          </p>
          <p className="mt-2 max-w-2xl text-sm text-[var(--apex-fg-muted)]">
            {t("intro")}
          </p>
        </div>
      </header>

      <ScannerDailyBriefing briefing={briefing} />
      <ScannerDailyInsight insight={insight} />
      <ScannerStatus status={status} />

      <ScannerRankings
        boards={rankings}
        catalogEmpty={analyzed.length === 0}
        onFocus={focusFixture}
      />

      <div className="space-y-4">
        <ScannerModeBar mode={mode} onMode={setMode} />
        <ScannerQuickPresets active={activePreset} onSelect={applyPreset} />
        <ScannerFilterBar
          filters={filters}
          leagues={leagues}
          countries={countries}
          onChange={setFilters}
        />
      </div>

      {analyzed.length === 0 ? (
        <ScannerStandby quota={quotaExhausted} />
      ) : ranked.length === 0 ? (
        <ScannerFilterEmpty
          mode={mode}
          filters={filters}
          mainReason={status.mainReason}
          secondaryReason={status.secondaryReason}
          onTodaysBest={() => applyPreset("todays_best")}
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--apex-radius-xl)] border border-[var(--apex-border)]">
          <div className="min-w-[1080px]">
            <div className="grid grid-cols-[auto_auto_minmax(0,1.6fr)_minmax(0,0.9fr)_repeat(6,minmax(3.2rem,1fr))_auto] gap-2 border-b border-[var(--apex-border)] bg-black/40 px-2 py-2.5 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--apex-fg-subtle)] sm:px-3">
              <span />
              <span>#</span>
              <span>{t("table.match")}</span>
              <span>{t("table.league")}</span>
              <span>{t("table.market")}</span>
              <span>{t("table.odds")}</span>
              <span>{t("table.score")}</span>
              <span>{t("table.conf")}</span>
              <span>{t("table.ev")}</span>
              <span>{t("table.risk")}</span>
              <span className="text-right">{t("table.read")}</span>
            </div>
            {ranked.map((row, index) => {
              const expanded = expandedId === row.fixtureId;
              return (
                <div key={row.fixtureId}>
                  <ScannerRow
                    row={row}
                    rank={index + 1}
                    selected={selectedIds.includes(row.fixtureId)}
                    expanded={expanded}
                    favoriteLeague={favorites.hasLeague(row.leagueName)}
                    favoriteTeam={favorites.hasTeam(pickTeamName(row))}
                    onSelect={() => toggleSelect(row.fixtureId)}
                    onExpand={() =>
                      setExpandedId((current) =>
                        current === row.fixtureId ? null : row.fixtureId,
                      )
                    }
                    onToggleLeague={() => favorites.toggleLeague(row.leagueName)}
                    onToggleTeam={() => favorites.toggleTeam(pickTeamName(row))}
                  />
                  {expanded ? (
                    <ScannerDetail
                      row={row}
                      watched={watchlist.has(row.fixtureId)}
                      onWatch={() => watchlist.toggle(row.fixtureId)}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ScannerComboTray
        count={selectedIds.length}
        analysis={analysis}
        onOpen={openCombo}
        onClear={() => setSelectedIds([])}
      />
    </div>
  );
}
