CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_select" ON public.clients;
DROP POLICY IF EXISTS "clients_insert" ON public.clients;
DROP POLICY IF EXISTS "clients_update" ON public.clients;
DROP POLICY IF EXISTS "clients_delete" ON public.clients;

CREATE POLICY "clients_select" ON public.clients FOR SELECT USING (
  get_my_role() IN ('admin', 'management', 'accounting', 'internal')
);
CREATE POLICY "clients_insert" ON public.clients FOR INSERT WITH CHECK (
  get_my_role() IN ('admin', 'management')
);
CREATE POLICY "clients_update" ON public.clients FOR UPDATE USING (
  get_my_role() IN ('admin', 'management')
);
CREATE POLICY "clients_delete" ON public.clients FOR DELETE USING (
  get_my_role() = 'admin'
);

-- 既存プロジェクトから顧客名を移行
INSERT INTO clients (name)
SELECT DISTINCT client_name FROM projects WHERE client_name IS NOT NULL AND client_name != ''
ON CONFLICT (name) DO NOTHING;
