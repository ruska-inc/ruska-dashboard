-- =============================================
-- periods / clients テーブルの RLS を有効化
-- =============================================

-- periods テーブル（未作成の場合は作成）
CREATE TABLE IF NOT EXISTS public.periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "periods_select" ON public.periods;
DROP POLICY IF EXISTS "periods_insert" ON public.periods;
DROP POLICY IF EXISTS "periods_delete" ON public.periods;

CREATE POLICY "periods_select" ON public.periods FOR SELECT USING (true);
CREATE POLICY "periods_insert" ON public.periods FOR INSERT WITH CHECK (
  get_my_role() IN ('admin', 'management')
);
CREATE POLICY "periods_delete" ON public.periods FOR DELETE USING (
  get_my_role() IN ('admin', 'management')
);

-- clients テーブル
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
