-- Gym management schema: trainers + clients.
-- Apply with `supabase db push` (CLI) or paste into the Supabase SQL editor.

create table if not exists public.trainers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  phone       text check (phone is null or phone ~ '^[0-9]{8,15}$'),
  speciality  text,
  created_at  timestamptz not null default now()
);

create table if not exists public.clients (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(trim(name)) > 0),
  -- International format, digits only (e.g. 919876543210), which is exactly
  -- what https://wa.me/<phone> expects. Enforced here as a last line of defence.
  phone         text not null unique check (phone ~ '^[0-9]{8,15}$'),
  age           smallint check (age between 5 and 120),
  blood_group   text check (blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  package_name  text not null check (length(trim(package_name)) > 0),
  expiry_date   date not null,
  -- If a trainer is deleted, keep the client and just unassign them.
  trainer_id    uuid references public.trainers(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- The dashboard filters/sorts by expiry_date on every load.
create index if not exists clients_expiry_date_idx on public.clients (expiry_date);
create index if not exists clients_trainer_id_idx  on public.clients (trainer_id);

-- Row Level Security ON with NO policies: the public anon key can read/write
-- nothing. The app talks to Supabase only from the server using the
-- service-role key (which bypasses RLS), so client PII (phones, blood groups)
-- is never reachable from the browser.
alter table public.trainers enable row level security;
alter table public.clients  enable row level security;

-- Optional seed data so the trainer dropdown isn't empty on first run.
-- Only seeds an empty table, so re-running this file never duplicates trainers.
insert into public.trainers (name, phone, speciality)
select * from (values
  ('Rahul Verma', '919800000001', 'Strength & Conditioning'),
  ('Priya Nair',  '919800000002', 'Yoga & Mobility')
) as seed(name, phone, speciality)
where not exists (select 1 from public.trainers);
