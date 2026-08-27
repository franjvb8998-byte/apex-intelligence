import type { Metadata } from "next";
import Link from "next/link";
import { ApiQuotaCard } from "@/components/app-shell/api-quota-card";
import { ProductShell } from "@/components/app-shell/product-shell";
import { MatchAnalysisView } from "@/components/match-analysis";
import { getShellUser } from "@/lib/auth/get-shell-user";
import { loadUnlessQuota } from "@/lib/data-platform/providers/api-football/quota";
import { getMatchAnalysisData } from "@/lib/match-analysis/load";
import { vendorFixtureId } from "@/lib/match-center/fixture-id";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export const metadata: Metadata = {
  title: "Match Analysis — APEX Intelligence",
  description:
    "Clasificación, últimos 5, H2H, goles, local/visitante y métricas del fixture.",
};

type MatchAnalysisFixturePageProps = {
  params: Promise<{ fixtureId: string }>;
};

export default async function MatchAnalysisFixturePage({
  params,
}: MatchAnalysisFixturePageProps) {
  const { fixtureId: rawFixtureId } = await params;
  const fixtureId = vendorFixtureId(decodeURIComponent(rawFixtureId));
  const user = await getShellUser();
  const loaded = await loadUnlessQuota(() =>
    getMatchAnalysisData({
      externalMatchId: fixtureId ?? rawFixtureId,
      requireProvider: true,
    }),
  );

  return (
    <ProductShell user={user}>
      <div className="w-full space-y-6">
        <Link
          href="/match-analysis"
          className="apex-focusable inline-flex items-center text-sm text-[var(--apex-accent)] hover:text-[var(--apex-accent-hover)]"
        >
          Volver a partidos
        </Link>
        {loaded.ok ? (
          <MatchAnalysisView data={loaded.data} />
        ) : (
          <ApiQuotaCard />
        )}
      </div>
    </ProductShell>
  );
}
