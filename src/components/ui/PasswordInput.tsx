"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/** A password <input> with a show/hide toggle. Takes every input prop
 * (including a react-hook-form registration and its ref); `type` is managed. */
export function PasswordInput({ className = "", ...props }: Omit<React.ComponentProps<"input">, "type">) {
  const t = useTranslations("common");
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative flex">
      <input {...props} type={visible ? "text" : "password"} className={`${className} w-full pr-11`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t("hidePassword") : t("showPassword")}
        aria-pressed={visible}
        className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-md flex items-center justify-center text-ink-faint hover:text-ink-muted bg-transparent border-none"
      >
        <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {visible && <path d="M4 4l16 16" />}
        </svg>
      </button>
    </div>
  );
}
