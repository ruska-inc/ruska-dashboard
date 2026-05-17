-- =============================================
-- 期に終了年月を追加(YYYY-MM 形式)
-- 未設定の場合は次の期の開始月の前月までを期の終了として扱う
-- =============================================

alter table public.periods add column if not exists end_year_month text;

-- 初期データ: 既存期の終了月をセット(任意)
update public.periods set end_year_month = '2023-08' where name = '第1期';
update public.periods set end_year_month = '2024-08' where name = '第2期';
update public.periods set end_year_month = '2025-08' where name = '第3期';
update public.periods set end_year_month = '2026-08' where name = '第4期';
update public.periods set end_year_month = '2027-08' where name = '第5期';
