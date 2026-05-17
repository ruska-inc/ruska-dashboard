-- =============================================
-- 入出金明細に重複防止の一意制約を追加
-- (account_id + transaction_date + expense + income + description のセットで一意)
-- =============================================

-- 1. 既存の description NULL を空文字に正規化
update public.bank_transactions
set description = ''
where description is null;

-- 2. description を NOT NULL + デフォルト '' に変更
alter table public.bank_transactions
  alter column description set default '';
alter table public.bank_transactions
  alter column description set not null;

-- 3. 既存データの重複を削除(同じキーの中で最古のレコードだけ残す)
delete from public.bank_transactions
where id in (
  select id from (
    select id, row_number() over (
      partition by account_id, transaction_date, expense, income, description
      order by created_at
    ) as rn
    from public.bank_transactions
  ) t
  where rn > 1
);

-- 4. 一意制約を追加(以後 upsert で重複を自動スキップ可能に)
alter table public.bank_transactions
  drop constraint if exists bank_transactions_dedup;
alter table public.bank_transactions
  add constraint bank_transactions_dedup
  unique (account_id, transaction_date, expense, income, description);
