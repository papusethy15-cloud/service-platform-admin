import { useEffect, useState, useCallback, useRef } from 'react'
import { paymentsAPI, refundsAPI } from '@/services/api'
import PageHeader from '@/components/layout/PageHeader'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  SUCCESS:            { bg: '#DCFCE7', color: '#16A34A' },
  PENDING:            { bg: '#FEF3C7', color: '#D97706' },
  FAILED:             { bg: '#FEE2E2', color: '#DC2626' },
  REFUNDED:           { bg: '#F3E8FF', color: '#7C3AED' },
  PARTIALLY_REFUNDED: { bg: '#EFF6FF', color: '#1D4ED8' },
}

const PERIODS = [
  { label: 'All Time', value: '' },
  { label: 'This Week', value: 'weekly' },
  { label: 'This Month', value: 'monthly' },
  { label: 'This Year', value: 'yearly' },
]

const fmt  = (n: any) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const fmtD = (d: string) => d ? new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

export default function RazorpayTransactions() {
  const [items, setItems]       = useState<any[]>([])
  const [stats, setStats]       = useState<any>({})
  const [loading, setLoading]   = useState(true)
  const [page, setPage]         = useState(1)
  const [pages, setPages]       = useState(1)
  const [total, setTotal]       = useState(0)
  const [detail, setDetail]     = useState<any>(null)
  const [refundModal, setRefundModal] = useState<any>(null)
  const [refundForm, setRefundForm]   = useState({ amount: '', reason: '', method: 'RAZORPAY', note: '' })
  const [refunding, setRefunding]     = useState(false)
  const [refundErr, setRefundErr]     = useState('')
  const [refundOk, setRefundOk]       = useState('')

  // Filters
  const [period, setPeriod]     = useState('')
  const [status, setStatus]     = useState('')
  const [search, setSearch]     = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const fRef = useRef({ period: '', status: '', search: '', dateFrom: '', dateTo: '' })

  const load = useCallback(async (pg: number, f?: typeof fRef.current) => {
    setLoading(true)
    try {
      const fi = f ?? fRef.current
      const params: any = { page: pg, per_page: 20 }
      if (fi.period)   params.period   = fi.period
      if (fi.status)   params.status   = fi.status
      if (fi.search)   params.search   = fi.search
      if (fi.dateFrom) params.date_from = fi.dateFrom
      if (fi.dateTo)   params.date_to  = fi.dateTo
      const r = await paymentsAPI.razorpayTxns(params)
      const d = r.data?.data
      setItems(d.items || []); setPages(d.pages || 1); setTotal(d.total || 0); setStats(d.stats || {})
    } catch { setItems([]) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load(page) }, [page, load])

  const apply = () => {
    const f = { period, status, search, dateFrom, dateTo }
    fRef.current = f; setPage(1); load(1, f)
  }
  const reset = () => {
    setPeriod(''); setStatus(''); setSearch(''); setDateFrom(''); setDateTo('')
    const f = { period: '', status: '', search: '', dateFrom: '', dateTo: '' }
    fRef.current = f; setPage(1); load(1, f)
  }

  const openRefund = (item: any) => {
    setRefundForm({ amount: String(item.amount || ''), reason: '', method: item.razorpay_payment_id ? 'RAZORPAY' : 'CASH', note: '' })
    setRefundErr(''); setRefundOk(''); setRefundModal(item)
  }

  const submitRefund = async () => {
    if (!refundForm.reason.trim()) { setRefundErr('Reason is required'); return }
    setRefunding(true); setRefundErr(''); setRefundOk('')
    try {
      // 1. Create refund request
      const cr = await refundsAPI.create({
        booking_id: refundModal.booking_id,
        payment_id: refundModal.id,
        amount: +refundForm.amount,
        reason: refundForm.reason,
        refund_method: refundForm.method,
        ...(refundForm.note ? { notes: refundForm.note } : {}),
      })
      const refundId = cr.data?.data?.id
      // 2. Approve it
      await refundsAPI.approve(refundId)
      // 3. If RAZORPAY method, trigger gateway refund
      if (refundForm.method === 'RAZORPAY' && refundModal.razorpay_payment_id) {
        await refundsAPI.razorpayRefund(refundId)
        setRefundOk('Razorpay refund initiated successfully! It will reflect in 5–7 business days.')
      } else {
        setRefundOk(`Manual refund (${refundForm.method}) recorded. Please transfer the amount manually.`)
      }
      load(page)
    } catch (e: any) {
      setRefundErr(e.response?.data?.detail || 'Refund failed. Please try again.')
    } finally { setRefunding(false) }
  }

  const statCards = [
    { label: 'Total Razorpay Txns', value: stats.total_count || 0,   color: '#1B4FD8', icon: '💳' },
    { label: 'Total Collected',     value: fmt(stats.total_collected), color: '#059669', icon: '✅' },
    { label: 'Failed Payments',     value: stats.failed_count || 0,   color: '#DC2626', icon: '❌' },
    { label: 'Failed Amount',       value: fmt(stats.total_failed_amount), color: '#D97706', icon: '⚠️' },
  ]

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader title="Razorpay Transactions" subtitle="Online payment gateway records" />
      <div style={{ height: 16 }} />

      {/* Period tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {PERIODS.map(p => (
          <button key={p.value} onClick={() => { setPeriod(p.value); const f = { ...fRef.current, period: p.value }; fRef.current = f; setPage(1); load(1, f) }}
            style={{ padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: period === p.value ? '#1B4FD8' : '#F1F5F9', color: period === p.value ? '#fff' : '#334155' }}>
            {p.label}
          </button>
        ))}
      </div>

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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>SEARCH</label>
            <input className="input" value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && apply()} placeholder="Payment ID, Booking #, Invoice #..." style={{ width: '100%' }} />
          </div>
          <div style={{ flex: '0 1 140px' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>STATUS</label>
            <select className="input" value={status} onChange={e => setStatus(e.target.value)} style={{ width: '100%' }}>
              <option value="">All</option>
              {['SUCCESS','PENDING','FAILED','REFUNDED'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ flex: '0 1 140px' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>FROM</label>
            <input className="input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div style={{ flex: '0 1 140px' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>TO</label>
            <input className="input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={apply}>Apply</button>
            <button className="btn btn-secondary" onClick={reset}>Reset</button>
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
                    <th>#</th><th>Txn #</th><th>Razorpay Order ID</th><th>Razorpay Payment ID</th>
                    <th>Customer</th><th>Booking</th><th>Invoice</th><th>Amount</th><th>Status</th><th>Date</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={11} style={{ textAlign: 'center', color: '#94A3B8', padding: 48 }}>No Razorpay transactions found</td></tr>
                  ) : items.map((p: any, idx: number) => {
                    const ss = STATUS_STYLE[p.status] || { bg: '#F1F5F9', color: '#64748B' }
                    return (
                      <tr key={p.id}>
                        <td style={{ color: '#94A3B8', fontSize: 12 }}>{(page-1)*20+idx+1}</td>
                        <td><span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#1B4FD8', cursor: 'pointer' }} onClick={() => setDetail(p)}>{p.transaction_number || p.id?.slice(0,12)}</span></td>
                        <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#64748B' }}>{p.razorpay_order_id || '—'}</td>
                        <td><span style={{ fontFamily: 'monospace', fontSize: 11, color: p.razorpay_payment_id ? '#059669' : '#94A3B8' }}>{p.razorpay_payment_id || 'Not captured'}</span></td>
                        <td style={{ fontSize: 13 }}>{p.customer_name || '—'}<br /><span style={{ fontSize: 11, color: '#94A3B8' }}>{p.customer_mobile || ''}</span></td>
                        <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#7C3AED' }}>{p.booking_number || '—'}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#64748B' }}>{p.invoice_number || '—'}</td>
                        <td><span style={{ fontWeight: 700, color: p.status === 'SUCCESS' ? '#059669' : '#1E293B' }}>{fmt(p.amount)}</span></td>
                        <td>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: ss.bg, color: ss.color }}>{p.status}</span>
                          {p.status === 'FAILED' && p.failure_reason && (
                            <div style={{ fontSize: 10, color: '#DC2626', marginTop: 2 }} title={p.failure_reason}>⚠ {p.failure_reason?.slice(0, 30)}</div>
                          )}
                        </td>
                        <td style={{ fontSize: 12, color: '#64748B', whiteSpace: 'nowrap' }}>{fmtD(p.created_at)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setDetail(p)}>View</button>
                            {p.status === 'SUCCESS' && (
                              <button className="btn btn-sm" onClick={() => openRefund(p)}
                                style={{ background: '#FEE2E2', color: '#DC2626', border: 'none', padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                Refund
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

      {/* Detail Modal */}
      {detail && (
        <Modal title={`Razorpay — ${detail.transaction_number}`} onClose={() => setDetail(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              ['Transaction #', detail.transaction_number || '—'],
              ['Status', detail.status || '—'],
              ['Amount', fmt(detail.amount)],
              ['Customer', detail.customer_name || '—'],
              ['Customer Mobile', detail.customer_mobile || '—'],
              ['Booking #', detail.booking_number || '—'],
              ['Invoice #', detail.invoice_number || '—'],
              ['Razorpay Order ID', detail.razorpay_order_id || '—'],
              ['Razorpay Payment ID', detail.razorpay_payment_id || '—'],
              ['Initiated', fmtD(detail.created_at)],
              ['Paid At', detail.paid_at ? fmtD(detail.paid_at) : '—'],
            ].map(([k, v]) => (
              <div key={k} style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>{k}</div>
                <div style={{ fontWeight: 600, fontSize: 13, fontFamily: typeof v === 'string' && v.startsWith('rzp_') ? 'monospace' : undefined }}>{v as string}</div>
              </div>
            ))}
          </div>
          {detail.status === 'FAILED' && (
            <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', marginBottom: 4 }}>⚠ Payment Failure Details</div>
              <div style={{ fontSize: 13, color: '#7F1D1D' }}>{detail.failure_reason || 'No failure reason recorded. Check Razorpay dashboard for details.'}</div>
              {detail.razorpay_order_id && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#DC2626' }}>
                  Check in Razorpay Dashboard → Orders → <code>{detail.razorpay_order_id}</code>
                </div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setDetail(null)}>Close</button>
            {detail.status === 'SUCCESS' && (
              <button onClick={() => { setDetail(null); openRefund(detail) }}
                style={{ background: '#FEE2E2', color: '#DC2626', border: 'none', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Initiate Refund
              </button>
            )}
          </div>
        </Modal>
      )}

      {/* Refund Modal */}
      {refundModal && (
        <Modal title="Initiate Refund" onClose={() => setRefundModal(null)}>
          <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: '#64748B', marginBottom: 4 }}>Payment Reference</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{refundModal.transaction_number}</div>
            <div style={{ fontSize: 12, color: '#7C3AED', fontFamily: 'monospace', marginTop: 2 }}>{refundModal.razorpay_payment_id}</div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>Customer: <b>{refundModal.customer_name}</b> · Booking: <b style={{ fontFamily: 'monospace' }}>{refundModal.booking_number}</b></div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#059669', marginTop: 4 }}>Original Amount: {fmt(refundModal.amount)}</div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Refund Type</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['full', 'partial'].map(t => (
                <button key={t} onClick={() => { if (t === 'full') setRefundForm(f => ({ ...f, amount: String(refundModal.amount) })) }}
                  style={{ padding: '6px 16px', borderRadius: 8, border: '1.5px solid', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    borderColor: (t === 'partial' ? refundForm.amount && +refundForm.amount < refundModal.amount : +refundForm.amount === refundModal.amount) ? '#1B4FD8' : '#E2E8F0',
                    background: (t === 'partial' ? refundForm.amount && +refundForm.amount < refundModal.amount : +refundForm.amount === refundModal.amount) ? '#EFF6FF' : '#fff',
                    color: '#0F172A' }}>
                  {t === 'full' ? `Full Refund (${fmt(refundModal.amount)})` : 'Partial Refund'}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Refund Amount *</label>
            <input className="input" type="number" step="0.01" max={refundModal.amount} value={refundForm.amount}
              onChange={e => setRefundForm(f => ({ ...f, amount: e.target.value }))} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Refund Method *</label>
            <select className="input" value={refundForm.method} onChange={e => setRefundForm(f => ({ ...f, method: e.target.value }))}>
              {refundModal.razorpay_payment_id && <option value="RAZORPAY">Razorpay (Auto-reverse to original payment method)</option>}
              <option value="CASH">Cash (Manual)</option>
              <option value="BANK_TRANSFER">Bank Transfer (Manual)</option>
              <option value="WALLET">Wallet Credit</option>
            </select>
            {refundForm.method === 'RAZORPAY' && (
              <div style={{ fontSize: 11, color: '#059669', marginTop: 4 }}>
                ✅ Amount will be auto-reversed to customer's original payment method via Razorpay gateway (5–7 business days)
              </div>
            )}
            {refundForm.method === 'CASH' && (
              <div style={{ fontSize: 11, color: '#D97706', marginTop: 4 }}>
                ⚠ Manual refund — please physically hand cash to the customer and add a note below.
              </div>
            )}
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Reason for Refund *</label>
            <textarea className="input" style={{ height: 70, resize: 'vertical' }} value={refundForm.reason}
              onChange={e => setRefundForm(f => ({ ...f, reason: e.target.value }))} placeholder="Why is this refund being issued?" />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Internal Note (optional)</label>
            <input className="input" value={refundForm.note} onChange={e => setRefundForm(f => ({ ...f, note: e.target.value }))} placeholder="Any internal reference or note" />
          </div>
          {refundErr && <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{refundErr}</div>}
          {refundOk  && <div style={{ background: '#F0FDF4', color: '#166534', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>✅ {refundOk}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            {!refundOk && <button className="btn btn-primary" onClick={submitRefund} disabled={refunding}>{refunding ? <Spinner size="sm" /> : `Confirm Refund ${refundForm.amount ? fmt(+refundForm.amount) : ''}`}</button>}
            <button className="btn btn-secondary" onClick={() => setRefundModal(null)}>Close</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
