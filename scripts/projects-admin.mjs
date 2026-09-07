#!/usr/bin/env node
/**
 * 案件データのバックアップ・復元・リセット（管理用）
 *
 *   node scripts/projects-admin.mjs report            現状の件数と期ごとの売上を表示
 *   node scripts/projects-admin.mjs backup            backups/ にJSONで保存
 *   node scripts/projects-admin.mjs reset             全案件を削除（入金記録は残す）
 *   node scripts/projects-admin.mjs reset --period 第3期   期を限定して削除
 *   node scripts/projects-admin.mjs restore <file>    バックアップから復元
 *   node scripts/projects-admin.mjs relink-payments   入金記録を案件に貼り直す（既定は確認のみ）
 *   node scripts/projects-admin.mjs relink-payments --apply   実際に貼り直す
 *
 * SUPABASE_SECRET_KEY（RLSを迂回する管理者キー）を使うため、サーバー上でのみ実行すること。
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// --- .env.local の読み込み（dotenv非依存） ---
function loadEnv(path = '.env.local') {
  const env = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return env
}

const env = loadEnv()
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SECRET_KEY
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SECRET_KEY を .env.local に設定してください')
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false } })

const yen = n => `¥${(n ?? 0).toLocaleString('ja-JP')}`

/** PostgRESTは既定で1000件までなので、全件取れるまでページングする */
async function fetchAll(table) {
  const size = 1000
  const rows = []
  for (let from = 0; ; from += size) {
    const { data, error } = await db.from(table).select('*').range(from, from + size - 1)
    if (error) throw new Error(`${table} の取得に失敗: ${error.message}`)
    rows.push(...data)
    if (data.length < size) break
  }
  return rows
}

/** 表記ゆれを吸収した突合用の正規化 */
const norm = s => (s ?? '').normalize('NFKC').replace(/\s+/g, '').toLowerCase()

/**
 * 入金記録を案件に突合する。
 * 入金額は税込のことが多いため、税込・税抜の両方で照合する。
 * 候補が複数ある場合は、請求月が入金月以前で最も近いものを選ぶ。
 */
export function matchPayments(payments, projects) {
  const index = new Map()
  const add = (key, p) => {
    if (!index.has(key)) index.set(key, [])
    index.get(key).push(p)
  }
  for (const p of projects) {
    const client = norm(p.client_name)
    add(`c:${client}|${(p.amount ?? 0) + (p.tax_amount ?? 0)}`, p)   // 税込
    add(`c:${client}|${p.amount ?? 0}`, p)                            // 税抜
    add(`n:${client}|${norm(p.name)}`, p)                             // 顧客＋案件名
  }

  const linked = [], ambiguous = [], unmatched = []
  for (const r of payments) {
    const client = norm(r.client_name)
    const candidates =
      index.get(`n:${client}|${norm(r.project_name)}`) ??
      index.get(`c:${client}|${r.amount}`) ??
      []

    if (candidates.length === 0) { unmatched.push(r); continue }
    if (candidates.length === 1) { linked.push({ record: r, project: candidates[0] }); continue }

    // 請求月が入金月以前で最も近い案件を選ぶ
    const sameName = candidates.filter(p => norm(p.name) === norm(r.project_name))
    const pool = sameName.length > 0 ? sameName : candidates
    const scored = pool
      .filter(p => !p.invoice_month || p.invoice_month <= r.payment_month)
      .sort((a, b) => (b.invoice_month ?? '').localeCompare(a.invoice_month ?? ''))
    if (scored.length > 0) linked.push({ record: r, project: scored[0] })
    else ambiguous.push({ record: r, candidates: pool })
  }
  return { linked, ambiguous, unmatched }
}

/** ダッシュボードの売上条件（確度=確定 かつ 失注以外）で期ごとに集計する */
function salesByPeriod(projects) {
  const acc = {}
  for (const p of projects) {
    if (p.probability !== '確定' || p.status === '失注') continue
    acc[p.period] ??= { 件数: 0, 売上: 0 }
    acc[p.period].件数 += 1
    acc[p.period].売上 += p.amount ?? 0
  }
  return acc
}

function printReport(projects, payments) {
  const byPeriod = salesByPeriod(projects)
  const periods = Object.keys(byPeriod).sort()

  console.log(`\n案件: ${projects.length}件 / 入金記録: ${payments.length}件`)
  console.log('\n■ 期ごとの売上（確度=確定 かつ 失注以外）')
  let total = 0, count = 0
  for (const p of periods) {
    console.log(`  ${p.padEnd(6)} ${String(byPeriod[p].件数).padStart(4)}件  ${yen(byPeriod[p].売上).padStart(14)}`)
    total += byPeriod[p].売上
    count += byPeriod[p].件数
  }
  console.log(`  ${'合計'.padEnd(6)} ${String(count).padStart(4)}件  ${yen(total).padStart(14)}`)

  const mf = projects.filter(p => p.mf_billing_id || p.mf_quote_id).length
  console.log(`\n■ 出所の内訳`)
  console.log(`  MF取込          ${String(mf).padStart(4)}件`)
  console.log(`  既存(手入力等)  ${String(projects.length - mf).padStart(4)}件`)
}

// =============================================
const [, , cmd, ...args] = process.argv

