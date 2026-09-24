"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// A thin bar at the top of the screen while a page change is in flight — the
// App Router's stand-in for the Pages Router's routeChangeStart/Complete
// events, which it doesn't have. It starts on a click on an internal link (or
// a form marked data-navigates, or startNavigationProgress() before a
// router.push) and finishes when the URL changes: without a loading.tsx the
// router keeps the old page up until the new one is ready and only then
// updates the URL, so that's exactly "navigation complete". Driven
// imperatively through a ref — no React state per animation frame.

const SHOW_DELAY = 150; // fast navigations never show the bar
const TRICKLE_EVERY = 350;
const GIVE_UP_AFTER = 15000;

let startFromOutside: (() => void) | null = null;

/** Call right before a programmatic router.push to another page. */
export function startNavigationProgress() {
  startFromOutside?.();
}

function isInternalNavigation(a: HTMLAnchorElement, e: MouseEvent): boolean {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  if (a.target && a.target !== "_self") return false;
  if (a.hasAttribute("download")) return false;
  const url = new URL(a.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  // Same page (or just a #hash) — nothing will load.
  return url.pathname !== window.location.pathname || url.search !== window.location.search;
}

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const barRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const trickle = useRef<ReturnType<typeof setInterval> | null>(null);
  const active = useRef(false);
  const shown = useRef(false);
  const finishRef = useRef<() => void>(() => {});

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    const clear = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      if (trickle.current) clearInterval(trickle.current);
      trickle.current = null;
    };
    const paint = (progress: number, opacity: number, transition: string) => {
      bar.style.transition = transition;
      bar.style.transform = `scaleX(${progress})`;
      bar.style.opacity = String(opacity);
    };

    const start = () => {
      if (active.current) return;
      active.current = true;
      shown.current = false;
      clear();
      paint(0, 0, "none");
      timers.current.push(
        setTimeout(() => {
          shown.current = true;
          let progress = 0.2;
          paint(progress, 1, "transform 0.3s ease, opacity 0.15s ease");
          // Creep towards 90% — never "done" until the page actually changes.
          trickle.current = setInterval(() => {
            progress += (0.9 - progress) * 0.12;
            paint(progress, 1, "transform 0.35s ease");
          }, TRICKLE_EVERY);
        }, SHOW_DELAY),
        setTimeout(() => finish(), GIVE_UP_AFTER)
      );
    };

    const finish = () => {
      if (!active.current) return;
      active.current = false;
      clear();
      if (!shown.current) return paint(0, 0, "none");
      paint(1, 1, "transform 0.2s ease");
      timers.current.push(setTimeout(() => paint(1, 0, "opacity 0.25s ease"), 220));
    };

    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (a instanceof HTMLAnchorElement && isInternalNavigation(a, e)) start();
    };
    const onSubmit = (e: SubmitEvent) => {
      if ((e.target as HTMLElement | null)?.hasAttribute("data-navigates")) start();
    };

    startFromOutside = start;
    finishRef.current = finish;
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      startFromOutside = null;
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      clear();
    };
  }, []);

  // The URL changed: the new page is rendered.
  const search = searchParams.toString();
  useEffect(() => {
    finishRef.current();
  }, [pathname, search]);

  return (
    <div
      ref={barRef}
      aria-hidden
      className="fixed left-0 right-0 z-[70] h-[2.5px] origin-left pointer-events-none bg-accent"
      style={{
        top: "env(safe-area-inset-top, 0px)",
        transform: "scaleX(0)",
        opacity: 0,
        boxShadow: "0 0 10px var(--accent), 0 0 4px var(--accent)",
      }}
    />
  );
}
