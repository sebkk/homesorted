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
  -- default currency: every sum in the zone is shown in it (chosen at creation)
  currency text not null default 'PLN' check (currency ~ '^[A-Z]{3}$'),
  -- the zone's "month": the day it starts on (1 = calendar month; capped at 28
  -- so every month has it) and whether a period spanning two calendar months
  -- is named after the month it starts in or ends in (src/lib/finance.ts periodOf)
  month_start_day smallint not null default 1 check (month_start_day between 1 and 28),
  month_label text not null default 'start' check (month_label in ('start', 'end')),
  created_at timestamptz not null default now()
);

-- ---------- incomes ----------
-- amount/hours/"desc" are `text`, not `numeric`: once a user enables
-- client-side encryption (src/lib/crypto.ts) they hold an opaque ciphertext
-- blob instead of a plain value. isEncrypted() tells the two apart, so rows
-- from before encryption was enabled keep working untouched.
create table if not exists public.incomes (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.zones(id) on delete cascade,
  month text not null, -- 'YYYY-MM'
  invoice_date date not null, -- drives the NBP rate date
  type text not null default 'b2b' check (type in ('b2b','uop','uz','uod','inne')),
  hours text not null default '0',
  amount text not null default '0',
  "desc" text not null default '',
  icon text, -- overrides INCOME_TYPE_ICONS[type] (app-side) when set
  -- amount is always NET; gross = amount * (1 + vat_rate). Totals use net.
  vat_rate numeric not null default 0 check (vat_rate >= 0 and vat_rate < 1),
  created_at timestamptz not null default now()
);

-- ---------- expense categories ----------
-- Global, shared across all users — managed here / via SQL editor, not per-zone.
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  key text not null unique, -- stable identifier and translation key
  name text not null unique, -- default (Polish) label
  -- special meaning used by calculations; at most one category per role
  role text check (role in ('zus', 'income_tax', 'vat')),
  icon text not null default '💳',
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists categories_role_unique on public.categories (role) where role is not null;

insert into public.categories (key, name, role, icon, sort_order) values
  ('zus', 'ZUS', 'zus', '🏛️', 1),
  ('income_tax', 'Podatek', 'income_tax', '💰', 2),
  ('vat', 'VAT', 'vat', '🧾', 3),
  ('housing', 'Mieszkanie/czynsz', null, '🏠', 4),
  ('loan', 'Kredyt', null, '🏦', 5),
  ('utilities', 'Rachunki (prąd, internet)', null, '💡', 6),
  ('food', 'Jedzenie', null, '🍔', 7),
  ('transport', 'Transport/paliwo', null, '⛽', 8),
  ('equipment', 'Sprzęt/oprogramowanie', null, '💻', 9),
  ('accounting', 'Księgowość', null, '📊', 10),
  ('insurance', 'Ubezpieczenie', null, '🛡️', 11),
  ('subscriptions', 'Abonamenty', null, '📺', 12),
  ('education', 'Rozwój/szkolenia', null, '📚', 13),
  ('health', 'Zdrowie', null, '🩺', 14),
  ('entertainment', 'Rozrywka', null, '🎮', 15),
  ('vacation', 'Urlop/wakacje', null, '🏖️', 16),
  ('other', 'Inne', null, '📦', 17)
on conflict (key) do nothing;

-- ---------- one-off expenses ----------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.zones(id) on delete cascade,
  date date not null,
  category_id uuid not null references public.categories(id),
  "desc" text not null default '',
  amount text not null default '0', -- ciphertext once encryption is enabled, see incomes above
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
  category_id uuid not null references public.categories(id),
  "desc" text not null default '',
  amount text not null default '0', -- ciphertext once encryption is enabled, see incomes above
  day_of_month smallint not null default 1 check (day_of_month between 1 and 31),
  start_month text not null,
  end_month text,
  skip_months text[] not null default '{}',
  icon text, -- overrides the category's default icon when set
  created_at timestamptz not null default now()
);

