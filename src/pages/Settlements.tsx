// src/pages/Settlements.tsx — Settled bookings + commission settlement
// Withdrawal management is handled separately in Withdrawals.tsx
import { useEffect, useState, useCallback } from 'react'
import { walletAPI } from '@/services/api'
import PageHeader from '@/components/layout/PageHeader'
import Pagination from '@/components/ui/Pagination'
import Spinner from '@/components/ui/Spinner'
import SettleModal from '@/components/ui/SettleModal'

const fmt = (n: number) =>
  `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const fmtDate = (iso: string) =>
  iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

function CommBadge({ paid, status }: { paid: boolean; status: string }) {
  const isClosed = status === 'CLOSED' || status === 'SETTLED'
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
      background: paid ? '#D1FAE5' : isClosed ? '#EFF6FF' : '#FEF3C7',
      color: paid ? '#059669' : isClosed ? '#1D4ED8' : '#D97706',
    }}>{paid ? 'Commission Paid' : isClosed ? 'Settled' : 'Commission Pending'}</span>
  )
}

export default function Settlements() {
  const [items, setItems]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage]       = useState(1)
  const [pages, setPages]     = useState(1)
  const [total, setTotal]     = useState(0)
  const [techSearch, setTechSearch] = useState('')

  // Single settle modal — using shared SettleModal component
  const [settleBooking, setSettleBooking] = useState<any>(null)

  const fetchSettlements = useCallback(async () => {
    setLoading(true)
    try {
      const r = await walletAPI.settlements({ page, per_page: 20 })
      const d = r.data.data
      setItems(d.items || [])
      setPages(d.pages || 1)
      setTotal(d.total || 0)
    } catch { setItems([]) } finally { setLoading(false) }
  }, [page])

  useEffect(() => { fetchSettlements() }, [fetchSettlements])

  const filtered = techSearch
    ? items.filter(i =>
        (i.technician_name || '').toLowerCase().includes(techSearch.toLowerCase()) ||
        (i.technician_code || '').toLowerCase().includes(techSearch.toLowerCase()) ||
        (i.booking_number || '').toLowerCase().includes(techSearch.toLowerCase())
      )
    : items

  const canSettle = (s: any) =>
    ['PAID', 'COMPLETED', 'INVOICE_GENERATED', 'PAYMENT_PENDING'].includes(s.booking_status || '')

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader
        title="Settlements"
        subtitle={`${total} completed bookings — settle & hold technician commissions`}
      />

      {/* Search */}
      <div style={{ marginTop: 20, marginBottom: 14 }}>
        <input
          className="input"
          style={{ maxWidth: 360 }}
          placeholder="Search by technician, code, booking number…"
          value={techSearch}
          onChange={e => setTechSearch(e.target.value)}
        />
      </div>

      <div style={{ marginBottom: 10, fontSize: 13, color: '#64748B' }}>
        Showing {filtered.length} of {total} bookings.{' '}
        <b>Settle &amp; Close</b> finalises commission and <b>holds</b> it (not yet in wallet).
        To release to wallet, go to{' '}
        <a href="/commissions" style={{ color: '#1D4ED8', fontWeight: 700 }}>Commissions → Pay</a>.
        To pay out technicians, go to{' '}
        <a href="/withdrawals" style={{ color: '#1D4ED8', fontWeight: 700 }}>Withdrawal Requests</a>.
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading
          ? <div style={{ padding: 60, textAlign: 'center' }}><Spinner /></div>
          : (
            <>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Booking</th>
                    <th>Customer</th>
                    <th>Technician</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th style={{ textAlign: 'right' }}>Commission</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th style={{ textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0
                    ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', color: '#94A3B8', padding: 50 }}>
                          <div style={{ fontSize: 32, marginBottom: 8 }}>🏦</div>
                          No bookings found
                        </td>
                      </tr>
                    )
                    : filtered.map((s: any) => (
                      <tr key={s.booking_id}>
                        <td>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#1B4FD8' }}>#{s.booking_number}</div>
                          <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#94A3B8' }}>{s.booking_id?.slice(0, 16)}…</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{s.customer_name}</div>
                          <div style={{ fontSize: 11, color: '#64748B' }}>{s.customer_mobile}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{s.technician_name}</div>
                          {s.technician_code && <div style={{ fontSize: 11, color: '#64748B' }}>#{s.technician_code}</div>}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>{fmt(s.total_amount)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>{fmt(s.commission_total)}</td>
                        <td>
                          {s.commission_count > 0
                            ? <CommBadge paid={s.commission_paid} status={s.booking_status || ''} />
                            : <span style={{ fontSize: 11, color: '#94A3B8' }}>No commission</span>
                          }
                        </td>
                        <td style={{ fontSize: 12, color: '#64748B' }}>{fmtDate(s.settled_at)}</td>
                        <td style={{ textAlign: 'center' }}>
                          {canSettle(s) ? (
                            <button
                              style={{
                                background: '#059669', color: '#fff', border: 'none',
                                borderRadius: 6, padding: '4px 12px', fontSize: 12,
                                cursor: 'pointer', fontWeight: 700,
                              }}
                              onClick={() => setSettleBooking(s)}
                            >
                              🔒 Settle
                            </button>
                          ) : (
                            <span style={{ fontSize: 11, color: '#94A3B8' }}>Settled</span>
                          )}
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
              <Pagination page={page} pages={pages} onPage={p => setPage(p)} />
            </>
          )
        }
      </div>

      {/* ── Shared Settle & Close Modal ── */}
      {settleBooking && (
        <SettleModal
          booking={settleBooking}
          onClose={() => setSettleBooking(null)}
          onSettled={() => {
            setSettleBooking(null)
            fetchSettlements()
          }}
        />
      )}
    </div>
  )
}
