-- =============================================
-- 期の設定を「請求月」基準に変更
-- (元: 9月〜8月の入金基準 → 8月〜7月の請求基準)
-- 入出金管理の月次集計では自動的に+1ヶ月シフトして9月〜8月で表示される
-- =============================================

update public.periods set
  start_year_month = '2022-08',
  end_year_month   = '2023-07'
where name = '第1期';

update public.periods set
  start_year_month = '2023-08',
  end_year_month   = '2024-07'
where name = '第2期';

update public.periods set
  start_year_month = '2024-08',
  end_year_month   = '2025-07'
where name = '第3期';

update public.periods set
  start_year_month = '2025-08',
  end_year_month   = '2026-07'
where name = '第4期';

update public.periods set
  start_year_month = '2026-08',
  end_year_month   = '2027-07'
where name = '第5期';
