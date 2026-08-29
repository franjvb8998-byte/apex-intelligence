import { ApiQuotaCard } from "@/components/app-shell/api-quota-card";
import { ProductShell } from "@/components/app-shell/product-shell";
import { MatchCenterDetail } from "@/components/match-center/match-center-screen";
import { getShellUser } from "@/lib/auth/get-shell-user";
import { loadUnlessQuota } from "@/lib/repositories";
import { localeMetadata } from "@/lib/i18n/page-meta";
import { getMatchCenterData } from "@/lib/match-center";
import { vendorFixtureId } from "@/lib/match-center/fixture-id";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export async function generateMetadata() {
  return localeMetadata("matchCenter");
}

type MatchCenterFixturePageProps = {
  params: Promise<{ fixtureId: string }>;
};

export default async function MatchCenterFixturePage({
  params,
}: MatchCenterFixturePageProps) {
  const { fixtureId: rawFixtureId } = await params;
  const fixtureId = vendorFixtureId(decodeURIComponent(rawFixtureId));
  const user = await getShellUser();
  const loaded = await loadUnlessQuota(() =>
    getMatchCenterData({
      externalMatchId: fixtureId ?? rawFixtureId,
      requireProvider: true,
      includeFixtureList: false,
    }),
  );

  return (
    <ProductShell user={user}>
      {loaded.ok ? (
        <MatchCenterDetail data={loaded.data} />
      ) : (
        <ApiQuotaCard />
      )}
    </ProductShell>
  );
}
