import { useEffect, useState } from 'react'
import { escalationsAPI } from '@/services/api'
import PageHeader from '@/components/layout/PageHeader'
import StatusBadge from '@/components/ui/StatusBadge'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'

const PRIORITY_COLOR: Record<string, string> = {
  LOW: '#DCFCE7', MEDIUM: '#FEF9C3', HIGH: '#FED7AA', CRITICAL: '#FEE2E2'
}
const PRIORITY_TEXT: Record<string, string> = {
  LOW: '#166534', MEDIUM: '#854D0E', HIGH: '#9A3412', CRITICAL: '#991B1B'
}

export default function Escalations() {
  const [escalations, setEscalations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState<any>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [resolveModal, setResolveModal] = useState<any>(null)
  const [resolveNotes, setResolveNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ subject: '', description: '', priority: 'MEDIUM', booking_id: '' })

  const fetchEscalations = async () => {
    setLoading(true)
    try {
      const res = await escalationsAPI.list({ page, per_page: 20, status: statusFilter || undefined })
      const d = res.data.data
      setEscalations(d.items || [])
      setPages(d.pages || Math.ceil((d.total || 0) / 20))
      setTotal(d.total || 0)
    } catch { setEscalations([]) } finally { setLoading(false) }
  }

  useEffect(() => { fetchEscalations() }, [page, statusFilter])

  const handleResolve = async () => {
    if (!resolveModal) return
    setSaving(true)
    try {
      await escalationsAPI.resolve(resolveModal.id, { notes: resolveNotes })
      setResolveModal(null); setResolveNotes(''); fetchEscalations()
    } catch {} finally { setSaving(false) }
  }

  const handleCreate = async (e: any) => {
    e.preventDefault(); setSaving(true)
    try {
      const payload: any = { ...form }
      if (!form.booking_id) delete payload.booking_id
      // POST /escalations
      const res = await fetch('/api/v1/escalations', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token')}` }, body: JSON.stringify(payload) })
      if (res.ok) { setShowCreate(false); setForm({ subject: '', description: '', priority: 'MEDIUM', booking_id: '' }); fetchEscalations() }
    } catch {} finally { setSaving(false) }
  }

  const statuses = ['', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader title="Escalations & Complaints" subtitle={`${total} total escalations`}
        actions={<button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Escalation</button>} />
      <div style={{ height: 20 }} />

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <select className="input" style={{ width: 180 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          {statuses.map(s => <option key={s} value={s}>{s || 'All Status'}</option>)}
        </select>
      </div>

      <div className="card">
        {loading ? <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div> : (
          <>
            <table className="data-table">
              <thead><tr>
                <th>Subject</th><th>Customer</th><th>Booking</th><th>Priority</th><th>Status</th><th>Created</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {escalations.length === 0
                  ? <tr><td colSpan={5} style={{ textAlign: 'center', color: '#94A3B8', padding: 32 }}>No escalations found</td></tr>
                  : escalations.map((e: any) => (
                    <tr key={e.id}>
                      <td>
                        <span style={{ fontWeight: 600, color: '#1B4FD8', cursor: 'pointer' }} onClick={() => setSelected(e)}>{e.subject}</span>
                        <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{e.description?.slice(0, 60)}{e.description?.length > 60 ? '...' : ''}</div>
                      </td>
                      <td>
                        {e.customer_name ? (
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{e.customer_name}</div>
                            {e.customer_mobile && <div style={{ fontSize: 12, color: '#94A3B8' }}>{e.customer_mobile}</div>}
                          </div>
                        ) : <span style={{ color: '#94A3B8' }}>—</span>}
                      </td>
                      <td>
                        {e.booking_number ? (
                          <span style={{ fontFamily: 'monospace', fontSize: 12, background: '#EFF6FF', color: '#1B4FD8', padding: '2px 8px', borderRadius: 6 }}>
                            #{e.booking_number}
                          </span>
                        ) : <span style={{ color: '#94A3B8', fontSize: 12 }}>—</span>}
                      </td>
                      <td>
                        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: PRIORITY_COLOR[e.priority] || '#F1F5F9', color: PRIORITY_TEXT[e.priority] || '#334155' }}>
                          {e.priority}
                        </span>
                      </td>
                      <td><StatusBadge status={e.status} /></td>
                      <td style={{ fontSize: 12, color: '#94A3B8' }}>{new Date(e.created_at).toLocaleString('en-IN')}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => setSelected(e)}>View</button>
                          {e.status === 'OPEN' || e.status === 'IN_PROGRESS' ? (
                            <button className="btn btn-secondary btn-sm" style={{ color: '#059669', borderColor: '#86EFAC' }} onClick={() => setResolveModal(e)}>Resolve</button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <Pagination page={page} pages={pages} onPage={setPage} />
          </>
        )}
      </div>

      {selected && (
        <Modal title="Escalation Details" onClose={() => setSelected(null)}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: PRIORITY_COLOR[selected.priority] || '#F1F5F9', color: PRIORITY_TEXT[selected.priority] || '#334155' }}>{selected.priority}</span>
              <StatusBadge status={selected.status} />
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{selected.subject}</h3>
            <p style={{ fontSize: 14, color: '#334155', lineHeight: 1.6 }}>{selected.description}</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginBottom: 4 }}>CUSTOMER</div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{selected.customer_name || '—'}</div>
              {selected.customer_mobile && <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{selected.customer_mobile}</div>}
            </div>
            <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginBottom: 4 }}>BOOKING</div>
              {selected.booking_number
                ? <span style={{ fontFamily: 'monospace', fontSize: 13, background: '#EFF6FF', color: '#1B4FD8', padding: '2px 8px', borderRadius: 6 }}>#{selected.booking_number}</span>
                : <div style={{ fontWeight: 600, fontSize: 12, color: '#94A3B8' }}>{selected.booking_id || '—'}</div>
              }
            </div>
          </div>
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginBottom: 2 }}>CREATED</div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{new Date(selected.created_at).toLocaleString('en-IN')}</div>
            </div>
            {selected.resolved_at && (
              <div style={{ background: '#F0FDF4', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: '#166534', fontWeight: 600, marginBottom: 2 }}>RESOLVED AT</div>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#166534' }}>{new Date(selected.resolved_at).toLocaleString('en-IN')}</div>
              </div>
            )}
          </div>
          {selected.resolution_notes && (
            <div style={{ marginTop: 10, background: '#F0FDF4', borderRadius: 8, padding: '10px 14px', border: '1px solid #BBF7D0' }}>
              <div style={{ fontSize: 11, color: '#166534', fontWeight: 600, marginBottom: 4 }}>RESOLUTION NOTES</div>
              <div style={{ fontSize: 13, color: '#334155' }}>{selected.resolution_notes}</div>
            </div>
          )}
        </Modal>
      )}

      {resolveModal && (
        <Modal title="Resolve Escalation" onClose={() => setResolveModal(null)}>
          <p style={{ fontSize: 14, color: '#64748B', marginBottom: 16 }}><b>{resolveModal.subject}</b></p>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Resolution Notes</label>
          <textarea className="input" rows={4} value={resolveNotes} onChange={e => setResolveNotes(e.target.value)} placeholder="Describe how this was resolved..." style={{ resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="btn btn-primary" onClick={handleResolve} disabled={saving}>{saving ? <Spinner size="sm" /> : 'Mark Resolved'}</button>
            <button className="btn btn-secondary" onClick={() => setResolveModal(null)}>Cancel</button>
          </div>
        </Modal>
      )}

      {showCreate && (
        <Modal title="New Escalation" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Subject *</label>
              <input className="input" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Priority</label>
                <select className="input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                  {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Booking ID (optional)</label>
                <input className="input" value={form.booking_id} onChange={e => setForm(f => ({ ...f, booking_id: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Description *</label>
              <textarea className="input" rows={4} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ resize: 'vertical' }} required />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? <Spinner size="sm" /> : 'Create Escalation'}</button>
              <button className="btn btn-secondary" type="button" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
