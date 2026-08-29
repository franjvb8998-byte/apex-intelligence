import { Badge } from "@/components/design-system";
import { FeedCard, type FeedCardStatus } from "@/components/feed/feed-card";
import { FeedRowLink } from "@/components/feed/feed-row";
import type { FeedCardModel } from "@/lib/feed/types";
import type { ReactNode } from "react";

type NamedCardProps = {
  model?: FeedCardModel;
  status?: FeedCardStatus;
  errorTitle?: string;
  errorDescription?: string;
  icon: ReactNode;
  title: string;
  eyebrow: string;
  badge?: ReactNode;
  className?: string;
};

export function NamedFeedCard({
  model,
  status = "ready",
  errorTitle,
  errorDescription,
  icon,
  title,
  eyebrow,
  badge,
  className,
}: NamedCardProps) {
  return (
    <FeedCard
      title={title}
      eyebrow={eyebrow}
      icon={icon}
      badge={badge}
      model={model}
      status={status}
      errorTitle={errorTitle}
      errorDescription={errorDescription}
      className={className}
    >
      {model?.rows.map((row) => (
        <FeedRowLink key={row.id} row={row} />
      ))}
    </FeedCard>
  );
}

export function LiveBadge({ label = "LIVE" }: { label?: string }) {
  return (
    <Badge tone="accent" className="font-mono tracking-[0.14em]">
      <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--apex-accent)]" />
      {label}
    </Badge>
  );
}
