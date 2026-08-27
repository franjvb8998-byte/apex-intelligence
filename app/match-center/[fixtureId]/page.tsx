import type { Metadata } from "next";
import { ProductShell } from "@/components/app-shell/product-shell";
import { MatchCenterDetail } from "@/components/match-center/match-center-screen";
import { getShellUser } from "@/lib/auth/get-shell-user";
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

  const [data, user] = await Promise.all([
    getMatchCenterData({
      externalMatchId: fixtureId ?? rawFixtureId,
      requireProvider: true,
      includeFixtureList: false,
    }),
    getShellUser(),
  ]);

  return (
    <ProductShell user={user}>
      <MatchCenterDetail data={data} />
    </ProductShell>
  );
}
