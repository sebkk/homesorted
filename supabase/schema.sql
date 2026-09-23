-- HomeSorted — Supabase schema
-- Run this once in the Supabase SQL editor (Project → SQL Editor → New query).
-- Mirrors the prototype's data model: zones -> incomes / expenses / recurring / savings.

create extension if not exists "pgcrypto";

-- ---------- zones ----------
create table if not exists public.zones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Strefa',
  pinned boolean not null default false,
  color smallint not null default 1 check (color between 1 and 8),
  created_at timestamptz not null default now()
);

-- ---------- incomes ----------
create table if not exists public.incomes (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.zones(id) on delete cascade,
  month text not null, -- 'YYYY-MM'
  type text not null default 'b2b' check (type in ('b2b','uop','uz','uod','inne')),
  hours numeric not null default 0,
  amount numeric not null default 0,
  "desc" text not null default '',
  icon text, -- overrides INCOME_TYPE_ICONS[type] (app-side) when set
  created_at timestamptz not null default now()
);

-- ---------- expense categories ----------
-- Global, shared across all users — managed here / via SQL editor, not per-zone.
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text not null default '💳',
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

insert into public.categories (name, icon, sort_order) values
  ('ZUS', '🏛️', 1),
  ('Podatek', '💰', 2),
  ('VAT', '🧾', 3),
  ('Mieszkanie/czynsz', '🏠', 4),
  ('Kredyt', '🏦', 5),
  ('Rachunki (prąd, internet)', '💡', 6),
  ('Jedzenie', '🍔', 7),
  ('Transport/paliwo', '⛽', 8),
  ('Sprzęt/oprogramowanie', '💻', 9),
  ('Księgowość', '📊', 10),
  ('Ubezpieczenie', '🛡️', 11),
  ('Abonamenty', '📺', 12),
  ('Rozwój/szkolenia', '📚', 13),
  ('Zdrowie', '🩺', 14),
  ('Rozrywka', '🎮', 15),
  ('Inne', '📦', 16)
on conflict (name) do nothing;

-- ---------- one-off expenses ----------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.zones(id) on delete cascade,
  date date not null,
  category text not null,
  "desc" text not null default '',
  amount numeric not null default 0,
  icon text, -- overrides the category's default icon when set
  created_at timestamptz not null default now()
);

-- ---------- recurring expense templates ----------
-- end_month is a forward-only cutoff: occurrences for months >= end_month are
-- excluded, but earlier months keep their historical totals unchanged.
-- skip_months holds one-off exceptions (a single month skipped, template stays active).
create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.zones(id) on delete cascade,
  category text not null,
  "desc" text not null default '',
  amount numeric not null default 0,
  day_of_month smallint not null default 1 check (day_of_month between 1 and 31),
  start_month text not null,
  end_month text,
  skip_months text[] not null default '{}',
  icon text, -- overrides the category's default icon when set
  created_at timestamptz not null default now()
);

-- ---------- savings ----------
create table if not exists public.savings_state (
  zone_id uuid primary key references public.zones(id) on delete cascade,
  initial numeric not null default 0
);

create table if not exists public.savings_entries (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.zones(id) on delete cascade,
  date date not null,
  "desc" text not null default '',
  amount numeric not null default 0, -- negative = withdrawal
  created_at timestamptz not null default now()
);

-- ---------- indexes ----------
create index if not exists idx_zones_user on public.zones(user_id);
create index if not exists idx_incomes_zone on public.incomes(zone_id);
create index if not exists idx_expenses_zone on public.expenses(zone_id);
create index if not exists idx_recurring_zone on public.recurring_expenses(zone_id);
create index if not exists idx_savings_entries_zone on public.savings_entries(zone_id);

-- ---------- row level security ----------
-- Every table is scoped to the owning user via zones.user_id, so a user can
-- only ever read/write their own zones and the records hanging off them.

alter table public.zones enable row level security;
alter table public.categories enable row level security;
alter table public.incomes enable row level security;
alter table public.expenses enable row level security;
alter table public.recurring_expenses enable row level security;
alter table public.savings_state enable row level security;
alter table public.savings_entries enable row level security;

create policy "zones: owner full access" on public.zones
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "categories: read for authenticated" on public.categories
  for select to authenticated using (true);

create policy "incomes: owner full access" on public.incomes
  for all using (exists (select 1 from public.zones z where z.id = zone_id and z.user_id = auth.uid()))
  with check (exists (select 1 from public.zones z where z.id = zone_id and z.user_id = auth.uid()));

create policy "expenses: owner full access" on public.expenses
  for all using (exists (select 1 from public.zones z where z.id = zone_id and z.user_id = auth.uid()))
  with check (exists (select 1 from public.zones z where z.id = zone_id and z.user_id = auth.uid()));

create policy "recurring: owner full access" on public.recurring_expenses
  for all using (exists (select 1 from public.zones z where z.id = zone_id and z.user_id = auth.uid()))
  with check (exists (select 1 from public.zones z where z.id = zone_id and z.user_id = auth.uid()));

create policy "savings_state: owner full access" on public.savings_state
  for all using (exists (select 1 from public.zones z where z.id = zone_id and z.user_id = auth.uid()))
  with check (exists (select 1 from public.zones z where z.id = zone_id and z.user_id = auth.uid()));

create policy "savings_entries: owner full access" on public.savings_entries
  for all using (exists (select 1 from public.zones z where z.id = zone_id and z.user_id = auth.uid()))
  with check (exists (select 1 from public.zones z where z.id = zone_id and z.user_id = auth.uid()));
