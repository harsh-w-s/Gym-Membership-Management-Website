-- Phase 1A: package catalogue, membership history and a payments ledger.
--
-- Money model:
--   memberships = every period a client bought (renewals add rows)
--   payments    = every time money came in (never overwritten)
--   clients.package_fee / amount_paid / expiry_date / package_name become
--   cached totals, kept in sync by triggers so existing pages keep working.
--
-- Safe to re-run: every create/insert is guarded.

------------------------------------------------------------------------------
-- Tables
------------------------------------------------------------------------------

create table if not exists public.packages (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (length(trim(name)) > 0),
  duration_months  smallint not null check (duration_months between 1 and 36),
  price            numeric(10,2) not null default 0 check (price >= 0),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);
create unique index if not exists packages_name_key on public.packages (lower(name));

create table if not exists public.memberships (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  -- Kept even if the package is later deleted or renamed.
  package_id    uuid references public.packages(id) on delete set null,
  package_name  text not null check (length(trim(package_name)) > 0),
  start_date    date not null,
  end_date      date not null,
  fee           numeric(10,2) not null default 0 check (fee >= 0),
  created_at    timestamptz not null default now(),
  check (end_date >= start_date)
);
create index if not exists memberships_client_idx on public.memberships (client_id, end_date desc);
create index if not exists memberships_end_date_idx on public.memberships (end_date);

create table if not exists public.payments (
  id             uuid primary key default gen_random_uuid(),
  -- SET NULL (not CASCADE): deleting a client must never delete revenue
  -- history. client_name is a snapshot so the record still makes sense.
  client_id      uuid references public.clients(id) on delete set null,
  client_name    text not null,
  membership_id  uuid references public.memberships(id) on delete set null,
  amount         numeric(10,2) not null check (amount > 0),
  paid_on        date not null default current_date,
  method         text not null check (method in ('cash', 'upi', 'card', 'bank', 'other')),
  received_by    text, -- "Owner" or a trainer's name
  note           text,
  created_at     timestamptz not null default now()
);
create index if not exists payments_client_idx on public.payments (client_id, paid_on desc);
create index if not exists payments_paid_on_idx on public.payments (paid_on);

-- Same lock-down as the other tables: no policies, server (service role) only.
alter table public.packages    enable row level security;
alter table public.memberships enable row level security;
alter table public.payments    enable row level security;

------------------------------------------------------------------------------
-- Backfill from existing data (only rows not yet converted)
------------------------------------------------------------------------------

-- Packages: one per distinct package name already used, with a guessed
-- duration and the most common fee. The owner can correct them in Settings.
insert into public.packages (name, duration_months, price)
select
  min(trim(c.package_name) collate "C"), -- "Monthly" wins over "monthly"
  case
    when lower(trim(c.package_name)) ~* 'half|6 ?month'         then 6
    when lower(trim(c.package_name)) ~* 'annual|year|12 ?month' then 12
    when lower(trim(c.package_name)) ~* 'quarter|3 ?month'      then 3
    else 1
  end,
  mode() within group (order by c.package_fee)
from public.clients c
group by lower(trim(c.package_name))
on conflict do nothing;

-- Memberships: each existing client gets one period, joining date -> expiry.
insert into public.memberships (client_id, package_id, package_name, start_date, end_date, fee)
select
  c.id,
  p.id,
  c.package_name,
  least(c.joined_on, c.expiry_date),
  c.expiry_date,
  c.package_fee
from public.clients c
left join public.packages p on lower(p.name) = lower(trim(c.package_name))
where not exists (select 1 from public.memberships m where m.client_id = c.id);

-- Payments: the old single "amount paid" becomes one opening-balance entry.
insert into public.payments (client_id, client_name, membership_id, amount, paid_on, method, note)
select
  c.id,
  c.name,
  (select m.id from public.memberships m where m.client_id = c.id order by m.end_date desc limit 1),
  c.amount_paid,
  c.joined_on,
  'other',
  'Imported opening balance'
from public.clients c
where c.amount_paid > 0
  and not exists (select 1 from public.payments pay where pay.client_id = c.id);

------------------------------------------------------------------------------
-- Keep the cached totals on clients in sync
------------------------------------------------------------------------------

create or replace function public.refresh_client_totals(p_client_id uuid)
returns void
language sql
set search_path = public
as $$
  update public.clients c set
    package_fee  = coalesce((select sum(m.fee) from public.memberships m where m.client_id = c.id), 0),
    amount_paid  = coalesce((select sum(p.amount) from public.payments p where p.client_id = c.id), 0),
    expiry_date  = coalesce((select max(m.end_date) from public.memberships m where m.client_id = c.id), c.expiry_date),
    package_name = coalesce(
      (select m.package_name from public.memberships m where m.client_id = c.id
        order by m.end_date desc, m.created_at desc limit 1),
      c.package_name)
  where c.id = p_client_id;
