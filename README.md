# HomeSorted

Next.js 14 (App Router) + TypeScript + Tailwind CSS + Supabase rewrite of the
"Moje sprawy" prototype. The "liquid glass" design tokens (colors, blur,
radii, shadows) are ported 1:1 from the prototype into `src/app/globals.css`
and `tailwind.config.ts`, so the app should look identical to the approved
prototype design.

## Why this needs a look before you trust it

This was scaffolded in a sandboxed environment with **no access to the npm
registry** — I could not run `npm install`, `next build`, or `next dev` here,
so nothing has actually been executed. I did run the TypeScript compiler in a
type-declarations-free mode to catch outright syntax errors (none found), but
that's a much weaker guarantee than a real build. Treat this as a solid first
draft, not verified working code — please run through setup below and report
back anything that breaks so I can fix it.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create a Supabase project** at [supabase.com](https://supabase.com) (free tier is enough to start).

3. **Run the schema** — open your project's SQL Editor and run the contents
   of `supabase/schema.sql`. This creates `zones`, `incomes`, `expenses`,
   `recurring_expenses`, `savings_state`, `savings_entries`, all with
   row-level security scoped to the owning user.

4. **Environment variables** — copy `.env.local.example` to `.env.local` and
   fill in your Supabase project URL + anon key (Project Settings → API).
   ```bash
   cp .env.local.example .env.local
   ```

5. **Email confirmation** — by default Supabase requires email confirmation
   before a new account can sign in. For local development, turn this off
   under Authentication → Providers → Email → "Confirm email" (uncheck it),
   or set up an email provider if you want confirmation emails to actually
   work in production.

6. **Run it**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000 — you should land on `/login`.

7. **Deploy** — push to GitHub, import the repo in Vercel, add the same two
   env vars in Vercel's project settings, deploy.

## What's implemented

- Email/password auth via Supabase (`src/app/login`), with a combined
  sign-in-or-create-account flow matching the prototype.
- Zones: create, list, pin to the launcher (`src/app/(app)/zones`).
- Launcher/pulpit with pinned zones + module grid (`src/app/(app)/launcher`).
- Finance module (`src/app/(app)/finance/[zoneId]`) with the four tabs from
  the prototype: dashboard (hero balance, stat tiles, chart, recent
  transactions), incomes, expenses, savings.
- Recurring expenses with the two mechanisms from the prototype:
  `skip_months` (one-off exception, template stays active) and `end_month`
  (forward-only cutoff — historical months keep their totals). Business logic
  in `src/lib/finance.ts` is a straight port of the prototype's JS.
- Toast with undo, matching the prototype's pattern, for every delete/disable
  action.
- PWA basics: `public/manifest.json`, a minimal app-shell service worker
  (`public/sw.js`), and icons generated from the prototype's brand mark.

## What's *not* done yet / worth reviewing

- **Sync strategy is "poll on load"** as agreed — each page fetches once on
  mount via `useZoneData`. No realtime subscriptions. If you want the
  telephone/computer sync to feel instant, Supabase Realtime is a natural
  next step (the schema doesn't need to change for it).
- **No editing** of existing incomes/expenses/savings entries — only
  add/delete, matching the prototype. Add an edit sheet if you want that.
- **Zones page** (`/zones`) is new — the prototype didn't have a dedicated
  screen for it under this name, I inferred it from the "strefy" concept
  already in the data model. Sanity-check the flow.
- **No dark-mode toggle UI** yet — the CSS variables support it
  (`prefers-color-scheme` + a `data-theme` override), but there's no button
  to force it like the prototype's theme-note button implied.
- I have not run `next build`/`tsc` in this environment — please run
  `npm run build` locally and send me any errors.

## Project structure

```
src/
  app/
    globals.css          — design tokens (ported from prototype)
    layout.tsx            — shell, fonts, PWA registration, ToastProvider
    page.tsx               — redirects to /login or /launcher
    login/                  — auth screen
    (app)/                  — everything behind auth
      layout.tsx            — auth guard
      launcher/               — pulpit
      zones/                  — zone list / create / pin
      finance/[zoneId]/        — finance module entry point
  components/
    ui/                      — Toast, Sheet, Fab (generic)
    finance/                 — tabs, chart, sheets, tabbar (finance-specific)
  lib/
    types.ts                  — data model
    finance.ts                 — pure business logic (totals, recurring, chart data)
    useZoneData.ts               — client data-fetching + mutation hook
    actions.ts                    — server actions (auth, zones)
    supabase/                      — browser/server/middleware Supabase clients
supabase/
  schema.sql                       — run this in the Supabase SQL editor
```
