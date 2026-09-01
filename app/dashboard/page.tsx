import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { ApiQuotaCard } from "@/components/app-shell/api-quota-card";
import { ProductShell } from "@/components/app-shell/product-shell";
import { EmptyState } from "@/components/app-shell/states";
import { DashboardOverview } from "@/components/dashboard";
import { MatchCenterView } from "@/components/match-center";
import { getShellUser } from "@/lib/auth/get-shell-user";
import { loadDashboardWorkspace } from "@/lib/dashboard";
import { localeMetadata } from "@/lib/i18n/page-meta";

export async function generateMetadata() {
  return localeMetadata("dashboard");
}

/**
 * Authenticated home — Dashboard wired to Data Platform + Match Center.
 * Auth is resolved before any football widget; widget failures stay empty.
 */
export default async function DashboardPage() {
  const shellUser = await getShellUser();
  if (!shellUser?.id) {
    redirect("/login");
  }

  const [t, workspace] = await Promise.all([
    getTranslations("dashboard"),
    loadDashboardWorkspace(),
  ]);
  const { dashboard, matchCenter, quotaExhausted } = workspace;
  const featuredHref = dashboard.featuredMatchId
    ? `/match-center?matchId=${encodeURIComponent(dashboard.featuredMatchId)}`
    : "/match-center";
  const showQuotaCard =
    quotaExhausted &&
    dashboard.todayMatches.length === 0 &&
    dashboard.upcomingMatches.length === 0 &&
    !matchCenter;

  return (
    <ProductShell user={shellUser}>
      {showQuotaCard ? (
        <ApiQuotaCard />
      ) : (
        <div className="w-full space-y-10">
          <div>
            <p className="text-sm text-[var(--apex-accent)]">{t("summary")}</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--apex-fg)] sm:text-3xl">
              {t("hello", { name: shellUser.displayName })}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-[var(--apex-fg-muted)]">
              {dashboard.system.hasApiKey ? t("dataLive") : t("dataMock")}{" "}
              <Link
                href="/opportunities"
                className="text-[var(--apex-accent)] hover:text-[var(--apex-accent-hover)]"
              >
                APEX Opportunities
              </Link>
              {" · "}
              <Link
                href="/portfolio"
                className="text-[var(--apex-accent)] hover:text-[var(--apex-accent-hover)]"
              >
                Portfolio
              </Link>
              {" · "}
              <Link
                href={featuredHref}
                className="text-[var(--apex-accent)] hover:text-[var(--apex-accent-hover)]"
              >
                Match Center
              </Link>
              {" · "}
              <Link
                href="/copilot"
                className="text-[var(--apex-accent)] hover:text-[var(--apex-accent-hover)]"
              >
                Copilot
              </Link>
            </p>
          </div>

          <DashboardOverview data={dashboard} />

          <section className="space-y-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
                {t("featured")}
              </p>
              <p className="mt-1 text-sm text-[var(--apex-fg-muted)]">
                {t("featuredSubtitle")}
              </p>
            </div>
            {matchCenter ? (
              <MatchCenterView data={matchCenter} />
            ) : (
              <EmptyState
                title={t("featuredEmptyTitle")}
                description={t("featuredEmptyDescription")}
                action={
                  <Link
                    href="/match-center"
                    className="text-sm text-[var(--apex-accent)] hover:text-[var(--apex-accent-hover)]"
                  >
                    {t("openMatchCenter")}
                  </Link>
                }
              />
            )}
          </section>
        </div>
      )}
    </ProductShell>
  );
}
