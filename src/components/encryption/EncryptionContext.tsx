"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { unwrapWithPassword, unwrapWithRecoveryCode, wrapWithPassword, WrappedKeyBlob } from "@/lib/crypto";
import { migrateAllZonesToEncryption } from "./migrateEncryption";

/**
 * - "loading": checking whether this account has encryption set up yet.
 * - "none": no encryption row exists — data is stored in the clear.
 * - "locked": encryption is enabled, but this session hasn't unlocked the
 *   data key yet (fresh page load). No finance data should be read/rendered.
 * - "unlocked": the data key is in memory for this tab; reads/writes decrypt
 *   and encrypt transparently.
 */
export type EncryptionStatus = "loading" | "none" | "locked" | "unlocked";

interface EncryptionState {
  status: EncryptionStatus;
  /** In-memory only for the life of this tab — never persisted. */
  dek: CryptoKey | null;
  unlock: (password: string) => Promise<boolean>;
  /** Checks a recovery code and returns the data key, WITHOUT unlocking the
   * session yet — the user must first set a new password (rewrapPassword). */
  checkRecoveryCode: (code: string) => Promise<CryptoKey | null>;
  /** Writes the wrapped key pair (already prepared by the setup wizard,
   * see EncryptionSetup.tsx) and flips this session to "unlocked". */
  finishSetup: (dek: CryptoKey, passwordWrap: WrappedKeyBlob, recoveryWrap: WrappedKeyBlob) => Promise<boolean>;
  /** After a recovery-code check, replaces the password wrap and unlocks. */
  rewrapPassword: (dek: CryptoKey, passwordWrap: WrappedKeyBlob) => Promise<boolean>;
  /** Changes the encryption password: "wrong" if `current` doesn't unwrap the
   * data key. Data isn't re-encrypted — only the key's password wrap changes. */
  changePassword: (current: string, next: string) => Promise<"ok" | "wrong" | "error">;
  lock: () => void;
}

const EncryptionCtx = createContext<EncryptionState | null>(null);

export function EncryptionProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [status, setStatus] = useState<EncryptionStatus>("loading");
  const [dek, setDek] = useState<CryptoKey | null>(null);
  const [row, setRow] = useState<{ password_wrap: string; recovery_wrap: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("user_encryption")
      .select("password_wrap, recovery_wrap")
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data) {
          setRow(data);
          setStatus("locked");
        } else {
          setStatus("none");
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Finishes a setup migration that was interrupted (tab closed mid-way);
  // a no-op query per table once everything is encrypted.
  const resumeMigration = useCallback(
    (key: CryptoKey) => {
      migrateAllZonesToEncryption(supabase, key).catch(() => {});
    },
    [supabase]
  );

  const unlock = useCallback(
    async (password: string) => {
      if (!row) return false;
      let key: CryptoKey;
      try {
        key = await unwrapWithPassword(row.password_wrap, password);
      } catch {
        return false;
      }
      setDek(key);
      setStatus("unlocked");
      resumeMigration(key);
      return true;
    },
    [row, resumeMigration]
  );

  const checkRecoveryCode = useCallback(
    async (code: string) => {
      if (!row) return null;
      try {
        return await unwrapWithRecoveryCode(row.recovery_wrap, code);
      } catch {
        return null;
      }
    },
    [row]
  );

  const finishSetup = useCallback(
    async (key: CryptoKey, passwordWrap: WrappedKeyBlob, recoveryWrap: WrappedKeyBlob) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return false;
      const { error } = await supabase
        .from("user_encryption")
        .upsert({ user_id: user.id, password_wrap: passwordWrap, recovery_wrap: recoveryWrap });
      if (error) return false;
      setRow({ password_wrap: passwordWrap, recovery_wrap: recoveryWrap });
      setDek(key);
      setStatus("unlocked");
      return true;
    },
    [supabase]
  );

  const rewrapPassword = useCallback(
    async (key: CryptoKey, passwordWrap: WrappedKeyBlob) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return false;
      const { error } = await supabase.from("user_encryption").update({ password_wrap: passwordWrap }).eq("user_id", user.id);
      if (error) return false;
      setRow((prev) => (prev ? { ...prev, password_wrap: passwordWrap } : prev));
      setDek(key);
      setStatus("unlocked");
      resumeMigration(key);
      return true;
    },
    [supabase, resumeMigration]
  );

  const changePassword = useCallback(
    async (current: string, next: string): Promise<"ok" | "wrong" | "error"> => {
      if (!row) return "error";
      let key: CryptoKey;
      try {
        key = await unwrapWithPassword(row.password_wrap, current);
      } catch {
        return "wrong";
      }
      return (await rewrapPassword(key, await wrapWithPassword(key, next))) ? "ok" : "error";
    },
    [row, rewrapPassword]
  );

  const lock = useCallback(() => {
    setDek(null);
    setStatus(row ? "locked" : "none");
  }, [row]);

  const value = useMemo<EncryptionState>(
    () => ({ status, dek, unlock, checkRecoveryCode, finishSetup, rewrapPassword, changePassword, lock }),
    [status, dek, unlock, checkRecoveryCode, finishSetup, rewrapPassword, changePassword, lock]
  );

  return <EncryptionCtx.Provider value={value}>{children}</EncryptionCtx.Provider>;
}

export function useEncryption(): EncryptionState {
  const ctx = useContext(EncryptionCtx);
  if (!ctx) throw new Error("useEncryption must be used within EncryptionProvider");
  return ctx;
}
