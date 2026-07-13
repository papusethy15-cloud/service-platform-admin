import { useEffect, useState, useCallback, useRef } from 'react'
import { paymentsAPI, refundsAPI } from '@/services/api'
import PageHeader from '@/components/layout/PageHeader'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'

const METHOD_OPTIONS = ['', 'CASH', 'RAZORPAY', 'UPI', 'BANK_TRANSFER']
const STATUS_OPTIONS = ['', 'PENDING', 'SUCCESS', 'FAILED', 'REFUNDED']

const METHOD_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  CASH:          { bg: '#DCFCE7', color: '#16A34A', label: 'Cash' },
  RAZORPAY:     { bg: '#EFF6FF', color: '#1D4ED8', label: 'Razorpay' },
  UPI:          { bg: '#FEF3C7', color: '#D97706', label: 'UPI' },
  BANK_TRANSFER:{ bg: '#F3E8FF', color: '#7C3AED', label: 'Bank Transfer' },
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  SUCCESS:  { bg: '#DCFCE7', color: '#16A34A' },
  PENDING:  { bg: '#FEF3C7', color: '#D97706' },
  FAILED:   { bg: '#FEE2E2', color: '#DC2626' },
  REFUNDED: { bg: '#F3E8FF', color: '#7C3AED' },
}

