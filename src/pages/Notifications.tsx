import { useEffect, useState, useRef } from 'react'
import { notificationsAPI } from '@/services/api'
import Pagination from '@/components/ui/Pagination'
import Spinner from '@/components/ui/Spinner'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (d: string) =>
  d ? new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : '—'

const channelMeta: Record<string, { color: string; bg: string; icon: string }> = {
  PUSH:      { color: '#7C3AED', bg: '#F5F3FF', icon: '🔔' },
  EMAIL:     { color: '#059669', bg: '#ECFDF5', icon: '✉️' },
  SMS:       { color: '#D97706', bg: '#FFFBEB', icon: '💬' },
  WHATSAPP:  { color: '#16A34A', bg: '#F0FDF4', icon: '📱' },
  IN_APP:    { color: '#1B4FD8', bg: '#EFF6FF', icon: '🔵' },
}

const audienceMeta: Record<string, { label: string; icon: string; color: string }> = {
  ALL_CUSTOMERS:   { label: 'All Customers',   icon: '👥', color: '#059669' },
  ALL_TECHNICIANS: { label: 'All Technicians', icon: '🔧', color: '#1B4FD8' },
  SPECIFIC_USER:   { label: 'Specific User',   icon: '👤', color: '#7C3AED' },
}

const QUICK_TEMPLATES = [
  { title: 'Service Reminder', body: 'Your scheduled service is coming up soon. We look forward to serving you!' },
  { title: 'Payment Due', body: 'You have a pending payment for your recent service booking. Please complete the payment.' },
  { title: 'Booking Confirmed', body: 'Your booking has been confirmed. Our technician will arrive at the scheduled time.' },
  { title: 'Work Completed', body: 'Your service has been completed successfully. Thank you for choosing us!' },
]

