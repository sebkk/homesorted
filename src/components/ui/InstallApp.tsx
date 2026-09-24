"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useInstallBannerDismissed, useInstallPrompt } from "@/lib/useInstallPrompt";
import { Sheet, SheetHeader } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { Logo } from "@/components/ui/Logo";

/** Starts installation: the native dialog on Chrome/Edge, the Share-sheet
 * steps on iOS. */
function useInstallAction() {
  const t = useTranslations("install");
  const { showToast } = useToast();
  const { state, promptInstall } = useInstallPrompt();
  const [iosStepsOpen, setIosStepsOpen] = useState(false);

  async function install() {
    if (state === "ios") return setIosStepsOpen(true);
    if ((await promptInstall()) === "accepted") showToast(t("added"));
  }

  const iosSteps = <IosSteps open={iosStepsOpen} onClose={() => setIosStepsOpen(false)} />;
  return { state, install, iosSteps };
}

/** Home-screen banner offering installation; dismissible per device. */
export function InstallBanner() {
  const t = useTranslations("install");
  const { state, install, iosSteps } = useInstallAction();
  const [dismissed, dismiss] = useInstallBannerDismissed();

  if ((state !== "prompt" && state !== "ios") || dismissed) return iosSteps;

  return (
    <>
      <div className="bg-surface-2 border border-border rounded-xl p-3.5 flex items-start gap-3 mb-3">
        <span className="shrink-0 mt-0.5">
          <Logo size={32} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold">{t("bannerTitle")}</div>
          <div className="text-[11.5px] text-ink-muted mt-0.5 leading-relaxed">{t("bannerBody")}</div>
          <div className="flex gap-2 mt-2.5">
            <button type="button" onClick={install} className="text-[12.5px] font-semibold text-accent bg-accent-soft rounded-md px-3 py-1.5">
              {t("add")}
            </button>
            <button type="button" onClick={dismiss} className="text-[12.5px] font-semibold text-ink-muted bg-transparent border-none">
              {t("notNow")}
            </button>
          </div>
        </div>
      </div>
      {iosSteps}
    </>
  );
}

/** Profile section: install button, or the current state when there's
 * nothing to install. */
export function InstallSection() {
  const t = useTranslations("install");
  const { state, install, iosSteps } = useInstallAction();

  return (
    <>
      {state === "prompt" || state === "ios" ? (
        <>
          <p className="text-[12.5px] text-ink-muted leading-relaxed">{t("bannerBody")}</p>
          <button type="button" onClick={install} className="font-bold text-[14.5px] text-accent-ink bg-accent rounded-md py-3">
            {t("addLong")}
          </button>
        </>
      ) : state === "installed" ? (
        <p className="text-[13px] text-good font-semibold">{t("installed")}</p>
      ) : (
        <p className="text-[12.5px] text-ink-muted leading-relaxed">{t("unsupported")}</p>
      )}
      {iosSteps}
    </>
  );
}

function IosSteps({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("install");
  const steps = [
    { icon: <ShareIcon />, text: t("iosStep1") },
    { icon: <AddIcon />, text: t("iosStep2") },
    { icon: <Logo size={22} />, text: t("iosStep3") },
  ];
  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHeader title={t("iosTitle")} onClose={onClose} />
      <p className="text-[12.5px] text-ink-muted leading-relaxed -mt-1">{t("iosIntro")}</p>
      {/* A real sequence, so it's an ordered list */}
      <ol className="flex flex-col gap-2.5">
        {steps.map((s, i) => (
          <li key={i} className="flex items-center gap-3 bg-surface-2 border border-border rounded-md p-3">
            <span className="w-6 h-6 rounded-full bg-accent-soft text-accent text-[12px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
            <span className="flex-1 text-[13px] leading-snug">{s.text}</span>
            <span className="w-9 h-9 rounded-md bg-surface-3 text-accent flex items-center justify-center shrink-0" aria-hidden>
              {s.icon}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-[11.5px] text-ink-faint leading-relaxed">{t("iosNote")}</p>
      <button type="button" onClick={onClose} className="font-bold text-[14.5px] text-accent-ink bg-accent rounded-md py-3 mb-1">
        {t("gotIt")}
      </button>
    </Sheet>
  );
}

/** Safari's Share icon (square with an arrow up). */
function ShareIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
    </svg>
  );
}

/** "Add to Home Screen" icon (plus in a rounded square). */
function AddIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}
