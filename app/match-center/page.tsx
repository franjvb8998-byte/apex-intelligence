import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ApiQuotaCard } from "@/components/app-shell/api-quota-card";
import { ProductShell } from "@/components/app-shell/product-shell";
import { MatchCenterList } from "@/components/match-center/match-center-screen";
import { getShellUser } from "@/lib/auth/get-shell-user";
import { loadUnlessQuota } from "@/lib/data-platform/providers/api-football/quota";
import { listMatchCenterFixtures } from "@/lib/match-center";
import {
  firstSearchParam,
  matchCenterHref,
} from "@/lib/match-center/fixture-id";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "APEX Match Center™ — APEX Intelligence",
  description:
    "Lista de fixtures. Abre un partido para ver Preview, Live y Post Match.",
};

type MatchCenterPageProps = {
  searchParams: Promise<{
    fixture?: string | string[];
    matchId?: string | string[];
  }>;
};

export default async function MatchCenterPage({
  searchParams,
}: MatchCenterPageProps) {
  const params = await searchParams;
  const fromQuery =
    firstSearchParam(params.fixture) ?? firstSearchParam(params.matchId);
  if (fromQuery) {
    redirect(matchCenterHref(fromQuery));
  }

  const user = await getShellUser();
  const loaded = await loadUnlessQuota(() =>
    listMatchCenterFixtures({ requireProvider: true }),
  );

  return (
    <ProductShell user={user}>
      {loaded.ok ? (
        <MatchCenterList matches={loaded.data} />
      ) : (
        <ApiQuotaCard />
      )}
    </ProductShell>
  );
}
