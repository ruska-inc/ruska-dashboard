-- =============================================
-- 期に開始年月を追加(YYYY-MM 形式)
-- =============================================

alter table public.periods add column if not exists start_year_month text;

-- 既存データの開始月をセット
update public.periods set start_year_month = '2022-08' where name = '第1期';
update public.periods set start_year_month = '2023-09' where name = '第2期';
update public.periods set start_year_month = '2024-09' where name = '第3期';
update public.periods set start_year_month = '2025-09' where name = '第4期';
update public.periods set start_year_month = '2026-09' where name = '第5期';
