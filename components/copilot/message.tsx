import { AnalysisCard } from "@/components/copilot/analysis-card";
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
          "max-w-[min(100%,42rem)] rounded-[var(--apex-radius-xl)] px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-[var(--apex-accent-muted)] text-[var(--apex-fg)] border border-[var(--apex-accent-border)]"
            : "bg-[var(--apex-surface)] text-[var(--apex-fg)] border border-[var(--apex-border)]",
        )}
      >
        {!isUser && (
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-accent)]">
            APEX Copilot
          </p>
        )}
        <p className="whitespace-pre-wrap">{message.content}</p>
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