if (cmd === 'report') {
  printReport(await fetchAll('projects'), await fetchAll('payment_records'))

} else if (cmd === 'backup') {
  const projects = await fetchAll('projects')
  const payment_records = await fetchAll('payment_records')
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 13)
  const file = join('backups', `projects-${stamp}.json`)
  writeFileSync(file, JSON.stringify({
    created_at: new Date().toISOString(),
    counts: { projects: projects.length, payment_records: payment_records.length },
    sales_by_period: salesByPeriod(projects),
    projects,
    payment_records,
  }, null, 2))
  console.log(`バックアップ作成: ${file}`)
  printReport(projects, payment_records)

} else if (cmd === 'reset') {
  const periodIdx = args.indexOf('--period')
  const period = periodIdx >= 0 ? args[periodIdx + 1] : null

  const all = await fetchAll('projects')
  const targets = period ? all.filter(p => p.period === period) : all
  const targetIds = new Set(targets.map(p => p.id))
  if (targets.length === 0) {
    console.log('削除対象がありません')
    process.exit(0)
  }

  // 1. 入金記録の案件参照を外す（記録そのものは残す）
  const payments = await fetchAll('payment_records')
  const affected = payments.filter(r => r.project_id && targetIds.has(r.project_id))
  for (const r of affected) {
    const { error } = await db.from('payment_records').update({ project_id: null }).eq('id', r.id)
    if (error) throw new Error(`入金記録の更新に失敗: ${error.message}`)
  }

  // 2. 削除対象を親に持つ案件の parent_id を外す
  const children = all.filter(p => p.parent_id && targetIds.has(p.parent_id))
  for (const c of children) {
    const { error } = await db.from('projects').update({ parent_id: null }).eq('id', c.id)
    if (error) throw new Error(`親子関係の解除に失敗: ${error.message}`)
  }

  // 3. 案件を削除
  for (const p of targets) {
    const { error } = await db.from('projects').delete().eq('id', p.id)
    if (error) throw new Error(`案件の削除に失敗 (${p.name}): ${error.message}`)
  }

  console.log(`削除: ${targets.length}件${period ? `（${period}）` : '（全期）'}`)
  console.log(`入金記録の紐付け解除: ${affected.length}件（記録自体は残っています）`)
  console.log(`親子関係の解除: ${children.length}件`)
  printReport(await fetchAll('projects'), await fetchAll('payment_records'))

} else if (cmd === 'restore') {
  const file = args[0] ?? join('backups', readdirSync('backups').filter(f => f.endsWith('.json')).sort().pop() ?? '')
  const snap = JSON.parse(readFileSync(file, 'utf8'))
  console.log(`復元元: ${file}（${snap.created_at} 時点 / 案件${snap.counts.projects}件）`)

  // 1. 現在の案件をすべて外して削除
  const payments = await fetchAll('payment_records')
  for (const r of payments.filter(r => r.project_id)) {
    await db.from('payment_records').update({ project_id: null }).eq('id', r.id)
  }
  const current = await fetchAll('projects')
  for (const p of current.filter(p => p.parent_id)) {
    await db.from('projects').update({ parent_id: null }).eq('id', p.id)
  }
  for (const p of current) {
    const { error } = await db.from('projects').delete().eq('id', p.id)
    if (error) throw new Error(`削除に失敗 (${p.name}): ${error.message}`)
  }

  // 2. 親案件から先に戻す（子を先に入れると parent_id が制約違反になる）
  const parents = snap.projects.filter(p => !p.parent_id)
  const kids = snap.projects.filter(p => p.parent_id)
  for (const chunk of [parents, kids]) {
    for (let i = 0; i < chunk.length; i += 100) {
      const { error } = await db.from('projects').insert(chunk.slice(i, i + 100))
      if (error) throw new Error(`復元に失敗: ${error.message}`)
    }
  }

  // 3. 入金記録の案件参照を戻す
  for (const r of snap.payment_records.filter(r => r.project_id)) {
    const { error } = await db.from('payment_records').update({ project_id: r.project_id }).eq('id', r.id)
    if (error) throw new Error(`入金記録の復元に失敗: ${error.message}`)
  }

  console.log('復元しました')
  printReport(await fetchAll('projects'), await fetchAll('payment_records'))

} else if (cmd === 'relink-payments') {
  const apply = args.includes('--apply')
  const projects = await fetchAll('projects')
  const payments = await fetchAll('payment_records')
  const orphans = payments.filter(r => !r.project_id)

  if (orphans.length === 0) {
    console.log('紐付けが外れている入金記録はありません')
    process.exit(0)
  }

  const { linked, ambiguous, unmatched } = matchPayments(orphans, projects)
  console.log(`紐付けが外れている入金記録: ${orphans.length}件`)
  console.log(`  貼り直せる     : ${linked.length}件`)
  console.log(`  候補が絞れない : ${ambiguous.length}件`)
  console.log(`  該当なし       : ${unmatched.length}件`)

  if (unmatched.length > 0) {
    console.log('\n■ 該当する案件が見つからなかった入金記録')
    for (const r of unmatched.slice(0, 15)) {
      console.log(`  ${r.payment_month}  ${yen(r.amount).padStart(12)}  ${r.client_name} / ${r.project_name}`.slice(0, 110))
    }
    if (unmatched.length > 15) console.log(`  ...ほか${unmatched.length - 15}件`)
  }

  if (!apply) {
    console.log('\n確認のみで終了しました。実際に貼り直すには --apply を付けてください。')
    process.exit(0)
  }

  let done = 0
  for (const { record, project } of linked) {
    const { error } = await db.from('payment_records').update({ project_id: project.id }).eq('id', record.id)
    if (error) throw new Error(`入金記録の更新に失敗: ${error.message}`)
    done++
  }
  console.log(`\n${done}件の入金記録を案件に貼り直しました`)

} else {
  console.log(readFileSync(new URL(import.meta.url)).toString().split('*/')[0])
  process.exit(1)
}
