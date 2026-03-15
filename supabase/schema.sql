-- =============================================
-- Ruska Dashboard - Database Schema
-- =============================================

-- ユーザープロファイル（Supabase Authと連携）
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  email text not null,
  role text not null default 'internal'
    check (role in ('admin', 'management', 'accounting', 'internal', 'contractor')),
  created_at timestamptz default now()
);

-- プロジェクト
create table if not exists public.projects (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  client_name text not null,
  status text not null default '見積もり中'
    check (status in ('見積もり中','進行中','外注','請求済み','着金済み','立て替え','完了済','失注')),
  probability text not null default '確度（中）'
    check (probability in ('確度（低）','確度（中）','確度（高）','確定','保留・トラブル有り','失注')),
  amount integer not null default 0,
  tax_amount integer not null default 0,
  period text not null default '第1期'
    check (period in ('第1期','第2期','第3期','第4期','第5期')),
  invoice_month text,
  payment_month text,
  notes text,
  estimate_url text,
  invoice_url text,
  parent_id uuid references public.projects(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 入金記録
create table if not exists public.payment_records (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id),
  project_name text not null,
  client_name text not null,
  payment_date date not null,
  amount integer not null,
  payment_month text not null,
  created_at timestamptz default now()
);

-- 業務委託先マスタ
create table if not exists public.contractors (
  id uuid default gen_random_uuid() primary key,
  skills text[] default '{}',
  company_name text not null,
  contact_name text not null,
  invoice_status text not null default '未定'
    check (invoice_status in ('登録済み','免税事業者','申請中','未定')),
  email text,
  phone text,
  notes text,
  created_at timestamptz default now()
);

-- 業務委託案件
create table if not exists public.contractor_assignments (
  id uuid default gen_random_uuid() primary key,
  contractor_id uuid references public.contractors(id) on delete cascade not null,
  project_name text not null,
  amount_excl_tax integer not null default 0,
  amount_incl_tax integer not null default 0,
  invoice_month text,
  payment_month text,
  payment_status text not null default '未対応'
    check (payment_status in ('支払済','未対応','確認中')),
  notes text,
  created_at timestamptz default now()
);

-- =============================================
-- updated_at 自動更新トリガー
-- =============================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at
  before update on public.projects
  for each row execute procedure public.handle_updated_at();

-- =============================================
-- 新規ユーザー登録時にprofilesを自動作成
-- =============================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    new.email,
    'internal'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================
-- Row Level Security (RLS)
-- =============================================

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.payment_records enable row level security;
alter table public.contractors enable row level security;
alter table public.contractor_assignments enable row level security;

-- profiles
drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- ロール確認用ヘルパー関数
create or replace function public.get_my_role()
returns text as $$
  select role from public.profiles where id = auth.uid();
$$ language sql security definer stable;

-- projects
drop policy if exists "projects_select" on public.projects;
drop policy if exists "projects_insert" on public.projects;
drop policy if exists "projects_update" on public.projects;
drop policy if exists "projects_delete" on public.projects;
create policy "projects_select" on public.projects for select using (
  get_my_role() in ('admin', 'management', 'accounting', 'internal')
);
create policy "projects_insert" on public.projects for insert with check (
  get_my_role() in ('admin', 'management')
);
create policy "projects_update" on public.projects for update using (
  get_my_role() in ('admin', 'management')
);
create policy "projects_delete" on public.projects for delete using (
  get_my_role() = 'admin'
);

-- payment_records
drop policy if exists "payment_records_select" on public.payment_records;
drop policy if exists "payment_records_insert" on public.payment_records;
drop policy if exists "payment_records_delete" on public.payment_records;
create policy "payment_records_select" on public.payment_records for select using (
  get_my_role() in ('admin', 'management', 'accounting')
);
create policy "payment_records_insert" on public.payment_records for insert with check (
  get_my_role() in ('admin', 'management', 'accounting')
);
create policy "payment_records_delete" on public.payment_records for delete using (
  get_my_role() in ('admin', 'management')
);

-- contractors
drop policy if exists "contractors_select" on public.contractors;
drop policy if exists "contractors_insert" on public.contractors;
drop policy if exists "contractors_update" on public.contractors;
create policy "contractors_select" on public.contractors for select using (
  get_my_role() in ('admin', 'management', 'accounting')
);
create policy "contractors_insert" on public.contractors for insert with check (
  get_my_role() in ('admin', 'management')
);
create policy "contractors_update" on public.contractors for update using (
  get_my_role() in ('admin', 'management')
);

-- contractor_assignments
drop policy if exists "assignments_select" on public.contractor_assignments;
drop policy if exists "assignments_insert" on public.contractor_assignments;
drop policy if exists "assignments_update" on public.contractor_assignments;
create policy "assignments_select" on public.contractor_assignments for select using (
  get_my_role() in ('admin', 'management', 'accounting')
);
create policy "assignments_insert" on public.contractor_assignments for insert with check (
  get_my_role() in ('admin', 'management')
);
create policy "assignments_update" on public.contractor_assignments for update using (
  get_my_role() in ('admin', 'management')
);
