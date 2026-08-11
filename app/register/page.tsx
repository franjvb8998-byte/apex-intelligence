import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";
import { PageShell } from "@/components/layout/page-shell";

export const metadata: Metadata = {
  title: "Crear cuenta — APEX Intelligence",
  description: "Regístrate en APEX Intelligence y empieza a analizar tus apuestas.",
};

export default function RegisterPage() {
  return (
    <PageShell centered>
      <RegisterForm />
    </PageShell>
  );
}
