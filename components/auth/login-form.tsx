"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { AuthCard } from "@/components/ui/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAuthErrorMessage } from "@/lib/supabase/auth-errors";
import { createClient } from "@/lib/supabase/client";
import { isValidEmail, validatePassword } from "@/lib/validation";

type LoginErrors = {
  email?: string;
  password?: string;
  form?: string;
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<LoginErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): LoginErrors {
    const nextErrors: LoginErrors = {};

    if (!email.trim()) {
      nextErrors.email = "El email es obligatorio.";
    } else if (!isValidEmail(email)) {
      nextErrors.email = "Introduce un email válido.";
    }

    const passwordError = validatePassword(password);
    if (passwordError) nextErrors.password = passwordError;

    return nextErrors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationErrors = validate();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    setIsSubmitting(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setIsSubmitting(false);

    if (error) {
      setErrors({ form: getAuthErrorMessage(error.message) });
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <AuthCard
      title="Iniciar sesión"
      subtitle="Accede a tu panel de análisis deportivo"
      footer={
        <>
          ¿No tienes cuenta?{" "}
          <Link
            href="/register"
            className="font-medium text-[#00D4AA] transition-colors hover:text-[#00eabb]"
          >
            Crear cuenta
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

        <Input
          label="Contraseña"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />

        {errors.form && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400" role="alert">
            {errors.form}
          </p>
        )}

        <Button type="submit" fullWidth disabled={isSubmitting}>
          {isSubmitting ? "Iniciando sesión..." : "Iniciar sesión"}
        </Button>
      </form>
    </AuthCard>
  );
}
