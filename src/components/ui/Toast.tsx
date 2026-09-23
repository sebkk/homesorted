"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

interface ToastState {
  message: string;
  undo: (() => void) | null;
}

interface ToastContextValue {
  showToast: (message: string, undo?: () => void) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, undo?: () => void) => {
    setToast({ message, undo: undo ?? null });
    setVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), 4200);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className={`absolute left-5 right-5 bottom-[90px] max-w-[440px] mx-auto bg-[#141a20] text-white text-[12.5px] font-semibold leading-snug px-4 py-3 rounded-xl shadow-glass z-40 flex items-center gap-3 transition-all duration-200 ${
          visible ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none"
        }`}
      >
        <span className="flex-1 min-w-0">{toast?.message}</span>
        {toast?.undo && (
          <button
            type="button"
            className="shrink-0 font-bold text-[12.5px] text-accent"
            onClick={() => {
              toast.undo?.();
              setVisible(false);
            }}
          >
            Cofnij
          </button>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
