import { Badge } from "@/components/design-system";
import { getTranslations } from "next-intl/server";
import { VERDICT_BADGE_TONE } from "@/components/apex-opportunities/format";
import { LabBarList } from "@/components/lab/lab-charts";
import { LabPanel } from "@/components/lab/lab-panel";
import { liveComponentBars } from "@/lib/lab/features";
import type { LabDecisionView } from "@/lib/lab/types";

export async function DecisionBreakdownCard({
  decision,
}: {
  decision: LabDecisionView | null;
}) {
  const t = await getTranslations("lab");
  if (!decision) {
    return (
      <LabPanel
        id="decision"
        eyebrow={t("engineEyebrow")}
        title={t("decision")}
        status="empty"
        emptyTitle={t("noFeaturedDecision")}
        emptyDescription={t("noFeaturedDecisionDescription")}
        footerHref="/match-analysis"
        footerLabel={t("openMatchAnalysis")}
      />
    );
  }

  return (
    <LabPanel
      id="decision"
      eyebrow={t("engineEyebrow")}
      title={t("decision")}
      badge={
        <Badge tone={VERDICT_BADGE_TONE[decision.verdictKind]}>
          {decision.verdictLabel}
        </Badge>
      }
      kpis={decision.kpis}
      footerHref={decision.href}
      footerLabel={t("openNamed", { name: decision.matchLabel })}
    >
      <p className="mb-3 text-[12px] leading-relaxed text-[var(--apex-fg-muted)]">
        {decision.selectionLabel}. {decision.explanation}
      </p>
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--apex-fg-subtle)]">
            Score components
          </p>
          <LabBarList bars={liveComponentBars(decision.components)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--apex-accent)]">
              For
            </p>
            {decision.reasonsFor.length === 0 ? (
              <p className="text-sm text-[var(--apex-fg-muted)]">None published.</p>
            ) : (
              <ul className="space-y-2">
                {decision.reasonsFor.map((reason) => (
                  <li key={reason.id} className="text-[12px] leading-snug">
                    <span className="text-[var(--apex-fg)]">{reason.title}</span>
                    <span className="mt-0.5 block text-[11px] text-[var(--apex-fg-muted)]">
                      {reason.detail}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--apex-danger)]">
              Against
            </p>
            {decision.reasonsAgainst.length === 0 ? (
              <p className="text-sm text-[var(--apex-fg-muted)]">None published.</p>
            ) : (
              <ul className="space-y-2">
                {decision.reasonsAgainst.map((reason) => (
                  <li key={reason.id} className="text-[12px] leading-snug">
                    <span className="text-[var(--apex-fg)]">{reason.title}</span>
                    <span className="mt-0.5 block text-[11px] text-[var(--apex-fg-muted)]">
                      {reason.detail}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </LabPanel>
  );
}
