import { useEffect, useState } from 'react'
import { refundsAPI } from '@/services/api'
import PageHeader from '@/components/layout/PageHeader'
import StatusBadge from '@/components/ui/StatusBadge'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'

export default function Refunds() {
  const [refunds, setRefunds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [processModal, setProcessModal] = useState<any>(null)
  const [processForm, setProcessForm] = useState({ method: 'ORIGINAL', reference: '', note: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const fetchData = async () => {
    setLoading(true)
    try {
      const r = await refundsAPI.list({ page, per_page: 20 })
      const d = r.data.data
      setRefunds(d.items || []); setPages(d.pages || 1); setTotal(d.total || 0)
    } catch { setRefunds([]) } finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [page])

  const handleApprove = async (id: string) => {
    try { await refundsAPI.approve(id); fetchData() } catch {}
  }

  const handleProcess = async (e: any) => {
    e.preventDefault(); setSaving(true); setErr('')
    try {
      await refundsAPI.process(processModal.id, processForm)
      setProcessModal(null); fetchData()
    } catch (ex: any) { setErr(ex.response?.data?.detail || 'Failed') } finally { setSaving(false) }
  }

  const statusColor = (s: string) => {
    if (s === 'APPROVED') return '#059669'
    if (s === 'PROCESSED') return '#1B4FD8'
    if (s === 'REJECTED') return '#DC2626'
    return '#D97706'
  }

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader title="Refunds" subtitle={`${total} refund requests`} />
      <div style={{ height: 20 }} />

      <div className="card">
        {loading ? <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div> : (
          <>
            <table className="data-table">
              <thead>
                <tr><th>Booking</th><th>Customer</th><th>Amount ₹</th><th>Reason</th><th>Status</th><th>Requested</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {refunds.length === 0
                  ? <tr><td colSpan={7} style={{ textAlign: 'center', color: '#94A3B8', padding: 32 }}>No refund requests</td></tr>
                  : refunds.map((r: any) => (
                    <tr key={r.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#1B4FD8' }}>{r.booking_number || '—'}</td>
                      <td style={{ fontWeight: 500 }}>{r.customer_name || r.customer_id}</td>
                      <td style={{ fontWeight: 700, color: '#DC2626' }}>₹{r.amount?.toLocaleString('en-IN')}</td>
                      <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: '#64748B' }}>{r.reason || '—'}</td>
                      <td><StatusBadge status={r.status || 'PENDING'} /></td>
                      <td style={{ fontSize: 12, color: '#94A3B8' }}>{r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN') : '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {r.status === 'PENDING' && (
                            <button className="btn btn-primary btn-sm" onClick={() => handleApprove(r.id)}>Approve</button>
                          )}
                          {r.status === 'APPROVED' && (
                            <button className="btn btn-secondary btn-sm" onClick={() => { setProcessModal(r); setErr('') }}>Process</button>
                          )}
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

      {processModal && (
        <Modal title="Process Refund" onClose={() => setProcessModal(null)}>
          <p style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>
            Processing refund of <b style={{ color: '#DC2626' }}>₹{processModal.amount?.toLocaleString('en-IN')}</b> for booking{' '}
            <b style={{ fontFamily: 'monospace' }}>{processModal.booking_number}</b>
          </p>
          <form onSubmit={handleProcess}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Refund Method *</label>
              <select className="input" value={processForm.method} onChange={e => setProcessForm(f => ({ ...f, method: e.target.value }))} required>
                <option value="ORIGINAL">Original Payment Method</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="WALLET">Wallet Credit</option>
                <option value="CASH">Cash</option>
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Transaction Reference</label>
              <input className="input" value={processForm.reference} onChange={e => setProcessForm(f => ({ ...f, reference: e.target.value }))} placeholder="UTR / Transaction ID" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Note</label>
              <input className="input" value={processForm.note} onChange={e => setProcessForm(f => ({ ...f, note: e.target.value }))} placeholder="Internal note" />
            </div>
            {err && <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 12 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? <Spinner size="sm" /> : 'Confirm Refund'}</button>
              <button className="btn btn-secondary" type="button" onClick={() => setProcessModal(null)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
