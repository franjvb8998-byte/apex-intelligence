import { ProductShell } from "@/components/app-shell/product-shell";
import { BankrollView } from "@/components/bankroll";
import { getShellUser } from "@/lib/auth/get-shell-user";
import { getMockBankroll } from "@/lib/bankroll";
import { loadBankrollFixtures } from "@/lib/bankroll/load-fixtures";
import { localeMetadata } from "@/lib/i18n/page-meta";
import { firstSearchParam } from "@/lib/match-center/fixture-id";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return localeMetadata("bankroll");
}

type BankrollPageProps = {
  searchParams: Promise<{ fixture?: string | string[] }>;
};

export default async function BankrollPage({ searchParams }: BankrollPageProps) {
  const [user, fixtures, params] = await Promise.all([
    getShellUser(),
    loadBankrollFixtures(),
    searchParams,
  ]);
  const data = getMockBankroll();
  const initialFixtureId = firstSearchParam(params.fixture);

  return (
    <ProductShell user={user}>
      <BankrollView
        initial={data}
        fixtures={fixtures}
        initialFixtureId={initialFixtureId}
      />
    </ProductShell>
  );
}
