import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { PageShell } from "@/components/layout/page-shell";

export const metadata: Metadata = {
  title: "Restablecer contraseña — APEX Intelligence",
  description: "Crea una nueva contraseña para tu cuenta de APEX Intelligence.",
};

export default function ResetPasswordPage() {
  return (
    <PageShell centered>
      <ResetPasswordForm />
    </PageShell>
  );
}
