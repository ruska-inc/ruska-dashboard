-- =============================================
-- 取り込みテスト前のバックアップと復元
--
-- ① でスナップショットを作り、④ でいつでも元に戻せます。
-- バックアップ表は Supabase 上に残るので、CSVを保管する必要はありません。
--
-- 影響を受けるのは projects と payment_records.project_id の2つだけです。
-- （contractor_assignments は案件名テキストでの参照なので影響しません）
-- =============================================

-- ---------------------------------------------
-- ① バックアップの作成
--    日付部分は任意。復元時に同じ名前を使ってください。
-- ---------------------------------------------
create table if not exists public.projects_backup_20260904 as
  select * from public.projects;

create table if not exists public.payment_records_backup_20260904 as
  select * from public.payment_records;

-- バックアップ表は集計や画面から見えてはいけないので、参照を全面的に塞ぐ。
-- ポリシーを作らないまま RLS を有効にすると既定で全拒否になる。
-- SQL Editor（サービスロール）は RLS を迂回するため、復元は問題なく行える。
alter table public.projects_backup_20260904        enable row level security;
alter table public.payment_records_backup_20260904 enable row level security;


-- ---------------------------------------------
-- ② バックアップが取れたかの確認
--    「現在」と「バックアップ」の件数・金額が一致していればOK
-- ---------------------------------------------
select
  'projects'                                                  as テーブル,
  (select count(*)    from public.projects)                   as 現在の件数,
  (select count(*)    from public.projects_backup_20260904)   as バックアップ件数,
  (select sum(amount) from public.projects)                   as 現在の金額,
  (select sum(amount) from public.projects_backup_20260904)   as バックアップ金額
union all
select
  'payment_records',
  (select count(*)    from public.payment_records),
  (select count(*)    from public.payment_records_backup_20260904),
  (select sum(amount) from public.payment_records),
  (select sum(amount) from public.payment_records_backup_20260904);


-- ---------------------------------------------
-- ③ 期ごとの売上を控えておく（再取り込み後の答え合わせ用）
--    ダッシュボードの集計条件（確度=確定 かつ 失注以外）と同じ
-- ---------------------------------------------
select period as 期, count(*) as 件数, sum(amount) as 売上
from public.projects
where probability = '確定' and status <> '失注'
group by 1
order by 1;


-- ---------------------------------------------
-- ④ 復元：バックアップ時点の状態に完全に戻す
--    取り込み結果に納得できなかった場合、下の6文をまとめて実行してください。
--    ※ 外部キー制約があるため、この順序で実行する必要があります。
-- ---------------------------------------------
-- -- 1. 入金記録の案件参照を一旦外す（入金記録そのものは消しません）
-- update public.payment_records set project_id = null where project_id is not null;
--
-- -- 2. 案件どうしの親子参照を外す
-- update public.projects set parent_id = null where parent_id is not null;
--
-- -- 3. 現在の案件を全削除
-- delete from public.projects;
--
-- -- 4. 親案件から先に戻す（親が居ないと子の parent_id が制約違反になるため）
-- insert into public.projects
--   select * from public.projects_backup_20260904 where parent_id is null;
--
-- -- 5. 続いて子案件を戻す
-- insert into public.projects
--   select * from public.projects_backup_20260904 where parent_id is not null;
--
-- -- 6. 入金記録の案件参照を元に戻す
-- update public.payment_records pr
--    set project_id = b.project_id
--   from public.payment_records_backup_20260904 b
--  where pr.id = b.id;


-- ---------------------------------------------
-- ⑤ 後片付け：結果に満足したらバックアップ表を削除する
--    急ぐ必要はありません。しばらく残しておいて構いません。
-- ---------------------------------------------
-- drop table if exists public.projects_backup_20260904;
-- drop table if exists public.payment_records_backup_20260904;
