import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { PageShell } from "@/components/layout/page-shell";

export const metadata: Metadata = {
  title: "Iniciar sesión — APEX Intelligence",
  description: "Accede a tu cuenta de APEX Intelligence.",
};

export default function LoginPage() {
  return (
    <PageShell centered>
      <LoginForm />
    </PageShell>
  );
}
