import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { PageShell } from "@/components/layout/page-shell";

export const metadata: Metadata = {
  title: "Recuperar contraseña — APEX Intelligence",
  description: "Solicita un enlace para restablecer tu contraseña de APEX Intelligence.",
};

export default function ForgotPasswordPage() {
  return (
    <PageShell centered>
      <ForgotPasswordForm />
    </PageShell>
  );
}
