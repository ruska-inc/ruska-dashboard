-- =============================================
-- 月次予測テーブル(月別の予想収入・予想費用 — 口座横断のグローバル予測)
-- =============================================

-- 既に古い形(account_id付き)で作成されていた場合は作り直す
drop table if exists public.monthly_forecasts cascade;

create table public.monthly_forecasts (
  id uuid default gen_random_uuid() primary key,
  year_month text not null unique,  -- YYYY-MM
  expected_income bigint not null default 0,
  expected_expense bigint not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
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
