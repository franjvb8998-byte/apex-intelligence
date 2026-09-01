import { getApexOpportunities } from "@/lib/apex-opportunities/load";
import { ProductShell } from "@/components/app-shell/product-shell";
import { PortfolioView } from "@/components/portfolio";
import { getShellUser } from "@/lib/auth/get-shell-user";
import { getMockBankroll, loadBankrollFixtures } from "@/lib/bankroll";
import { loadUnlessQuota } from "@/lib/repositories";
import { localeMetadata } from "@/lib/i18n/page-meta";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return localeMetadata("portfolio");
}

export default async function PortfolioPage() {
  const [user, fixtures, scan] = await Promise.all([
    getShellUser(),
    loadBankrollFixtures(),
    loadUnlessQuota(() => getApexOpportunities()),
  ]);
  const data = getMockBankroll();
  const analyzed = scan.ok ? scan.data.analyzed : [];

  return (
    <ProductShell user={user}>
      <PortfolioView data={data} fixtures={fixtures} analyzed={analyzed} />
    </ProductShell>
  );
}
