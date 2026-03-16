-- payment_records に MoneyForward トランザクションID カラムを追加
ALTER TABLE payment_records
  ADD COLUMN IF NOT EXISTS mf_transaction_id TEXT;

-- 重複同期防止のためユニーク制約を追加
CREATE UNIQUE INDEX IF NOT EXISTS payment_records_mf_transaction_id_idx
  ON payment_records (mf_transaction_id)
  WHERE mf_transaction_id IS NOT NULL;
