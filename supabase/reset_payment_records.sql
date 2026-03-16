-- 既存の入金記録をクリア
TRUNCATE TABLE payment_records;

-- 失注・見積もり中を除くプロジェクトから入金記録を生成
INSERT INTO payment_records (project_id, project_name, client_name, payment_date, amount, payment_month, period)
SELECT
  id,
  name,
  client_name,
  (regexp_replace(regexp_replace(payment_month, '年', '-'), '月', '') || '-01')::date,
  amount,
  payment_month,
  period
FROM projects
WHERE
  status NOT IN ('失注', '見積もり中')
  AND payment_month IS NOT NULL
  AND amount > 0;
