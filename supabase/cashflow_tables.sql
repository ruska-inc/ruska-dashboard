-- =============================================
-- 入出金管理(銀行口座・取引明細)
-- =============================================

-- 銀行口座マスタ
create table if not exists public.bank_accounts (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

-- 入出金明細
create table if not exists public.bank_transactions (
  id uuid default gen_random_uuid() primary key,
  account_id uuid references public.bank_accounts(id) on delete cascade not null,
  transaction_date date not null,
  expense bigint not null default 0,
  income bigint not null default 0,
  description text,
  source text not null default 'manual'
    check (source in ('manual','csv_sbi','csv_smbc','csv_generic','sheet_import')),
  created_at timestamptz default now()
);

create index if not exists bank_transactions_account_date_idx
  on public.bank_transactions (account_id, transaction_date desc);

-- RLS
alter table public.bank_accounts enable row level security;
alter table public.bank_transactions enable row level security;

-- bank_accounts policies
drop policy if exists "bank_accounts_select" on public.bank_accounts;
drop policy if exists "bank_accounts_insert" on public.bank_accounts;
drop policy if exists "bank_accounts_update" on public.bank_accounts;
drop policy if exists "bank_accounts_delete" on public.bank_accounts;
create policy "bank_accounts_select" on public.bank_accounts for select using (
  get_my_role() in ('admin','management','accounting')
);
create policy "bank_accounts_insert" on public.bank_accounts for insert with check (
  get_my_role() in ('admin','management')
);
create policy "bank_accounts_update" on public.bank_accounts for update using (
  get_my_role() in ('admin','management')
);
create policy "bank_accounts_delete" on public.bank_accounts for delete using (
  get_my_role() = 'admin'
);

-- bank_transactions policies
drop policy if exists "bank_transactions_select" on public.bank_transactions;
drop policy if exists "bank_transactions_insert" on public.bank_transactions;
drop policy if exists "bank_transactions_update" on public.bank_transactions;
drop policy if exists "bank_transactions_delete" on public.bank_transactions;
create policy "bank_transactions_select" on public.bank_transactions for select using (
  get_my_role() in ('admin','management','accounting')
);
create policy "bank_transactions_insert" on public.bank_transactions for insert with check (
  get_my_role() in ('admin','management','accounting')
);
create policy "bank_transactions_update" on public.bank_transactions for update using (
  get_my_role() in ('admin','management','accounting')
);
create policy "bank_transactions_delete" on public.bank_transactions for delete using (
  get_my_role() in ('admin','management')
);

-- 初期データ
insert into public.bank_accounts (name, sort_order) values
  ('住信SBI', 0),
  ('三井住友', 1)
on conflict do nothing;
