import type { Config } from "tailwindcss";

// Design tokens ported 1:1 from the prototype (prototype.html) so the
// Next.js app matches the "liquid glass" look already approved by the user.
const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "var(--font-ibm-plex)",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
      },
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)",
        "sheet-bg": "var(--sheet-bg)",
        "sheet-field-bg": "var(--sheet-field-bg)",
        "nav-bg": "var(--nav-bg)",
        "fab-bg": "var(--fab-bg)",
        ink: "var(--ink)",
        "ink-muted": "var(--ink-muted)",
        "ink-faint": "var(--ink-faint)",
        accent: "var(--accent)",
        "accent-ink": "var(--accent-ink)",
        "accent-soft": "var(--accent-soft)",
        good: "var(--good)",
        "good-soft": "var(--good-soft)",
        critical: "var(--critical)",
        "critical-soft": "var(--critical-soft)",
        warning: "var(--warning)",
        border: "var(--border)",
        cat1: "var(--cat1)",
        cat2: "var(--cat2)",
        cat3: "var(--cat3)",
        cat4: "var(--cat4)",
        cat5: "var(--cat5)",
        cat6: "var(--cat6)",
        cat7: "var(--cat7)",
        cat8: "var(--cat8)",
        "cat1-soft": "var(--cat1-soft)",
        "cat2-soft": "var(--cat2-soft)",
        "cat3-soft": "var(--cat3-soft)",
        "cat4-soft": "var(--cat4-soft)",
        "cat5-soft": "var(--cat5-soft)",
        "cat6-soft": "var(--cat6-soft)",
        "cat7-soft": "var(--cat7-soft)",
        "cat8-soft": "var(--cat8-soft)",
      },
      borderRadius: {
        sm: "8px",
        md: "10px",
        lg: "12px",
        xl: "14px",
        "2xl": "16px",
      },
      boxShadow: {
        glass: "var(--shadow)",
      },
      backdropBlur: {
        glass: "22px",
      },
    },
  },
  plugins: [],
};

export default config;
