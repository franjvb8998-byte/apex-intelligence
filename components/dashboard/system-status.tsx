import { getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/design-system/badge";
import { Card, CardHeader } from "@/components/design-system/card";
import type { DashboardSystemStatus } from "@/lib/dashboard/types";

function providerTone(
  system: DashboardSystemStatus,
): "accent" | "warning" | "info" {
  if (system.dataMode === "live") return "accent";
  if (system.provider === "mock") return "warning";
  return "info";
}

type DashboardSystemStatusProps = {
  system: DashboardSystemStatus;
};

export async function DashboardSystemStatusCard({
  system,
}: DashboardSystemStatusProps) {
  const t = await getTranslations("dashboard");
  const locale = await getLocale();
  const providerLabel =
    system.dataMode === "live"
      ? t("modeLive")
      : system.provider === "mock"
        ? t("modeCatalog")
        : t("modeRecorded");
  const checkedAt = new Date(system.checkedAt).toLocaleString(locale, {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "UTC",
  });

  return (
    <Card padding="md">
      <CardHeader
        title={t("systemTitle")}
        description={system.message}
        action={
          <Badge tone={providerTone(system)}>{providerLabel}</Badge>
        }
      />
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatusStat label={t("provider")} value={system.displayName} />
        <StatusStat label={t("today")} value={String(system.todayCount)} />
        <StatusStat label={t("upcoming")} value={String(system.upcomingCount)} />
        <StatusStat
          label={t("apiKey")}
          value={system.hasApiKey ? t("apiKeyConfigured") : t("apiKeyMissing")}
        />
      </dl>
      <p className="mt-4 text-xs text-[var(--apex-fg-subtle)]">
        {t("systemFooter", {
          leagues: system.leagueCount,
          teams: system.teamCount,
          datetime: checkedAt,
        })}
      </p>
    </Card>
  );
}

function StatusStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-[var(--apex-fg)]">{value}</dd>
    </div>
  );
}
