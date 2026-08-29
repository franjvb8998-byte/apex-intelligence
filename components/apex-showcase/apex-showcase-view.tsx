import { getLocale, getTranslations } from "next-intl/server";
import {
  Badge,
  Card,
  CardHeader,
  ConfidenceIndicator,
  MarketChip,
  ProbabilityBars,
  ScoreGauge,
  Timeline,
  cx,
} from "@/components/design-system";
import { ButtonLink } from "@/components/ui/button";
import {
  ARCHITECTURE_FLOW,
  ROADMAP,
  SHOWCASE_STATS,
  SHOWCASE_VERSION,
  SYSTEM_HEALTH,
  type RoadmapStatus,
  type SystemHealthStatus,
} from "@/lib/apex-showcase/content";

const roadmapMark: Record<RoadmapStatus, string> = {
  done: "✅",
  active: "🟡",
  todo: "⬜",
};

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-6 space-y-2">
      <p className="text-xs font-medium uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-accent)]">
        {eyebrow}
      </p>
      <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
        {title}
      </h2>
      {description && (
        <p className="max-w-2xl text-sm text-[var(--apex-fg-muted)]">
          {description}
        </p>
      )}
    </div>
  );
}

/**
 * Internal development showcase — presentation only.
 */
export async function ApexShowcaseView() {
  const t = await getTranslations("showcase");
  const locale = await getLocale();
  const healthTone: Record<
    SystemHealthStatus,
    { badge: "success" | "warning" | "danger"; label: string; dot: string }
  > = {
    running: {
      badge: "success",
      label: t("running"),
      dot: "bg-[var(--apex-accent)] shadow-[0_0_12px_rgb(0_212_170/0.55)]",
    },
    mock: {
      badge: "warning",
      label: t("mock"),
      dot: "bg-[var(--apex-warning)] shadow-[0_0_12px_rgb(251_191_36/0.45)]",
    },
    pending: {
      badge: "danger",
      label: t("pending"),
      dot: "bg-[var(--apex-danger)] shadow-[0_0_12px_rgb(248_113_113/0.4)]",
    },
  };
  const buildDate = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());

  return (
    <div className="w-full space-y-16 sm:space-y-20">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[var(--apex-radius-2xl)] border border-[var(--apex-border)] bg-[linear-gradient(145deg,rgb(15_23_42/0.92),rgb(11_18_32/0.88)_45%,rgb(0_212_170/0.08))] p-8 sm:p-12">
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[var(--apex-accent)]/15 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-24 left-10 h-48 w-48 rounded-full bg-sky-500/10 blur-3xl"
          aria-hidden
        />
        <div className="relative space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{t("internal")}</Badge>
            <Badge tone="info">{t("devShowcase")}</Badge>
            <Badge>v{SHOWCASE_VERSION}</Badge>
          </div>
          <div className="space-y-3">
            <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-5xl sm:leading-[1.08]">
              {t("title")}
            </h1>
            <p className="text-base text-[var(--apex-fg-muted)] sm:text-lg">
              {t("subtitle")}
            </p>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-[var(--apex-fg-subtle)]">
            {t("intro")}
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <ButtonLink href="/match-center" variant="primary">
              {t("openMatchCenter")}
            </ButtonLink>
            <ButtonLink href="/design-system" variant="secondary">
              Design System
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* System Health */}
      <section>
        <SectionHeading
          eyebrow={t("healthEyebrow")}
          title={t("health")}
          description={t("healthDescription")}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SYSTEM_HEALTH.map((item) => {
            const tone = healthTone[item.status];
            return (
              <Card
                key={item.id}
                interactive
                className="transition-transform duration-[var(--apex-duration-normal)] hover:-translate-y-0.5"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cx(
                        "mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full",
                        tone.dot,
                      )}
                      aria-hidden
                    />
                    <h3 className="text-sm font-semibold text-white">
                      {item.name}
                    </h3>
                  </div>
                  <Badge tone={tone.badge}>
                    {item.status === "running" && "🟢 "}
                    {item.status === "mock" && "🟡 "}
                    {item.status === "pending" && "🔴 "}
                    {tone.label}
                  </Badge>
                </div>
                <p className="text-xs text-[var(--apex-fg-subtle)]">
                  {item.detail}
                </p>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Architecture */}
      <section>
        <SectionHeading
          eyebrow={t("architectureEyebrow")}
          title={t("architecture")}
          description={t("architectureDescription")}
        />
        <Card padding="lg" className="overflow-hidden">
          <div className="mx-auto flex max-w-md flex-col items-center">
            {ARCHITECTURE_FLOW.map((layer, index) => {
              const isLast = index === ARCHITECTURE_FLOW.length - 1;
              return (
                <div key={layer} className="flex w-full flex-col items-center">
                  <div
                    className={cx(
                      "w-full rounded-[var(--apex-radius-xl)] border px-5 py-3.5 text-center text-sm font-medium transition-colors duration-[var(--apex-duration-normal)]",
                      index === 0 || index === ARCHITECTURE_FLOW.length - 1
                        ? "border-[var(--apex-accent-border)] bg-[var(--apex-accent-muted)] text-[var(--apex-accent)]"
                        : "border-[var(--apex-border)] bg-slate-950/50 text-slate-200",
                    )}
                  >
                    {layer}
                  </div>
                  {!isLast && (
                    <div
                      className="flex flex-col items-center py-1"
                      aria-hidden
                    >
                      <span className="h-4 w-px bg-gradient-to-b from-[var(--apex-accent)]/70 to-[var(--apex-border-strong)]" />
                      <span className="text-[10px] leading-none text-[var(--apex-accent)]">
                        ↓
                      </span>
                      <span className="h-4 w-px bg-gradient-to-b from-[var(--apex-border-strong)] to-[var(--apex-accent)]/40" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      {/* Roadmap */}
      <section>
        <SectionHeading
          eyebrow={t("roadmapEyebrow")}
          title={t("roadmap")}
          description={t("roadmapDescription")}
        />
        <Card>
          <ol className="relative space-y-0">
            {ROADMAP.map((item, index) => {
              const isLast = index === ROADMAP.length - 1;
              return (
                <li key={item.id} className="relative flex gap-4 pb-5 last:pb-0">
                  <div className="flex w-10 shrink-0 flex-col items-center">
                    <span className="z-10 text-base leading-none" aria-hidden>
                      {roadmapMark[item.status]}
                    </span>
                    {!isLast && (
                      <span className="mt-2 w-px flex-1 bg-[var(--apex-border)]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 rounded-[var(--apex-radius-xl)] border border-[var(--apex-border)] bg-slate-950/40 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-white">
                        {item.label}
                      </p>
                      <Badge
                        tone={
                          item.status === "done"
                            ? "success"
                            : item.status === "active"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {item.status === "done"
                          ? "Done"
                          : item.status === "active"
                            ? t("inProgress")
                            : t("planned")}
                      </Badge>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      </section>

      {/* Statistics */}
      <section>
        <SectionHeading
          eyebrow={t("metricsEyebrow")}
          title={t("statistics")}
          description={t("statisticsDescription")}
        />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {SHOWCASE_STATS.map((stat) => (
            <Card key={stat.id} padding="sm" className="text-center sm:p-6">
              <p className="font-mono text-3xl font-bold tabular-nums text-[var(--apex-accent)] sm:text-4xl">
                {stat.value}
              </p>
              <p className="mt-2 text-xs uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
                {stat.label}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* Design System Preview */}
      <section>
        <SectionHeading
          eyebrow={t("dsEyebrow")}
          title={t("dsPreview")}
          description={t("dsPreviewDescription")}
        />
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title={t("cardsButtons")} />
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/design-system" variant="primary">
                Primary
              </ButtonLink>
              <ButtonLink href="/design-system" variant="secondary">
                Secondary
              </ButtonLink>
            </div>
          </Card>

          <Card>
            <CardHeader title={t("badgesStatus")} />
            <div className="flex flex-wrap gap-2">
              <Badge tone="success">🟢 Running</Badge>
              <Badge tone="warning">🟡 Mock</Badge>
              <Badge tone="danger">🔴 Pending</Badge>
              <Badge tone="info">Info</Badge>
              <Badge>Neutral</Badge>
            </div>
          </Card>

          <Card>
            <CardHeader title={t("progress")} />
            <ProbabilityBars
              aria-label="Progress showcase"
              items={[
                { id: "a", label: "Platform core", value: 0.86 },
                { id: "b", label: "Data integration", value: 0.54 },
                { id: "c", label: "Explainability", value: 0.22 },
              ]}
            />
          </Card>

          <Card>
            <CardHeader title={t("gaugeConfidence")} />
            <div className="grid gap-4 sm:grid-cols-2 sm:items-center">
              <ScoreGauge value={78} label="APEX" caption={t("buildHealth")} />
              <div className="space-y-3">
                <ConfidenceIndicator value={0.78} band="high" />
                <MarketChip
                  interactive={false}
                  selected
                  label={t("signal")}
                  value="Strong"
                  hint="Design-system chip"
                />
              </div>
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader title={t("timeline")} />
            <Timeline
              items={[
                {
                  id: "t1",
                  timeLabel: "Q1",
                  title: "Foundation",
                  description: "Auth, dashboard, design tokens.",
                  tone: "success",
                },
                {
                  id: "t2",
                  timeLabel: "Q2",
                  title: "Intelligence + Data",
                  description: "PE, Data Platform, BFF, Match Center.",
                  tone: "accent",
                },
                {
                  id: "t3",
                  timeLabel: "Next",
                  title: "Real data & explainability",
                  description: "Live feeds, Mission Control, Copilot.",
                  tone: "warning",
                },
              ]}
            />
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="rounded-[var(--apex-radius-2xl)] border border-[var(--apex-border)] bg-[var(--apex-surface)] px-6 py-8 text-center sm:px-8">
        <p className="text-sm font-semibold tracking-wide text-white">
          <span className="text-[var(--apex-accent)]">APEX</span> Intelligence
        </p>
        <p className="mt-2 text-xs uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
          Version {SHOWCASE_VERSION}
        </p>
        <p className="mt-1 font-mono text-xs tabular-nums text-[var(--apex-fg-muted)]">
          Build Date · {buildDate}
        </p>
      </footer>
    </div>
  );
}
