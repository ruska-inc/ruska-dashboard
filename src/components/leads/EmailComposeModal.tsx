'use client'

import { useState, useEffect, useMemo } from 'react'
import Modal from '@/components/ui/Modal'
import { Send, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import type { SalesLead, EmailTemplate } from '@/lib/types'

interface Props {
  open: boolean
  onClose: () => void
  leads: SalesLead[]        // 送信対象(1件=個別、複数=一括)
  templates: EmailTemplate[]
  onSent: (results: { succeeded: number; failed: number }) => void
}

const inputClass = 'w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2'
const inputStyle = { background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }
const labelClass = 'block text-xs font-medium mb-1'
const labelStyle = { color: 'var(--muted)' }

// テンプレートの変数を差し込む
function fillTemplate(text: string, lead: SalesLead): string {
  return text
    .replace(/\{\{company_name\}\}/g, lead.company_name)
    .replace(/\{\{contact_person_name\}\}/g, lead.contact_person_name || 'ご担当者')
    .replace(/\{\{address\}\}/g, lead.address || '')
    .replace(/\{\{industry\}\}/g, lead.industry || '')
    .replace(/\{\{url\}\}/g, lead.url || '')
}

export default function EmailComposeModal({ open, onClose, leads, templates, onSent }: Props) {
  const defaultTemplate = useMemo(
    () => templates.find(t => t.is_default) ?? templates[0],
    [templates],
  )
  const [templateId, setTemplateId] = useState<string>(defaultTemplate?.id ?? '')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ succeeded: number; failed: number } | null>(null)
  const [previewLeadId, setPreviewLeadId] = useState<string>(leads[0]?.id ?? '')

  useEffect(() => {
    setTemplateId(defaultTemplate?.id ?? '')
    setError(null)
    setDone(null)
    setPreviewLeadId(leads[0]?.id ?? '')
  }, [open, leads, defaultTemplate])

  useEffect(() => {
    const tpl = templates.find(t => t.id === templateId)
    if (tpl) {
      setSubject(tpl.subject)
      setBody(tpl.body)
    }
  }, [templateId, templates])

  const previewLead = leads.find(l => l.id === previewLeadId) ?? leads[0]
  const previewSubject = previewLead ? fillTemplate(subject, previewLead) : subject
  const previewBody = previewLead ? fillTemplate(body, previewLead) : body

  const missingEmails = leads.filter(l => !l.email)
  const canSend = leads.length > 0 && missingEmails.length < leads.length && subject && body

  const handleSend = async () => {
    setSending(true)
    setError(null)
    try {
      const items = leads
        .filter(l => l.email)
        .map(l => ({
          lead_id: l.id,
          to_email: l.email!,
          subject: fillTemplate(subject, l),
          body: fillTemplate(body, l),
        }))
      const res = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, template_id: templateId || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || `エラー (${res.status})`)
        return
      }
      setDone({ succeeded: data.succeeded, failed: data.failed })
      onSent({ succeeded: data.succeeded, failed: data.failed })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  const title = leads.length === 1
    ? `メール送信: ${leads[0].company_name}`
    : `一括メール送信 (${leads.length}件)`

  return (
    <Modal open={open} onClose={onClose} title={title}>
      {done ? (
        <div className="text-center py-8 space-y-3">
          <CheckCircle size={48} className="mx-auto" style={{ color: 'var(--accent)' }} />
          <p className="font-semibold">送信完了</p>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            成功: {done.succeeded}件 / 失敗: {done.failed}件
          </p>
          <button onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg font-medium text-white"
            style={{ background: 'var(--primary)' }}>
            閉じる
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {leads.length > 1 && (
            <div className="text-xs px-3 py-2 rounded-md" style={{ background: 'rgba(219,234,254,0.5)', color: 'var(--muted)' }}>
              💡 {leads.length}件の企業に一括送信します。各企業ごとに変数が差し込まれます。
            </div>
          )}

          {missingEmails.length > 0 && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(254,243,199,0.6)' }}>
              <AlertCircle size={14} style={{ color: '#D97706', marginTop: 2 }} />
              <p className="text-xs" style={{ color: '#92400E' }}>
                メールアドレス未登録: {missingEmails.length}件({missingEmails.slice(0, 3).map(l => l.company_name).join(', ')}
                {missingEmails.length > 3 && ` 他${missingEmails.length - 3}件`})→ スキップされます
              </p>
            </div>
          )}

          {templates.length > 0 && (
            <div>
              <label className={labelClass} style={labelStyle}>テンプレート</label>
              <select value={templateId} onChange={e => setTemplateId(e.target.value)}
                className={inputClass} style={inputStyle}>
                <option value="">(空白から作成)</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}{t.is_default && ' (デフォルト)'}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className={labelClass} style={labelStyle}>件名</label>
            <input value={subject} onChange={e => setSubject(e.target.value)}
              className={inputClass} style={inputStyle} />
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>本文</label>
            <textarea value={body} onChange={e => setBody(e.target.value)}
              className={inputClass} style={{ ...inputStyle, minHeight: 200, fontFamily: 'monospace' }} />
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
              変数: <code>{'{{company_name}}'}</code>, <code>{'{{contact_person_name}}'}</code>, <code>{'{{address}}'}</code>, <code>{'{{industry}}'}</code>, <code>{'{{url}}'}</code>
            </p>
          </div>

          {/* プレビュー */}
          {previewLead && (
            <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.5)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                  プレビュー({leads.length > 1 && '対象企業:'}
                  {leads.length > 1 && (
                    <select value={previewLeadId} onChange={e => setPreviewLeadId(e.target.value)}
                      className="ml-1 text-xs bg-transparent">
                      {leads.map(l => (
                        <option key={l.id} value={l.id}>{l.company_name}</option>
                      ))}
                    </select>
                  )}
                  {leads.length === 1 && `→ ${previewLead.email || '(メール未登録)'}`}
                  )
                </span>
              </div>
              <p className="text-xs font-bold mb-1">{previewSubject}</p>
              <pre className="text-xs whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>
                {previewBody}
              </pre>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(254,226,226,0.6)' }}>
              <AlertCircle size={14} style={{ color: '#EF4444', marginTop: 2 }} />
              <p className="text-xs whitespace-pre-wrap" style={{ color: '#B91C1C' }}>{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
            <button onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50"
              style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
              キャンセル
            </button>
            <button onClick={handleSend} disabled={!canSend || sending}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium text-white hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--primary)' }}>
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {leads.length - missingEmails.length}件送信
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
