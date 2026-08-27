import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProductShell } from "@/components/app-shell/product-shell";
import { MatchCenterList } from "@/components/match-center/match-center-screen";
import { getShellUser } from "@/lib/auth/get-shell-user";
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

  const [matches, user] = await Promise.all([
    listMatchCenterFixtures({ requireProvider: true }),
    getShellUser(),
  ]);

  return (
    <ProductShell user={user}>
      <MatchCenterList matches={matches} />
    </ProductShell>
  );
}
