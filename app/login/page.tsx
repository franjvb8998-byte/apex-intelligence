import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { TranslatedLoading } from "@/components/i18n/translated-loading";
import { PageShell } from "@/components/layout/page-shell";
import { localeMetadata } from "@/lib/i18n/page-meta";

export async function generateMetadata() {
  return localeMetadata("auth.login");
}

export default function LoginPage() {
  return (
    <PageShell centered>
      <Suspense fallback={<TranslatedLoading messageKey="default" rows={2} />}>
        <LoginForm />
      </Suspense>
    </PageShell>
  );
}
