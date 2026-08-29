import { ProductShell } from "@/components/app-shell/product-shell";
import { LabView } from "@/components/lab";
import { getShellUser } from "@/lib/auth/get-shell-user";
import { localeMetadata } from "@/lib/i18n/page-meta";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return localeMetadata("lab");
}

export default async function LabPage() {
  const user = await getShellUser();

  return (
    <ProductShell user={user} flush>
      <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6">
        <LabView />
      </div>
    </ProductShell>
  );
}
