import type { useTranslations } from "next-intl";
import type { MessageKeys, NestedKeyOf } from "next-intl";
import en from "@/messages/en.json";

type FeedMessages = (typeof en)["feed"];
type FeedMessageKey = MessageKeys<FeedMessages, NestedKeyOf<FeedMessages>>;
export type FeedTranslator = ReturnType<typeof useTranslations<"feed">>;

function collectStringLeaves(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") {
    return prefix ? [prefix] : [];
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, nested]) =>
      collectStringLeaves(nested, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [];
}

const FEED_MESSAGE_KEYS = new Set(collectStringLeaves(en.feed));

function isFeedMessageKey(key: string): key is FeedMessageKey {
  return FEED_MESSAGE_KEYS.has(key);
}

function interpolateNumber(value: string | number | undefined): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function interpolateText(value: string | number | undefined): string {
  return value == null ? "" : String(value);
}

function translateFeedKey(
  t: FeedTranslator,
  key: FeedMessageKey,
  values?: Record<string, string | number>,
): string {
  switch (key) {
    case "scan":
      return t(key, { time: interpolateText(values?.time) });
    case "loadingAria":
      return t(key, { title: interpolateText(values?.title) });
    case "fixtureId":
      return t(key, { id: interpolateText(values?.id) });
    case "row.betsTitle":
      return t(key, { count: interpolateNumber(values?.count) });
    case "row.betsSubtitle":
      return t(key, { amount: interpolateText(values?.amount) });
    case "row.portfolioTitle":
      return t(key, { band: interpolateText(values?.band) });
    case "row.currentCashSubtitle":
      return t(key, { amount: interpolateText(values?.amount) });
    case "row.activeExposureSubtitle":
      return t(key, {
        count: interpolateNumber(values?.count),
        pct: interpolateText(values?.pct),
      });
    default:
      return t(key);
  }
}

/** Translate a feed catalog key, or return the raw string when it is not a message. */
export function translateFeedOrRaw(
  t: FeedTranslator,
  key: string,
  values?: Record<string, string | number>,
): string {
  if (!isFeedMessageKey(key)) return key;
  return translateFeedKey(t, key, values);
}
