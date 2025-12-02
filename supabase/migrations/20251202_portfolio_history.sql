-- Portfolio history per user
create table if not exists public.portfolio_history (
  id bigserial primary key,
  user_id uuid not null,
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  value numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, month)
);

-- Reference to auth.users (no FK across schemas by default in Supabase templates; enable if desired)
-- alter table public.portfolio_history
--   add constraint portfolio_history_user_fk
--   foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.portfolio_history enable row level security;

-- Policies: owner-only access
create policy if not exists "select_own_history" on public.portfolio_history
  for select using ( auth.uid() = user_id );

create policy if not exists "insert_own_history" on public.portfolio_history
  for insert with check ( auth.uid() = user_id );

create policy if not exists "update_own_history" on public.portfolio_history
  for update using ( auth.uid() = user_id );

create policy if not exists "delete_own_history" on public.portfolio_history
  for delete using ( auth.uid() = user_id );

-- Helpful index
create index if not exists idx_portfolio_history_user_month on public.portfolio_history(user_id, month);
