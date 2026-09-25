"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

// Cloudflare Turnstile for the Supabase Auth calls that accept a CAPTCHA
// token (sign in, sign up, password reset, resend confirmation). Supabase
// verifies the token server-side once "CAPTCHA protection" is enabled in the
// dashboard with the matching secret key.
//
// Off until NEXT_PUBLIC_TURNSTILE_SITE_KEY is set: then no widget renders and
// no token is sent, exactly like before. Enable in this order — site key
// deployed first, Supabase protection second — or sign-ins would fail.

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface Turnstile {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let scriptPromise: Promise<Turnstile> | null = null;

function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile missing")));
    script.onerror = () => {
      scriptPromise = null; // allow a retry on the next form
      reject(new Error("turnstile failed to load"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * One Turnstile widget for one form. Render `widget` inside the form, send
 * `captchaOptions` with the Supabase call, then call `reset()` — a token can
 * be used only once. `ready` is false while a token is still being obtained.
 */
export function useCaptcha() {
  const locale = useLocale();
  const t = useTranslations("captcha");
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  // The check couldn't run (script blocked, offline, Cloudflare error) —
  // without a message the submit button would just sit at "Verifying…".
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !containerRef.current) return;
        widgetId.current = turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          theme: "dark",
          language: locale,
          size: "flexible",
          // Invisible unless Cloudflare decides a human check is needed.
          appearance: "interaction-only",
          callback: (value: string) => {
            setToken(value);
            setFailed(false);
          },
          "expired-callback": () => setToken(null),
          "error-callback": () => {
            setToken(null);
            setFailed(true);
          },
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [locale]);

  const reset = useCallback(() => {
    if (!SITE_KEY) return;
    setToken(null);
    if (widgetId.current) window.turnstile?.reset(widgetId.current);
  }, []);

  return {
    enabled: !!SITE_KEY,
    ready: !SITE_KEY || token !== null,
    /** Spread into the Supabase auth call's `options`. */
    captchaOptions: SITE_KEY && token ? { captchaToken: token } : {},
    reset,
    widget: SITE_KEY ? (
      <>
        <div ref={containerRef} className="empty:hidden" />
        {failed && (
          <p role="alert" className="text-[12px] text-critical leading-relaxed">
            {t("failed")}
          </p>
        )}
      </>
    ) : null,
  };
}

/** Supabase's error when the token is missing, expired or rejected. */
export function isCaptchaError(message: string) {
  return message.toLowerCase().includes("captcha");
}
