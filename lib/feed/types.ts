import type { ApexTone } from "@/components/design-system/tokens";

export type FeedKpi = {
  label: string;
  value: string;
  tone?: ApexTone;
};

export type FeedBadge = {
  label: string;
  tone: ApexTone;
};

export type FeedRow = {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  badge?: FeedBadge;
  kpis: FeedKpi[];
  confidence?: number | null;
  i18n?: Record<string, string | number>;
};

export type FeedCardModel = {
  kpis: FeedKpi[];
  rows: FeedRow[];
  emptyTitle: string;
  emptyDescription: string;
  footerHref: string;
  footerLabel: string;
};

export const FEED_ROW_LIMIT = 5;
