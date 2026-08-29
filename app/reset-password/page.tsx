import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { PageShell } from "@/components/layout/page-shell";
import { localeMetadata } from "@/lib/i18n/page-meta";

export async function generateMetadata() {
  return localeMetadata("auth.reset");
}

export default function ResetPasswordPage() {
  return (
    <PageShell centered>
      <ResetPasswordForm />
    </PageShell>
  );
}
