-- =============================================
-- マネーフォワード クラウド請求書 連携
-- API v3 (https://invoice.moneyforward.com/api/v3)
-- =============================================

-- ---------------------------------------------
-- 1. projects に MF の外部IDを追加
--    再同期しても重複せず、手で編集した内容を保持するためのキー
-- ---------------------------------------------
alter table public.projects add column if not exists mf_quote_id text;
alter table public.projects add column if not exists mf_billing_id text;
alter table public.projects add column if not exists mf_synced_at timestamptz;

create unique index if not exists projects_mf_quote_id_key
  on public.projects (mf_quote_id) where mf_quote_id is not null;
create unique index if not exists projects_mf_billing_id_key
  on public.projects (mf_billing_id) where mf_billing_id is not null;

-- ---------------------------------------------
-- 2. OAuth トークン保管（事業者ごとに1行）
--    refresh_token は機微情報のため admin / management / accounting のみ参照可
-- ---------------------------------------------
create table if not exists public.mf_oauth_tokens (
  id text primary key default 'default',
  access_token text,
  refresh_token text not null,
  expires_at timestamptz,
  scope text,
  office_name text,
  connected_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists mf_oauth_tokens_updated_at on public.mf_oauth_tokens;
create trigger mf_oauth_tokens_updated_at
  before update on public.mf_oauth_tokens
  for each row execute procedure public.handle_updated_at();

alter table public.mf_oauth_tokens enable row level security;

drop policy if exists "mf_oauth_tokens_select" on public.mf_oauth_tokens;
drop policy if exists "mf_oauth_tokens_insert" on public.mf_oauth_tokens;
drop policy if exists "mf_oauth_tokens_update" on public.mf_oauth_tokens;
drop policy if exists "mf_oauth_tokens_delete" on public.mf_oauth_tokens;

-- 同期実行時にトークンの参照・更新（リフレッシュ）が必要なため、経理も対象に含める
create policy "mf_oauth_tokens_select" on public.mf_oauth_tokens for select using (
  get_my_role() in ('admin','management','accounting')
);
create policy "mf_oauth_tokens_insert" on public.mf_oauth_tokens for insert with check (
  get_my_role() in ('admin','management')
);
create policy "mf_oauth_tokens_update" on public.mf_oauth_tokens for update using (
  get_my_role() in ('admin','management','accounting')
);
create policy "mf_oauth_tokens_delete" on public.mf_oauth_tokens for delete using (
  get_my_role() in ('admin','management')
);

-- ---------------------------------------------
-- 3. 同期ログ（いつ・何件取り込んだか）
-- ---------------------------------------------
create table if not exists public.mf_sync_logs (
  id uuid default gen_random_uuid() primary key,
  synced_at timestamptz default now(),
  synced_by uuid references auth.users(id),
  range_from text,
  range_to text,
  quotes_fetched integer default 0,
  billings_fetched integer default 0,
  created_count integer default 0,
  updated_count integer default 0,
  error text
);

alter table public.mf_sync_logs enable row level security;

drop policy if exists "mf_sync_logs_select" on public.mf_sync_logs;
drop policy if exists "mf_sync_logs_insert" on public.mf_sync_logs;

create policy "mf_sync_logs_select" on public.mf_sync_logs for select using (
  get_my_role() in ('admin','management','accounting')
);
create policy "mf_sync_logs_insert" on public.mf_sync_logs for insert with check (
  get_my_role() in ('admin','management','accounting')
);
