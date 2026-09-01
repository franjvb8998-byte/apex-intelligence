import { getTranslations } from "next-intl/server";
import {
  Badge,
  Card,
  CardHeader,
  ConfidenceIndicator,
  ExplanationPanel,
  HeatmapPlaceholder,
  MarketChip,
  ProbabilityBars,
  ScoreGauge,
  Timeline,
} from "@/components/design-system";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/app-shell/states";
import { ProductShell } from "@/components/app-shell/product-shell";
import { getShellUser } from "@/lib/auth/get-shell-user";
import { localeMetadata } from "@/lib/i18n/page-meta";

export async function generateMetadata() {
  return localeMetadata("designSystem");
}

export default async function DesignSystemPage() {
  const [user, t, common, loading] = await Promise.all([
    getShellUser(),
    getTranslations("designSystem"),
    getTranslations("common"),
    getTranslations("loading"),
  ]);

  return (
    <ProductShell user={user}>
      <div className="w-full space-y-10">
        <header className="space-y-3">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {t("title")}
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-[var(--apex-fg-muted)] sm:text-base">
            {t("description")}
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-white">{t("badges")}</h2>
          <Card>
            <div className="flex flex-wrap gap-2">
              <Badge>Neutral</Badge>
              <Badge tone="accent">Accent</Badge>
              <Badge tone="success">Success</Badge>
              <Badge tone="warning">Warning</Badge>
              <Badge tone="danger">Danger</Badge>
              <Badge tone="info">Info</Badge>
            </div>
          </Card>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-white">
            {t("productStates")}
          </h2>
          <div className="grid gap-4 lg:grid-cols-3">
            <LoadingState label={loading("default")} rows={2} />
            <EmptyState
              title={t("empty")}
              description={t("emptyDescription")}
            />
            <ErrorState
              title={common("error")}
              description={t("errorDescription")}
            />
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title={t("scoreGauge")} description={t("scoreGaugeDescription")} />
            <ScoreGauge
              value={71}
              label="APEX"
              caption={t("scoreCaption")}
            />
          </Card>
          <Card>
            <CardHeader
              title={t("confidenceIndicator")}
              description={t("confidenceBands")}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <ConfidenceIndicator value={0.62} band="medium" />
              <ConfidenceIndicator value={0.82} band="high" layout="badge" />
            </div>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title={t("probabilityBars")} />
            <ProbabilityBars
              aria-label={t("example1x2")}
              items={[
                { id: "h", label: common("home"), value: 0.48 },
                { id: "d", label: common("draw"), value: 0.27 },
                { id: "a", label: common("away"), value: 0.25 },
              ]}
            />
          </Card>
          <Card>
            <CardHeader title={t("marketChips")} />
            <div className="grid gap-2 sm:grid-cols-3">
              <MarketChip
                label={common("home")}
                value="48%"
                selected
                hint={t("oddsHint", { odds: "2.05" })}
              />
              <MarketChip
                label={common("draw")}
                value="27%"
                hint={t("oddsHint", { odds: "3.40" })}
              />
              <MarketChip
                label={common("away")}
                value="25%"
                hint={t("oddsHint", { odds: "3.60" })}
              />
            </div>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Timeline" />
            <Timeline
              items={[
                {
                  id: "1",
                  timeLabel: "1'",
                  title: t("timelineKickoff"),
                  description: t("timelineKickoffDescription"),
                },
                {
                  id: "2",
                  timeLabel: "23'",
                  title: t("timelineGoal"),
                  description: t("timelineGoalDescription"),
                  tone: "accent",
                },
                {
                  id: "3",
                  timeLabel: "67'",
                  title: t("timelineCard"),
                  description: t("timelineCardDescription"),
                  tone: "warning",
                },
              ]}
            />
          </Card>
          <Card>
            <CardHeader title={t("heatmapTitle")} />
            <HeatmapPlaceholder title={t("heatmapDemo")} />
          </Card>
        </section>

        <section>
          <ExplanationPanel
            title="Explanation panel"
            summary={t("explanationSummary")}
            footnotes={[
              t("footnotePresentational"),
              t("footnoteMotion"),
            ]}
          >
            <p className="text-sm leading-relaxed text-[var(--apex-fg-muted)]">
              {t("explanationBody")}
            </p>
          </ExplanationPanel>
        </section>
      </div>
    </ProductShell>
  );
}
