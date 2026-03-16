CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 既存プロジェクトから顧客名を移行
INSERT INTO clients (name)
SELECT DISTINCT client_name FROM projects WHERE client_name IS NOT NULL AND client_name != ''
ON CONFLICT (name) DO NOTHING;
