create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.focus_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('stop', 'start')),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.timers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  focus_item_id uuid references public.focus_items(id) on delete set null,
  name text not null default 'Timer',
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.timer_resets (
  id uuid primary key default gen_random_uuid(),
  timer_id uuid not null references public.timers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  previous_started_at timestamptz not null,
  reset_at timestamptz not null default now()
);

create table if not exists public.grow_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.grow_task_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.grow_tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (task_id, log_date)
);

create table if not exists public.todo_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.weekly_reflects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  word text not null,
  reflect text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create table if not exists public.monthly_chapters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month_start date not null,
  word text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month_start)
);

create index if not exists focus_items_user_id_idx on public.focus_items (user_id, kind);
create index if not exists timers_user_id_idx on public.timers (user_id, created_at desc);
create index if not exists timer_resets_user_id_idx on public.timer_resets (user_id, reset_at desc);
create index if not exists grow_tasks_user_id_idx on public.grow_tasks (user_id, created_at desc);
create index if not exists grow_task_logs_user_id_idx on public.grow_task_logs (user_id, log_date desc);
create index if not exists todo_tasks_user_id_idx on public.todo_tasks (user_id, created_at desc);
create index if not exists weekly_reflects_user_id_idx on public.weekly_reflects (user_id, week_start desc);
create index if not exists monthly_chapters_user_id_idx on public.monthly_chapters (user_id, month_start desc);

alter table public.profiles enable row level security;
alter table public.focus_items enable row level security;
alter table public.timers enable row level security;
alter table public.timer_resets enable row level security;
alter table public.grow_tasks enable row level security;
alter table public.grow_task_logs enable row level security;
alter table public.todo_tasks enable row level security;
alter table public.weekly_reflects enable row level security;
alter table public.monthly_chapters enable row level security;

create policy "Users can select own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can select own focus items"
on public.focus_items
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own focus items"
on public.focus_items
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own focus items"
on public.focus_items
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own focus items"
on public.focus_items
for delete
to authenticated
using (auth.uid() = user_id);

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

create policy "Users can select own timer resets"
on public.timer_resets
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own timer resets"
on public.timer_resets
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can select own grow tasks"
on public.grow_tasks
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own grow tasks"
on public.grow_tasks
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own grow tasks"
on public.grow_tasks
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own grow tasks"
on public.grow_tasks
for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can select own grow task logs"
on public.grow_task_logs
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own grow task logs"
on public.grow_task_logs
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own grow task logs"
on public.grow_task_logs
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own grow task logs"
on public.grow_task_logs
for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can select own todo tasks"
on public.todo_tasks
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own todo tasks"
on public.todo_tasks
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own todo tasks"
on public.todo_tasks
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own todo tasks"
on public.todo_tasks
for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can select own weekly reflects"
on public.weekly_reflects
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own weekly reflects"
on public.weekly_reflects
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own weekly reflects"
on public.weekly_reflects
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own weekly reflects"
on public.weekly_reflects
for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can select own monthly chapters"
on public.monthly_chapters
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own monthly chapters"
on public.monthly_chapters
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own monthly chapters"
on public.monthly_chapters
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own monthly chapters"
on public.monthly_chapters
for delete
to authenticated
using (auth.uid() = user_id);
