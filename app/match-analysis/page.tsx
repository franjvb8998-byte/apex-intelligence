import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { ApiQuotaCard } from "@/components/app-shell/api-quota-card";
import { ProductShell } from "@/components/app-shell/product-shell";
import { DashboardMatchList } from "@/components/dashboard";
import { getShellUser } from "@/lib/auth/get-shell-user";
import { loadUnlessQuota } from "@/lib/repositories";
import { localeMetadata } from "@/lib/i18n/page-meta";
import { listMatchAnalysisFixtures } from "@/lib/match-analysis/load";
import {
  firstSearchParam,
  matchAnalysisHref,
} from "@/lib/match-center/fixture-id";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return localeMetadata("matchAnalysis");
}

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

  const [user, t, loaded] = await Promise.all([
    getShellUser(),
    getTranslations("matchAnalysis"),
    loadUnlessQuota(() =>
      listMatchAnalysisFixtures({ requireProvider: true }),
    ),
  ]);

  return (
    <ProductShell user={user}>
      <div className="w-full space-y-6">
        {loaded.ok ? (
          <DashboardMatchList
            title={t("pickerTitle")}
            description={t("pickerDescription")}
            matches={loaded.data}
            emptyLabel={t("pickerEmpty")}
            hrefForFixture={matchAnalysisHref}
          />
        ) : (
          <ApiQuotaCard />
        )}
      </div>
    </ProductShell>
  );
}
