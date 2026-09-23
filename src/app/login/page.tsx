"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Step = "email" | "creds";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function goToCreds(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setStep("creds");
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      if (mode === "signin") {
        // Most likely: no account yet with this email — offer to create one
        // rather than showing a raw Supabase error.
        setMode("signup");
        setError("Nie znaleziono konta z tym hasłem. Jeśli to Twój pierwszy raz, podaj imię i załóż konto poniżej.");
        setBusy(false);
        return;
      }

      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: name.trim() } },
      });

      if (signUpError) {
        setError(signUpError.message);
        setBusy(false);
        return;
      }

      router.push("/launcher");
      router.refresh();
      return;
    }

    router.push("/launcher");
    router.refresh();
  }

  return (
    <div className="flex-1 flex flex-col justify-center gap-4 px-7 py-8 overflow-y-auto">
      <div className="flex flex-col items-center gap-2.5 mb-2 text-center">
        <svg width={44} height={44} viewBox="0 0 26 26" fill="none">
          <rect x="1" y="1" width="24" height="24" rx="7" fill="var(--accent)" />
          <path
            d="M7 17.5L10.5 12L13.5 15L19 8"
            stroke="var(--accent-ink)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="text-xl font-bold tracking-tight">HomeSorted</div>
        <div className="text-[13px] text-ink-muted leading-relaxed max-w-[280px]">
          Podaj adres e-mail, aby się zalogować lub założyć konto.
        </div>
      </div>

      {step === "email" && (
        <form onSubmit={goToCreds} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-muted" htmlFor="email">
            <span>Adres e-mail</span>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="ty@przyklad.pl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="text-[14.5px] font-medium text-ink bg-surface-2 border border-border rounded-md px-3 py-2.5 outline-none focus:border-accent"
            />
          </label>
          <button
            type="submit"
            className="font-bold text-[14.5px] text-accent-ink bg-accent rounded-md py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_6px_16px_rgba(42,120,214,0.28)]"
          >
            Dalej
          </button>
        </form>
      )}

      {step === "creds" && (
        <form onSubmit={handleSignIn} className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 bg-surface-2 border border-border rounded-md px-3 py-2.5 text-[13px] font-semibold">
            <span className="truncate">{email}</span>
            <button
              type="button"
              className="text-accent font-bold text-xs shrink-0"
              onClick={() => {
                setStep("email");
                setMode("signin");
                setError(null);
              }}
            >
              Zmień
            </button>
          </div>

          {mode === "signup" && (
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-muted" htmlFor="name">
              <span>Imię</span>
              <input
                id="name"
                type="text"
                autoComplete="given-name"
                placeholder="np. Kuba"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-[14.5px] font-medium text-ink bg-surface-2 border border-border rounded-md px-3 py-2.5 outline-none focus:border-accent"
              />
            </label>
          )}

          <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-muted" htmlFor="password">
            <span>Hasło</span>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="text-[14.5px] font-medium text-ink bg-surface-2 border border-border rounded-md px-3 py-2.5 outline-none focus:border-accent"
            />
          </label>

          {error && <div className="text-[12.5px] text-critical leading-relaxed">{error}</div>}

          <button
            type="submit"
            disabled={busy}
            className="font-bold text-[14.5px] text-accent-ink bg-accent rounded-md py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_6px_16px_rgba(42,120,214,0.28)] disabled:opacity-60"
          >
            {mode === "signup" ? "Załóż konto" : "Zaloguj się"}
          </button>
        </form>
      )}

      <div className="text-center text-[11.5px] text-ink-faint leading-relaxed mt-1">
        Twoje dane trzymane są w Supabase i zsynchronizują się między urządzeniami.
      </div>
    </div>
  );
}
