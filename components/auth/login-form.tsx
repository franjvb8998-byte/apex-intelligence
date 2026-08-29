"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { FormEvent, useState } from "react";
import { AuthCard } from "@/components/ui/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAuthErrorKey } from "@/lib/supabase/auth-errors";
import { createClient } from "@/lib/supabase/client";
import { isValidEmail, validatePassword } from "@/lib/validation";

type LoginErrors = {
  email?: string;
  password?: string;
  form?: string;
};

export function LoginForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/scanner";
  const passwordUpdated = searchParams.get("password_updated") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<LoginErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): LoginErrors {
    const nextErrors: LoginErrors = {};

    if (!email.trim()) {
      nextErrors.email = t("validation.emailRequired");
    } else if (!isValidEmail(email)) {
      nextErrors.email = t("validation.emailInvalid");
    }

    const passwordError = validatePassword(password);
    if (passwordError) nextErrors.password = t(`validation.${passwordError}`);

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
      setErrors({ form: t(`errors.${getAuthErrorKey(error.message)}`) });
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <AuthCard
      title={t("login.title")}
      subtitle={t("login.subtitle")}
      footer={
        <>
          {t("login.footerPrompt")}{" "}
          <Link
            href="/register"
            className="font-medium text-[#00D4AA] transition-colors hover:text-[#00eabb]"
          >
            {t("login.footerLink")}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
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
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-[#00D4AA] transition-colors hover:text-[#00eabb]"
          >
            {t("login.forgot")}
          </Link>
        </div>

        {passwordUpdated && (
          <p
            className="rounded-lg border border-[#00D4AA]/30 bg-[#00D4AA]/10 px-4 py-3 text-sm text-[#00D4AA]"
            role="status"
          >
            {t("login.passwordUpdated")}
          </p>
        )}

        {errors.form && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400" role="alert">
            {errors.form}
          </p>
        )}

        <Button type="submit" fullWidth disabled={isSubmitting}>
          {isSubmitting ? t("login.submitting") : t("login.submit")}
        </Button>
      </form>
    </AuthCard>
  );
}
