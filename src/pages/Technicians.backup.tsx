import { useEffect, useState } from 'react'
import { techniciansAPI } from '@/services/api'
import PageHeader from '@/components/layout/PageHeader'
import StatusBadge from '@/components/ui/StatusBadge'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'

export default function Technicians() {
  const [techs, setTechs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState<any>(null)
  const [performance, setPerformance] = useState<any>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', mobile: '', email: '', city: '', area: '', experience_years: 0, address: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const fetchTechs = async () => {
    setLoading(true)
    try {
      const res = await techniciansAPI.list({ page, per_page: 20, status: statusFilter || undefined })
      const d = res.data.data
      setTechs(d.technicians || d.items || [])
      setPages(d.pages || Math.ceil((d.total || 0) / 20))
      setTotal(d.total || 0)
    } catch { setTechs([]) } finally { setLoading(false) }
  }

  useEffect(() => { fetchTechs() }, [page, statusFilter])

  const openDetail = async (t: any) => {
    setSelected(t); setPerformance(null)
    try { const r = await techniciansAPI.performance(t.id); setPerformance(r.data.data) } catch {}
  }

  const handleCreate = async (e: any) => {
    e.preventDefault(); setSaving(true); setErr('')
    try {
      await techniciansAPI.create(form)
      setShowCreate(false); setForm({ name: '', mobile: '', email: '', city: '', area: '', experience_years: 0, address: '' })
      fetchTechs()
    } catch (ex: any) { setErr(ex.response?.data?.detail || 'Failed to create') } finally { setSaving(false) }
  }

  const statusOptions = ['', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'ON_LEAVE']

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader title="Technicians" subtitle={`${total} total technicians`}
        actions={<button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Add Technician</button>} />
      <div style={{ height: 20 }} />

      <div className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', gap: 12 }}>
        <select className="input" style={{ width: 180 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          {statusOptions.map(s => <option key={s} value={s}>{s || 'All Status'}</option>)}
        </select>
      </div>

      <div className="card">
        {loading ? <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div> : (
          <>
            <table className="data-table">
              <thead><tr>
                <th>Code</th><th>Name</th><th>Mobile</th><th>City / Area</th><th>Rating</th><th>Jobs</th><th>Status</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {techs.length === 0
                  ? <tr><td colSpan={8} style={{ textAlign: 'center', color: '#94A3B8', padding: 32 }}>No technicians found</td></tr>
                  : techs.map((t: any) => (
                    <tr key={t.id}>
                      <td><span style={{ fontFamily: 'monospace', fontSize: 12, background: '#F1F5F9', padding: '2px 6px', borderRadius: 4 }}>{t.technician_code}</span></td>
                      <td><span style={{ fontWeight: 600, color: '#1B4FD8', cursor: 'pointer' }} onClick={() => openDetail(t)}>{t.name}</span></td>
                      <td>{t.mobile}</td>
                      <td style={{ fontSize: 13 }}>{t.city || '—'}{t.area ? ` / ${t.area}` : ''}</td>
                      <td><span style={{ fontWeight: 600, color: '#059669' }}>⭐ {t.rating?.toFixed(1) || '—'}</span></td>
                      <td style={{ fontWeight: 600 }}>{t.total_jobs || 0}</td>
                      <td><StatusBadge status={t.status} /></td>
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={() => openDetail(t)}>View</button>
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
        <Modal title={`${selected.name} — ${selected.technician_code}`} onClose={() => setSelected(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            {[['Status', selected.status], ['City', selected.city || '—'], ['Area', selected.area || '—'],
              ['Experience', `${selected.experience_years || 0} yrs`], ['Rating', selected.rating?.toFixed(1) || '—'],
              ['Total Jobs', selected.total_jobs || 0]].map(([l, v]) => (
              <div key={l} style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>{l}</div>
                <div style={{ fontWeight: 600, color: '#0F172A' }}>{String(v)}</div>
              </div>
            ))}
          </div>
          {performance && (
            <>
              <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Performance</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {[['Assigned', performance.total_assigned], ['Completed', performance.completed], ['Rate', `${performance.completion_rate}%`]].map(([l, v]) => (
                  <div key={l} style={{ background: '#F0FDF4', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#059669' }}>{v}</div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>{l}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Modal>
      )}

      {showCreate && (
        <Modal title="Add Technician" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[['Name *', 'name', 'text'], ['Mobile *', 'mobile', 'tel'], ['Email', 'email', 'email'], ['City *', 'city', 'text'], ['Area', 'area', 'text'], ['Experience (yrs)', 'experience_years', 'number']].map(([label, key, type]) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{label}</label>
                  <input className="input" type={type} value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? +e.target.value : e.target.value }))} />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Address</label>
              <input className="input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            {err && <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginTop: 12 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? <Spinner size="sm" /> : 'Add Technician'}</button>
              <button className="btn btn-secondary" type="button" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
