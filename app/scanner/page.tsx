import { ProductShell } from "@/components/app-shell/product-shell";
import { ScannerView } from "@/components/opportunity-scanner";
import { getShellUser } from "@/lib/auth/get-shell-user";
import { localeMetadata } from "@/lib/i18n/page-meta";
import { loadOpportunityScanner } from "@/lib/opportunity-scanner/load";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return localeMetadata("scanner");
}

export default async function ScannerPage() {
  const [user, loaded] = await Promise.all([
    getShellUser(),
    loadOpportunityScanner(),
  ]);

  return (
    <ProductShell user={user} flush>
      <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6">
        <ScannerView
          analyzed={loaded.analyzed}
          generatedAt={loaded.generatedAt}
          leagues={loaded.leagues}
          countries={loaded.countries}
          rankings={loaded.rankings}
          quotaExhausted={loaded.quotaExhausted}
        />
      </div>
    </ProductShell>
  );
}
