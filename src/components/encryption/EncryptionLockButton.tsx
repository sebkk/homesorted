"use client";

import { useTranslations } from "next-intl";
import { useEncryption } from "./EncryptionContext";

/** Manual "lock now" button — only visible once encryption is unlocked. */
export function EncryptionLockButton({ className = "" }: { className?: string }) {
  const t = useTranslations("encryption");
  const { status, lock } = useEncryption();
  if (status !== "unlocked") return null;

  return (
    <button
      type="button"
      aria-label={t("lockNow")}
      title={t("lockNow")}
      onClick={lock}
      className={`w-8 h-8 rounded-md border border-border bg-surface-2 text-ink-muted flex items-center justify-center shrink-0 ${className}`}
    >
      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="11" width="16" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
    </button>
  );
}
