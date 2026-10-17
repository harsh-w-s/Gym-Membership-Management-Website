-- Payments on clients, salary on trainers. Existing rows get 0 by default.

alter table public.clients
  add column if not exists package_fee numeric(10,2) not null default 0 check (package_fee >= 0);

alter table public.clients
  add column if not exists amount_paid numeric(10,2) not null default 0 check (amount_paid >= 0);

-- Computed by Postgres on every insert/update, so it can never drift.
-- Positive = client still owes money; negative = paid in advance.
-- Stored (not virtual) so the Clients page can filter on it via PostgREST.
alter table public.clients
  add column if not exists balance_due numeric(10,2)
  generated always as (package_fee - amount_paid) stored;

create index if not exists clients_balance_due_idx on public.clients (balance_due);

-- Monthly salary.
alter table public.trainers
  add column if not exists salary numeric(10,2) not null default 0 check (salary >= 0);
