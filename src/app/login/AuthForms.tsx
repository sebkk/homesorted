"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/ui/NavigationProgress";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { createClient } from "@/lib/supabase/client";
import { LanguageSwitch } from "@/components/ui/LanguageSwitch";
import { Banner, FormField, primaryButtonClass } from "@/components/ui/FormField";
import { Logo } from "@/components/ui/Logo";

export type LoginNotice = "confirmed" | "confirmError" | "resetError" | null;

type View =
  | { kind: "signin" }
  | { kind: "signup" }
  | { kind: "signupDone"; email: string }
  | { kind: "forgot" }
  | { kind: "forgotSent"; email: string };

interface SignInValues {
  email: string;
  password: string;
}

interface SignUpValues {
  name: string;
  email: string;
  password: string;
  passwordConfirm: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

/** Supabase auth errors come back in English; map the ones users actually hit. */
function authErrorKey(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "errors.invalidCredentials";
  if (m.includes("email not confirmed")) return "errors.emailNotConfirmed";
  if (m.includes("rate limit") || m.includes("too many")) return "errors.rateLimit";
  if (m.includes("already registered")) return "errors.alreadyRegistered";
  if (m.includes("password")) return "errors.weakPassword";
  if (m.includes("fetch") || m.includes("network")) return "errors.network";
  return "errors.generic";
}

export function AuthForms({ notice }: { notice: LoginNotice }) {
  const t = useTranslations("login");
  const [view, setView] = useState<View>({ kind: "signin" });
  const [prefillEmail, setPrefillEmail] = useState("");

  return (
    <div className="flex-1 flex flex-col justify-center gap-4 px-7 pt-[calc(2rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))] overflow-y-auto relative">
      <LanguageSwitch className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top))]" />
      <div className="flex flex-col items-center gap-2.5 mb-2 text-center">
        <Logo size={44} />
        <div className="text-xl font-bold tracking-tight">HomeSorted</div>
        <div className="text-[13px] text-ink-muted leading-relaxed max-w-[280px]">
          {view.kind === "signin"
            ? t("signInIntro")
            : view.kind === "signup"
              ? t("signUpIntro")
              : view.kind === "forgot"
                ? t("forgotIntro")
                : t("checkInboxTitle")}
        </div>
      </div>

      {view.kind === "signin" && (
        <>
          {notice === "confirmed" && <Banner tone="good">{t("notices.confirmed")}</Banner>}
          {notice === "confirmError" && <Banner tone="critical">{t("notices.confirmError")}</Banner>}
          {notice === "resetError" && <Banner tone="critical">{t("notices.resetError")}</Banner>}
          <SignInForm
            defaultEmail={prefillEmail}
            onForgot={(email) => {
              setPrefillEmail(email);
              setView({ kind: "forgot" });
            }}
          />
          <SwitchPrompt question={t("noAccountQuestion")} action={t("signUp")} onClick={() => setView({ kind: "signup" })} />
        </>
      )}

      {view.kind === "signup" && (
        <>
          <SignUpForm
            onDone={(email) => setView({ kind: "signupDone", email })}
            onAlreadyRegistered={(email) => {
              setPrefillEmail(email);
              setView({ kind: "signin" });
            }}
          />
          <SwitchPrompt question={t("haveAccountQuestion")} action={t("signIn")} onClick={() => setView({ kind: "signin" })} />
        </>
      )}

      {view.kind === "forgot" && (
        <>
          <ForgotPasswordForm defaultEmail={prefillEmail} onSent={(email) => setView({ kind: "forgotSent", email })} />
          <SwitchPrompt question={t("rememberedQuestion")} action={t("signIn")} onClick={() => setView({ kind: "signin" })} />
        </>
      )}

      {view.kind === "forgotSent" && (
        <div className="flex flex-col gap-3">
          <Banner tone="good">
            {t.rich("forgotSentBody", { email: view.email, b: (chunks) => <b className="font-semibold break-all">{chunks}</b> })}
          </Banner>
          <div className="text-[12px] text-ink-muted leading-relaxed">{t("forgotSentHint")}</div>
          <button
            type="button"
            onClick={() => {
              setPrefillEmail(view.email);
              setView({ kind: "signin" });
            }}
            className={primaryButtonClass}
          >
            {t("backToSignIn")}
          </button>
        </div>
      )}

      {view.kind === "signupDone" && (
        <SignUpDone
          email={view.email}
          onBack={() => {
            setPrefillEmail(view.email);
            setView({ kind: "signin" });
          }}
        />
      )}

      <div className="text-center text-[11.5px] text-ink-faint leading-relaxed mt-1">{t("footer")}</div>
    </div>
  );
}

