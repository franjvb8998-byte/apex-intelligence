import { RegisterForm } from "@/components/auth/register-form";
import { PageShell } from "@/components/layout/page-shell";
import { localeMetadata } from "@/lib/i18n/page-meta";

export async function generateMetadata() {
  return localeMetadata("auth.register");
}

export default function RegisterPage() {
  return (
    <PageShell centered>
      <RegisterForm />
    </PageShell>
  );
}
