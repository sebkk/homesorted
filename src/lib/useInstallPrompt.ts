"use client";

import { useSyncExternalStore } from "react";

// "Add to Home Screen" support per platform:
// - Chrome/Edge (Android and desktop) fire `beforeinstallprompt`; the inline
//   script in the root layout keeps it on window.__hsInstallPrompt so it can
//   be shown later from a button.
// - iOS has no such API: installing is only possible from the Share sheet, so
//   the UI shows instructions instead.
// - Already running as an installed app: nothing to offer.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    __hsInstallPrompt?: BeforeInstallPromptEvent | null;
    __hsInstalled?: boolean;
  }
}

/** "prompt": a native install dialog is available; "ios": show Share-sheet
 * steps; "installed": running as the app (or just installed); "none": this
 * browser can't install (or hasn't offered it yet). */
export type InstallState = "prompt" | "ios" | "installed" | "none";

const CHANGE = "hs-install-change";

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIOS(): boolean {
  // iPadOS reports itself as a Mac; touch support gives it away.
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function getSnapshot(): InstallState {
  if (window.__hsInstalled || isStandalone()) return "installed";
  if (window.__hsInstallPrompt) return "prompt";
  if (isIOS()) return "ios";
  return "none";
}

function subscribe(onChange: () => void) {
  const mq = window.matchMedia("(display-mode: standalone)");
  window.addEventListener(CHANGE, onChange);
  mq.addEventListener("change", onChange);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    mq.removeEventListener("change", onChange);
  };
}

export function useInstallPrompt() {
  const state = useSyncExternalStore(subscribe, getSnapshot, () => "none" as InstallState);

  /** Opens the browser's install dialog (Chrome/Edge only). */
  async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
    const event = window.__hsInstallPrompt;
    if (!event) return "unavailable";
    await event.prompt();
    const { outcome } = await event.userChoice;
    // A prompt can only be used once; the browser fires a new one if it wants.
    window.__hsInstallPrompt = null;
    if (outcome === "accepted") window.__hsInstalled = true;
    window.dispatchEvent(new Event(CHANGE));
    return outcome;
  }

  return { state, promptInstall };
}

// ---------- "don't show the banner again" (per device) ----------
const DISMISS_KEY = "hs-install-banner-dismissed";
const DISMISS_CHANGE = "hs-install-dismiss-change";
// Fallback when storage is unavailable: hidden until the page reloads.
let dismissedThisPage = false;

function readDismissed(): boolean {
  if (dismissedThisPage) return true;
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function useInstallBannerDismissed(): [boolean, () => void] {
  const dismissed = useSyncExternalStore(
    (onChange) => {
      window.addEventListener(DISMISS_CHANGE, onChange);
      return () => window.removeEventListener(DISMISS_CHANGE, onChange);
    },
    readDismissed,
    () => true // server: render no banner, avoid a flash before we know
  );
  const dismiss = () => {
    dismissedThisPage = true;
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // private mode etc. — just hide it for this page view
    }
    window.dispatchEvent(new Event(DISMISS_CHANGE));
  };
  return [dismissed, dismiss];
}