function SignInForm({ defaultEmail, onForgot }: { defaultEmail: string; onForgot: (email: string) => void }) {
  const t = useTranslations("login");
  const router = useRouter();
  const [formError, setFormError] = useState<{ key: string; email?: string } | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({ defaultValues: { email: defaultEmail, password: "" }, mode: "onTouched" });

  async function onSubmit(values: SignInValues) {
    setFormError(null);
    const supabase = createClient();
    const email = values.email.trim();
    const { error } = await supabase.auth.signInWithPassword({ email, password: values.password });
    if (error) {
      setFormError({ key: authErrorKey(error.message), email });
      return;
    }
    setRedirecting(true);
    startNavigationProgress();
    router.push("/launcher");
    router.refresh();
  }

  const busy = isSubmitting || redirecting;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
      <FormField
        id="email"
        label={t("email")}
        type="email"
        autoComplete="email"
        placeholder={t("emailPlaceholder")}
        error={errors.email}
        registration={register("email", {
          required: t("validation.emailRequired"),
          pattern: { value: EMAIL_PATTERN, message: t("validation.emailInvalid") },
        })}
      />
      <FormField
        id="password"
        label={t("password")}
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
        error={errors.password}
        registration={register("password", { required: t("validation.passwordRequired") })}
      />
      <button
        type="button"
        onClick={() => onForgot(getValues("email").trim())}
        className="self-end -mt-1 text-[12.5px] font-semibold text-accent bg-transparent border-none"
      >
        {t("forgotLink")}
      </button>

      {formError && (
        <Banner tone="critical">
          {t(formError.key)}
          {formError.key === "errors.emailNotConfirmed" && formError.email && <ResendLink email={formError.email} />}
        </Banner>
      )}

      <button type="submit" disabled={busy} className={primaryButtonClass}>
        {busy ? t("signingIn") : t("signIn")}
      </button>
    </form>
  );
}

function SignUpForm({ onDone, onAlreadyRegistered }: { onDone: (email: string) => void; onAlreadyRegistered: (email: string) => void }) {
  const t = useTranslations("login");
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({ defaultValues: { name: "", email: "", password: "", passwordConfirm: "" }, mode: "onTouched" });

  async function onSubmit(values: SignUpValues) {
    setFormError(null);
    const supabase = createClient();
    const email = values.email.trim();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: values.password,
      options: {
        data: { full_name: values.name.trim() },
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });

    if (error) {
      const key = authErrorKey(error.message);
      if (key === "errors.alreadyRegistered") return onAlreadyRegistered(email);
      setFormError(key);
      return;
    }
    // With email confirmation on, Supabase doesn't reveal whether the address
    // is taken: it answers with a user that has no identities instead.
    if (data.user && data.user.identities?.length === 0) {
      setFormError("errors.alreadyRegistered");
      return;
    }
    if (data.session) {
      // Confirmation disabled in Supabase: the account is ready right away.
      setRedirecting(true);
      startNavigationProgress();
      router.push("/launcher");
      router.refresh();
      return;
    }
    onDone(email);
  }

  const busy = isSubmitting || redirecting;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
      <FormField
        id="name"
        label={t("name")}
        type="text"
        autoComplete="given-name"
        placeholder={t("namePlaceholder")}
        error={errors.name}
        registration={register("name", {
          required: t("validation.nameRequired"),
          validate: (v) => v.trim().length > 0 || t("validation.nameRequired"),
          maxLength: { value: 50, message: t("validation.nameTooLong") },
        })}
      />
      <FormField
        id="signupEmail"
        label={t("email")}
        type="email"
        autoComplete="email"
        placeholder={t("emailPlaceholder")}
        error={errors.email}
        registration={register("email", {
          required: t("validation.emailRequired"),
          pattern: { value: EMAIL_PATTERN, message: t("validation.emailInvalid") },
        })}
      />
      <FormField
        id="signupPassword"
        label={t("password")}
        type="password"
        autoComplete="new-password"
        placeholder="••••••••"
        hint={t("passwordHint", { min: MIN_PASSWORD })}
        error={errors.password}
        registration={register("password", {
          required: t("validation.passwordRequired"),
          minLength: { value: MIN_PASSWORD, message: t("validation.passwordTooShort", { min: MIN_PASSWORD }) },
        })}
      />
      <FormField
        id="signupPasswordConfirm"
        label={t("passwordConfirm")}
        type="password"
        autoComplete="new-password"
        placeholder="••••••••"
        error={errors.passwordConfirm}
        registration={register("passwordConfirm", {
          required: t("validation.passwordConfirmRequired"),
          validate: (v) => v === getValues("password") || t("validation.passwordMismatch"),
        })}
      />

      {formError && (
        <Banner tone="critical">
          {t(formError)}
          {formError === "errors.alreadyRegistered" && (
            <button type="button" onClick={() => onAlreadyRegistered(getValues("email").trim())} className="ml-1 font-semibold underline">
              {t("signIn")}
            </button>
          )}
        </Banner>
      )}

      <button type="submit" disabled={busy} className={primaryButtonClass}>
        {busy ? t("signingUp") : t("signUp")}
      </button>
    </form>
  );
}

