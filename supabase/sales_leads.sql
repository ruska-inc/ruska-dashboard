-- =============================================
-- 営業リスト(SalesNow API連携の保存先)
-- =============================================

create table if not exists public.sales_leads (
  id uuid default gen_random_uuid() primary key,
  -- SalesNow企業データ(キャッシュ)
  corporate_number text,  -- 法人番号(13桁)
  company_name text not null,
  url text,
  address text,
  phone text,
  industry text,
  representative text,
  employees integer,
  capital bigint,
  revenue bigint,
  established_year integer,
  salesnow_score integer,
  -- 営業情報
  status text not null default '未アプローチ'
    check (status in ('未アプローチ','アプローチ中','商談中','提案中','受注','失注','保留')),
  priority text not null default '中'
    check (priority in ('高','中','低')),
  assigned_to uuid references public.profiles(id),
  notes text,
  next_action_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (corporate_number)
);

create index if not exists sales_leads_status_idx on public.sales_leads (status);
create index if not exists sales_leads_assigned_idx on public.sales_leads (assigned_to);

-- updated_at自動更新
drop trigger if exists sales_leads_updated_at on public.sales_leads;
create trigger sales_leads_updated_at
  before update on public.sales_leads
  for each row execute procedure public.handle_updated_at();

-- RLS
alter table public.sales_leads enable row level security;

drop policy if exists "sales_leads_select" on public.sales_leads;
drop policy if exists "sales_leads_insert" on public.sales_leads;
drop policy if exists "sales_leads_update" on public.sales_leads;
drop policy if exists "sales_leads_delete" on public.sales_leads;

create policy "sales_leads_select" on public.sales_leads for select using (
  get_my_role() in ('admin','management','accounting','internal')
);
create policy "sales_leads_insert" on public.sales_leads for insert with check (
  get_my_role() in ('admin','management','accounting','internal')
);
create policy "sales_leads_update" on public.sales_leads for update using (
  get_my_role() in ('admin','management','accounting','internal')
);
create policy "sales_leads_delete" on public.sales_leads for delete using (
  get_my_role() in ('admin','management')
);
