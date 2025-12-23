-- Portfolio history table (simple version, bypassing CLI issues)
create table if not exists public.portfolio_history (
  id bigserial primary key,
  user_id uuid not null,
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  value numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, month)
);

alter table public.portfolio_history enable row level security;

-- Drop existing policies if they exist (to avoid conflicts)
drop policy if exists "select_own_history" on public.portfolio_history;
drop policy if exists "insert_own_history" on public.portfolio_history;
drop policy if exists "update_own_history" on public.portfolio_history;
drop policy if exists "delete_own_history" on public.portfolio_history;

-- Create policies fresh
create policy "select_own_history" on public.portfolio_history
  for select using ( auth.uid() = user_id );

create policy "insert_own_history" on public.portfolio_history
  for insert with check ( auth.uid() = user_id );

create policy "update_own_history" on public.portfolio_history
  for update using ( auth.uid() = user_id );

create policy "delete_own_history" on public.portfolio_history
  for delete using ( auth.uid() = user_id );

-- Index
create index if not exists idx_portfolio_history_user_month on public.portfolio_history(user_id, month);
