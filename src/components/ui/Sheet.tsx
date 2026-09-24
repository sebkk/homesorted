"use client";

import { useTranslations } from "next-intl";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function Sheet({ open, onClose, children }: SheetProps) {
  return (
    <div
      className={`absolute inset-0 z-30 flex items-end bg-[rgba(10,13,16,0.32)] backdrop-blur-md transition-opacity duration-200 ${
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
      onClick={onClose}
    >
      <div
        className={`w-full max-h-[88%] bg-sheet-bg glass border border-border border-b-0 rounded-t-2xl px-5 pt-4 shadow-glass flex flex-col gap-3 overflow-y-auto transition-transform duration-200 [&_input]:bg-sheet-field-bg [&_select]:bg-sheet-field-bg ${
          open ? "translate-y-0" : "translate-y-4"
        }`}
        style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))" }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  const t = useTranslations("common");
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-base font-semibold">{title}</h3>
      <button
        type="button"
        aria-label={t("close")}
        onClick={onClose}
        className="w-[30px] h-[30px] rounded-md border-none bg-surface-2 text-ink-muted flex items-center justify-center"
      >
        ✕
      </button>
    </div>
  );
}

/** Label + control + hint. A validation `error` replaces the hint and gets
 * id `${htmlFor}-error` — point the control's aria-describedby at it
 * (see fieldAria). */
export function Field({
  label,
  hint,
  htmlFor,
  error,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-muted" htmlFor={htmlFor}>
      <span>{label}</span>
      {children}
      {error ? (
        <span id={`${htmlFor}-error`} role="alert" className="text-[11.5px] font-normal text-critical leading-snug">
          {error}
        </span>
      ) : (
        hint && <span className="text-[11px] font-normal text-ink-faint leading-snug">{hint}</span>
      )}
    </label>
  );
}

/** aria attributes linking an invalid control to its Field error. */
export function fieldAria(id: string, error?: { message?: string }) {
  return error ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : {};
}
