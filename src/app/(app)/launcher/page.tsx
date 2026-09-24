import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageSwitch } from "@/components/ui/LanguageSwitch";
import { EncryptionSetupBanner } from "@/components/encryption/EncryptionSetup";
import { EncryptionLockButton } from "@/components/encryption/EncryptionLockButton";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions";
import { Zone } from "@/lib/types";

export async function generateMetadata() {
  return { title: (await getTranslations("titles"))("launcher") };
}

const CAT_VARS = [
  "var(--cat1)",
  "var(--cat2)",
  "var(--cat3)",
  "var(--cat4)",
  "var(--cat5)",
  "var(--cat6)",
  "var(--cat7)",
  "var(--cat8)",
];

export default async function LauncherPage() {
  const t = await getTranslations("launcher");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: zones } = await supabase
    .from("zones")
    .select("*")
    .eq("pinned", true)
    .order("created_at", { ascending: true });

  const pinnedZones = (zones as Zone[] | null) ?? [];
  const displayName = (user?.user_metadata?.full_name as string | undefined)?.trim() || user?.email || "";

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div
        className="flex-1 min-h-0 overflow-y-auto px-5"
        style={{ paddingTop: "calc(22px + env(safe-area-inset-top, 0px))", paddingBottom: "28px" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="text-[19px] font-bold mt-1 mb-0.5 tracking-tight min-w-0 break-words">{t("hello", { name: displayName })}</div>
          <div className="flex items-center gap-1.5 shrink-0">
            <EncryptionLockButton />
            <Link
              href="/profile"
              aria-label={t("profile")}
              title={t("profile")}
              className="w-8 h-8 rounded-md border border-border bg-surface-2 text-ink-muted flex items-center justify-center shrink-0"
            >
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21a8 8 0 0 1 16 0" />
              </svg>
            </Link>
            <LanguageSwitch />
          </div>
        </div>
        <div className="text-[13px] text-ink-muted mb-[18px]">{t("intro")}</div>

        <EncryptionSetupBanner />

        {pinnedZones.length > 0 && (
          <div className="mb-1">
            <div className="section-title text-[13px] font-semibold text-ink-muted uppercase tracking-wider mb-2.5">
              {t("pinned")}
            </div>
            <div className="grid grid-cols-2 gap-3 mb-1">
              {pinnedZones.map((zone) => (
                <Link
                  key={zone.id}
                  href={`/finance/${zone.id}`}
                  className="bg-surface-2 border border-border rounded-xl p-4 flex flex-col gap-2.5 text-left shadow-glass"
                >
                  <span
                    className="w-[38px] h-[38px] rounded-md flex items-center justify-center shrink-0"
                    style={{
                      background: `color-mix(in srgb, ${CAT_VARS[(zone.color - 1) % 8]} 16%, transparent)`,
                      color: CAT_VARS[(zone.color - 1) % 8],
                    }}
                  >
                    <FinanceIcon />
                  </span>
                  <span className="text-[13.5px] font-bold">{zone.name}</span>
                  <span className="text-[11.5px] text-ink-muted leading-snug">{t("finance")}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="section-title text-[13px] font-semibold text-ink-muted uppercase tracking-wider mt-[22px] mb-2.5">
          {t("modules")}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/zones"
            className="bg-surface-2 border border-border rounded-xl p-4 flex flex-col gap-2.5 text-left shadow-glass"
          >
            <span className="w-[38px] h-[38px] rounded-md bg-accent-soft text-accent flex items-center justify-center shrink-0">
              <FinanceIcon />
            </span>
            <span className="text-[13.5px] font-bold">{t("finance")}</span>
            <span className="text-[11.5px] text-ink-muted leading-snug">{t("financeDesc")}</span>
          </Link>
          <div className="bg-surface-2 border border-border rounded-xl p-4 flex flex-col gap-2.5 opacity-55">
            <span className="w-[38px] h-[38px] rounded-md bg-surface-3 text-ink-faint flex items-center justify-center shrink-0">
              <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 8L12 3 3 8v8l9 5 9-5V8Z" />
                <path d="M3 8l9 5 9-5" />
                <path d="M12 13v8" />
              </svg>
            </span>
            <span className="text-[13.5px] font-bold">{t("pantry")}</span>
            <span className="text-[11.5px] text-ink-muted leading-snug">{t("pantryDesc")}</span>
            <span className="self-start text-[9.5px] font-bold uppercase tracking-wide text-ink-faint bg-surface-3 rounded-full px-2 py-0.5">
              {t("soon")}
            </span>
          </div>
        </div>
      </div>

      <form action={signOut}>
        <button
          type="submit"
          className="block flex-none w-full bg-transparent border-none border-t border-border text-ink-faint font-sans text-xs font-semibold cursor-pointer px-5 pt-3.5"
          style={{ paddingBottom: "calc(14px + env(safe-area-inset-bottom, 0px))" }}
        >
          {t("signOut")}
        </button>
      </form>
    </div>
  );
}

function FinanceIcon() {
  return (
    <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </svg>
  );
}
