"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthCard } from "@/components/ui/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPasswordResetEmailRedirectTo } from "@/lib/auth/password-recovery";
import { getAuthErrorMessage } from "@/lib/supabase/auth-errors";
import { createClient } from "@/lib/supabase/client";
import { isValidEmail } from "@/lib/validation";

type ForgotPasswordErrors = {
  email?: string;
  form?: string;
};

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<ForgotPasswordErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  function validate(): ForgotPasswordErrors {
    const nextErrors: ForgotPasswordErrors = {};

    if (!email.trim()) {
      nextErrors.email = "El email es obligatorio.";
    } else if (!isValidEmail(email)) {
      nextErrors.email = "Introduce un email válido.";
    }

    return nextErrors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailSent(false);

    const validationErrors = validate();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    setIsSubmitting(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: getPasswordResetEmailRedirectTo(window.location.origin),
    });

    setIsSubmitting(false);

    if (error) {
      setErrors({ form: getAuthErrorMessage(error.message) });
      return;
    }

    setErrors({});
    setEmailSent(true);
  }

  return (
    <AuthCard
      title="Recuperar contraseña"
      subtitle="Te enviaremos un enlace para crear una nueva contraseña"
      footer={
        <>
          ¿La recuerdas?{" "}
          <Link
            href="/login"
            className="font-medium text-[#00D4AA] transition-colors hover:text-[#00eabb]"
          >
            Iniciar sesión
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="tu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />

        {errors.form && (
          <p
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
            role="alert"
          >
            {errors.form}
          </p>
        )}

        {emailSent && (
          <p
            className="rounded-lg border border-[#00D4AA]/30 bg-[#00D4AA]/10 px-4 py-3 text-sm text-[#00D4AA]"
            role="status"
          >
            Revisa tu email para restablecer la contraseña.
          </p>
        )}

        <Button type="submit" fullWidth disabled={isSubmitting}>
          {isSubmitting ? "Enviando enlace..." : "Enviar enlace"}
        </Button>
      </form>
    </AuthCard>
  );
}
