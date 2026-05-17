-- =============================================
-- 月次予測テーブル(口座×月で予想収入・予想費用を管理)
-- =============================================

create table if not exists public.monthly_forecasts (
  id uuid default gen_random_uuid() primary key,
  account_id uuid references public.bank_accounts(id) on delete cascade not null,
  year_month text not null,  -- YYYY-MM
  expected_income bigint not null default 0,
  expected_expense bigint not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (account_id, year_month)
);

alter table public.monthly_forecasts enable row level security;

drop policy if exists "monthly_forecasts_select" on public.monthly_forecasts;
drop policy if exists "monthly_forecasts_insert" on public.monthly_forecasts;
drop policy if exists "monthly_forecasts_update" on public.monthly_forecasts;
drop policy if exists "monthly_forecasts_delete" on public.monthly_forecasts;

create policy "monthly_forecasts_select" on public.monthly_forecasts for select using (
  get_my_role() in ('admin','management','accounting')
);
create policy "monthly_forecasts_insert" on public.monthly_forecasts for insert with check (
  get_my_role() in ('admin','management','accounting')
);
create policy "monthly_forecasts_update" on public.monthly_forecasts for update using (
  get_my_role() in ('admin','management','accounting')
);
create policy "monthly_forecasts_delete" on public.monthly_forecasts for delete using (
  get_my_role() in ('admin','management')
);
