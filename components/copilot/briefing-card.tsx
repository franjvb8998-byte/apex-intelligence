"use client";

import { Badge, Card } from "@/components/design-system";
import { cx } from "@/components/design-system/utils";
import type { ApexTone } from "@/components/design-system/tokens";
import type {
  CopilotBriefing,
  CopilotCall,
  CopilotEvTone,
  CopilotMarketVerdict,
} from "@/lib/copilot";
import { useTranslations } from "next-intl";

type BriefingCardProps = {
  briefing: CopilotBriefing;
};

const riskTone: Record<CopilotBriefing["riskLevel"], ApexTone> = {
  low: "accent",
  medium: "warning",
  high: "danger",
};

const confidenceTone: Record<CopilotBriefing["confidenceBand"], ApexTone> = {
  high: "accent",
  medium: "warning",
  low: "danger",
};

const evTone: Record<CopilotEvTone, ApexTone> = {
  positive: "accent",
  neutral: "neutral",
  negative: "danger",
};

const verdictTone: Record<CopilotMarketVerdict, ApexTone> = {
  elite: "accent",
  value: "accent",
  fair: "info",
  high_risk: "warning",
  no_bet: "neutral",
  avoid: "danger",
};

const callKey: Record<CopilotCall, "backHome" | "backAway" | "backDraw" | "avoid" | "watchLive"> =
  {
    back_home: "backHome",
    back_away: "backAway",
    back_draw: "backDraw",
    avoid: "avoid",
    watch_live: "watchLive",
  };

const evKey: Record<CopilotEvTone, "evPositive" | "evNeutral" | "evNegative"> = {
  positive: "evPositive",
  neutral: "evNeutral",
  negative: "evNegative",
};

const confidenceBandKey = {
  low: "confidenceLow",
  medium: "confidenceMedium",
  high: "confidenceHigh",
} as const;

const riskBandKey = {
  low: "riskLow",
  medium: "riskMedium",
  high: "riskHigh",
} as const;

const verdictKey: Record<
  CopilotMarketVerdict,
  "verdictElite" | "verdictValue" | "verdictFair" | "verdictHighRisk" | "verdictNoBet" | "verdictAvoid"
> = {
  elite: "verdictElite",
  value: "verdictValue",
  fair: "verdictFair",
  high_risk: "verdictHighRisk",
  no_bet: "verdictNoBet",
  avoid: "verdictAvoid",
};

export function BriefingCard({ briefing }: BriefingCardProps) {
  const t = useTranslations("copilot.intelligence");
  const desk = briefing.intelligence;

  return (
    <Card
      padding="lg"
      aria-label={t("deskAria")}
      className="mt-3 border-[var(--apex-accent-border)] bg-[linear-gradient(180deg,rgba(0,212,170,0.05),transparent_28%),#070b14]"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--apex-border)] pb-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--apex-accent)]">
            {t("eyebrow")}
          </p>
          <h3 className="mt-2 text-lg font-semibold text-[var(--apex-fg)]">
            {briefing.matchLabel}
          </h3>
          <p className="mt-1 text-sm text-[var(--apex-fg-subtle)]">{briefing.league}</p>
        </div>
        <Badge tone={verdictTone[desk.verdict]} size="md">
          {t(verdictKey[desk.verdict])}
        </Badge>
      </header>

      <section className="mt-6" aria-labelledby="copilot-exec">
        <p
          id="copilot-exec"
          className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--apex-fg-subtle)]"
        >
          {t("briefing")}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label={t("recommendation")}
            value={t(callKey[desk.call])}
            tone={desk.call === "avoid" ? "danger" : "accent"}
          />
          <Stat
            label={t("confidence")}
            value={t(confidenceBandKey[desk.confidenceBand])}
            tone={confidenceTone[desk.confidenceBand]}
          />
          <Stat
            label={t("risk")}
            value={t(riskBandKey[desk.riskBand])}
            tone={riskTone[desk.riskBand]}
          />
          <Stat
            label={t("expectedValue")}
            value={t(evKey[desk.evTone])}
            tone={evTone[desk.evTone]}
          />
        </dl>
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-[var(--apex-fg)] sm:text-[15px]">
          {desk.paragraph}
        </p>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="copilot-why">
          <p
            id="copilot-why"
            className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--apex-accent)]"
          >
            {t("why")}
          </p>
          <ul className="mt-4 space-y-3">
            {desk.reasons.map((row) => (
              <li key={row.id} className="flex gap-3">
                <span className="mt-0.5 font-mono text-sm text-[var(--apex-accent)]" aria-hidden>
                  ✓
                </span>
                <div>
                  <p className="text-sm font-medium text-[var(--apex-fg)]">{row.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-[var(--apex-fg-muted)]">
                    {row.detail}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="copilot-concerns">
          <p
            id="copilot-concerns"
            className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--apex-warning)]"
          >
            {t("concerns")}
          </p>
          <ul className="mt-4 space-y-3">
            {desk.concerns.map((row) => (
              <li key={row.id} className="flex gap-3">
                <span className="mt-0.5 font-mono text-sm text-[var(--apex-warning)]" aria-hidden>
                  ⚠
                </span>
                <div>
                  <p className="text-sm font-medium text-[var(--apex-fg)]">{row.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-[var(--apex-fg-muted)]">
                    {row.detail}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {desk.live ? (
        <section
          className="mt-8 rounded-[var(--apex-radius-lg)] border border-[var(--apex-border)] bg-slate-950/40 px-4 py-4"
          aria-labelledby="copilot-live"
        >
          <p
            id="copilot-live"
            className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--apex-info)]"
          >
            {t("liveTitle")}
          </p>
          <ul className="mt-3 space-y-2">
            {desk.live.cues.map((cue) => (
              <li key={cue} className="text-sm text-[var(--apex-fg-muted)]">
                {cue}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8 border-t border-[var(--apex-border)] pt-6" aria-labelledby="copilot-conf">
        <p
          id="copilot-conf"
          className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--apex-fg-subtle)]"
        >
          {t("confidenceWhy")}
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--apex-fg-muted)]">
          {desk.confidenceWhy}
        </p>
      </section>
    </Card>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: ApexTone;
}) {
  const valueClass: Record<ApexTone, string> = {
    neutral: "text-[var(--apex-fg)]",
    accent: "text-[var(--apex-accent)]",
    success: "text-[var(--apex-accent)]",
    warning: "text-[var(--apex-warning)]",
    danger: "text-[var(--apex-danger)]",
    info: "text-[var(--apex-info)]",
  };
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
        {label}
      </dt>
      <dd className={cx("mt-1 text-sm font-semibold", valueClass[tone])}>{value}</dd>
    </div>
  );
}
