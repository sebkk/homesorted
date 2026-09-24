"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useEncryption } from "./EncryptionContext";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { wrapWithPassword } from "@/lib/crypto";

type Mode = "password" | "recovery" | "newPassword";

const inputClass =
  "text-[14.5px] font-medium text-ink bg-surface-2 border border-border rounded-md px-3 py-2.5 outline-none focus:border-accent";

/** Full-screen gate shown instead of the app while the data key isn't
 * unlocked yet (fresh page load on an account with encryption enabled). */
export function EncryptionUnlock() {
  const t = useTranslations("encryption");
  const { unlock, checkRecoveryCode, rewrapPassword } = useEncryption();
  const [mode, setMode] = useState<Mode>("password");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [recoveredDek, setRecoveredDek] = useState<CryptoKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const ok = await unlock(password);
    setBusy(false);
    if (!ok) setError(t("wrongPassword"));
  }

  async function handleRecover(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const dek = await checkRecoveryCode(code);
    setBusy(false);
    if (!dek) {
      setError(t("wrongRecoveryCode"));
      return;
    }
    setRecoveredDek(dek);
    setMode("newPassword");
  }

  async function handleSetNewPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError(t("passwordTooShort"));
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setError(t("passwordMismatch"));
      return;
    }
    if (!recoveredDek) return;
    setBusy(true);
    setError(null);
    const wrap = await wrapWithPassword(recoveredDek, newPassword);
    const ok = await rewrapPassword(recoveredDek, wrap);
    setBusy(false);
    // On success the session is now unlocked and the gate renders the app.
    if (!ok) setError(t("setupFailed"));
  }

  return (
    <div className="flex-1 flex flex-col justify-center gap-4 px-7 py-8 overflow-y-auto">
      <div className="flex flex-col items-center gap-2.5 mb-2 text-center">
        <LockIcon />
        <div className="text-xl font-bold tracking-tight">{t("unlockTitle")}</div>
        <div className="text-[13px] text-ink-muted leading-relaxed max-w-[280px]">
          {mode === "password" ? t("unlockIntro") : mode === "recovery" ? t("recoveryIntro") : t("newPasswordIntro")}
        </div>
      </div>

      {mode === "password" && (
        <form onSubmit={handleUnlock} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-muted" htmlFor="encPassword">
            <span>{t("password")}</span>
            <PasswordInput
              id="encPassword"
              required
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </label>
          {error && <div className="text-[12.5px] text-critical leading-relaxed">{error}</div>}
          <button
            type="submit"
            disabled={busy}
            className="font-bold text-[14.5px] text-accent-ink bg-accent rounded-md py-3 disabled:opacity-60"
          >
            {t("unlock")}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("recovery");
              setError(null);
            }}
            className="text-[12.5px] font-semibold text-ink-muted bg-transparent border-none"
          >
            {t("forgotPassword")}
          </button>
        </form>
      )}

      {mode === "recovery" && (
        <form onSubmit={handleRecover} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-muted" htmlFor="encRecoveryCode">
            <span>{t("recoveryCode")}</span>
            <input
              id="encRecoveryCode"
              type="text"
              required
              autoFocus
              placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={inputClass + " tracking-wide"}
            />
          </label>
          {error && <div className="text-[12.5px] text-critical leading-relaxed">{error}</div>}
          <button
            type="submit"
            disabled={busy}
            className="font-bold text-[14.5px] text-accent-ink bg-accent rounded-md py-3 disabled:opacity-60"
          >
            {t("recover")}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("password");
              setError(null);
            }}
            className="text-[12.5px] font-semibold text-ink-muted bg-transparent border-none"
          >
            {t("backToPassword")}
          </button>
        </form>
      )}

      {mode === "newPassword" && (
        <form onSubmit={handleSetNewPassword} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-muted" htmlFor="encNewPassword">
            <span>{t("newPassword")}</span>
            <PasswordInput
              id="encNewPassword"
              required
              autoFocus
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-muted" htmlFor="encNewPasswordConfirm">
            <span>{t("confirmPassword")}</span>
            <PasswordInput
              id="encNewPasswordConfirm"
              required
              autoComplete="new-password"
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              className={inputClass}
            />
          </label>
          {error && <div className="text-[12.5px] text-critical leading-relaxed">{error}</div>}
          <button
            type="submit"
            disabled={busy}
            className="font-bold text-[14.5px] text-accent-ink bg-accent rounded-md py-3 disabled:opacity-60"
          >
            {t("saveNewPassword")}
          </button>
        </form>
      )}
    </div>
  );
}

function LockIcon() {
  return (
    <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
