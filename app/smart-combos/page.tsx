import { ProductShell } from "@/components/app-shell/product-shell";
import { SmartCombosView } from "@/components/smart-combos";
import { getShellUser } from "@/lib/auth/get-shell-user";
import { localeMetadata } from "@/lib/i18n/page-meta";
import { loadSmartCombosDesk } from "@/lib/smart-combos/load";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return localeMetadata("smartCombos");
}

export default async function SmartCombosPage() {
  const [user, loaded] = await Promise.all([
    getShellUser(),
    loadSmartCombosDesk(),
  ]);

  return (
    <ProductShell user={user} flush>
      <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8">
        <SmartCombosView
          analyzed={loaded.analyzed}
          leagues={loaded.leagues}
          generatedAt={loaded.generatedAt}
          daily={loaded.daily}
          quotaExhausted={loaded.quotaExhausted}
        />
      </div>
    </ProductShell>
  );
}
