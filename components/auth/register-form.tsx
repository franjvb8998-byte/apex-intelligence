"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthCard } from "@/components/ui/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isValidEmail, validatePassword } from "@/lib/validation";

type RegisterErrors = {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

export function RegisterForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  function validate(): RegisterErrors {
    const nextErrors: RegisterErrors = {};

    if (!name.trim()) {
      nextErrors.name = "El nombre es obligatorio.";
    } else if (name.trim().length < 2) {
      nextErrors.name = "El nombre debe tener al menos 2 caracteres.";
    }

    if (!email.trim()) {
      nextErrors.email = "El email es obligatorio.";
    } else if (!isValidEmail(email)) {
      nextErrors.email = "Introduce un email válido.";
    }

    const passwordError = validatePassword(password);
    if (passwordError) nextErrors.password = passwordError;

    if (!confirmPassword) {
      nextErrors.confirmPassword = "Confirma tu contraseña.";
    } else if (password !== confirmPassword) {
      nextErrors.confirmPassword = "Las contraseñas no coinciden.";
    }

    return nextErrors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSuccess(false);

    const validationErrors = validate();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    setIsSubmitting(true);

    // Simulación de envío — se conectará a Supabase más adelante
    await new Promise((resolve) => setTimeout(resolve, 800));

    setIsSubmitting(false);
    setIsSuccess(true);
  }

  return (
    <AuthCard
      title="Crear cuenta"
      subtitle="Empieza a analizar tus apuestas con inteligencia"
      footer={
        <>
          ¿Ya tienes cuenta?{" "}
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
          label="Nombre"
          name="name"
          type="text"
          autoComplete="name"
          placeholder="Tu nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />

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
          autoComplete="new-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />

        <Input
          label="Confirmar contraseña"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={errors.confirmPassword}
        />

        {isSuccess && (
          <p className="rounded-lg border border-[#00D4AA]/30 bg-[#00D4AA]/10 px-4 py-3 text-sm text-[#00D4AA]" role="status">
            Cuenta validada. El registro se conectará próximamente.
          </p>
        )}

        <Button type="submit" fullWidth disabled={isSubmitting}>
          {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
        </Button>
      </form>
    </AuthCard>
  );
}
