"use client";

import { useTranslations } from "next-intl";
import { useEncryption } from "./EncryptionContext";
import { EncryptionUnlock } from "./EncryptionUnlock";

/** Blocks the app behind an unlock screen while encryption is enabled but
 * this session hasn't unwrapped the data key yet. Renders children as-is
 * when the account has no encryption set up ("none") — that's the unchanged,
 * pre-encryption behavior — or once unlocked. */
export function EncryptionGate({ children }: { children: React.ReactNode }) {
  const t = useTranslations("finance");
  const { status } = useEncryption();

  if (status === "loading") {
    return <div className="flex-1 flex items-center justify-center text-ink-muted text-[13px]">{t("loading")}</div>;
  }
  if (status === "locked") {
    return <EncryptionUnlock />;
  }
  return <>{children}</>;
}
