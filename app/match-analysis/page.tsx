import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ApiQuotaCard } from "@/components/app-shell/api-quota-card";
import { ProductShell } from "@/components/app-shell/product-shell";
import { DashboardMatchList } from "@/components/dashboard";
import { getShellUser } from "@/lib/auth/get-shell-user";
import { loadUnlessQuota } from "@/lib/data-platform/providers/api-football/quota";
import { listMatchAnalysisFixtures } from "@/lib/match-analysis/load";
import {
  firstSearchParam,
  matchAnalysisHref,
} from "@/lib/match-center/fixture-id";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Match Analysis — APEX Intelligence",
  description:
    "Análisis del fixture seleccionado: clasificación, forma, H2H, goles y métricas.",
};

type MatchAnalysisPageProps = {
  searchParams: Promise<{
    fixture?: string | string[];
    matchId?: string | string[];
  }>;
};

export default async function MatchAnalysisPage({
  searchParams,
}: MatchAnalysisPageProps) {
  const params = await searchParams;
  const fromQuery =
    firstSearchParam(params.fixture) ?? firstSearchParam(params.matchId);
  if (fromQuery) {
    redirect(matchAnalysisHref(fromQuery));
  }

  const user = await getShellUser();
  const loaded = await loadUnlessQuota(() =>
    listMatchAnalysisFixtures({ requireProvider: true }),
  );

  return (
    <ProductShell user={user}>
      <div className="w-full space-y-6">
        {loaded.ok ? (
          <DashboardMatchList
            title="Match Analysis"
            description="Elige un fixture de API-Football para ver clasificación, forma, H2H y métricas."
            matches={loaded.data}
            emptyLabel="API-Football no devolvió fixtures para hoy ni Premier League 2025."
            hrefForFixture={matchAnalysisHref}
          />
        ) : (
          <ApiQuotaCard />
        )}
      </div>
    </ProductShell>
  );
}
