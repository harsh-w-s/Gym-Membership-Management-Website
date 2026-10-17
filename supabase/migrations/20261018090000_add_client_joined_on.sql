-- Date the client joined the gym (can differ from created_at when old
-- notebook entries are typed in later).

alter table public.clients
  add column if not exists joined_on date;

-- Existing clients: best guess is the day they were entered into the app.
update public.clients
  set joined_on = (created_at at time zone 'Asia/Kolkata')::date
  where joined_on is null;

alter table public.clients
  alter column joined_on set default current_date,
  alter column joined_on set not null;

create index if not exists clients_joined_on_idx on public.clients (joined_on);
