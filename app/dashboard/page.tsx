import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProductShell } from "@/components/app-shell/product-shell";
import { DashboardOverview } from "@/components/dashboard";
import { MatchCenterView } from "@/components/match-center";
import { getShellUser } from "@/lib/auth/get-shell-user";
import { getDashboardData, resolveDashboardProvider } from "@/lib/dashboard";
import { getMatchCenterData } from "@/lib/match-center";

export const metadata: Metadata = {
  title: "Dashboard — APEX Intelligence",
  description:
    "Partidos del día, próximos encuentros, ligas, equipos y estado del sistema.",
};

/**
 * Authenticated home — Dashboard wired to Data Platform + Match Center.
 */
export default async function DashboardPage() {
  const shellUser = await getShellUser();
  if (!shellUser) {
    redirect("/login");
  }

  const resolved = resolveDashboardProvider();
  const dashboard = await getDashboardData({ provider: resolved.provider });
  const matchCenter = await getMatchCenterData({
    externalMatchId: dashboard.featuredMatchId,
    provider: resolved.provider,
    requireProvider: false,
  });

  return (
    <ProductShell user={shellUser}>
      <div className="w-full space-y-10">
        <div>
          <p className="text-sm text-[var(--apex-accent)]">Resumen</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--apex-fg)] sm:text-3xl">
            Hola, {shellUser.displayName}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--apex-fg-muted)]">
            Datos vía Data Platform
            {dashboard.system.hasApiKey
              ? " (API-Football)."
              : " (mock automático sin API key)."}{" "}
            <Link
              href="/match-center"
              className="text-[var(--apex-accent)] hover:text-[var(--apex-accent-hover)]"
            >
              Abrir Match Center
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
              Partido destacado
            </p>
            <p className="mt-1 text-sm text-[var(--apex-fg-muted)]">
              Match Center™ — misma experiencia Preview / Live / Post.
            </p>
          </div>
          <MatchCenterView data={matchCenter} />
        </section>
      </div>
    </ProductShell>
  );
}
