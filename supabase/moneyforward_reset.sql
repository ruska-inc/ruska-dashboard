-- =============================================
-- 案件を作り直す（MFから取り込み直す前の初期化）
--
-- 【重要】実行前に必ず supabase/moneyforward_backup.sql の ① を実行して
--         バックアップを取ってください。いつでも元に戻せます。
--
-- 影響を受けるのは projects と payment_records.project_id だけです。
-- 入金記録そのもの・業務委託・顧客マスタ・期の設定は消えません。
-- =============================================

-- ---------------------------------------------
-- ① 消える対象の確認（参照のみ）
-- ---------------------------------------------
select
  period as 期,
  case
    when mf_billing_id is not null then 'MF請求書'
    when mf_quote_id   is not null then 'MF見積書'
    else '既存（手入力・Excel）'
  end          as 出所,
  count(*)     as 件数,
  sum(amount)  as 金額合計
from public.projects
group by 1, 2
order by 1 desc, 2;


-- ---------------------------------------------
-- ② 巻き添えになる依存データの確認（参照のみ）
--    入金記録は削除せず、案件との紐付けだけ外します
-- ---------------------------------------------
select
  (select count(*) from public.payment_records where project_id is not null) as 紐付きが外れる入金記録,
  (select count(*) from public.projects        where parent_id  is not null) as 親子関係が外れる案件;


-- ---------------------------------------------
-- ③【全期リセット】第1期からMFで管理している場合はこちら
--    ① ② を確認してから、下の3文をまとめて実行してください。
-- ---------------------------------------------
-- update public.payment_records set project_id = null where project_id is not null;
-- update public.projects        set parent_id  = null where parent_id  is not null;
-- delete from public.projects;


-- ---------------------------------------------
-- ③'【期を限定してリセット】一部の期だけやり直す場合はこちら
--    '第3期' の部分を対象の期に書き換えてから実行してください。
-- ---------------------------------------------
-- update public.payment_records set project_id = null
--  where project_id in (select id from public.projects where period = '第3期');
-- update public.projects set parent_id = null
--  where parent_id in (select id from public.projects where period = '第3期');
-- delete from public.projects where period = '第3期';


-- ---------------------------------------------
-- ④ リセット後の確認（0件になっていればOK）
-- ---------------------------------------------
select count(*) as 残っている案件数 from public.projects;