// ── Component ─────────────────────────────────────────────────────────────────
export default function Notifications() {
  const [tab, setTab] = useState<'log' | 'send'>('log')

  // Log state
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Send form state
  const [form, setForm] = useState({
    title: '', body: '', channel: 'PUSH', audience: 'ALL_CUSTOMERS', user_id: '',
  })
  const [sending, setSending] = useState(false)
  const [sendErr, setSendErr] = useState('')
  const [sendResult, setSendResult] = useState<{ sent: number; push: number } | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const r = await notificationsAPI.adminLog({ page, per_page: 20 })
      const d = r.data.data
      setLogs(d.items || [])
      setPages(d.pages || 1)
      setTotal(d.total || 0)
    } catch { setLogs([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (tab === 'log') fetchLogs() }, [tab, page])

  const applyTemplate = (t: { title: string; body: string }) => {
    setForm(f => ({ ...f, title: t.title, body: t.body }))
    bodyRef.current?.focus()
  }

  const handleSend = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      setSendErr('Title and message body are required.')
      return
    }
    if (form.audience === 'SPECIFIC_USER' && !form.user_id.trim()) {
      setSendErr('User ID is required for Specific User audience.')
      return
    }
    setSending(true); setSendErr(''); setSendResult(null)
    try {
      let res: any
      if (form.audience === 'SPECIFIC_USER') {
        res = await notificationsAPI.send({
          user_id: form.user_id.trim(),
          title: form.title.trim(),
          body: form.body.trim(),
          channel: form.channel,
        })
        setSendResult({ sent: 1, push: res.data?.data?.push_sent ? 1 : 0 })
      } else {
        const roleMap: Record<string, string> = {
          ALL_CUSTOMERS: 'CUSTOMER',
          ALL_TECHNICIANS: 'TECHNICIAN',
        }
        res = await notificationsAPI.bulk({
          role: roleMap[form.audience],
          title: form.title.trim(),
          body: form.body.trim(),
          channel: form.channel,
        })
        const d = res.data?.data || {}
        setSendResult({ sent: d.sent_to || 0, push: d.push_sent || 0 })
      }
      setForm(f => ({ ...f, title: '', body: '', user_id: '' }))
      setTimeout(() => { setSendResult(null); setTab('log') }, 3500)
    } catch (ex: any) {
      setSendErr(ex.response?.data?.detail || ex.message || 'Failed to send notification')
    } finally { setSending(false) }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, boxShadow: '0 4px 14px rgba(124,58,237,0.3)',
          }}>🔔</div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 }}>Notifications</h1>
            <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>
              Send push notifications and track delivery
            </p>
          </div>
        </div>

        {/* Stats strip */}
        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          {[
            { label: 'Total Sent', value: total, icon: '📤', color: '#1B4FD8' },
            { label: 'Today', value: logs.filter(n => new Date(n.created_at).toDateString() === new Date().toDateString()).length, icon: '📅', color: '#059669' },
            { label: 'Push', value: logs.filter(n => n.channel === 'PUSH').length, icon: '🔔', color: '#7C3AED' },
          ].map(s => (
            <div key={s.label} style={{
              flex: 1, background: '#fff', borderRadius: 14,
              border: '1px solid #E2E8F0', padding: '14px 18px',
              display: 'flex', alignItems: 'center', gap: 12,
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, fontSize: 18,
                background: `${s.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 4, background: '#F1F5F9',
        borderRadius: 12, padding: 4, width: 'fit-content', marginBottom: 24,
      }}>
        {[
          { key: 'log',  label: 'Notification Log',  icon: '📋' },
          { key: 'send', label: 'Send Notification',  icon: '📤' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)} style={{
            padding: '9px 20px', borderRadius: 9, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
            background: tab === t.key ? '#fff' : 'transparent',
            color: tab === t.key ? '#1B4FD8' : '#64748B',
            boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            transition: 'all .15s',
          }}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* ── LOG TAB ──────────────────────────────────────────────────────── */}
      {tab === 'log' && (
        <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>
              All Notifications <span style={{ fontWeight: 400, color: '#94A3B8', fontSize: 12 }}>({total} total)</span>
            </span>
            <button onClick={fetchLogs} style={{
              background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8,
              padding: '6px 14px', fontSize: 12, fontWeight: 600, color: '#475569', cursor: 'pointer',
            }}>↻ Refresh</button>
          </div>

          {loading ? (
            <div style={{ padding: 60, textAlign: 'center' }}><Spinner /></div>
          ) : logs.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
              <div style={{ color: '#94A3B8', fontWeight: 600 }}>No notifications sent yet</div>
              <div style={{ color: '#CBD5E1', fontSize: 13, marginTop: 4 }}>Send your first notification to get started</div>
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      {['Notification', 'Channel', 'Recipient', 'Role', 'Sent At'].map(h => (
                        <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '.04em', borderBottom: '1px solid #F1F5F9' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((n: any, i: number) => {
                      const ch = channelMeta[n.channel] || { color: '#64748B', bg: '#F8FAFC', icon: '📩' }
                      return (
                        <tr key={n.id} style={{ borderBottom: '1px solid #F8FAFC', transition: 'background .1s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFF')}
                          onMouseLeave={e => (e.currentTarget.style.background = '')}>
                          <td style={{ padding: '13px 16px', maxWidth: 280 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                              <div style={{
                                width: 34, height: 34, borderRadius: 9, background: ch.bg,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 16, flexShrink: 0,
                              }}>{ch.icon}</div>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 13, color: '#0F172A' }}>{n.title}</div>
                                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{n.body}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '13px 16px' }}>
                            <span style={{
                              padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                              background: ch.bg, color: ch.color, display: 'inline-flex', alignItems: 'center', gap: 4,
                            }}>{ch.icon} {n.channel}</span>
                          </td>
                          <td style={{ padding: '13px 16px', fontSize: 13, color: '#334155', fontWeight: 500 }}>
                            {n.recipient_name || <span style={{ color: '#CBD5E1' }}>—</span>}
                          </td>
                          <td style={{ padding: '13px 16px' }}>
                            {n.recipient_role ? (
                              <span style={{
                                padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                                background: n.recipient_role === 'TECHNICIAN' ? '#EFF6FF' : '#F0FDF4',
                                color: n.recipient_role === 'TECHNICIAN' ? '#1B4FD8' : '#059669',
                              }}>{n.recipient_role}</span>
                            ) : <span style={{ color: '#CBD5E1', fontSize: 12 }}>—</span>}
                          </td>
                          <td style={{ padding: '13px 16px', fontSize: 12, color: '#94A3B8', whiteSpace: 'nowrap' }}>
                            {fmt(n.sent_at || n.created_at)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '12px 20px', borderTop: '1px solid #F1F5F9' }}>
                <Pagination page={page} pages={pages} onPage={setPage} />
              </div>
            </>
          )}
        </div>
      )}

      {/* ── SEND TAB ─────────────────────────────────────────────────────── */}
      {tab === 'send' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>

          {/* Left — Compose */}
          <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #F1F5F9', background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>📤 Compose Notification</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 }}>Send push notifications to customers or technicians</div>
            </div>

            <div style={{ padding: '22px' }}>
              {/* Success banner */}
              {sendResult && (
                <div style={{
                  background: 'linear-gradient(135deg, #ECFDF5, #F0FDF4)',
                  border: '1px solid #86EFAC', borderRadius: 12,
                  padding: '14px 18px', marginBottom: 20,
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{ fontSize: 28 }}>✅</div>
                  <div>
                    <div style={{ fontWeight: 700, color: '#166534', fontSize: 14 }}>Notification Sent Successfully!</div>
                    <div style={{ color: '#15803D', fontSize: 12, marginTop: 2 }}>
                      Delivered to <strong>{sendResult.sent}</strong> user{sendResult.sent !== 1 ? 's' : ''} &nbsp;·&nbsp;
                      <strong>{sendResult.push}</strong> push notification{sendResult.push !== 1 ? 's' : ''} fired
                    </div>
                  </div>
                </div>
              )}

              {/* Audience selector — pill style */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  Target Audience *
                </label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {Object.entries(audienceMeta).map(([key, meta]) => (
                    <button key={key} onClick={() => setForm(f => ({ ...f, audience: key }))} style={{
                      padding: '9px 16px', borderRadius: 20, border: `2px solid`,
                      borderColor: form.audience === key ? meta.color : '#E2E8F0',
                      background: form.audience === key ? `${meta.color}12` : '#F8FAFC',
                      color: form.audience === key ? meta.color : '#64748B',
                      fontWeight: 700, fontSize: 13, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6,
                      transition: 'all .15s',
                    }}>
                      <span>{meta.icon}</span>{meta.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* User ID (specific user only) */}
              {form.audience === 'SPECIFIC_USER' && (
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    User ID *
                  </label>
                  <input
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 10,
                      border: '1.5px solid #E2E8F0', fontSize: 13, color: '#0F172A',
                      outline: 'none', boxSizing: 'border-box',
                      fontFamily: 'monospace',
                    }}
                    value={form.user_id}
                    onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))}
                    placeholder="Paste user UUID here"
                  />
                </div>
              )}

              {/* Channel selector */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  Channel *
                </label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {Object.entries(channelMeta).map(([key, meta]) => (
                    <button key={key} onClick={() => setForm(f => ({ ...f, channel: key }))} style={{
                      padding: '7px 14px', borderRadius: 20, border: `2px solid`,
                      borderColor: form.channel === key ? meta.color : '#E2E8F0',
                      background: form.channel === key ? meta.bg : '#F8FAFC',
                      color: form.channel === key ? meta.color : '#94A3B8',
                      fontWeight: 700, fontSize: 12, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 5,
                      transition: 'all .15s',
                    }}>
                      {meta.icon} {key}
                    </button>
                  ))}
                </div>
                {form.channel === 'PUSH' && (
                  <div style={{ marginTop: 8, fontSize: 11, color: '#7C3AED', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    ⚡ Push notifications are sent directly to the user's device via FCM
                  </div>
                )}
              </div>

              {/* Title */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  Notification Title *
                </label>
                <input
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 10,
                    border: `1.5px solid ${form.title ? '#6366F1' : '#E2E8F0'}`,
                    fontSize: 14, fontWeight: 600, color: '#0F172A',
                    outline: 'none', boxSizing: 'border-box', transition: 'border-color .15s',
                  }}
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Important Service Update"
                  maxLength={100}
                />
                <div style={{ textAlign: 'right', fontSize: 11, color: '#CBD5E1', marginTop: 3 }}>{form.title.length}/100</div>
              </div>

              {/* Body */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  Message Body *
                </label>
                <textarea
                  ref={bodyRef}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 10,
                    border: `1.5px solid ${form.body ? '#6366F1' : '#E2E8F0'}`,
                    fontSize: 13, color: '#0F172A', resize: 'vertical',
                    minHeight: 100, outline: 'none', boxSizing: 'border-box',
                    lineHeight: 1.6, transition: 'border-color .15s', fontFamily: 'inherit',
                  }}
                  value={form.body}
                  onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                  placeholder="Write your notification message here..."
                  maxLength={500}
                />
                <div style={{ textAlign: 'right', fontSize: 11, color: '#CBD5E1', marginTop: 3 }}>{form.body.length}/500</div>
              </div>

              {/* Error */}
              {sendErr && (
                <div style={{
                  background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10,
                  padding: '11px 14px', marginBottom: 16, color: '#DC2626', fontSize: 13,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>⚠️ {sendErr}</div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={handleSend}
                  disabled={sending || !form.title.trim() || !form.body.trim()}
                  style={{
                    flex: 1, padding: '13px 20px', borderRadius: 12, border: 'none',
                    background: sending || !form.title.trim() || !form.body.trim()
                      ? '#E2E8F0'
                      : 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                    color: sending || !form.title.trim() || !form.body.trim() ? '#94A3B8' : '#fff',
                    fontWeight: 800, fontSize: 14, cursor: sending ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: sending ? 'none' : '0 4px 14px rgba(99,102,241,0.35)',
                    transition: 'all .15s',
                  }}
                >
                  {sending ? <><Spinner size="sm" /> Sending…</> : <><span>🚀</span> Send Notification</>}
                </button>
                <button
                  onClick={() => setForm(f => ({ ...f, title: '', body: '', user_id: '' }))}
                  style={{
                    padding: '13px 18px', borderRadius: 12, border: '1.5px solid #E2E8F0',
                    background: '#F8FAFC', color: '#64748B', fontWeight: 700,
                    fontSize: 13, cursor: 'pointer',
                  }}
                >Clear</button>
              </div>
            </div>
          </div>

          {/* Right — Preview + Quick templates */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Phone preview */}
            <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #F1F5F9', fontWeight: 700, fontSize: 13, color: '#475569' }}>
                📱 Push Preview
              </div>
              <div style={{ padding: '18px' }}>
                {/* Android-style notification preview */}
                <div style={{
                  background: '#1E1E1E', borderRadius: 16, padding: '12px 14px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: 5, background: '#7C3AED',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
                    }}>🔔</div>
                    <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>Bibek Enterprises · now</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#F9FAFB', marginBottom: 3 }}>
                    {form.title || <span style={{ color: '#4B5563', fontStyle: 'italic' }}>Notification title…</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.4 }}>
                    {form.body || <span style={{ fontStyle: 'italic' }}>Message body will appear here…</span>}
                  </div>
                </div>

                <div style={{ marginTop: 12, padding: '10px 12px', background: '#F8FAFC', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginBottom: 6 }}>DELIVERY TARGET</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{audienceMeta[form.audience]?.icon}</span>
                    {audienceMeta[form.audience]?.label}
                  </div>
                  <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {channelMeta[form.channel]?.icon} {form.channel}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick templates */}
            <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #F1F5F9', fontWeight: 700, fontSize: 13, color: '#475569' }}>
                ⚡ Quick Templates
              </div>
              <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {QUICK_TEMPLATES.map(t => (
                  <button key={t.title} onClick={() => applyTemplate(t)} style={{
                    background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 10,
                    padding: '10px 12px', textAlign: 'left', cursor: 'pointer',
                    transition: 'all .15s',
                  }}
                    onMouseEnter={e => { (e.currentTarget.style.borderColor = '#6366F1'); (e.currentTarget.style.background = '#F5F3FF') }}
                    onMouseLeave={e => { (e.currentTarget.style.borderColor = '#E2E8F0'); (e.currentTarget.style.background = '#F8FAFC') }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 2 }}>{t.title}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.body}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
