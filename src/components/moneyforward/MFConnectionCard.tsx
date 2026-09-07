'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { Link2, Link2Off, AlertCircle, CheckCircle2 } from 'lucide-react'

interface MfStatus {
  configured: boolean
  connected: boolean
  office_name: string | null
  scope: string | null
  connected_at: string | null
  last_sync: {
    synced_at: string
    created_count: number
    updated_count: number
    error: string | null
  } | null
}

export default function MFConnectionCard() {
  const [status, setStatus] = useState<MfStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  // OAuthコールバックからの戻り値を表示し、URLからクエリを取り除く
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const connected = params.get('mf_connected')
    const error = params.get('mf_error')
    if (!connected && !error) return
    setMessage(connected ? { type: 'ok', text: connected } : { type: 'error', text: error! })
    params.delete('mf_connected')
    params.delete('mf_error')
    const rest = params.toString()
    window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''))
  }, [])

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/moneyforward/status')
      if (res.ok) setStatus(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const disconnect = async () => {
    setDisconnecting(true)
    try {
      const res = await fetch('/api/moneyforward/status', { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? '連携解除に失敗しました')
      setMessage({ type: 'ok', text: '連携を解除しました' })
      await load()
    } catch (e) {
      setMessage({ type: 'error', text: (e as Error).message })
    } finally {
      setDisconnecting(false)
      setConfirmOpen(false)
    }
  }

  const formatDateTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

  return (
    <Card>
      <ConfirmDialog
        open={confirmOpen}
        title="マネーフォワード連携を解除"
        message="保存済みのトークンを削除します。再度取り込むには連携し直す必要があります。取り込み済みの案件データは残ります。"
        onConfirm={disconnect}
        onCancel={() => setConfirmOpen(false)}
      />

      <CardHeader>
        <div className="flex items-center gap-2">
          <Link2 size={16} style={{ color: 'var(--accent)' }} />
          <CardTitle>マネーフォワード クラウド請求書 連携</CardTitle>
        </div>
        {status?.connected && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border bg-emerald-50 text-emerald-700 border-emerald-200">
            <CheckCircle2 size={11} />
            連携中
          </span>
        )}
      </CardHeader>

      {message && (
        <div
          className="flex items-start gap-2 px-3 py-2 rounded-lg mb-3"
          style={{ background: message.type === 'ok' ? 'rgba(220,252,231,0.6)' : 'rgba(254,226,226,0.6)' }}
        >
          {message.type === 'ok'
            ? <CheckCircle2 size={14} style={{ color: '#16A34A', marginTop: 2 }} />
            : <AlertCircle size={14} style={{ color: '#EF4444', marginTop: 2 }} />}
          <p className="text-xs" style={{ color: message.type === 'ok' ? '#15803D' : '#B91C1C' }}>{message.text}</p>
        </div>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--muted)' }}>読み込み中...</p>
      ) : !status?.configured ? (
        <div className="space-y-2">
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            OAuthアプリが未設定です。マネーフォワード クラウドの「アプリポータル」でアプリを作成し、
            以下の環境変数を設定してください。
          </p>
          <pre
            className="text-[11px] px-3 py-2 rounded-lg overflow-x-auto"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >{`MF_CLIENT_ID=...
MF_CLIENT_SECRET=...
MF_REDIRECT_URI=<このサイトのURL>/api/moneyforward/callback`}</pre>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            アプリポータルには MF_REDIRECT_URI と同じURLをリダイレクトURIとして登録し、
            クライアント認証方式は <code>CLIENT_SECRET_BASIC</code>（既定）のままにします。
            スコープ <code>mfc/invoice/data.read</code>（読み取りのみ）は連携時に要求します。
          </p>
        </div>
      ) : !status.connected ? (
        <div className="space-y-3">
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            マネーフォワードと連携すると、見積書を「見込み」、請求書を「請求済み」として案件一覧に取り込めます。
            取り込みは読み取りのみで、マネーフォワード側のデータは変更しません。
          </p>
          <a
            href="/api/moneyforward/auth"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--primary)' }}
          >
            <Link2 size={15} />
            マネーフォワードと連携する
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div>
              <dt style={{ color: 'var(--muted)' }}>事業者</dt>
              <dd className="font-medium">{status.office_name ?? '—'}</dd>
            </div>
            <div>
              <dt style={{ color: 'var(--muted)' }}>スコープ</dt>
              <dd className="font-medium">{status.scope ?? '—'}</dd>
            </div>
            <div>
              <dt style={{ color: 'var(--muted)' }}>連携日時</dt>
              <dd className="font-medium">{formatDateTime(status.connected_at)}</dd>
            </div>
            <div>
              <dt style={{ color: 'var(--muted)' }}>最終同期</dt>
              <dd className="font-medium">
                {status.last_sync
                  ? `${formatDateTime(status.last_sync.synced_at)}（新規${status.last_sync.created_count} / 更新${status.last_sync.updated_count}）`
                  : '未実行'}
              </dd>
            </div>
          </dl>

          {status.last_sync?.error && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(254,226,226,0.6)' }}>
              <AlertCircle size={14} style={{ color: '#EF4444', marginTop: 2 }} />
              <p className="text-xs whitespace-pre-wrap" style={{ color: '#B91C1C' }}>
                前回の同期で一部が失敗しています:{'\n'}{status.last_sync.error}
              </p>
            </div>
          )}

          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            取り込みは「プロジェクト」画面の <strong>MFから取り込み</strong> から実行します。
          </p>

          <div className="flex gap-2">
            <a
              href="/api/moneyforward/auth"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-gray-50"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              <Link2 size={13} />
              再連携
            </a>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={disconnecting}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-red-50 disabled:opacity-50"
              style={{ borderColor: 'var(--border)', color: '#B91C1C' }}
            >
              <Link2Off size={13} />
              {disconnecting ? '解除中...' : '連携を解除'}
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}
