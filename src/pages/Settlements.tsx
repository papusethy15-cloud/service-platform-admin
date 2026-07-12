// src/pages/Settlements.tsx — Settled bookings + commission settlement
// Withdrawal management is handled separately in Withdrawals.tsx
import { useEffect, useState, useCallback } from 'react'
import { walletAPI, bookingsAPI } from '@/services/api'
import PageHeader from '@/components/layout/PageHeader'
import Pagination from '@/components/ui/Pagination'
import Spinner from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'

const fmt = (n: number) =>
  `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtDate = (iso: string) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

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

  // Settle modal
  const [settleBooking, setSettleBooking]   = useState<any>(null)
  const [settlePreview, setSettlePreview]   = useState<any>(null)
  const [settleLoading, setSettleLoading]   = useState(false)
  const [settleNotes, setSettleNotes]       = useState('')
  const [settleOverrides, setSettleOverrides] = useState<Record<number, string>>({})
  const [settleErr, setSettleErr]           = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)

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

  const openSettleModal = async (s: any) => {
    setSettleBooking(s)
    setSettlePreview(null)
    setSettleNotes('')
    setSettleOverrides({})
    setSettleErr('')
    setPreviewLoading(true)
    try {
      const r = await bookingsAPI.commissionPreview(s.booking_id)
      setSettlePreview(r.data.data)
    } catch (ex: any) {
      setSettleErr(ex.response?.data?.detail || 'Failed to load commission preview')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleSettle = async () => {
    if (!settleBooking) return
    setSettleLoading(true); setSettleErr('')
    try {
      const overrideList = Object.entries(settleOverrides)
        .filter(([, v]) => v !== '')
        .map(([idx, val]) => ({ item_index: Number(idx), commission_amount: Number(val) }))
      await bookingsAPI.settleBooking(settleBooking.booking_id, {
        overrides: overrideList,
        notes: settleNotes || undefined,
      })
      setSettleBooking(null)
      fetchSettlements()
    } catch (ex: any) {
      setSettleErr(ex.response?.data?.detail || 'Failed to settle booking')
    } finally {
      setSettleLoading(false)
    }
  }

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
        subtitle={`${total} completed bookings — settle & credit technician commissions`}
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
        <b>Settle &amp; Close</b> finalises commission and credits the technician's wallet.
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
                              onClick={() => openSettleModal(s)}
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

      {/* ── Settle Modal ── */}
      {settleBooking && (
        <Modal title={`Settle & Close — #${settleBooking.booking_number}`} onClose={() => setSettleBooking(null)}>
          <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '12px 16px', marginBottom: 16, border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Technician</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{settleBooking.technician_name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Booking Amount</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>{fmt(settleBooking.total_amount)}</span>
            </div>
          </div>

          {previewLoading && <div style={{ textAlign: 'center', padding: 24 }}><Spinner /></div>}

          {settlePreview && !previewLoading && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#0F172A' }}>
                Commission Breakdown
                <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, color: '#059669' }}>
                  Total: {fmt(settlePreview.total_commission ?? 0)}
                </span>
              </div>
              {(settlePreview.line_items || []).length === 0 ? (
                <div style={{ color: '#94A3B8', fontSize: 13, marginBottom: 12 }}>No commission line items found.</div>
              ) : (
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', marginBottom: 14 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748B' }}>Item</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', color: '#64748B' }}>Total</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', color: '#64748B' }}>Commission</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', color: '#64748B' }}>Override</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(settlePreview.line_items || []).map((item: any, idx: number) => (
                      <tr key={idx} style={{ borderTop: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '6px 8px' }}>
                          <div style={{ fontWeight: 600 }}>{item.name}</div>
                          <div style={{ color: '#94A3B8', fontSize: 11 }}>{item.type} · qty {item.quantity}</div>
                        </td>
                        <td style={{ textAlign: 'right', padding: '6px 8px' }}>{fmt(item.total_price)}</td>
                        <td style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700,
                          color: item.commission_amount != null ? '#059669' : '#F59E0B' }}>
                          {item.commission_amount != null ? fmt(item.commission_amount) : 'No rule'}
                        </td>
                        <td style={{ textAlign: 'right', padding: '6px 8px' }}>
                          <input
                            type="number" min="0" step="0.01" placeholder="Override"
                            value={settleOverrides[idx] ?? ''}
                            onChange={e => setSettleOverrides(prev => ({ ...prev, [idx]: e.target.value }))}
                            style={{ width: 80, padding: '3px 6px', fontSize: 12, border: '1px solid #E2E8F0', borderRadius: 6, textAlign: 'right' }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Settlement Notes (optional)</label>
            <textarea
              className="input" rows={2} value={settleNotes}
              onChange={e => setSettleNotes(e.target.value)}
              placeholder="Any notes about this settlement…"
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#92400E' }}>
            <b>Settling</b> will credit the commission to the technician's wallet and mark this booking as <b>CLOSED</b>. This cannot be undone.
          </div>

          {settleErr && <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 12 }}>{settleErr}</div>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              style={{ background: '#059669', color: '#fff', borderRadius: 8, padding: '8px 20px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
              disabled={settleLoading || previewLoading}
              onClick={handleSettle}
            >{settleLoading ? <Spinner size="sm" /> : '🔒 Settle & Close'}</button>
            <button className="btn btn-secondary" onClick={() => setSettleBooking(null)}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
