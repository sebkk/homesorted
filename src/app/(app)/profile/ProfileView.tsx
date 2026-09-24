"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { createClient } from "@/lib/supabase/client";
import { useEncryption } from "@/components/encryption/EncryptionContext";
import { Banner, FormField, primaryButtonClass } from "@/components/ui/FormField";
import { InstallSection } from "@/components/ui/InstallApp";

const MIN_PASSWORD = 8;

type Result = { tone: "good" | "critical"; text: string } | null;

export function ProfileView({ email, name }: { email: string; name: string }) {
  const t = useTranslations("profile");
  const tf = useTranslations("finance");
  const { status } = useEncryption();

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header
        className="sticky top-0 z-20 bg-surface glass flex items-center gap-3 border-b border-border px-5"
        style={{ paddingTop: "calc(14px + env(safe-area-inset-top, 0px))", paddingBottom: "12px" }}
      >
        <Link
          href="/launcher"
          aria-label={tf("backToLauncher")}
          className="w-8 h-8 rounded-md border border-border bg-surface-2 text-ink-muted flex items-center justify-center shrink-0"
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <span className="font-bold text-[16px] tracking-tight">{t("title")}</span>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 flex flex-col gap-6" style={{ paddingTop: "22px", paddingBottom: "28px" }}>
        <Section title={t("account.title")}>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-ink-muted">{t("account.email")}</span>
            <span className="text-[14.5px] font-medium break-all">{email}</span>
          </div>
          <NameForm name={name} />
        </Section>

        <Section title={t("password.title")}>
          <AccountPasswordForm email={email} />
        </Section>

        <Section title={t("app.title")}>
          <InstallSection />
        </Section>

        {(status === "unlocked" || status === "locked") && (
          <Section title={t("encryption.title")} intro={t("encryption.intro")}>
            <EncryptionPasswordForm />
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-[13px] font-semibold text-ink-muted uppercase tracking-wide">{title}</h2>
        {intro && <p className="text-[12px] text-ink-muted leading-relaxed mt-1">{intro}</p>}
      </div>
      <div className="bg-surface-2 border border-border rounded-xl p-4 flex flex-col gap-3">{children}</div>
    </section>
  );
}

function NameForm({ name }: { name: string }) {
  const t = useTranslations("profile");
  const router = useRouter();
  const [result, setResult] = useState<Result>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<{ name: string }>({ defaultValues: { name }, mode: "onTouched" });

  async function onSubmit(values: { name: string }) {
    setResult(null);
    const trimmed = values.name.trim();
    const { error } = await createClient().auth.updateUser({ data: { full_name: trimmed } });
    if (error) {
      setResult({ tone: "critical", text: t("errors.generic") });
      return;
    }
    reset({ name: trimmed });
    setResult({ tone: "good", text: t("account.saved") });
    router.refresh(); // the launcher greets by name
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
      <FormField
        id="profileName"
        label={t("account.name")}
        type="text"
        autoComplete="given-name"
        error={errors.name}
        registration={register("name", {
          validate: (v) => v.trim().length > 0 || t("validation.nameRequired"),
          maxLength: { value: 50, message: t("validation.nameTooLong") },
        })}
      />
      {result && <Banner tone={result.tone}>{result.text}</Banner>}
      <button type="submit" disabled={isSubmitting || !isDirty} className={primaryButtonClass}>
        {isSubmitting ? t("saving") : t("account.save")}
      </button>
    </form>
  );
}

interface PasswordValues {
  current: string;
  next: string;
  confirm: string;
}

function usePasswordForm() {
  const t = useTranslations("profile");
  const form = useForm<PasswordValues>({ defaultValues: { current: "", next: "", confirm: "" }, mode: "onTouched" });
  const rules = {
    current: { required: t("validation.currentRequired") },
    next: {
      required: t("validation.newRequired"),
      minLength: { value: MIN_PASSWORD, message: t("validation.tooShort", { min: MIN_PASSWORD }) },
      validate: (v: string) => v !== form.getValues("current") || t("validation.sameAsCurrent"),
    },
    confirm: {
      required: t("validation.confirmRequired"),
      validate: (v: string) => v === form.getValues("next") || t("validation.mismatch"),
    },
  };
  return { form, rules };
}

function PasswordFields({ idPrefix, form, rules }: { idPrefix: string } & ReturnType<typeof usePasswordForm>) {
  const t = useTranslations("profile");
  const { register, formState } = form;
  return (
    <>
      <FormField
        id={`${idPrefix}Current`}
        label={t("password.current")}
        type="password"
        autoComplete="current-password"
        error={formState.errors.current}
        registration={register("current", rules.current)}
      />
      <FormField
        id={`${idPrefix}New`}
        label={t("password.new")}
        type="password"
        autoComplete="new-password"
        hint={t("password.hint", { min: MIN_PASSWORD })}
        error={formState.errors.next}
        registration={register("next", rules.next)}
      />
      <FormField
        id={`${idPrefix}Confirm`}
        label={t("password.confirm")}
        type="password"
        autoComplete="new-password"
        error={formState.errors.confirm}
        registration={register("confirm", rules.confirm)}
      />
    </>
  );
}

/** Supabase has no "change password with the old one" call, so the current
 * password is checked by signing in with it first, then updated. */
function AccountPasswordForm({ email }: { email: string }) {
  const t = useTranslations("profile");
  const { form, rules } = usePasswordForm();
  const [result, setResult] = useState<Result>(null);

  async function onSubmit(values: PasswordValues) {
    setResult(null);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password: values.current });
    if (authError) {
      const m = authError.message.toLowerCase();
      if (m.includes("rate limit") || m.includes("too many")) setResult({ tone: "critical", text: t("errors.rateLimit") });
      else form.setError("current", { message: t("errors.wrongCurrent") }, { shouldFocus: true });
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: values.next });
    if (error) {
      const m = error.message.toLowerCase();
      setResult({
        tone: "critical",
        text: m.includes("different") ? t("validation.sameAsCurrent") : m.includes("password") ? t("errors.weak") : t("errors.generic"),
      });
      return;
    }
    form.reset();
    setResult({ tone: "good", text: t("password.changed") });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
      <PasswordFields idPrefix="accountPassword" form={form} rules={rules} />
      {result && <Banner tone={result.tone}>{result.text}</Banner>}
      <button type="submit" disabled={form.formState.isSubmitting} className={primaryButtonClass}>
        {form.formState.isSubmitting ? t("saving") : t("password.submit")}
      </button>
    </form>
  );
}

function EncryptionPasswordForm() {
  const t = useTranslations("profile");
  const { changePassword } = useEncryption();
  const { form, rules } = usePasswordForm();
  const [result, setResult] = useState<Result>(null);

  async function onSubmit(values: PasswordValues) {
    setResult(null);
    const outcome = await changePassword(values.current, values.next);
    if (outcome === "wrong") {
      form.setError("current", { message: t("errors.wrongCurrent") }, { shouldFocus: true });
      return;
    }
    if (outcome === "error") {
      setResult({ tone: "critical", text: t("errors.generic") });
      return;
    }
    form.reset();
    setResult({ tone: "good", text: t("encryption.changed") });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
      <PasswordFields idPrefix="encryptionPassword" form={form} rules={rules} />
      {result && <Banner tone={result.tone}>{result.text}</Banner>}
      <button type="submit" disabled={form.formState.isSubmitting} className={primaryButtonClass}>
        {form.formState.isSubmitting ? t("saving") : t("encryption.submit")}
      </button>
    </form>
  );
}
