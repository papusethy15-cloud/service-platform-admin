import { useEffect, useState, useCallback, useRef } from 'react'
import { invoicesAPI } from '@/services/api'
import PageHeader from '@/components/layout/PageHeader'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'

const STATUS_OPTIONS = ['', 'GENERATED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'CANCELLED']
const TYPE_OPTIONS = ['', 'GST_B2C', 'GST_B2B', 'NON_GST']

// ── Helper: download a PDF blob with auth token ──────────────────────────────
async function downloadInvoicePDF(inv: any) {
  try {
    const r = await invoicesAPI.pdf(inv.id)
    const blob = new Blob([r.data], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${inv.invoice_number || inv.id}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (err) {
    alert('Failed to download PDF. Please try again.')
    console.error('Invoice PDF download error:', err)
  }
}

export default function Invoices() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [detail, setDetail] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [invoiceType, setInvoiceType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sendingEmail, setSendingEmail] = useState<string | null>(null)
  const [downloadingPDF, setDownloadingPDF] = useState<string | null>(null)

  // Use refs to always have latest filter values in fetchData
  const searchRef = useRef(search)
  const statusRef = useRef(status)
  const invoiceTypeRef = useRef(invoiceType)
  const dateFromRef = useRef(dateFrom)
  const dateToRef = useRef(dateTo)

  const fetchData = useCallback(async (pg: number, filters?: {
    search?: string; status?: string; invoiceType?: string; dateFrom?: string; dateTo?: string
  }) => {
    setLoading(true)
    try {
      const s = filters?.search  ?? searchRef.current
      const st = filters?.status ?? statusRef.current
      const it = filters?.invoiceType ?? invoiceTypeRef.current
      const df = filters?.dateFrom ?? dateFromRef.current
      const dt = filters?.dateTo ?? dateToRef.current

      const params: any = { page: pg, per_page: 20 }
      if (s) params.search = s
      if (st) params.status = st
      if (it) params.invoice_type = it
      if (df) params.date_from = df
      if (dt) params.date_to = dt

      const r = await invoicesAPI.list(params)
      const d = r.data?.data
      if (d) {
        setItems(d.items || [])
        setPages(d.pages || 1)
        setTotal(d.total || 0)
      } else {
        setItems([])
      }
    } catch (err) {
      console.error('Failed to load invoices:', err)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load and page changes
  useEffect(() => {
    fetchData(page)
  }, [page, fetchData])

  const handleSearch = () => {
    searchRef.current = search
    statusRef.current = status
    invoiceTypeRef.current = invoiceType
    dateFromRef.current = dateFrom
    dateToRef.current = dateTo
    setPage(1)
    fetchData(1, { search, status, invoiceType, dateFrom, dateTo })
  }

  const handleReset = () => {
    setSearch(''); setStatus(''); setInvoiceType(''); setDateFrom(''); setDateTo('')
    searchRef.current = ''; statusRef.current = ''; invoiceTypeRef.current = ''
    dateFromRef.current = ''; dateToRef.current = ''
    setPage(1)
    fetchData(1, { search: '', status: '', invoiceType: '', dateFrom: '', dateTo: '' })
  }

  const openDetail = async (inv: any) => {
    try { const r = await invoicesAPI.get(inv.id); setDetail(r.data?.data || inv) }
    catch { setDetail(inv) }
  }

  // ── Authenticated PDF download (uses Bearer token via axios) ──────────────
  const handleDownloadPDF = async (inv: any) => {
    setDownloadingPDF(inv.id)
    try {
      await downloadInvoicePDF(inv)
    } finally {
      setDownloadingPDF(null)
    }
  }

  const handleSendEmail = async (inv: any) => {
    setSendingEmail(inv.id)
    try {
      await invoicesAPI.email(inv.id)
      alert('Email queued successfully')
    } catch { alert('Failed to send email') }
    finally { setSendingEmail(null) }
  }

  const handleSendWhatsApp = async (inv: any) => {
    try {
      await invoicesAPI.whatsapp(inv.id)
      alert('WhatsApp message queued')
    } catch { alert('Failed to send WhatsApp') }
  }

  const fmt = (n: any) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  const STATUS_COLOR: Record<string, string> = {
    PAID: '#059669', PARTIALLY_PAID: '#D97706', GENERATED: '#1B4FD8',
    SENT: '#7C3AED', CANCELLED: '#DC2626',
  }

  // Summary counts from current page
  const paidCount = items.filter(i => i.status === 'PAID').length
  const pendingCount = items.filter(i => ['GENERATED', 'SENT', 'PARTIALLY_PAID'].includes(i.status)).length
  const totalAmt = items.reduce((s, i) => s + (i.total_amount || 0), 0)

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader title="Invoices" subtitle={`${total} total invoices`} />
      <div style={{ height: 16 }} />

      {/* Advanced Filter Bar */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 220px' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>SEARCH</label>
            <input className="input" value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Invoice #, customer name, booking #, mobile..." style={{ width: '100%' }} />
          </div>
          <div style={{ flex: '0 1 160px' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>STATUS</label>
            <select className="input" value={status} onChange={e => setStatus(e.target.value)} style={{ width: '100%' }}>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
            </select>
          </div>
          <div style={{ flex: '0 1 150px' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>TYPE</label>
            <select className="input" value={invoiceType} onChange={e => setInvoiceType(e.target.value)} style={{ width: '100%' }}>
              {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t || 'All Types'}</option>)}
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

      {/* Summary Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Total Invoices', value: total, color: '#1B4FD8' },
          { label: `Paid (this page)`, value: paidCount, color: '#059669' },
          { label: 'Pending (this page)', value: pendingCount, color: '#D97706' },
          { label: 'Page Amount', value: fmt(totalAmt), color: '#7C3AED' },
        ].map(s => (
          <div key={s.label} className="card" style={{ flex: 1, padding: '12px 16px', borderLeft: `3px solid ${s.color}` }}>
            <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card">
        {loading ? <div style={{ padding: 60, textAlign: 'center' }}><Spinner /></div> : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 48 }}>SL</th>
                    <th>Invoice #</th>
                    <th>Customer</th>
                    <th>Booking #</th>
                    <th>Type</th>
                    <th>Subtotal</th>
                    <th>GST</th>
                    <th>Total</th>
                    <th>Balance</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th style={{ width: 190 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0
                    ? <tr><td colSpan={12} style={{ textAlign: 'center', color: '#94A3B8', padding: 48 }}>No invoices found</td></tr>
                    : items.map((inv: any, idx: number) => (
                      <tr key={inv.id}>
                        <td style={{ color: '#94A3B8', fontSize: 12, fontWeight: 600 }}>{(page - 1) * 20 + idx + 1}</td>
                        <td>
                          <span style={{ fontWeight: 700, color: '#1B4FD8', cursor: 'pointer', fontFamily: 'monospace', fontSize: 12 }}
                            onClick={() => openDetail(inv)}>
                            {inv.invoice_number || inv.id?.slice(0, 8) || '—'}
                          </span>
                          {inv.coupon_code && (
                            <span style={{ display: 'inline-block', marginTop: 3, fontSize: 10, padding: '1px 7px', borderRadius: 20, background: '#FEF3C7', color: '#92400E', fontWeight: 700, border: '1px solid #FDE68A' }}>
                              🏷️ {inv.coupon_code}
                            </span>
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{inv.customer_name || '—'}</div>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748B' }}>{inv.booking_number || '—'}</td>
                        <td>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#EFF6FF', color: '#1B4FD8', fontWeight: 600 }}>
                            {inv.invoice_type || '—'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{fmt(inv.taxable_amount)}</td>
                        <td style={{ color: '#64748B', fontSize: 12 }}>{fmt(inv.gst_amount)}</td>
                        <td style={{ fontWeight: 700, color: '#059669' }}>{fmt(inv.total_amount)}</td>
                        <td style={{ fontWeight: 700, color: (inv.balance_amount || 0) > 0 ? '#DC2626' : '#059669' }}>
                          {fmt(inv.balance_amount)}
                        </td>
                        <td>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                            background: `${STATUS_COLOR[inv.status] || '#64748B'}18`,
                            color: STATUS_COLOR[inv.status] || '#64748B'
                          }}>
                            {inv.status || 'GENERATED'}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: '#94A3B8', whiteSpace: 'nowrap' }}>{fmtDate(inv.created_at)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => openDetail(inv)}>View</button>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleDownloadPDF(inv)}
                              disabled={downloadingPDF === inv.id}
                              title="Download PDF"
                            >
                              {downloadingPDF === inv.id ? <Spinner size="sm" /> : '⬇ PDF'}
                            </button>
                            <button className="btn btn-secondary btn-sm"
                              disabled={sendingEmail === inv.id}
                              onClick={() => handleSendEmail(inv)}
                              title="Send Email"
                              style={{ padding: '4px 7px' }}>✉</button>
                            <button className="btn btn-secondary btn-sm"
                              onClick={() => handleSendWhatsApp(inv)}
                              title="Send WhatsApp"
                              style={{ padding: '4px 7px', color: '#25D366' }}>📱</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pages={pages} onPage={setPage} />
          </>
        )}
      </div>

      {/* Detail Modal */}
      {detail && (
        <Modal title={`Invoice — ${detail.invoice_number || ''}`} onClose={() => setDetail(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              ['Invoice #', detail.invoice_number || '—'],
              ['Status', detail.status || '—'],
              ['Type', detail.invoice_type || '—'],
              ['Customer', detail.customer_name || '—'],
              ['Booking #', detail.booking_number || '—'],
              ['Date', fmtDate(detail.created_at)],
              ['Subtotal', fmt(detail.taxable_amount)],
              ['CGST', fmt(detail.cgst_amount)],
              ['SGST', fmt(detail.sgst_amount)],
              ['IGST', fmt(detail.igst_amount)],
              ...(detail.coupon_code ? [['🏷️ Coupon', `${detail.coupon_code}  − ${fmt(detail.coupon_discount)}`]] : []),
              ['Total Amount', fmt(detail.total_amount)],
              ['Balance Due', fmt(detail.balance_amount)],
            ].map(([k, v]) => (
              <div key={k} style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>{k}</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{v as string}</div>
              </div>
            ))}
          </div>
          {detail.business_name && (
            <div style={{ background: '#FFFBEB', borderRadius: 8, padding: '10px 14px', marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: '#92400E', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>Business (B2B)</div>
              <div style={{ fontWeight: 600 }}>{detail.business_name}</div>
              {detail.gstin && <div style={{ fontSize: 12, color: '#64748B' }}>GSTIN: {detail.gstin}</div>}
              {detail.business_address && <div style={{ fontSize: 12, color: '#64748B' }}>{detail.business_address}</div>}
            </div>
          )}
          {detail.notes && (
            <div style={{ fontSize: 13, color: '#64748B', padding: '10px 14px', background: '#F8FAFC', borderRadius: 8, marginBottom: 10 }}>
              <strong>Notes:</strong> {detail.notes}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              className="btn btn-primary"
              onClick={() => handleDownloadPDF(detail)}
              disabled={downloadingPDF === detail.id}
            >
              {downloadingPDF === detail.id ? <Spinner size="sm" /> : '⬇ Download PDF'}
            </button>
            <button className="btn btn-secondary" onClick={() => handleSendEmail(detail)}
              disabled={sendingEmail === detail.id}>
              {sendingEmail === detail.id ? 'Sending…' : 'Send Email'}
            </button>
            <button className="btn btn-secondary" onClick={() => handleSendWhatsApp(detail)}>WhatsApp</button>
            <button className="btn btn-secondary" onClick={() => setDetail(null)}>Close</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
