"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Sheet, SheetHeader, Field } from "@/components/ui/Sheet";
import { createClient } from "@/lib/supabase/client";
import { useEncryption } from "./EncryptionContext";
import { migrateAllZonesToEncryption } from "./migrateEncryption";
import { generateDataKey, generateRecoveryCode, wrapWithPassword, wrapWithRecoveryCode } from "@/lib/crypto";

const inputClass =
  "text-[14.5px] font-medium text-ink bg-sheet-field-bg border border-border rounded-md px-3 py-2.5 outline-none focus:border-accent";

type Step = "intro" | "password" | "recovery" | "migrating" | "done";

/** Dismissible banner offering to enable encryption; only shown for accounts
 * that haven't set it up yet (status "none" — see EncryptionContext). */
export function EncryptionSetupBanner() {
  const t = useTranslations("encryption");
  const { status } = useEncryption();
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);

  // The sheet must outlive the banner: finishing setup flips the status away
  // from "none" (hiding the banner) while the migration and "done" steps are
  // still showing inside the sheet.
  const showBanner = status === "none" && !dismissed;
  if (!showBanner && !open) return null;

  return (
    <>
      {showBanner && (
      <div className="bg-surface-2 border border-border rounded-xl p-3.5 flex items-start gap-3 mb-1">
        <span className="w-8 h-8 rounded-md bg-accent-soft text-accent flex items-center justify-center shrink-0 mt-0.5">
          <LockIcon />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold">{t("bannerTitle")}</div>
          <div className="text-[11.5px] text-ink-muted mt-0.5 leading-relaxed">{t("bannerBody")}</div>
          <div className="flex gap-2 mt-2.5">
            <button type="button" onClick={() => setOpen(true)} className="text-[12.5px] font-semibold text-accent bg-accent-soft rounded-md px-3 py-1.5">
              {t("bannerEnable")}
            </button>
            <button type="button" onClick={() => setDismissed(true)} className="text-[12.5px] font-semibold text-ink-muted bg-transparent border-none">
              {t("bannerLater")}
            </button>
          </div>
        </div>
      </div>
      )}
      <EncryptionSetupSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function EncryptionSetupSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("encryption");
  const { finishSetup } = useEncryption();
  const supabase = createClient();

  const [step, setStep] = useState<Step>("intro");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [savedChecked, setSavedChecked] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  // Held only in memory between the "password" and "migrating" steps — the
  // key isn't written to Supabase until finishSetup() runs, so closing the
  // sheet before then leaves no trace and can be safely retried.
  const [pending, setPending] = useState<{ dek: CryptoKey; passwordWrap: string; recoveryWrap: string } | null>(null);

  function reset() {
    setStep("intro");
    setPassword("");
    setConfirm("");
    setError(null);
    setRecoveryCode("");
    setSavedChecked(false);
    setProgress({ done: 0, total: 0 });
    setPending(null);
  }

  function handleClose() {
    if (step === "recovery" || step === "migrating") return; // must finish or explicitly go back
    onClose();
    setTimeout(reset, 200);
  }

  async function handleCreatePassword() {
    if (password.length < 8) {
      setError(t("passwordTooShort"));
      return;
    }
    if (password !== confirm) {
      setError(t("passwordMismatch"));
      return;
    }
    setError(null);
    setBusy(true);
    const dek = await generateDataKey();
    const code = generateRecoveryCode();
    const [passwordWrap, recoveryWrap] = await Promise.all([wrapWithPassword(dek, password), wrapWithRecoveryCode(dek, code)]);
    setBusy(false);
    setPending({ dek, passwordWrap, recoveryWrap });
    setRecoveryCode(code);
    setStep("recovery");
  }

  async function handleConfirmSaved() {
    if (!pending || !savedChecked) return;
    setStep("migrating");
    const ok = await finishSetup(pending.dek, pending.passwordWrap, pending.recoveryWrap);
    if (!ok) {
      setError(t("setupFailed"));
      setStep("recovery");
      return;
    }
    await migrateAllZonesToEncryption(supabase, pending.dek, (done, total) => setProgress({ done, total }));
    setStep("done");
  }

  return (
    <Sheet open={open} onClose={handleClose}>
      {step === "intro" && (
        <>
          <SheetHeader title={t("setupTitle")} onClose={handleClose} />
          <div className="text-[13px] text-ink-muted leading-relaxed">{t("introBody")}</div>
          <ul className="text-[12.5px] text-ink-muted leading-relaxed list-disc pl-4 flex flex-col gap-1">
            <li>{t("introEncrypted")}</li>
            <li>{t("introRecovery")}</li>
            <li>{t("introWarning")}</li>
          </ul>
          <button type="button" onClick={() => setStep("password")} className="font-bold text-[14.5px] text-accent-ink bg-accent rounded-md py-3 mb-1">
            {t("continue")}
          </button>
        </>
      )}

      {step === "password" && (
        <>
          <SheetHeader title={t("setupTitle")} onClose={handleClose} />
          <Field label={t("newPassword")} htmlFor="setupPassword">
            <input
              id="setupPassword"
              type="password"
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label={t("confirmPassword")} htmlFor="setupPasswordConfirm">
            <input
              id="setupPasswordConfirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClass}
            />
          </Field>
          {error && <div className="text-[12.5px] text-critical leading-relaxed">{error}</div>}
          <button
            type="button"
            disabled={busy}
            onClick={handleCreatePassword}
            className="font-bold text-[14.5px] text-accent-ink bg-accent rounded-md py-3 mb-1 disabled:opacity-60"
          >
            {busy ? t("preparing") : t("continue")}
          </button>
        </>
      )}

      {step === "recovery" && (
        <>
          <SheetHeader title={t("recoveryTitle")} onClose={handleClose} />
          <div className="text-[13px] text-ink-muted leading-relaxed">{t("recoveryBody")}</div>
          <div className="font-mono text-[15px] font-bold tracking-wide bg-surface-2 border border-border rounded-md p-3.5 text-center break-all">
            {recoveryCode}
          </div>
          <label className="flex flex-row items-start gap-2.5" htmlFor="setupSavedCheck">
            <input
              id="setupSavedCheck"
              type="checkbox"
              checked={savedChecked}
              onChange={(e) => setSavedChecked(e.target.checked)}
              className="w-[17px] h-[17px] accent-accent shrink-0 mt-0.5"
            />
            <span className="text-[13px]">{t("savedConfirm")}</span>
          </label>
          {error && <div className="text-[12.5px] text-critical leading-relaxed">{error}</div>}
          <button
            type="button"
            disabled={!savedChecked}
            onClick={handleConfirmSaved}
            className="font-bold text-[14.5px] text-accent-ink bg-accent rounded-md py-3 mb-1 disabled:opacity-40"
          >
            {t("enableNow")}
          </button>
        </>
      )}

      {step === "migrating" && (
        <>
          <SheetHeader title={t("migratingTitle")} onClose={handleClose} />
          <div className="text-[13px] text-ink-muted leading-relaxed">{t("migratingBody")}</div>
          <div className="h-2 rounded-full overflow-hidden bg-surface-2 border border-border">
            <div
              className="h-full bg-accent transition-[width] duration-200"
              style={{ width: progress.total > 0 ? `${(progress.done / progress.total) * 100}%` : "8%" }}
            />
          </div>
          <div className="text-[11.5px] text-ink-muted text-center tabular-nums">
            {progress.total > 0 ? `${progress.done} / ${progress.total}` : t("preparing")}
          </div>
        </>
      )}

      {step === "done" && (
        <>
          <SheetHeader title={t("doneTitle")} onClose={handleClose} />
          <div className="text-[13px] text-ink-muted leading-relaxed">{t("doneBody")}</div>
          <button
            type="button"
            onClick={handleClose}
            className="font-bold text-[14.5px] text-accent-ink bg-accent rounded-md py-3 mb-1"
          >
            {t("done")}
          </button>
        </>
      )}
    </Sheet>
  );
}

function LockIcon() {
  return (
    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
