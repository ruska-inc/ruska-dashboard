-- =============================================
-- マネーフォワード取り込み後の重複チェック
-- Supabase の SQL Editor に貼って、上から順に実行してください。
-- ① 〜 ④ は参照のみ。⑤ の削除は結果を確認してからコメントを外します。
-- =============================================

-- ---------------------------------------------
-- ① 期ごとの内訳（どこが増えたかの全体像）
--    「売上」= 確度が確定 かつ 失注以外（ダッシュボードの集計条件と同じ）
-- ---------------------------------------------
select
  period                                                as 期,
  case
    when mf_billing_id is not null then 'MF請求書'
    when mf_quote_id   is not null then 'MF見積書'
    else '既存（手入力・Excel）'
  end                                                   as 出所,
  count(*)                                              as 件数,
  sum(amount)                                           as 金額合計
from public.projects
where probability = '確定' and status <> '失注'
group by 1, 2
order by 1 desc, 2;


-- ---------------------------------------------
-- ② 【原因A】既存案件とMF取込案件の重複
--    顧客名と金額が同じなのに、件名が違うため別案件になったもの
-- ---------------------------------------------
select
  old.period                as 期,
  old.client_name           as 顧客,
  old.name                  as 既存の案件名,
  new.name                  as MF取込の案件名,
  old.amount                as 金額,
  old.id                    as 既存ID,
  new.id                    as MF取込ID
from public.projects old
join public.projects new
  on  old.client_name = new.client_name
  and old.amount      = new.amount
  and old.id         <> new.id
where old.mf_billing_id is null and old.mf_quote_id is null
  and (new.mf_billing_id is not null or new.mf_quote_id is not null)
  and old.probability = '確定' and old.status <> '失注'
  and new.probability = '確定' and new.status <> '失注'
order by old.period desc, old.client_name;


-- ---------------------------------------------
-- ③ 【原因B】MF内の見積書と請求書が別案件に分かれたもの
--    マネーフォワード側で見積書と請求書の件名が違うと統合されません
-- ---------------------------------------------
select
  q.period          as 期,
  q.client_name     as 顧客,
  q.name            as 見積書側の案件名,
  b.name            as 請求書側の案件名,
  q.amount          as 金額,
  q.id              as 見積書側ID,
  b.id              as 請求書側ID
from public.projects q
join public.projects b
  on  q.client_name = b.client_name
  and q.amount      = b.amount
  and q.id         <> b.id
where q.mf_quote_id   is not null and q.mf_billing_id is null
  and b.mf_billing_id is not null
  and q.probability = '確定' and q.status <> '失注'
order by q.period desc, q.client_name;


-- ---------------------------------------------
-- ④ 直前の同期で「新規作成」された案件の合計
--    （既存案件の更新は作成日時が古いので、ここには含まれません）
-- ---------------------------------------------
select
  period       as 期,
  count(*)     as 新規作成件数,
  sum(amount)  as 金額合計
from public.projects
where mf_synced_at is not null
  and created_at > mf_synced_at - interval '1 minute'
group by 1
order by 1 desc;


-- ---------------------------------------------
-- ⑤ 取り消し：直前の同期で新規作成された案件だけを削除する
--    ④ の結果を確認してから、下の2行のコメントを外して実行してください。
--    ※ 既存案件（Excel・手入力）と、同期で「更新」されただけの案件は消えません。
-- ---------------------------------------------
-- delete from public.projects
-- where mf_synced_at is not null and created_at > mf_synced_at - interval '1 minute';
