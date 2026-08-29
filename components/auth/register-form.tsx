"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FormEvent, useState } from "react";
import { AuthCard } from "@/components/ui/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAuthErrorKey } from "@/lib/supabase/auth-errors";
import { createClient } from "@/lib/supabase/client";
import { isValidEmail, validatePassword } from "@/lib/validation";

type RegisterErrors = {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  form?: string;
};

export function RegisterForm() {
  const t = useTranslations("auth");
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  function validate(): RegisterErrors {
    const nextErrors: RegisterErrors = {};

    if (!name.trim()) {
      nextErrors.name = t("validation.nameRequired");
    } else if (name.trim().length < 2) {
      nextErrors.name = t("validation.nameMinLength");
    }

    if (!email.trim()) {
      nextErrors.email = t("validation.emailRequired");
    } else if (!isValidEmail(email)) {
      nextErrors.email = t("validation.emailInvalid");
    }

    const passwordError = validatePassword(password);
    if (passwordError) nextErrors.password = t(`validation.${passwordError}`);

    if (!confirmPassword) {
      nextErrors.confirmPassword = t("validation.confirmPasswordRequired");
    } else if (password !== confirmPassword) {
      nextErrors.confirmPassword = t("validation.passwordMismatch");
    }

    return nextErrors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConfirmationSent(false);

    const validationErrors = validate();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    setIsSubmitting(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: name.trim(),
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/scanner`,
      },
    });

    setIsSubmitting(false);

    if (error) {
      setErrors({ form: t(`errors.${getAuthErrorKey(error.message)}`) });
      return;
    }

    if (data.session) {
      router.push("/scanner");
      router.refresh();
      return;
    }

    setConfirmationSent(true);
  }

  return (
    <AuthCard
      title={t("register.title")}
      subtitle={t("register.subtitle")}
      footer={
        <>
          {t("register.footerPrompt")}{" "}
          <Link
            href="/login"
            className="font-medium text-[#00D4AA] transition-colors hover:text-[#00eabb]"
          >
            {t("register.footerLink")}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <Input
          label={t("register.name")}
          name="name"
          type="text"
          autoComplete="name"
          placeholder={t("register.namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />

        <Input
          label={t("login.email")}
          name="email"
          type="email"
          autoComplete="email"
          placeholder={t("login.emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />

        <Input
          label={t("login.password")}
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />

        <Input
          label={t("register.confirmPassword")}
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={errors.confirmPassword}
        />

        {errors.form && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400" role="alert">
            {errors.form}
          </p>
        )}

        {confirmationSent && (
          <p className="rounded-lg border border-[#00D4AA]/30 bg-[#00D4AA]/10 px-4 py-3 text-sm text-[#00D4AA]" role="status">
            {t("register.confirmationSent")}
          </p>
        )}

        <Button type="submit" fullWidth disabled={isSubmitting}>
          {isSubmitting ? t("register.submitting") : t("register.submit")}
        </Button>
      </form>
    </AuthCard>
  );
}
