import { ProductShell } from "@/components/app-shell/product-shell";
import { MatchLiveView } from "@/components/apex-vision";
import { getShellUser } from "@/lib/auth/get-shell-user";
import { localeMetadata } from "@/lib/i18n/page-meta";

export async function generateMetadata() {
  return localeMetadata("vision");
}

export default async function MatchLivePage() {
  const user = await getShellUser();

  return (
    <ProductShell user={user}>
      <div className="w-full">
        <MatchLiveView />
      </div>
    </ProductShell>
  );
}
