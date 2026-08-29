import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { PageShell } from "@/components/layout/page-shell";
import { localeMetadata } from "@/lib/i18n/page-meta";

export async function generateMetadata() {
  return localeMetadata("auth.forgot");
}

export default function ForgotPasswordPage() {
  return (
    <PageShell centered>
      <ForgotPasswordForm />
    </PageShell>
  );
}
