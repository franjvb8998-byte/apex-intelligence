import { AnalysisCard } from "@/components/copilot/analysis-card";
import { BriefingCard } from "@/components/copilot/briefing-card";
import { ExplainableCard } from "@/components/copilot/explainable-card";
import { PredictionCard } from "@/components/copilot/prediction-card";
import { cx } from "@/components/design-system/utils";
import type { CopilotMessage } from "@/lib/copilot";

type MessageProps = {
  message: CopilotMessage;
};

export function Message({ message }: MessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cx(
        "flex w-full",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cx(
          message.card?.kind === "briefing"
            ? "w-full max-w-4xl"
            : "max-w-[min(100%,42rem)] rounded-[var(--apex-radius-xl)] border px-4 py-3 text-sm leading-relaxed",
          message.card?.kind === "briefing"
            ? ""
            : isUser
              ? "border-[var(--apex-accent-border)] bg-[var(--apex-accent-muted)] text-[var(--apex-fg)]"
              : "border-[var(--apex-border)] bg-[var(--apex-surface)] text-[var(--apex-fg)]",
        )}
      >
        {message.card?.kind === "briefing" ? (
          <>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-accent)]">
              APEX Copilot
            </p>
            <BriefingCard briefing={message.card.briefing} />
          </>
        ) : (
          <>
            {!isUser && (
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-accent)]">
                APEX Copilot
              </p>
            )}
            <p className="whitespace-pre-wrap">{message.content}</p>
          </>
        )}
        {message.card?.kind === "analysis" && (
          <AnalysisCard data={message.card} />
        )}
        {message.card?.kind === "prediction" && (
          <PredictionCard data={message.card} />
        )}
        {message.card?.kind === "explainable" && (
          <ExplainableCard data={message.card} />
        )}
      </div>
    </div>
  );
}
