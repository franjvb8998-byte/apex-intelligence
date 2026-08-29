"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FormEvent, useEffect, useState } from "react";
import { AuthCard } from "@/components/ui/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RESET_PASSWORD_PATH } from "@/lib/auth/password-recovery";
import { getAuthErrorKey } from "@/lib/supabase/auth-errors";
import { createClient } from "@/lib/supabase/client";
import { validatePassword } from "@/lib/validation";

type ResetPasswordErrors = {
  password?: string;
  confirmPassword?: string;
  form?: string;
};

type SessionStatus = "loading" | "ready" | "invalid";

export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<ResetPasswordErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("loading");

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function establishSession() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!cancelled && !error) {
          window.history.replaceState({}, "", RESET_PASSWORD_PATH);
          setSessionStatus("ready");
          return true;
        }
      }

      const { data } = await supabase.auth.getSession();
      if (!cancelled && data.session) {
        setSessionStatus("ready");
        return true;
      }

      return false;
    }

    void establishSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (
        event === "PASSWORD_RECOVERY" ||
        event === "SIGNED_IN" ||
        Boolean(session)
      ) {
        setSessionStatus("ready");
      }
    });

    const timeout = window.setTimeout(() => {
      void establishSession().then((hasSession) => {
        if (!cancelled && !hasSession) setSessionStatus("invalid");
      });
    }, 4000);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);

  function validate(): ResetPasswordErrors {
    const nextErrors: ResetPasswordErrors = {};

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

    const validationErrors = validate();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    setIsSubmitting(true);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setIsSubmitting(false);
      setErrors({ form: t(`errors.${getAuthErrorKey(error.message)}`) });
      return;
    }

    await supabase.auth.signOut();
    setIsSubmitting(false);
    setSuccess(true);

    window.setTimeout(() => {
      router.push("/login?password_updated=1");
      router.refresh();
    }, 1600);
  }

  if (sessionStatus === "loading") {
    return (
      <AuthCard
        title={t("reset.loadingTitle")}
        subtitle={t("reset.loadingSubtitle")}
      >
        <p className="text-center text-sm text-slate-400">{t("reset.wait")}</p>
      </AuthCard>
    );
  }

  if (sessionStatus === "invalid") {
    return (
      <AuthCard
        title={t("reset.invalidTitle")}
        subtitle={t("reset.invalidSubtitle")}
        footer={
          <>
            <Link
              href="/forgot-password"
              className="font-medium text-[#00D4AA] transition-colors hover:text-[#00eabb]"
            >
              {t("reset.requestNew")}
            </Link>
            {" · "}
            <Link
              href="/login"
              className="font-medium text-[#00D4AA] transition-colors hover:text-[#00eabb]"
            >
              {t("login.submit")}
            </Link>
          </>
        }
      >
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {t("reset.invalidBody")}
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={t("reset.newTitle")}
      subtitle={t("reset.newSubtitle")}
      footer={
        <>
          {t("reset.footerPrompt")}{" "}
          <Link
            href="/login"
            className="font-medium text-[#00D4AA] transition-colors hover:text-[#00eabb]"
          >
            {t("login.submit")}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <Input
          label={t("reset.passwordLabel")}
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
          <p
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
            role="alert"
          >
            {errors.form}
          </p>
        )}

        {success && (
          <p
            className="rounded-lg border border-[#00D4AA]/30 bg-[#00D4AA]/10 px-4 py-3 text-sm text-[#00D4AA]"
            role="status"
          >
            {t("reset.success")}
          </p>
        )}

        <Button type="submit" fullWidth disabled={isSubmitting || success}>
          {isSubmitting ? t("reset.submitting") : t("reset.submit")}
        </Button>
      </form>
    </AuthCard>
  );
}