/** Sends a password-reset link. The response is the same whether or not the
 * address has an account, so the form can't be used to probe for accounts. */
function ForgotPasswordForm({ defaultEmail, onSent }: { defaultEmail: string; onSent: (email: string) => void }) {
  const t = useTranslations("login");
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ email: string }>({ defaultValues: { email: defaultEmail }, mode: "onTouched" });

  async function onSubmit(values: { email: string }) {
    setFormError(null);
    const email = values.email.trim();
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
    if (error) {
      const key = authErrorKey(error.message);
      // Any other error would leak whether the address exists; treat as sent.
      if (key === "errors.rateLimit" || key === "errors.network") {
        setFormError(key);
        return;
      }
    }
    onSent(email);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
      <FormField
        id="forgotEmail"
        label={t("email")}
        type="email"
        autoComplete="email"
        placeholder={t("emailPlaceholder")}
        error={errors.email}
        registration={register("email", {
          required: t("validation.emailRequired"),
          pattern: { value: EMAIL_PATTERN, message: t("validation.emailInvalid") },
        })}
      />
      {formError && <Banner tone="critical">{t(formError)}</Banner>}
      <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
        {isSubmitting ? t("sending") : t("sendResetLink")}
      </button>
    </form>
  );
}

function SignUpDone({ email, onBack }: { email: string; onBack: () => void }) {
  const t = useTranslations("login");
  return (
    <div className="flex flex-col gap-3">
      <Banner tone="good">
        <span className="block font-semibold mb-1">{t("accountCreated")}</span>
        {t.rich("checkInboxBody", { email, b: (chunks) => <b className="font-semibold break-all">{chunks}</b> })}
      </Banner>
      <div className="text-[12px] text-ink-muted leading-relaxed">
        {t("checkInboxHint")} <ResendLink email={email} />
      </div>
      <button type="button" onClick={onBack} className={primaryButtonClass}>
        {t("backToSignIn")}
      </button>
    </div>
  );
}

/** Re-sends the sign-up confirmation email, with inline feedback. */
function ResendLink({ email }: { email: string }) {
  const t = useTranslations("login");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function resend() {
    setState("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    });
    setState(error ? "error" : "sent");
  }

  if (state === "sent") return <span className="font-semibold text-good"> {t("resendSent")}</span>;
  return (
    <>
      {" "}
      <button type="button" disabled={state === "sending"} onClick={resend} className="font-semibold text-accent underline disabled:opacity-60">
        {state === "sending" ? t("resending") : t("resend")}
      </button>
      {state === "error" && <span className="text-critical"> {t("errors.rateLimit")}</span>}
    </>
  );
}

function SwitchPrompt({ question, action, onClick }: { question: string; action: string; onClick: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 mt-2 pt-4 border-t border-border">
      <span className="text-[12.5px] text-ink-muted">{question}</span>
      <button
        type="button"
        onClick={onClick}
        className="w-full font-semibold text-[14px] text-accent bg-accent-soft border-none rounded-md py-2.5"
      >
        {action}
      </button>
    </div>
  );
}
