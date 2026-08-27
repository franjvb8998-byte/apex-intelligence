import type { Metadata } from "next";
import { ApiQuotaCard } from "@/components/app-shell/api-quota-card";
import { ProductShell } from "@/components/app-shell/product-shell";
import { MatchCenterDetail } from "@/components/match-center/match-center-screen";
import { getShellUser } from "@/lib/auth/get-shell-user";
import { loadUnlessQuota } from "@/lib/data-platform/providers/api-football/quota";
import { getMatchCenterData } from "@/lib/match-center";
import { vendorFixtureId } from "@/lib/match-center/fixture-id";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export const metadata: Metadata = {
  title: "APEX Match Center™ — APEX Intelligence",
  description:
    "Dashboard de partido: probabilidad, EV, xG, BTTS, forma, H2H y recomendación.",
};

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
