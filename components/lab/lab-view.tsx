import { Suspense, type ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { FeedClock } from "@/components/feed/feed-clock";
import { formatScanTime } from "@/components/apex-opportunities/format";
import { cx } from "@/components/design-system/utils";
import { BacktestEngineCard } from "@/components/lab/backtest-card";
import { ModelComparisonCard } from "@/components/lab/comparison-card";
import { DecisionBreakdownCard } from "@/components/lab/decision-breakdown-card";
import { ExplainabilityViewerCard } from "@/components/lab/explainability-card";
import { FeatureImportanceCard } from "@/components/lab/feature-importance-card";
import { LabErrorBoundary } from "@/components/lab/lab-error-boundary";
import { LabPanelSkeleton } from "@/components/lab/lab-panel";
import { LabSectionNav } from "@/components/lab/lab-section-nav";
import { ModelLibraryCard, ModelVersionsCard } from "@/components/lab/library-card";
import { PerformanceReportsCard } from "@/components/lab/reports-card";
import { HistoricalSimulationCard } from "@/components/lab/simulation-card";
import { StrategyBuilderCard } from "@/components/lab/strategy-builder";
import { buildDecisionView } from "@/lib/lab/build";
import { simulateUnitMarks } from "@/lib/lab/backtest";
import { buildComparison } from "@/lib/lab/compare";
import { buildFeatureSeries } from "@/lib/lab/features";
import {
  loadLabBook,
  loadLabFeatured,
  loadLabResearch,
  loadLabScan,
} from "@/lib/lab/load";
import { LAB_MODELS } from "@/lib/lab/registry";

async function HeaderIsland() {
  const t = await getTranslations("lab");
  const scan = await loadLabScan();
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
          {scan.ok
            ? t("scan", { time: formatScanTime(scan.generatedAt) })
            : t("scanOffline")}
        </p>
      </div>
    </header>
  );
}

function LibraryIsland() {
  return (
    <ModelLibraryCard models={LAB_MODELS} />
  );
}

function VersionsIsland() {
  return <ModelVersionsCard models={LAB_MODELS} />;
}

async function ComparisonIsland() {
  const [scan, research, featured] = await Promise.all([
    loadLabScan(),
    loadLabResearch(),
    loadLabFeatured(),
  ]);
  return (
    <ModelComparisonCard
      scanOk={scan.ok}
      rows={buildComparison({
        analyzed: scan.ok ? scan.analyzed : [],
        report: research.report,
        featured,
      })}
    />
  );
}

async function StrategyIsland() {
  const scan = await loadLabScan();
  return (
    <StrategyBuilderCard
      analyzed={scan.ok ? scan.analyzed : []}
      scanOk={scan.ok}
    />
  );
}

async function BacktestIsland() {
  const research = await loadLabResearch();
  return <BacktestEngineCard backtest={simulateUnitMarks(research.cases)} />;
}

async function ReportsIsland() {
  const research = await loadLabResearch();
  return (
    <PerformanceReportsCard
      report={research.report}
      knowledge={research.knowledge}
    />
  );
}

async function SimulationIsland() {
  const [research, book] = await Promise.all([
    loadLabResearch(),
    loadLabBook(),
  ]);
  return (
    <HistoricalSimulationCard
      backtest={simulateUnitMarks(research.cases)}
      book={book.data}
      fixtures={book.fixtures}
    />
  );
}

async function ExplainIsland() {
  const featured = await loadLabFeatured();
  if (featured.quotaExhausted && !featured.explainable) {
    return (
      <ExplainabilityViewerCard
        explainable={null}
        matchLabel={null}
        href="/match-analysis"
      />
    );
  }
  return (
    <ExplainabilityViewerCard
      explainable={featured.explainable}
      matchLabel={featured.label}
      href={featured.href}
    />
  );
}

async function DecisionIsland() {
  const featured = await loadLabFeatured();
  return <DecisionBreakdownCard decision={buildDecisionView(featured)} />;
}

async function FeaturesIsland() {
  const [featured, research] = await Promise.all([
    loadLabFeatured(),
    loadLabResearch(),
  ]);
  return (
    <FeatureImportanceCard
      series={buildFeatureSeries({
        components: featured.decision?.score.components ?? null,
        cases: research.cases,
      })}
    />
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
    <div className={cx("h-full", span)}>
      <LabErrorBoundary title={title}>
        <Suspense fallback={<LabPanelSkeleton title={title} />}>
          {children}
        </Suspense>
      </LabErrorBoundary>
    </div>
  );
}

export async function LabView() {
  const t = await getTranslations("lab");
  return (
    <div className="w-full space-y-5">
      <LabErrorBoundary title={t("headerBoundary")}>
        <Suspense
          fallback={
            <div className="h-24 animate-pulse rounded-[var(--apex-radius-xl)] border border-[var(--apex-border)] bg-[var(--apex-surface)]" />
          }
        >
          <HeaderIsland />
        </Suspense>
      </LabErrorBoundary>

      <LabSectionNav />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <Pane title={t("library")} span="lg:col-span-8">
          <LibraryIsland />
        </Pane>
        <Pane title={t("versions")} span="lg:col-span-4">
          <VersionsIsland />
        </Pane>
        <Pane title={t("comparison")} span="lg:col-span-12">
          <ComparisonIsland />
        </Pane>
        <Pane title={t("strategy")} span="lg:col-span-7">
          <StrategyIsland />
        </Pane>
        <Pane title={t("backtest")} span="lg:col-span-5">
          <BacktestIsland />
        </Pane>
        <Pane title={t("simulation")} span="lg:col-span-6">
          <SimulationIsland />
        </Pane>
        <Pane title={t("reports")} span="lg:col-span-6">
          <ReportsIsland />
        </Pane>
        <Pane title={t("explainability")} span="lg:col-span-6">
          <ExplainIsland />
        </Pane>
        <Pane title={t("decision")} span="lg:col-span-6">
          <DecisionIsland />
        </Pane>
        <Pane title={t("features")} span="lg:col-span-12">
          <FeaturesIsland />
        </Pane>
      </div>
    </div>
  );
}
