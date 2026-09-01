import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ApiQuotaCard } from "@/components/app-shell/api-quota-card";
import { ProductShell } from "@/components/app-shell/product-shell";
import { MatchProductLinks } from "@/components/app-shell/match-product-links";
import { MatchAnalysisView } from "@/components/match-analysis";
import { getShellUser } from "@/lib/auth/get-shell-user";
import { loadUnlessQuota } from "@/lib/repositories";
import { localeMetadata } from "@/lib/i18n/page-meta";
import { getMatchAnalysisData } from "@/lib/match-analysis/load";
import { vendorFixtureId } from "@/lib/match-center/fixture-id";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export async function generateMetadata() {
  return localeMetadata("matchAnalysis");
}

type MatchAnalysisFixturePageProps = {
  params: Promise<{ fixtureId: string }>;
};

export default async function MatchAnalysisFixturePage({
  params,
}: MatchAnalysisFixturePageProps) {
  const { fixtureId: rawFixtureId } = await params;
  const fixtureId = vendorFixtureId(decodeURIComponent(rawFixtureId));
  const [user, t, loaded] = await Promise.all([
    getShellUser(),
    getTranslations("common"),
    loadUnlessQuota(() =>
      getMatchAnalysisData({
        externalMatchId: fixtureId ?? rawFixtureId,
        requireProvider: true,
      }),
    ),
  ]);

  return (
    <ProductShell user={user}>
      <div className="w-full space-y-6">
        <Link
          href="/match-analysis"
          className="apex-focusable inline-flex items-center text-sm text-[var(--apex-accent)] hover:text-[var(--apex-accent-hover)]"
        >
          {t("backToMatches")}
        </Link>
        {loaded.ok ? (
          <>
            <MatchProductLinks
              matchId={fixtureId ?? rawFixtureId}
              homeName={loaded.data.homeTeam.name}
              awayName={loaded.data.awayTeam.name}
              current="analysis"
            />
            <MatchAnalysisView data={loaded.data} />
          </>
        ) : (
          <ApiQuotaCard />
        )}
      </div>
    </ProductShell>
  );
}
