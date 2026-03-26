create extension if not exists pgcrypto;

create table if not exists public.timers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Timer',
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists timers_user_id_idx on public.timers (user_id);
create index if not exists timers_started_at_idx on public.timers (started_at);

alter table public.timers enable row level security;

create policy "Users can select own timers"
on public.timers
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own timers"
on public.timers
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own timers"
on public.timers
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own timers"
on public.timers
for delete
to authenticated
using (auth.uid() = user_id);
