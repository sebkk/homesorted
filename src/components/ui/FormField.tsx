"use client";

import type { FieldError, UseFormRegisterReturn } from "react-hook-form";

const inputClass =
  "text-[14.5px] font-medium text-ink bg-surface-2 border rounded-md px-3 py-2.5 outline-none focus:border-accent";

/** A react-hook-form bound input with its label, hint and validation error
 * (announced to screen readers and linked via aria-describedby). */
export function FormField({
  id,
  label,
  type,
  autoComplete,
  placeholder,
  hint,
  error,
  registration,
}: {
  id: string;
  label: string;
  type: string;
  autoComplete: string;
  placeholder?: string;
  hint?: string;
  error?: FieldError;
  registration: UseFormRegisterReturn;
}) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-ink-muted">
        {label}
      </label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={describedBy}
        className={`${inputClass} ${error ? "border-critical" : "border-border"}`}
        {...registration}
      />
      {error ? (
        <span id={`${id}-error`} role="alert" className="text-[11.5px] text-critical leading-snug">
          {error.message}
        </span>
      ) : (
        hint && (
          <span id={`${id}-hint`} className="text-[11px] text-ink-faint leading-snug">
            {hint}
          </span>
        )
      )}
    </div>
  );
}

/** Inline success / error message for a form. */
export function Banner({ tone, children }: { tone: "good" | "critical"; children: React.ReactNode }) {
  const cls = tone === "good" ? "bg-good-soft text-good" : "bg-critical-soft text-critical";
  return (
    <div role={tone === "critical" ? "alert" : "status"} className={`text-[12.5px] leading-relaxed rounded-md px-3 py-2.5 ${cls}`}>
      {children}
    </div>
  );
}

export const primaryButtonClass =
  "font-bold text-[14.5px] text-accent-ink bg-accent rounded-md py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_6px_16px_rgba(42,120,214,0.28)] disabled:opacity-60";
