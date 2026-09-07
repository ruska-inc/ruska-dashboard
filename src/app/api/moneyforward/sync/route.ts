import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMfCredentials, fetchBillings, fetchQuotes, MfError } from '@/lib/moneyforward/client'
import { buildSyncPlan, type SyncRow } from '@/lib/moneyforward/mapping'
import type { Project, PeriodSetting } from '@/lib/types'

export const dynamic = 'force-dynamic'
// MFへのページング取得と一括upsertがあるため長めに確保する
export const maxDuration = 60

interface PlanContext {
  rows: SyncRow[]
  quotesFetched: number
  billingsFetched: number
  range: { from: string; to: string }
}

/** 既定の取得期間: 過去2年分 */
function defaultRange() {
  const to = new Date()
  const from = new Date(to.getFullYear() - 2, to.getMonth(), 1)
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { from: fmt(from), to: fmt(to) }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** MFから帳票を取得し、既存プロジェクトと突合したプランを組み立てる */
async function buildPlan(
  req: NextRequest,
  supabase: Awaited<ReturnType<typeof createClient>>,
  fromParam: string | null,
  toParam: string | null,
): Promise<PlanContext> {
  const fallback = defaultRange()
  const from = fromParam && DATE_RE.test(fromParam) ? fromParam : fallback.from
  const to = toParam && DATE_RE.test(toParam) ? toParam : fallback.to

  const creds = getMfCredentials(new URL(req.url).origin)

  // マネーフォワードはリフレッシュのたびにリフレッシュトークンを再発行するため、
  // 見積書と請求書の取得は直列に行う（並列にすると同時リフレッシュで連携が壊れる）
  const quotes = await fetchQuotes(supabase, creds, { from, to })
  const billings = await fetchBillings(supabase, creds, { from, to })

  const [projectsRes, periodsRes] = await Promise.all([
    supabase.from('projects').select('*'),
    supabase.from('periods').select('*').order('sort_order', { ascending: false }),
  ])

  if (projectsRes.error) throw new MfError(`案件の読み込みに失敗しました: ${projectsRes.error.message}`, 500)
  if (periodsRes.error) throw new MfError(`期の読み込みに失敗しました: ${periodsRes.error.message}`, 500)

  const rows = buildSyncPlan(
    quotes,
    billings,
    (projectsRes.data ?? []) as Project[],
    (periodsRes.data ?? []) as PeriodSetting[],
  )

  return { rows, quotesFetched: quotes.length, billingsFetched: billings.length, range: { from, to } }
}

function errorResponse(e: unknown) {
  const status = e instanceof MfError ? e.status : 500
  const message = e instanceof MfError ? e.message : (e as Error).message
  return NextResponse.json({ error: message }, { status })
}

/** プレビュー: 取り込み内容を計算して返すだけで、DBは変更しない */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未ログインです' }, { status: 401 })

  const url = new URL(req.url)
  try {
    const plan = await buildPlan(req, supabase, url.searchParams.get('from'), url.searchParams.get('to'))
    return NextResponse.json({
      range: plan.range,
      quotes_fetched: plan.quotesFetched,
      billings_fetched: plan.billingsFetched,
      summary: {
        create: plan.rows.filter(r => r.action === 'create').length,
        update: plan.rows.filter(r => r.action === 'update').length,
        unchanged: plan.rows.filter(r => r.action === 'unchanged').length,
      },
      rows: plan.rows,
    })
  } catch (e) {
    return errorResponse(e)
  }
}

/**
 * 適用: 選択された行だけを取り込む。
 * プレビューと同じ手順でMFから取り直して差分を再計算するため、
 * 画面を開いたまま時間が経っていても古い値で上書きされることがない。
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未ログインです' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const keys: string[] = Array.isArray(body?.keys) ? body.keys : []
  if (keys.length === 0) {
    return NextResponse.json({ error: '取り込む対象が選択されていません' }, { status: 400 })
  }
  const selected = new Set(keys)

  let plan: PlanContext
  try {
    plan = await buildPlan(req, supabase, body?.from ?? null, body?.to ?? null)
  } catch (e) {
    return errorResponse(e)
  }

  const targets = plan.rows.filter(r => selected.has(r.key) && r.action !== 'unchanged')
  const syncedAt = new Date().toISOString()
  const created: Project[] = []
  const updated: Project[] = []
  const failures: { key: string; name: string; message: string }[] = []

  for (const row of targets) {
    try {
      if (row.action === 'create') {
        const { data, error } = await supabase
          .from('projects')
          .insert({
            name: row.name,
            ...row.values,
            payment_month: null,
            mf_synced_at: syncedAt,
          })
          .select()
          .single()
        if (error) throw new Error(error.message)
        created.push(data as Project)
      } else if (row.targetProjectId) {
        // プレビューで提示した差分だけを反映する
        const patch: Record<string, unknown> = { mf_synced_at: syncedAt }
        for (const change of row.changes) patch[change.field] = change.after
        const { data, error } = await supabase
          .from('projects')
          .update(patch)
          .eq('id', row.targetProjectId)
          .select()
          .single()
        if (error) throw new Error(error.message)
        updated.push(data as Project)
      }
    } catch (e) {
      failures.push({ key: row.key, name: row.name, message: (e as Error).message })
    }
  }

  await supabase.from('mf_sync_logs').insert({
    synced_by: user.id,
    range_from: plan.range.from,
    range_to: plan.range.to,
    quotes_fetched: plan.quotesFetched,
    billings_fetched: plan.billingsFetched,
    created_count: created.length,
    updated_count: updated.length,
    error: failures.length > 0 ? failures.map(f => `${f.name}: ${f.message}`).join('\n') : null,
  })

  return NextResponse.json({
    created_count: created.length,
    updated_count: updated.length,
    created,
    updated,
    failures,
  })
}