-- ---------- recurring income templates ----------
-- Same semantics as recurring_expenses: end_month is an exclusive, forward-only
-- cutoff; skip_months are one-off exceptions.
create table if not exists public.recurring_incomes (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.zones(id) on delete cascade,
  type text not null default 'b2b' check (type in ('b2b','uop','uz','uod','inne')),
  hours text not null default '0', -- ciphertext once encryption is enabled, see incomes above
  amount text not null default '0',
  "desc" text not null default '',
  icon text,
  vat_rate numeric not null default 0 check (vat_rate >= 0 and vat_rate < 1), -- amount is net
  start_month text not null,
  end_month text,
  skip_months text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------- savings ----------
create table if not exists public.savings_state (
  zone_id uuid primary key references public.zones(id) on delete cascade,
  initial text not null default '0' -- ciphertext once encryption is enabled, see incomes above
);

create table if not exists public.savings_entries (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.zones(id) on delete cascade,
  date date not null,
  "desc" text not null default '',
  amount text not null default '0', -- negative = withdrawal; ciphertext once encryption is enabled
  created_at timestamptz not null default now()
);

-- ---------- monthly budgets ----------
-- One monthly limit per category per zone; applies to every month. The
-- `amount > 0` invariant is enforced client-side once this holds ciphertext.
create table if not exists public.category_budgets (
  zone_id uuid not null references public.zones(id) on delete cascade,
  category_id uuid not null references public.categories(id),
  amount text not null, -- ciphertext once encryption is enabled, see incomes above
  created_at timestamptz not null default now(),
  primary key (zone_id, category_id)
);

-- ---------- indexes ----------
create index if not exists idx_zones_user on public.zones(user_id);
create index if not exists idx_incomes_zone on public.incomes(zone_id);
create index if not exists idx_expenses_zone on public.expenses(zone_id);
create index if not exists idx_expenses_category on public.expenses(category_id);
create index if not exists idx_recurring_category on public.recurring_expenses(category_id);
create index if not exists idx_category_budgets_category on public.category_budgets(category_id);
create index if not exists idx_recurring_zone on public.recurring_expenses(zone_id);
create index if not exists idx_recurring_incomes_zone on public.recurring_incomes(zone_id);
create index if not exists idx_savings_entries_zone on public.savings_entries(zone_id);

-- ---------- row level security ----------
-- Every table is scoped to the owning user via zones.user_id, so a user can
-- only ever read/write their own zones and the records hanging off them.

alter table public.zones enable row level security;
alter table public.categories enable row level security;
alter table public.incomes enable row level security;
alter table public.expenses enable row level security;
alter table public.recurring_expenses enable row level security;
alter table public.recurring_incomes enable row level security;
alter table public.savings_state enable row level security;
alter table public.savings_entries enable row level security;
alter table public.category_budgets enable row level security;

-- (select auth.uid()) is evaluated once per query instead of once per row.
create policy "zones: owner full access" on public.zones
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "categories: read for authenticated" on public.categories
  for select to authenticated using (true);

create policy "incomes: owner full access" on public.incomes
  for all to authenticated
  using (exists (select 1 from public.zones z where z.id = zone_id and z.user_id = (select auth.uid())))
  with check (exists (select 1 from public.zones z where z.id = zone_id and z.user_id = (select auth.uid())));

create policy "expenses: owner full access" on public.expenses
  for all to authenticated
  using (exists (select 1 from public.zones z where z.id = zone_id and z.user_id = (select auth.uid())))
  with check (exists (select 1 from public.zones z where z.id = zone_id and z.user_id = (select auth.uid())));

create policy "recurring: owner full access" on public.recurring_expenses
  for all to authenticated
  using (exists (select 1 from public.zones z where z.id = zone_id and z.user_id = (select auth.uid())))
  with check (exists (select 1 from public.zones z where z.id = zone_id and z.user_id = (select auth.uid())));

create policy "savings_state: owner full access" on public.savings_state
  for all to authenticated
  using (exists (select 1 from public.zones z where z.id = zone_id and z.user_id = (select auth.uid())))
  with check (exists (select 1 from public.zones z where z.id = zone_id and z.user_id = (select auth.uid())));

create policy "savings_entries: owner full access" on public.savings_entries
  for all to authenticated
  using (exists (select 1 from public.zones z where z.id = zone_id and z.user_id = (select auth.uid())))
  with check (exists (select 1 from public.zones z where z.id = zone_id and z.user_id = (select auth.uid())));

create policy "category_budgets: owner full access" on public.category_budgets
  for all to authenticated
  using (exists (select 1 from public.zones z where z.id = zone_id and z.user_id = (select auth.uid())))
  with check (exists (select 1 from public.zones z where z.id = zone_id and z.user_id = (select auth.uid())));

create policy "recurring_incomes: owner full access" on public.recurring_incomes
  for all to authenticated
  using (exists (select 1 from public.zones z where z.id = zone_id and z.user_id = (select auth.uid())))
  with check (exists (select 1 from public.zones z where z.id = zone_id and z.user_id = (select auth.uid())));

-- ---------- currencies ----------
-- Every entry keeps its own currency and the NBP rate that converts it into
-- the zone's currency (value in zone currency = amount * fx_rate). The rate
-- comes from the last NBP table published before the entry's date (invoice
-- date for incomes); 1 when the entry is already in the zone's currency.
do $$
declare t text;
begin
  foreach t in array array['incomes', 'expenses', 'recurring_expenses', 'recurring_incomes', 'savings_entries'] loop
    execute format('alter table public.%I add column if not exists currency text not null default ''PLN'' check (currency ~ ''^[A-Z]{3}$'')', t);
    execute format('alter table public.%I add column if not exists fx_rate numeric not null default 1 check (fx_rate > 0)', t);
    execute format('alter table public.%I add column if not exists fx_date date', t);
    execute format('alter table public.%I add column if not exists fx_table text', t);
  end loop;
