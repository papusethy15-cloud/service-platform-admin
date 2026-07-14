import { useEffect, useState } from 'react'
import { franchisesAPI } from '@/services/api'
import PageHeader from '@/components/layout/PageHeader'
import StatusBadge from '@/components/ui/StatusBadge'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'

const EMPTY_FORM = { name: '', owner_name: '', email: '', phone: '', city: '', state: '', address: '', territory: '' }

export default function Franchises() {
  const [franchises, setFranchises] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [addModal, setAddModal] = useState(false)
  const [detailModal, setDetailModal] = useState<any>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const fetchData = async () => {
    setLoading(true)
    try {
      const r = await franchisesAPI.list({ page, per_page: 20 })
      const d = r.data.data
      setFranchises(d.items || []); setPages(d.pages || 1); setTotal(d.total || 0)
    } catch { setFranchises([]) } finally { setLoading(false) }
  }

  const openDetail = async (f: any) => {
    try {
      const r = await franchisesAPI.get(f.id)
      setDetailModal(r.data.data)
    } catch { setDetailModal(f) }
  }

  useEffect(() => { fetchData() }, [page])

  const handleCreate = async (e: any) => {
    e.preventDefault(); setSaving(true); setErr('')
    try {
      await franchisesAPI.create(form)
      setAddModal(false); setForm({ ...EMPTY_FORM }); fetchData()
    } catch (ex: any) { setErr(ex.response?.data?.detail || 'Failed') } finally { setSaving(false) }
  }

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader
        title="Franchises"
        subtitle={`${total} franchise partners`}
        actions={<button className="btn btn-primary" onClick={() => { setAddModal(true); setErr('') }}>+ Add Franchise</button>}
      />
      <div style={{ height: 20 }} />

      <div className="card">
        {loading ? <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div> : (
          <>
            <table className="data-table">
              <thead>
                <tr><th>Name</th><th>Owner</th><th>City</th><th>Territory</th><th>Contact</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                {franchises.length === 0
                  ? <tr><td colSpan={7} style={{ textAlign: 'center', color: '#94A3B8', padding: 32 }}>No franchises registered</td></tr>
                  : franchises.map((f: any) => (
                    <tr key={f.id}>
                      <td style={{ fontWeight: 600, color: '#0F172A' }}>{f.name}</td>
                      <td>{f.owner_name || '—'}</td>
                      <td>{f.city || '—'}</td>
                      <td style={{ fontSize: 12, color: '#64748B' }}>{f.territory || '—'}</td>
                      <td style={{ fontSize: 12 }}>
                        <div>{f.email}</div>
                        <div style={{ color: '#94A3B8' }}>{f.phone}</div>
                      </td>
                      <td><StatusBadge status={f.status || 'ACTIVE'} /></td>
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={() => openDetail(f)}>View</button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <Pagination page={page} pages={pages} onPage={setPage} />
          </>
        )}
      </div>

      {addModal && (
        <Modal title="Add Franchise" onClose={() => setAddModal(false)}>
          <form onSubmit={handleCreate}>
            {[
              ['name', 'Franchise Name *', 'text', true],
              ['owner_name', 'Owner Name *', 'text', true],
              ['email', 'Email *', 'email', true],
              ['phone', 'Phone *', 'text', true],
              ['city', 'City *', 'text', true],
              ['state', 'State', 'text', false],
              ['territory', 'Territory / Zone', 'text', false],
              ['address', 'Address', 'text', false],
            ].map(([key, label, type, req]: any) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{label}</label>
                <input className="input" type={type} required={req}
                  value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={label.replace(' *', '')} />
              </div>
            ))}
            {err && <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 12 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? <Spinner size="sm" /> : 'Create Franchise'}</button>
              <button className="btn btn-secondary" type="button" onClick={() => setAddModal(false)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {detailModal && (
        <Modal title={detailModal.name} onClose={() => setDetailModal(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
            {[
              ['Owner', detailModal.owner_name], ['Email', detailModal.email], ['Phone', detailModal.phone],
              ['City', detailModal.city], ['State', detailModal.state], ['Territory', detailModal.territory],
              ['Status', detailModal.status], ['Joined', detailModal.created_at ? new Date(detailModal.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—'],
              ['Total Bookings', detailModal.total_bookings ?? '—'], ['Revenue ₹', detailModal.revenue ? `₹${Number(detailModal.revenue).toLocaleString('en-IN')}` : '—'],
            ].map(([k, v]: any) => (
              <div key={k}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 2 }}>{k}</div>
                <div style={{ fontWeight: 500, color: '#0F172A' }}>{v || '—'}</div>
              </div>
            ))}
          </div>
          {detailModal.address && (
            <div style={{ marginTop: 16, fontSize: 13, color: '#64748B' }}>
              <b>Address:</b> {detailModal.address}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
