import { useEffect, useState, useCallback, useRef } from 'react'
import { refundsAPI } from '@/services/api'
import PageHeader from '@/components/layout/PageHeader'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  PENDING:   { bg: '#FEF3C7', color: '#D97706' },
  APPROVED:  { bg: '#DCFCE7', color: '#059669' },
  PROCESSED: { bg: '#EFF6FF', color: '#1B4FD8' },
  REJECTED:  { bg: '#FEE2E2', color: '#DC2626' },
  CANCELLED: { bg: '#F1F5F9', color: '#64748B' },
}

const METHOD_OPTS = ['ORIGINAL', 'RAZORPAY', 'BANK_TRANSFER', 'UPI', 'CASH', 'WALLET']
const fmt = (n: any) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
const fmtD = (d: string) => d ? new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

export default function Refunds() {
  const [refunds, setRefunds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<any>({})

  // Filters
  const [filterStatus, setFilterStatus] = useState('')
  const [filterMethod, setFilterMethod] = useState('')
  const [search, setSearch] = useState('')
  const filterRef = useRef({ status: '', method: '', search: '' })

  // Modals
  const [viewModal, setViewModal] = useState<any>(null)
  const [processModal, setProcessModal] = useState<any>(null)
  const [processForm, setProcessForm] = useState({ method: 'ORIGINAL', reference: '', note: '', upi_id: '', bank_account: '', bank_ifsc: '', beneficiary_name: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [okMsg, setOkMsg] = useState('')

  const fetchData = useCallback(async (pg: number, f?: typeof filterRef.current) => {
    setLoading(true)
    try {
      const fi = f ?? filterRef.current
      const params: any = { page: pg, per_page: 20 }
      if (fi.status) params.status = fi.status
      if (fi.method) params.refund_method = fi.method
      if (fi.search) params.search = fi.search
      const r = await refundsAPI.list(params)
      const d = r.data.data
      setRefunds(d.items || [])
      setPages(d.pages || 1)
      setTotal(d.total || 0)
      setStats(d.stats || {})
    } catch { setRefunds([]) } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData(page) }, [page, fetchData])

  const applyFilter = () => {
    const f = { status: filterStatus, method: filterMethod, search }
    filterRef.current = f; setPage(1); fetchData(1, f)
  }
  const resetFilter = () => {
    setFilterStatus(''); setFilterMethod(''); setSearch('')
    const f = { status: '', method: '', search: '' }
    filterRef.current = f; setPage(1); fetchData(1, f)
  }

  const handleApprove = async (id: string) => {
    if (!window.confirm('Approve this refund request?')) return
    try { await refundsAPI.approve(id); fetchData(page) } catch (e: any) { alert(e.response?.data?.detail || 'Failed') }
  }
  const handleReject = async (id: string) => {
    const reason = window.prompt('Enter reason for rejection:')
    if (!reason) return
    try { await refundsAPI.process(id, { method: 'ORIGINAL', note: reason, status: 'REJECTED' }); fetchData(page) }
    catch (e: any) { alert(e.response?.data?.detail || 'Failed') }
  }

  const handleProcess = async () => {
    setSaving(true); setErr(''); setOkMsg('')
    try {
      const payload: any = { method: processForm.method, note: processForm.note }
      if (processForm.reference) payload.reference = processForm.reference
      if (processForm.upi_id) payload.upi_id = processForm.upi_id
      if (processForm.bank_account) payload.bank_account = processForm.bank_account
      if (processForm.bank_ifsc) payload.bank_ifsc = processForm.bank_ifsc
      if (processForm.beneficiary_name) payload.beneficiary_name = processForm.beneficiary_name
      await refundsAPI.process(processModal.id, payload)
      // If Razorpay method and payment ID exists
      if (processForm.method === 'RAZORPAY' && processModal.razorpay_payment_id) {
        await refundsAPI.razorpayRefund(processModal.id)
        setOkMsg('Razorpay refund initiated! Will reflect in 5–7 business days.')
      } else {
        setOkMsg(`Refund marked as processed via ${processForm.method}. Please transfer manually if needed.`)
      }
      fetchData(page)
      setTimeout(() => { setProcessModal(null); setOkMsg('') }, 2000)
    } catch (e: any) { setErr(e.response?.data?.detail || 'Failed to process refund') } finally { setSaving(false) }
  }

  const statCards = [
    { label: 'Total Requests', value: stats.total || total, color: '#1B4FD8', icon: '📋' },
    { label: 'Pending',        value: stats.pending || 0,   color: '#D97706', icon: '⏳' },
    { label: 'Total Refunded', value: fmt(stats.total_amount), color: '#DC2626', icon: '↩️' },
    { label: 'Processed',      value: stats.processed || 0,  color: '#059669', icon: '✅' },
  ]

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader title="Refunds" subtitle="Manage all refund requests and processing" />
      <div style={{ height: 16 }} />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
        {statCards.map(s => (
          <div key={s.label} className="card" style={{ padding: '14px 16px', borderLeft: `3px solid ${s.color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
              <span style={{ fontSize: 22 }}>{s.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>SEARCH</label>
            <input className="input" value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyFilter()}
              placeholder="Booking #, customer name..." style={{ width: '100%' }} />
          </div>
          <div style={{ flex: '0 1 140px' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>STATUS</label>
            <select className="input" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: '100%' }}>
              <option value="">All</option>
              {['PENDING','APPROVED','PROCESSED','REJECTED'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ flex: '0 1 160px' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>METHOD</label>
            <select className="input" value={filterMethod} onChange={e => setFilterMethod(e.target.value)} style={{ width: '100%' }}>
              <option value="">All Methods</option>
              {['RAZORPAY','CASH','BANK_TRANSFER','UPI','WALLET'].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={applyFilter}>Apply</button>
            <button className="btn btn-secondary" onClick={resetFilter}>Reset</button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? <div style={{ padding: 60, textAlign: 'center' }}><Spinner /></div> : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th><th>Booking</th><th>Customer</th><th>Amount</th>
                    <th>Method</th><th>Reason</th><th>Status</th><th>Requested</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {refunds.length === 0 ? (
                    <tr><td colSpan={9} style={{ textAlign: 'center', color: '#94A3B8', padding: 48 }}>No refund requests found</td></tr>
                  ) : refunds.map((r: any, idx: number) => {
                    const ss = STATUS_STYLE[r.status] || { bg: '#F1F5F9', color: '#64748B' }
                    return (
                      <tr key={r.id}>
                        <td style={{ color: '#94A3B8', fontSize: 12 }}>{(page-1)*20+idx+1}</td>
                        <td>
                          <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#7C3AED', fontWeight: 700, cursor: 'pointer' }}
                            onClick={() => setViewModal(r)}>{r.booking_number || '—'}</span>
                        </td>
                        <td style={{ fontSize: 13 }}>{r.customer_name || '—'}</td>
                        <td><span style={{ fontWeight: 700, color: '#DC2626', fontSize: 14 }}>{fmt(r.amount)}</span></td>
                        <td>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: '#F1F5F9', color: '#475569', fontWeight: 600 }}>
                            {r.refund_method || '—'}
                          </span>
                          {r.razorpay_payment_id && (
                            <div style={{ fontSize: 10, color: '#1B4FD8', fontFamily: 'monospace', marginTop: 2 }}>
                              {r.razorpay_payment_id.slice(0, 16)}…
                            </div>
                          )}
                        </td>
                        <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: '#64748B' }}>
                          {r.reason || '—'}
                        </td>
                        <td>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: ss.bg, color: ss.color }}>
                            {r.status}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: '#94A3B8', whiteSpace: 'nowrap' }}>{fmtD(r.created_at)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setViewModal(r)}>View</button>
                            {r.status === 'PENDING' && (
                              <>
                                <button className="btn btn-primary btn-sm" onClick={() => handleApprove(r.id)}>Approve</button>
                                <button className="btn btn-sm" onClick={() => handleReject(r.id)}
                                  style={{ background: '#FEE2E2', color: '#DC2626', border: 'none', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                  Reject
                                </button>
                              </>
                            )}
                            {r.status === 'APPROVED' && (
                              <button className="btn btn-sm" onClick={() => { setProcessModal(r); setProcessForm({ method: r.razorpay_payment_id ? 'RAZORPAY' : 'CASH', reference: '', note: '', upi_id: '', bank_account: '', bank_ifsc: '', beneficiary_name: '' }); setErr(''); setOkMsg('') }}
                                style={{ background: '#EFF6FF', color: '#1B4FD8', border: 'none', padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                Process
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pages={pages} onPage={setPage} />
          </>
        )}
      </div>

      {/* View Modal */}
      {viewModal && (
        <Modal title={`Refund — ${viewModal.booking_number || viewModal.id?.slice(0,8)}`} onClose={() => setViewModal(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              ['Booking #', viewModal.booking_number || '—'],
              ['Customer', viewModal.customer_name || '—'],
              ['Amount', fmt(viewModal.amount)],
              ['Status', viewModal.status || '—'],
              ['Refund Method', viewModal.refund_method || '—'],
              ['Requested On', fmtD(viewModal.created_at)],
              ...(viewModal.processed_at ? [['Processed On', fmtD(viewModal.processed_at)]] : []),
              ...(viewModal.razorpay_payment_id ? [['Razorpay Payment ID', viewModal.razorpay_payment_id]] : []),
              ...(viewModal.razorpay_refund_id ? [['Razorpay Refund ID', viewModal.razorpay_refund_id]] : []),
              ...(viewModal.transaction_reference ? [['Transaction Ref', viewModal.transaction_reference]] : []),
              ...(viewModal.invoice_number ? [['Invoice #', viewModal.invoice_number]] : []),
            ].map(([k, v]) => (
              <div key={k} style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>{k}</div>
                <div style={{ fontWeight: 600, fontSize: 13, fontFamily: (v as string).startsWith('pay_') || (v as string).startsWith('rfnd_') ? 'monospace' : undefined }}>{v as string}</div>
              </div>
            ))}
          </div>
          {viewModal.reason && (
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#D97706', marginBottom: 4 }}>REASON FOR REFUND</div>
              <div style={{ fontSize: 13, color: '#78350F' }}>{viewModal.reason}</div>
            </div>
          )}
          {viewModal.notes && (
            <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 4 }}>INTERNAL NOTE</div>
              <div style={{ fontSize: 13, color: '#334155' }}>{viewModal.notes}</div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setViewModal(null)}>Close</button>
            {viewModal.status === 'APPROVED' && (
              <button className="btn btn-primary" onClick={() => { setProcessModal(viewModal); setViewModal(null); setProcessForm({ method: viewModal.razorpay_payment_id ? 'RAZORPAY' : 'CASH', reference: '', note: '', upi_id: '', bank_account: '', bank_ifsc: '', beneficiary_name: '' }); setErr(''); setOkMsg('') }}>
                Process Refund
              </button>
            )}
          </div>
        </Modal>
      )}

      {/* Process Modal */}
      {processModal && (
        <Modal title="Process Refund" onClose={() => setProcessModal(null)}>
          {/* Payment reference context */}
          <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase' }}>Payment Reference</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><div style={{ fontSize: 10, color: '#94A3B8' }}>Booking</div><div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#7C3AED' }}>{processModal.booking_number || '—'}</div></div>
              <div><div style={{ fontSize: 10, color: '#94A3B8' }}>Amount</div><div style={{ fontWeight: 700, color: '#DC2626', fontSize: 14 }}>{fmt(processModal.amount)}</div></div>
              <div><div style={{ fontSize: 10, color: '#94A3B8' }}>Customer</div><div style={{ fontSize: 13, fontWeight: 600 }}>{processModal.customer_name || '—'}</div></div>
              {processModal.razorpay_payment_id && (
                <div><div style={{ fontSize: 10, color: '#94A3B8' }}>Razorpay Pay ID</div><div style={{ fontFamily: 'monospace', fontSize: 11, color: '#1B4FD8' }}>{processModal.razorpay_payment_id}</div></div>
              )}
            </div>
            <div style={{ marginTop: 8, padding: '8px 10px', background: '#FFFBEB', borderRadius: 6, fontSize: 12, color: '#78350F' }}>
              <b>Reason:</b> {processModal.reason || '—'}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Refund Method *</label>
            <select className="input" value={processForm.method} onChange={e => setProcessForm(f => ({ ...f, method: e.target.value }))}>
              {processModal.razorpay_payment_id && <option value="RAZORPAY">Razorpay (Auto-reverse via gateway)</option>}
              <option value="CASH">Cash (Manual)</option>
              <option value="UPI">UPI Transfer</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="WALLET">Wallet Credit</option>
            </select>
            {processForm.method === 'RAZORPAY' && (
              <div style={{ fontSize: 11, color: '#059669', marginTop: 4 }}>✅ Will be auto-reversed via Razorpay to original payment method (5–7 business days)</div>
            )}
            {processForm.method === 'CASH' && (
              <div style={{ fontSize: 11, color: '#D97706', marginTop: 4 }}>⚠ Please hand cash to customer physically and note details below</div>
            )}
          </div>

          {processForm.method === 'UPI' && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>UPI ID *</label>
              <input className="input" value={processForm.upi_id} onChange={e => setProcessForm(f => ({ ...f, upi_id: e.target.value }))} placeholder="customer@upi" />
            </div>
          )}
          {processForm.method === 'BANK_TRANSFER' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Account Number *</label>
                  <input className="input" value={processForm.bank_account} onChange={e => setProcessForm(f => ({ ...f, bank_account: e.target.value }))} placeholder="Account number" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>IFSC Code *</label>
                  <input className="input" value={processForm.bank_ifsc} onChange={e => setProcessForm(f => ({ ...f, bank_ifsc: e.target.value }))} placeholder="IFSC" />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Beneficiary Name</label>
                <input className="input" value={processForm.beneficiary_name} onChange={e => setProcessForm(f => ({ ...f, beneficiary_name: e.target.value }))} placeholder="Account holder name" />
              </div>
            </>
          )}
          {processForm.method !== 'RAZORPAY' && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Transaction Reference</label>
              <input className="input" value={processForm.reference} onChange={e => setProcessForm(f => ({ ...f, reference: e.target.value }))} placeholder="UTR / Transaction ID" />
            </div>
          )}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Internal Note</label>
            <input className="input" value={processForm.note} onChange={e => setProcessForm(f => ({ ...f, note: e.target.value }))} placeholder="Optional internal note" />
          </div>

          {err && <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{err}</div>}
          {okMsg && <div style={{ background: '#F0FDF4', color: '#166534', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>✅ {okMsg}</div>}

          <div style={{ display: 'flex', gap: 10 }}>
            {!okMsg && (
              <button className="btn btn-primary" onClick={handleProcess} disabled={saving}>
                {saving ? <Spinner size="sm" /> : `Confirm Refund ${fmt(processModal.amount)}`}
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => setProcessModal(null)}>Close</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