end $$;

-- ---------- client-side encryption ----------
-- Each user has one random AES-256 data key. It's wrapped (encrypted) twice —
-- once under a key derived from their encryption password, once under a key
-- derived from a one-time recovery code — so it never reaches this table (or
-- any Supabase log/backup) in the clear. See src/lib/crypto.ts for the
-- cryptography and src/components/encryption/ for the setup/unlock UI.
create table if not exists public.user_encryption (
  user_id uuid primary key references auth.users(id) on delete cascade,
  password_wrap text not null,
  recovery_wrap text not null,
  enabled_at timestamptz not null default now()
);

alter table public.user_encryption enable row level security;

create policy "user_encryption: owner full access" on public.user_encryption
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------- zone membership & modules ----------
-- A zone is a container of modules (finance, pantry) that can be shared with
-- other household members. The owner (zones.user_id) always has every module;
-- a member only opens the modules listed in their zone_members row. Finance
-- tables keep their owner-only policies above, so sharing a zone never exposes
-- its (possibly encrypted) finances — that waits for a per-zone key.
alter table public.zones add column if not exists modules text[] not null default '{finance}'
  check (modules <@ array['finance', 'pantry']::text[] and cardinality(modules) > 0);

create table if not exists public.zone_members (
  zone_id uuid not null references public.zones(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  -- modules a member may open; empty for the owner, who has all of them
  modules text[] not null default '{pantry}' check (modules <@ array['finance', 'pantry']::text[]),
  -- per person: everyone pins zones to their own launcher
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (zone_id, user_id)
);

create index if not exists idx_zone_members_user on public.zone_members(user_id);
create unique index if not exists zone_members_one_owner on public.zone_members(zone_id) where role = 'owner';

-- zones.pinned is superseded by zone_members.pinned; kept only until no
-- deployed build reads it, then dropped.
insert into public.zone_members (zone_id, user_id, role, modules, pinned)
select id, user_id, 'owner', '{}', pinned from public.zones
on conflict (zone_id, user_id) do nothing;

-- Not exposed through the API (private schema); callable only from policies.
create schema if not exists private;
grant usage on schema private to authenticated;

-- security definer: zone_members' own select policy calls this, so it must
-- read the table without recursing into that policy.
create or replace function private.is_zone_member(zid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.zone_members m
    where m.zone_id = zid and m.user_id = (select auth.uid())
  );
$$;

revoke execute on function private.is_zone_member(uuid) from public, anon;
grant execute on function private.is_zone_member(uuid) to authenticated;

-- Every new zone gets its owner row, so membership is the single source of
-- "zones I can see" and of per-person pins.
create or replace function private.add_zone_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.zone_members (zone_id, user_id, role, modules, pinned)
  values (new.id, new.user_id, 'owner', '{}', new.pinned)
  on conflict (zone_id, user_id) do nothing;
  return new;
end;
$$;

revoke execute on function private.add_zone_owner() from public, anon, authenticated;

drop trigger if exists zones_add_owner on public.zones;
create trigger zones_add_owner after insert on public.zones
  for each row execute function private.add_zone_owner();

-- zones: members can read (name, color, modules); only the owner changes them.
drop policy if exists "zones: owner full access" on public.zones;
drop policy if exists "zones: members read" on public.zones;
drop policy if exists "zones: owner insert" on public.zones;
drop policy if exists "zones: owner update" on public.zones;
drop policy if exists "zones: owner delete" on public.zones;

create policy "zones: members read" on public.zones
  for select to authenticated
  using ((select auth.uid()) = user_id or private.is_zone_member(id));

create policy "zones: owner insert" on public.zones
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "zones: owner update" on public.zones
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "zones: owner delete" on public.zones
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- zone_members: everyone in a zone sees who else is in it; each person can
-- only flip their own pin. Joining/leaving goes through invite RPCs (pantry
-- sharing stage); the owner row comes from the trigger above.
alter table public.zone_members enable row level security;

drop policy if exists "zone_members: members read" on public.zone_members;
drop policy if exists "zone_members: own pin" on public.zone_members;

create policy "zone_members: members read" on public.zone_members
  for select to authenticated
  using ((select auth.uid()) = user_id or private.is_zone_member(zone_id));

create policy "zone_members: own pin" on public.zone_members
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke insert, update, delete on public.zone_members from anon, authenticated;
grant update (pinned) on public.zone_members to authenticated;
