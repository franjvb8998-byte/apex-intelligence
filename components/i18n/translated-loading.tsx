"use client";

import { useTranslations } from "next-intl";
import { LoadingState } from "@/components/app-shell/states";

type LoadingMessageKey = Parameters<
  ReturnType<typeof useTranslations<"loading">>
>[0];

export function TranslatedLoading({
  messageKey,
  rows = 3,
}: {
  messageKey: LoadingMessageKey;
  rows?: number;
}) {
  const t = useTranslations("loading");
  return <LoadingState label={t(messageKey)} rows={rows} />;
}
