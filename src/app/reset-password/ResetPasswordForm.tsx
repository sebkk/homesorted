"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { createClient } from "@/lib/supabase/client";
import { Banner, FormField, primaryButtonClass } from "@/components/ui/FormField";
import { Logo } from "@/components/ui/Logo";

const MIN_PASSWORD = 8;

interface Values {
  password: string;
  confirm: string;
}

export function ResetPasswordForm({ email }: { email: string }) {
  const t = useTranslations("resetPassword");
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ defaultValues: { password: "", confirm: "" }, mode: "onTouched" });

  async function onSubmit(values: Values) {
    setFormError(null);
    const { error } = await createClient().auth.updateUser({ password: values.password });
    if (error) {
      const m = error.message.toLowerCase();
      setFormError(m.includes("different") ? t("errors.same") : m.includes("session") ? t("errors.expired") : m.includes("password") ? t("errors.weak") : t("errors.generic"));
      return;
    }
    setDone(true);
  }

  return (
    <div className="flex-1 flex flex-col justify-center gap-4 px-7 py-8 overflow-y-auto">
      <div className="flex flex-col items-center gap-2.5 mb-2 text-center">
        <Logo size={44} />
        <div className="text-xl font-bold tracking-tight">{t("title")}</div>
        <div className="text-[13px] text-ink-muted leading-relaxed max-w-[280px] break-words">
          {t.rich("intro", { email, b: (chunks) => <b className="font-semibold text-ink">{chunks}</b> })}
        </div>
      </div>

      {done ? (
        <div className="flex flex-col gap-3">
          <Banner tone="good">{t("done")}</Banner>
          <Link href="/launcher" className={`${primaryButtonClass} text-center`}>
            {t("goToApp")}
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
          <FormField
            id="resetPassword"
            label={t("password")}
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            hint={t("hint", { min: MIN_PASSWORD })}
            error={errors.password}
            registration={register("password", {
              required: t("validation.required"),
              minLength: { value: MIN_PASSWORD, message: t("validation.tooShort", { min: MIN_PASSWORD }) },
            })}
          />
          <FormField
            id="resetPasswordConfirm"
            label={t("confirm")}
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            error={errors.confirm}
            registration={register("confirm", {
              required: t("validation.confirmRequired"),
              validate: (v) => v === getValues("password") || t("validation.mismatch"),
            })}
          />
          {formError && <Banner tone="critical">{formError}</Banner>}
          <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
            {isSubmitting ? t("saving") : t("submit")}
          </button>
        </form>
      )}
    </div>
  );
}
