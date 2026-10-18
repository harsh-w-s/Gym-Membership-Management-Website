-- Phase 1B: money out (expenses + recurring bills) and finance summaries.
-- Safe to re-run: every create is guarded.

------------------------------------------------------------------------------
-- Recurring bills: rent, internet... entered once, due every month.
-- (Trainer salaries come straight from trainers.salary, no bill needed.)
------------------------------------------------------------------------------
create table if not exists public.recurring_bills (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  category    text not null check (category in
                ('rent','electricity','water','internet','salary','equipment','maintenance','marketing','other')),
  amount      numeric(10,2) not null default 0 check (amount >= 0), -- usual amount; 0 = varies
  due_day     smallint not null default 1 check (due_day between 1 and 28),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

------------------------------------------------------------------------------
-- Expenses: every time money went out.
------------------------------------------------------------------------------
create table if not exists public.expenses (
  id                 uuid primary key default gen_random_uuid(),
  category           text not null check (category in
                       ('rent','electricity','water','internet','salary','equipment','maintenance','marketing','other')),
  description        text,
  amount             numeric(10,2) not null check (amount > 0),
  spent_on           date not null default current_date,
  method             text not null default 'cash' check (method in ('cash','upi','card','bank','other')),
  -- Set when this expense pays a monthly bill / salary, so the checklist
  -- knows it's done. bill_month is always the 1st of that month.
  recurring_bill_id  uuid references public.recurring_bills(id) on delete set null,
  trainer_id         uuid references public.trainers(id) on delete set null,
  bill_month         date check (bill_month is null or extract(day from bill_month) = 1),
  created_at         timestamptz not null default now()
);
create index if not exists expenses_spent_on_idx on public.expenses (spent_on);
create index if not exists expenses_category_idx on public.expenses (category, spent_on);
-- A bill / salary can only be marked paid once per month.
create unique index if not exists expenses_bill_once_per_month
  on public.expenses (recurring_bill_id, bill_month) where recurring_bill_id is not null and bill_month is not null;
create unique index if not exists expenses_salary_once_per_month
  on public.expenses (trainer_id, bill_month) where category = 'salary' and trainer_id is not null and bill_month is not null;

alter table public.recurring_bills enable row level security;
alter table public.expenses        enable row level security;

------------------------------------------------------------------------------
-- Summaries, computed in Postgres (PostgREST caps responses at 1000 rows, so
-- summing rows in the app would silently undercount a busy gym).
------------------------------------------------------------------------------

-- Revenue and expenses per month, for the last p_months months up to p_month.
create or replace function public.finance_monthly(p_month date, p_months int default 6)
returns table (month date, revenue numeric, expenses numeric)
language sql stable
set search_path = public
as $$
  with months as (
    select (date_trunc('month', p_month) - make_interval(months => g))::date as m
    from generate_series(0, greatest(p_months, 1) - 1) g
  )
  select
    m.m,
    coalesce((select sum(p.amount) from payments p
              where p.paid_on >= m.m and p.paid_on < (m.m + interval '1 month')::date), 0),
    coalesce((select sum(e.amount) from expenses e
              where e.spent_on >= m.m and e.spent_on < (m.m + interval '1 month')::date), 0)
  from months m
  order by m.m;
$$;

-- Everything the Money page needs for one period, as a single JSON object.
create or replace function public.finance_breakdown(p_from date, p_to date)
returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'revenue',  coalesce((select sum(amount) from payments where paid_on between p_from and p_to), 0),
    'payments', (select count(*) from payments where paid_on between p_from and p_to),
    'expenses', coalesce((select sum(amount) from expenses where spent_on between p_from and p_to), 0),
    'by_method', coalesce((
      select jsonb_object_agg(method, total) from (
        select method, sum(amount) as total from payments
        where paid_on between p_from and p_to group by method) t), '{}'::jsonb),
    'by_receiver', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'total', total, 'count', n) order by total desc) from (
        select coalesce(received_by, 'Not recorded') as name, sum(amount) as total, count(*) as n
        from payments where paid_on between p_from and p_to group by 1) t), '[]'::jsonb),
    'by_category', coalesce((
      select jsonb_object_agg(category, total) from (
        select category, sum(amount) as total from expenses
        where spent_on between p_from and p_to group by category) t), '{}'::jsonb),
    'dues_total', coalesce((select sum(balance_due) from clients where balance_due > 0), 0),
    'dues_count', (select count(*) from clients where balance_due > 0)
  );
$$;

-- Server (service role) only.
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke execute on function public.finance_monthly(date, int) from %I', r);
      execute format('revoke execute on function public.finance_breakdown(date, date) from %I', r);
    end if;
  end loop;
end $$;
revoke execute on function public.finance_monthly(date, int) from public;
revoke execute on function public.finance_breakdown(date, date) from public;