export default function Payments() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [detail, setDetail] = useState<any>(null)
  const [refundModal, setRefundModal] = useState<any>(null)
  const [refundForm, setRefundForm] = useState({ amount: '', reason: '', method: 'ORIGINAL', upi_id: '', bank_account: '', bank_ifsc: '', beneficiary_name: '' })
  const [refunding, setRefunding] = useState(false)
  const [refundErr, setRefundErr] = useState('')
  const [refundOk, setRefundOk] = useState('')

  // Filter state
  const [search, setSearch] = useState('')
  const [method, setMethod] = useState('')
  const [status, setStatus] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Refs for latest filter values
  const refs = useRef({ search: '', method: '', status: '', dateFrom: '', dateTo: '' })

  const fetchData = useCallback(async (pg: number, f?: typeof refs.current) => {
    setLoading(true)
    try {
      const fi = f ?? refs.current
      const params: any = { page: pg, per_page: 20 }
      if (fi.search) params.search = fi.search
      if (fi.method) params.method = fi.method
      if (fi.status) params.status = fi.status
      if (fi.dateFrom) params.date_from = fi.dateFrom
      if (fi.dateTo) params.date_to = fi.dateTo

      const r = await paymentsAPI.history(params)
      const d = r.data?.data
      if (d) {
        setItems(d.items || [])
        setPages(d.pages || 1)
        setTotal(d.total || 0)
      } else {
        setItems([])
      }
    } catch (err) {
      console.error('Failed to load payments:', err)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(page) }, [page, fetchData])

  const handleSearch = () => {
    const f = { search, method, status, dateFrom, dateTo }
    refs.current = f
    setPage(1)
    fetchData(1, f)
  }

  const handleReset = () => {
    setSearch(''); setMethod(''); setStatus(''); setDateFrom(''); setDateTo('')
    const f = { search: '', method: '', status: '', dateFrom: '', dateTo: '' }
    refs.current = f
    setPage(1)
    fetchData(1, f)
  }

  const openRefund = (p: any) => {
    setRefundForm({ amount: String(p.amount || ''), reason: '', method: p.payment_method === 'RAZORPAY' ? 'RAZORPAY' : 'CASH', upi_id: '', bank_account: '', bank_ifsc: '', beneficiary_name: '' })
    setRefundErr(''); setRefundOk(''); setRefundModal(p)
  }

  const submitRefund = async () => {
    if (!refundForm.reason.trim()) { setRefundErr('Reason is required'); return }
    setRefunding(true); setRefundErr(''); setRefundOk('')
    try {
      const cr = await refundsAPI.create({
        booking_id: refundModal.booking_id,
        payment_id: refundModal.id,
        amount: +refundForm.amount,
        reason: refundForm.reason,
        refund_method: refundForm.method,
        upi_id: refundForm.upi_id || undefined,
        bank_account: refundForm.bank_account || undefined,
        bank_ifsc: refundForm.bank_ifsc || undefined,
        beneficiary_name: refundForm.beneficiary_name || undefined,
      })
      const refundId = cr.data?.data?.id
      await refundsAPI.approve(refundId)
      if (refundForm.method === 'RAZORPAY' && refundModal.provider_payment_id) {
        await refundsAPI.razorpayRefund(refundId)
        setRefundOk('Razorpay refund initiated! Will reflect in 5–7 business days.')
      } else {
        setRefundOk(`Refund recorded (${refundForm.method}). Please process the transfer manually.`)
      }
      fetchData(page)
    } catch (e: any) {
      setRefundErr(e.response?.data?.detail || 'Refund failed. Please try again.')
    } finally { setRefunding(false) }
  }

  const fmt = (n: any) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
  const fmtDate = (d: string) => d ? new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }) : '—'
  const fmtDateShort = (d: string) => d ? new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  }) : '—'

  // Summary
  const successAmt = items.filter(i => i.status === 'SUCCESS').reduce((s, i) => s + (i.amount || 0), 0)
  const pendingAmt = items.filter(i => i.status === 'PENDING').reduce((s, i) => s + (i.amount || 0), 0)
  const successCount = items.filter(i => i.status === 'SUCCESS').length

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader title="Payments" subtitle={`${total} transactions`} />
      <div style={{ height: 16 }} />

      {/* Advanced Filter Bar */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 220px' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>SEARCH</label>
            <input className="input" value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Transaction #, invoice #, booking #..." style={{ width: '100%' }} />
          </div>
          <div style={{ flex: '0 1 160px' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>METHOD</label>
            <select className="input" value={method} onChange={e => setMethod(e.target.value)} style={{ width: '100%' }}>
              {METHOD_OPTIONS.map(m => <option key={m} value={m}>{m || 'All Methods'}</option>)}
            </select>
          </div>
          <div style={{ flex: '0 1 150px' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>STATUS</label>
            <select className="input" value={status} onChange={e => setStatus(e.target.value)} style={{ width: '100%' }}>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
            </select>
          </div>
          <div style={{ flex: '0 1 140px' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>FROM DATE</label>
            <input className="input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div style={{ flex: '0 1 140px' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>TO DATE</label>
            <input className="input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={handleSearch}>Search</button>
            <button className="btn btn-secondary" onClick={handleReset}>Reset</button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Total Transactions', value: total, color: '#1B4FD8', icon: '📋' },
          { label: 'Collected (page)', value: fmt(successAmt), color: '#059669', icon: '✅' },
          { label: 'Pending (page)', value: fmt(pendingAmt), color: '#D97706', icon: '⏳' },
          { label: 'Success Count (page)', value: successCount, color: '#7C3AED', icon: '🎯' },
        ].map(s => (
          <div key={s.label} className="card" style={{ flex: 1, padding: '14px 16px', borderLeft: `3px solid ${s.color}` }}>
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

      {/* Payments Table */}
      <div className="card">
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center' }}><Spinner /></div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 44 }}>SL</th>
                    <th>Transaction #</th>
                    <th>Invoice #</th>
                    <th>Customer</th>
                    <th>Booking #</th>
                    <th>Method</th>
                    <th>Amount</th>
                    <th>Reference</th>
                    <th>Status</th>
                    <th>Paid At</th>
                    <th>Date</th>
                    <th style={{ width: 100 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={12} style={{ textAlign: 'center', color: '#94A3B8', padding: 48 }}>
                        No payment records found
                      </td>
                    </tr>
                  ) : items.map((p: any, idx: number) => {
                    const mStyle = METHOD_STYLE[p.payment_method] || { bg: '#F1F5F9', color: '#64748B', label: p.payment_method }
                    const sStyle = STATUS_STYLE[p.status] || { bg: '#F1F5F9', color: '#64748B' }
                    return (
                      <tr key={p.id}>
                        <td style={{ color: '#94A3B8', fontSize: 12, fontWeight: 600 }}>{(page - 1) * 20 + idx + 1}</td>
                        <td>
                          <span
                            style={{ fontWeight: 700, color: '#1B4FD8', cursor: 'pointer', fontFamily: 'monospace', fontSize: 12 }}
                            onClick={() => setDetail(p)}
                          >
                            {p.transaction_number || p.id?.slice(0, 12) || '—'}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#7C3AED' }}>
                          {p.invoice_number || '—'}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{p.customer_name || '—'}</div>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748B' }}>
                          {p.booking_number || '—'}
                        </td>
                        <td>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                            background: mStyle.bg, color: mStyle.color
                          }}>
                            {mStyle.label || p.payment_method || '—'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, fontSize: 14, color: p.status === 'SUCCESS' ? '#059669' : '#1E293B' }}>
                            {fmt(p.amount)}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: '#64748B', fontFamily: 'monospace' }}>
                          {p.reference_number || p.provider_payment_id || '—'}
                        </td>
                        <td>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                            background: sStyle.bg, color: sStyle.color
                          }}>
                            {p.status || '—'}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: '#64748B', whiteSpace: 'nowrap' }}>
                          {p.paid_at ? fmtDateShort(p.paid_at) : <span style={{ color: '#CBD5E1' }}>—</span>}
                        </td>
                        <td style={{ fontSize: 12, color: '#94A3B8', whiteSpace: 'nowrap' }}>
                          {fmtDateShort(p.created_at)}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setDetail(p)}>View</button>
                            {p.status === 'SUCCESS' && (
                              <button onClick={() => openRefund(p)}
                                style={{ fontSize: 11, color: '#DC2626', background: '#FEE2E2', border: 'none', padding: '3px 8px', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
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

      {/* Refund Modal */}
      {refundModal && (
        <Modal title="Initiate Refund" onClose={() => setRefundModal(null)}>
          <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: '#64748B' }}>Payment: <b style={{ fontFamily: 'monospace' }}>{refundModal.transaction_number}</b></div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Customer: <b>{refundModal.customer_name}</b> · Booking: <b style={{ fontFamily: 'monospace' }}>{refundModal.booking_number}</b></div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#059669', marginTop: 4 }}>Paid: {fmt(refundModal.amount)} via {refundModal.payment_method}</div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Refund Type</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setRefundForm(f => ({ ...f, amount: String(refundModal.amount) }))}
                style={{ padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${+refundForm.amount === refundModal.amount ? '#1B4FD8' : '#E2E8F0'}`, cursor: 'pointer', fontSize: 12, fontWeight: 600, background: +refundForm.amount === refundModal.amount ? '#EFF6FF' : '#fff' }}>
                Full ({fmt(refundModal.amount)})
              </button>
              <button onClick={() => setRefundForm(f => ({ ...f, amount: '' }))}
                style={{ padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${refundForm.amount && +refundForm.amount < refundModal.amount ? '#1B4FD8' : '#E2E8F0'}`, cursor: 'pointer', fontSize: 12, fontWeight: 600, background: refundForm.amount && +refundForm.amount < refundModal.amount ? '#EFF6FF' : '#fff' }}>
                Partial
              </button>
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Amount ₹ *</label>
            <input className="input" type="number" step="0.01" max={refundModal.amount} value={refundForm.amount} onChange={e => setRefundForm(f => ({ ...f, amount: e.target.value }))} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Refund Method *</label>
            <select className="input" value={refundForm.method} onChange={e => setRefundForm(f => ({ ...f, method: e.target.value }))}>
              {refundModal.payment_method === 'RAZORPAY' && <option value="RAZORPAY">Razorpay (Auto-reverse via gateway)</option>}
              <option value="CASH">Cash (Manual)</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="UPI">UPI</option>
              <option value="WALLET">Wallet Credit</option>
            </select>
          </div>
          {refundForm.method === 'UPI' && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>UPI ID *</label>
              <input className="input" value={refundForm.upi_id} onChange={e => setRefundForm(f => ({ ...f, upi_id: e.target.value }))} placeholder="customer@upi" />
            </div>
          )}
          {refundForm.method === 'BANK_TRANSFER' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Account Number</label>
                <input className="input" value={refundForm.bank_account} onChange={e => setRefundForm(f => ({ ...f, bank_account: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>IFSC Code</label>
                <input className="input" value={refundForm.bank_ifsc} onChange={e => setRefundForm(f => ({ ...f, bank_ifsc: e.target.value }))} placeholder="SBIN0001234" />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Account Holder Name</label>
                <input className="input" value={refundForm.beneficiary_name} onChange={e => setRefundForm(f => ({ ...f, beneficiary_name: e.target.value }))} />
              </div>
            </div>
          )}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Reason *</label>
            <textarea className="input" style={{ height: 70, resize: 'vertical' }} value={refundForm.reason} onChange={e => setRefundForm(f => ({ ...f, reason: e.target.value }))} placeholder="Reason for refund..." />
          </div>
          {refundErr && <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{refundErr}</div>}
          {refundOk  && <div style={{ background: '#F0FDF4', color: '#166534', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>✅ {refundOk}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            {!refundOk && <button className="btn btn-primary" onClick={submitRefund} disabled={refunding}>{refunding ? <Spinner size="sm" /> : 'Confirm Refund'}</button>}
            <button className="btn btn-secondary" onClick={() => setRefundModal(null)}>Close</button>
          </div>
        </Modal>
      )}

      {/* Detail Modal */}
      {detail && (
        <Modal title={`Payment — ${detail.transaction_number || detail.id?.slice(0, 12)}`} onClose={() => setDetail(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              ['Transaction #', detail.transaction_number || '—'],
              ['Invoice #', detail.invoice_number || '—'],
              ['Booking #', detail.booking_number || '—'],
              ['Customer', detail.customer_name || '—'],
              ['Method', detail.payment_method || '—'],
              ['Status', detail.status || '—'],
              ['Amount', fmt(detail.amount)],
              ['Currency', detail.currency || 'INR'],
              ['Reference #', detail.reference_number || '—'],
              ['Provider Order', detail.provider_order_id || '—'],
              ['Provider Payment', detail.provider_payment_id || '—'],
              ['Paid At', detail.paid_at ? fmtDate(detail.paid_at) : '—'],
              ['Created At', fmtDate(detail.created_at)],
            ].map(([k, v]) => (
              <div key={k} style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>{k}</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{v as string}</div>
              </div>
            ))}
          </div>
          {detail.notes && (
            <div style={{ fontSize: 13, color: '#64748B', padding: '10px 14px', background: '#F8FAFC', borderRadius: 8, marginBottom: 12 }}>
              <strong>Notes:</strong> {detail.notes}
            </div>
          )}
          {detail.payment_link && (
            <div style={{ padding: '10px 14px', background: '#EFF6FF', borderRadius: 8, marginBottom: 12, fontSize: 12 }}>
              <strong>Payment Link:</strong>{' '}
              <a href={detail.payment_link} target="_blank" rel="noreferrer" style={{ color: '#1B4FD8' }}>{detail.payment_link}</a>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-secondary" onClick={() => setDetail(null)}>Close</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