$$;

create or replace function public.trg_refresh_client_totals()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.client_id is not null then
    perform public.refresh_client_totals(old.client_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.client_id is not null
     and (tg_op = 'INSERT' or new.client_id is distinct from old.client_id) then
    perform public.refresh_client_totals(new.client_id);
  end if;
  return null;
end;
$$;

drop trigger if exists memberships_refresh_client on public.memberships;
create trigger memberships_refresh_client
  after insert or update or delete on public.memberships
  for each row execute function public.trg_refresh_client_totals();

drop trigger if exists payments_refresh_client on public.payments;
create trigger payments_refresh_client
  after insert or update or delete on public.payments
  for each row execute function public.trg_refresh_client_totals();

-- Fill the client_name snapshot automatically.
create or replace function public.trg_payment_client_name()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.client_id is not null and (new.client_name is null or new.client_name = '') then
    select c.name into new.client_name from public.clients c where c.id = new.client_id;
  end if;
  return new;
end;
$$;

drop trigger if exists payments_client_name on public.payments;
create trigger payments_client_name
  before insert on public.payments
  for each row execute function public.trg_payment_client_name();

------------------------------------------------------------------------------
-- Atomic multi-step operations (called from Server Actions via .rpc())
-- One function call = one transaction: no half-created clients.
------------------------------------------------------------------------------

create or replace function public.create_client_with_membership(
  p_name text, p_phone text, p_age smallint, p_blood_group text, p_trainer_id uuid,
  p_joined_on date,
  p_package_id uuid, p_package_name text, p_end_date date, p_fee numeric,
  p_paid_amount numeric, p_paid_on date, p_method text, p_received_by text
) returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_client_id uuid;
  v_membership_id uuid;
begin
  insert into public.clients
    (name, phone, age, blood_group, trainer_id, joined_on, package_name, expiry_date, package_fee, amount_paid)
  values
    (p_name, p_phone, p_age, p_blood_group, p_trainer_id, p_joined_on, p_package_name, p_end_date, 0, 0)
  returning id into v_client_id;

  insert into public.memberships (client_id, package_id, package_name, start_date, end_date, fee)
  values (v_client_id, p_package_id, p_package_name, p_joined_on, p_end_date, coalesce(p_fee, 0))
  returning id into v_membership_id;

  if coalesce(p_paid_amount, 0) > 0 then
    insert into public.payments (client_id, client_name, membership_id, amount, paid_on, method, received_by)
    values (v_client_id, p_name, v_membership_id, p_paid_amount, p_paid_on, p_method, p_received_by);
  end if;

  return v_client_id;
end;
$$;

create or replace function public.renew_membership(
  p_client_id uuid,
  p_package_id uuid, p_package_name text, p_start_date date, p_end_date date, p_fee numeric,
  p_paid_amount numeric, p_paid_on date, p_method text, p_received_by text, p_note text
) returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_membership_id uuid;
begin
  insert into public.memberships (client_id, package_id, package_name, start_date, end_date, fee)
  values (p_client_id, p_package_id, p_package_name, p_start_date, p_end_date, coalesce(p_fee, 0))
  returning id into v_membership_id;

  if coalesce(p_paid_amount, 0) > 0 then
    insert into public.payments (client_id, client_name, membership_id, amount, paid_on, method, received_by, note)
    values (p_client_id, '', v_membership_id, p_paid_amount, p_paid_on, p_method, p_received_by, nullif(p_note, ''));
  end if;

  return v_membership_id;
end;
$$;

-- Only the server (service role) may call these; never the public anon key.
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke execute on function public.refresh_client_totals(uuid) from %I', r);
      execute format('revoke execute on function public.create_client_with_membership(text, text, smallint, text, uuid, date, uuid, text, date, numeric, numeric, date, text, text) from %I', r);
      execute format('revoke execute on function public.renew_membership(uuid, uuid, text, date, date, numeric, numeric, date, text, text, text) from %I', r);
    end if;
  end loop;
end $$;
revoke execute on function public.refresh_client_totals(uuid) from public;
revoke execute on function public.create_client_with_membership(text, text, smallint, text, uuid, date, uuid, text, date, numeric, numeric, date, text, text) from public;
revoke execute on function public.renew_membership(uuid, uuid, text, date, date, numeric, numeric, date, text, text, text) from public;
