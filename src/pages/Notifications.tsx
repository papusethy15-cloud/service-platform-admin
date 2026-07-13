import { useEffect, useState } from 'react'
import { notificationsAPI } from '@/services/api'
import PageHeader from '@/components/layout/PageHeader'
import StatusBadge from '@/components/ui/StatusBadge'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'

const CHANNELS = ['EMAIL', 'SMS', 'PUSH', 'WHATSAPP', 'IN_APP']
const AUDIENCES = ['ALL_CUSTOMERS', 'ALL_TECHNICIANS', 'SPECIFIC_USER', 'CUSTOM_SEGMENT']

export default function Notifications() {
  const [tab, setTab] = useState<'log' | 'send'>('log')
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Send notification form
  const [sendForm, setSendForm] = useState({
    title: '', body: '', channel: 'PUSH', audience: 'ALL_CUSTOMERS',
    user_id: '', booking_id: '', scheduled_at: ''
  })
  const [sending, setSending] = useState(false)
  const [sendErr, setSendErr] = useState('')
  const [sendSuccess, setSendSuccess] = useState(false)

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const r = await notificationsAPI.adminLog({ page, per_page: 25 })
      const d = r.data.data
      setLogs(d.items || []); setPages(d.pages || 1); setTotal(d.total || 0)
    } catch { setLogs([]) } finally { setLoading(false) }
  }

  useEffect(() => { if (tab === 'log') fetchLogs() }, [tab, page])

  const handleSend = async () => {
    setSending(true); setSendErr(''); setSendSuccess(false)
    try {
      if (sendForm.audience === 'SPECIFIC_USER') {
        // Single user — POST /notifications/send (requires user_id UUID)
        if (!sendForm.user_id.trim()) {
          setSendErr('User ID is required for SPECIFIC_USER audience')
          setSending(false)
          return
        }
        await notificationsAPI.send({
          user_id: sendForm.user_id.trim(),
          title: sendForm.title,
          body: sendForm.body,
          channel: sendForm.channel,
        })
      } else {
        // Audience-based — POST /notifications/bulk (no user_id required)
        const roleMap: Record<string, string | undefined> = {
          ALL_CUSTOMERS: 'CUSTOMER',
          ALL_TECHNICIANS: 'TECHNICIAN',
          CUSTOM_SEGMENT: undefined,
        }
        await notificationsAPI.bulk({
          role: roleMap[sendForm.audience] || undefined,
          title: sendForm.title,
          body: sendForm.body,
          channel: sendForm.channel,
        })
      }
      setSendSuccess(true)
      setSendForm({ title: '', body: '', channel: 'PUSH', audience: 'ALL_CUSTOMERS', user_id: '', booking_id: '', scheduled_at: '' })
      // Auto-switch to log tab so admin sees the sent notifications
      setTimeout(() => setTab('log'), 1200)
    } catch (ex: any) {
      setSendErr(ex.response?.data?.detail || ex.message || 'Failed to send notification')
    } finally { setSending(false) }
  }

  const tabStyle = (t: string) => ({
    padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
    background: tab === t ? '#1B4FD8' : '#F1F5F9', color: tab === t ? '#fff' : '#334155'
  })

  const channelColors: Record<string, string> = {
    PUSH: '#7C3AED', EMAIL: '#059669', SMS: '#D97706', WHATSAPP: '#16A34A', IN_APP: '#1B4FD8'
  }

  const fmt = (d: string) => d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader title="Notifications" subtitle="Send and track system notifications" />
      <div style={{ height: 20 }} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button style={tabStyle('log')} onClick={() => setTab('log')}>Notification Log</button>
        <button style={tabStyle('send')} onClick={() => setTab('send')}>Send Notification</button>
      </div>

      {tab === 'log' ? (
        <div className="card">
          {loading ? <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div> : (
            <>
              <table className="data-table">
                <thead>
                  <tr><th>Title</th><th>Channel</th><th>Recipient</th><th>Status</th><th>Sent At</th></tr>
                </thead>
                <tbody>
                  {logs.length === 0
                    ? <tr><td colSpan={5} style={{ textAlign: 'center', color: '#94A3B8', padding: 32 }}>No notifications sent yet</td></tr>
                    : logs.map((n: any) => (
                      <tr key={n.id}>
                        <td>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{n.title}</div>
                          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.body}</div>
                        </td>
                        <td>
                          <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                            background: `${channelColors[n.channel] || '#64748B'}18`, color: channelColors[n.channel] || '#64748B' }}>
                            {n.channel}
                          </span>
                        </td>
                        <td style={{ fontSize: 12 }}>
                          <div>{n.recipient_name || '—'}</div>
                          {n.recipient_role && (
                            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8,
                              background: n.recipient_role === 'TECHNICIAN' ? '#EFF6FF' : '#F0FDF4',
                              color: n.recipient_role === 'TECHNICIAN' ? '#1B4FD8' : '#059669',
                              fontWeight: 700 }}>
                              {n.recipient_role}
                            </span>
                          )}
                        </td>
                        <td><StatusBadge status={n.status || 'SENT'} /></td>
                        <td style={{ fontSize: 12, color: '#94A3B8' }}>{fmt(n.sent_at || n.created_at)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
              <Pagination page={page} pages={pages} onPage={setPage} />
            </>
          )}
        </div>
      ) : (
        <div className="card" style={{ maxWidth: 560 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>Compose Notification</h3>
          {sendSuccess && (
            <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#166534', fontSize: 13 }}>
              ✅ Notification sent successfully!
            </div>
          )}
          <div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Title *</label>
              <input className="input" value={sendForm.title} onChange={e => setSendForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Notification title" required />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Message Body *</label>
              <textarea className="input" style={{ height: 80, resize: 'vertical' }} value={sendForm.body}
                onChange={e => setSendForm(f => ({ ...f, body: e.target.value }))}
                placeholder="Notification message..." required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Channel *</label>
                <select className="input" value={sendForm.channel} onChange={e => setSendForm(f => ({ ...f, channel: e.target.value }))}>
                  {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Audience *</label>
                <select className="input" value={sendForm.audience} onChange={e => setSendForm(f => ({ ...f, audience: e.target.value }))}>
                  {AUDIENCES.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
            </div>
            {sendForm.audience === 'SPECIFIC_USER' && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>User ID *</label>
                <input className="input" value={sendForm.user_id} onChange={e => setSendForm(f => ({ ...f, user_id: e.target.value }))}
                  placeholder="Paste user UUID" required />
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Booking Reference (optional)</label>
              <input className="input" value={sendForm.booking_id} onChange={e => setSendForm(f => ({ ...f, booking_id: e.target.value }))}
                placeholder="Booking UUID" />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Schedule At (optional)</label>
              <input className="input" type="datetime-local" value={sendForm.scheduled_at}
                onChange={e => setSendForm(f => ({ ...f, scheduled_at: e.target.value }))} />
            </div>
            {sendErr && <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 12 }}>{sendErr}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" type="button" onClick={handleSend} disabled={sending}>
                {sending ? <Spinner size="sm" /> : '🔔 Send Notification'}
              </button>
              <button className="btn btn-secondary" type="button"
                onClick={() => setSendForm({ title: '', body: '', channel: 'PUSH', audience: 'ALL_CUSTOMERS', user_id: '', booking_id: '', scheduled_at: '' })}>
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
