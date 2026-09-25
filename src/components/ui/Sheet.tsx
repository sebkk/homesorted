"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function Sheet({ open, onClose, children }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useSwipeToClose(panelRef, open, onClose);

  return (
    <div
      className={`absolute inset-0 z-30 flex items-end bg-[rgba(10,13,16,0.32)] backdrop-blur-md transition-opacity duration-200 ${
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className={`w-full max-h-[88%] bg-sheet-bg glass border border-border border-b-0 rounded-t-2xl px-5 pt-4 shadow-glass flex flex-col gap-3 overflow-y-auto transition-transform duration-200 [&_input]:bg-sheet-field-bg [&_select]:bg-sheet-field-bg ${
          open ? "translate-y-0" : "translate-y-4"
        }`}
        style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab handle: hints on touch screens that the sheet can be swiped down. */}
        <div aria-hidden className="hidden [@media(pointer:coarse)]:block shrink-0 self-center w-9 h-1 -mt-2 -mb-1 rounded-full bg-ink-faint opacity-50" />
        {children}
      </div>
    </div>
  );
}

// Released past this pull (px, capped at a share of short sheets' height) or
// flicked down faster than this (px/ms), the sheet closes.
const CLOSE_DISTANCE = 120;
const CLOSE_VELOCITY = 0.5;

/** Swipe down to close: a downward pull that starts with the content
 * scrolled to the top drags the panel; anything else scrolls as usual. */
function useSwipeToClose(panelRef: React.RefObject<HTMLDivElement | null>, open: boolean, onClose: () => void) {
  const latest = useRef({ open, onClose });
  useEffect(() => {
    latest.current = { open, onClose };
  });

  // A swipe leaves the panel off-screen; reopening slides it back in.
  useEffect(() => {
    if (open && panelRef.current) panelRef.current.style.transform = "";
  }, [open, panelRef]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    // "pending" until the first move shows the direction.
    let mode: "idle" | "pending" | "drag" = "idle";
    let startX = 0, startY = 0, lastY = 0, lastT = 0, velocity = 0, offset = 0;
    let snapBack: ReturnType<typeof setTimeout> | undefined;

    const moveTo = (y: number | "100%", animate: boolean) => {
      panel.style.transition = animate ? "" : "none";
      panel.style.transform = y === 0 ? "" : `translateY(${typeof y === "number" ? `${y}px` : y})`;
    };

    function onStart(e: TouchEvent) {
      const t = e.touches[0];
      mode = e.touches.length === 1 && !scrolledDown(e.target as Node, panel!) ? "pending" : "idle";
      startX = t.clientX;
      startY = lastY = t.clientY;
      lastT = e.timeStamp;
      velocity = offset = 0;
    }

    function onMove(e: TouchEvent) {
      if (mode === "idle") return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (mode === "pending") {
        if (dx === 0 && dy === 0) return;
        if (dy <= 0 || Math.abs(dx) > dy) {
          mode = "idle";
          return;
        }
        mode = "drag";
      }
      if (e.cancelable) e.preventDefault(); // no content scroll or overscroll bounce under the finger
      if (e.timeStamp > lastT) velocity = (t.clientY - lastY) / (e.timeStamp - lastT);
      lastY = t.clientY;
      lastT = e.timeStamp;
      offset = Math.max(0, dy);
      moveTo(offset, false);
    }

    function onEnd(e: TouchEvent) {
      if (mode !== "drag") {
        mode = "idle";
        return;
      }
      mode = "idle";
      const threshold = Math.min(CLOSE_DISTANCE, panel!.offsetHeight * 0.35);
      const close =
        e.type === "touchend" && (velocity > CLOSE_VELOCITY || (offset > threshold && velocity > -CLOSE_VELOCITY));
      if (!close) {
        moveTo(0, true);
        return;
      }
      moveTo("100%", true);
      latest.current.onClose();
      // Some sheets refuse to close mid-flow (EncryptionSetup's recovery step): slide back in.
      clearTimeout(snapBack);
      snapBack = setTimeout(() => {
        if (latest.current.open) moveTo(0, true);
      }, 250);
    }

    panel.addEventListener("touchstart", onStart, { passive: true });
    panel.addEventListener("touchmove", onMove, { passive: false });
    panel.addEventListener("touchend", onEnd);
    panel.addEventListener("touchcancel", onEnd);
    return () => {
      clearTimeout(snapBack);
      panel.removeEventListener("touchstart", onStart);
      panel.removeEventListener("touchmove", onMove);
      panel.removeEventListener("touchend", onEnd);
      panel.removeEventListener("touchcancel", onEnd);
    };
  }, [panelRef]);
}

/** Whether anything between the touch target and the panel is scrolled away
 * from its top — then a downward pull should scroll it back, not drag. */
function scrolledDown(target: Node, panel: HTMLElement) {
  for (let el: Node | null = target; el; el = el.parentNode) {
    if (el instanceof HTMLElement && el.scrollTop > 0) return true;
    if (el === panel) break;
  }
  return false;
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
