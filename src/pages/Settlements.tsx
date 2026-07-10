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
  const [items, setItems]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage]     = useState(1)
  const [pages, setPages]   = useState(1)
  const [total, setTotal]   = useState(0)
  const [techSearch, setTechSearch] = useState('')

  // Withdrawal requests tab
  const [tab, setTab]       = useState<'settlements' | 'withdrawals'>('settlements')
  const [wrItems, setWrItems]   = useState<any[]>([])
  const [wrLoading, setWrLoading] = useState(false)
  const [wrPage, setWrPage] = useState(1)
  const [wrPages, setWrPages] = useState(1)
  const [wrTotal, setWrTotal] = useState(0)
  const [wrFilter, setWrFilter] = useState('')
  const [reviewing, setReviewing] = useState<any>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [saving, setSaving]   = useState(false)
  const [err, setErr]         = useState('')

  // Settle modal (from settlements page)
  const [settleBooking, setSettleBooking] = useState<any>(null)
  const [settlePreview, setSettlePreview] = useState<any>(null)
  const [settleLoading, setSettleLoading] = useState(false)
  const [settleNotes, setSettleNotes]     = useState('')
  const [settleOverrides, setSettleOverrides] = useState<Record<number, string>>({})
  const [settleErr, setSettleErr]         = useState('')
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

  const fetchWithdrawals = useCallback(async () => {
    setWrLoading(true)
    try {
      const r = await walletAPI.withdrawalRequests({ page: wrPage, per_page: 20, status: wrFilter || undefined })
      const d = r.data.data
      setWrItems(d.items || [])
      setWrPages(d.pages || 1)
      setWrTotal(d.total || 0)
    } catch { setWrItems([]) } finally { setWrLoading(false) }
  }, [wrPage, wrFilter])

  useEffect(() => { if (tab === 'settlements') fetchSettlements() }, [fetchSettlements, tab])
  useEffect(() => { if (tab === 'withdrawals') fetchWithdrawals() }, [fetchWithdrawals, tab])

  const handleReview = async (action: 'APPROVE' | 'REJECT') => {
    if (!reviewing) return
    setSaving(true); setErr('')
    try {
      await walletAPI.reviewWithdrawal(reviewing.id, { action, admin_notes: reviewNotes || undefined })
      setReviewing(null); setReviewNotes('')
      fetchWithdrawals()
    } catch (ex: any) { setErr(ex.response?.data?.detail || 'Failed') } finally { setSaving(false) }
  }

  // Open settle modal — load preview
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

  // Bookings that can still be settled (PAID or COMPLETED, not yet CLOSED/SETTLED)
  const canSettle = (s: any) => ['PAID', 'COMPLETED', 'INVOICE_GENERATED', 'PAYMENT_PENDING'].includes(s.booking_status || '')

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader
        title="Settlements & Withdrawals"
        subtitle="Settled bookings, technician commissions, and withdrawal requests"
      />

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 0, marginTop: 20, marginBottom: 20, borderBottom: '2px solid #E2E8F0' }}>
        {([['settlements', `Settled Bookings (${total})`], ['withdrawals', `Withdrawal Requests (${wrTotal})`]] as [string, string][]).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k as any)}
            style={{
              padding: '10px 22px', border: 'none', cursor: 'pointer',
              background: 'none', fontWeight: 700, fontSize: 13,
              color: tab === k ? '#1B4FD8' : '#64748B',
              borderBottom: tab === k ? '2px solid #1B4FD8' : '2px solid transparent',
              marginBottom: -2,
            }}
          >{label}</button>
        ))}
      </div>

      {/* ═══════════ SETTLED BOOKINGS TAB ═══════════ */}
      {tab === 'settlements' && (
        <>
          <div style={{ marginBottom: 14 }}>
            <input
              className="input"
              style={{ maxWidth: 340 }}
              placeholder="Search by technician, code, booking number…"
              value={techSearch}
              onChange={e => setTechSearch(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: 10, fontSize: 13, color: '#64748B' }}>
            Showing {filtered.length} of {total} bookings. <b>Settle & Close</b> finalises commission and credits the technician's wallet.
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
                        ? <tr><td colSpan={8} style={{ textAlign: 'center', color: '#94A3B8', padding: 50 }}>No bookings found</td></tr>
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
                                  className="btn btn-primary btn-sm"
                                  style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}
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
        </>
      )}

      {/* ═══════════ WITHDRAWAL REQUESTS TAB ═══════════ */}
      {tab === 'withdrawals' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {['', 'PENDING', 'APPROVED', 'REJECTED'].map(s => (
              <button
                key={s}
                onClick={() => { setWrFilter(s); setWrPage(1) }}
                style={{
                  padding: '5px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 700,
                  background: wrFilter === s ? '#1B4FD8' : '#F1F5F9',
                  color: wrFilter === s ? '#fff' : '#475569',
                }}
              >{s || 'All'}</button>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94A3B8', alignSelf: 'center' }}>{wrTotal} requests</span>
          </div>

          <div className="card" style={{ overflow: 'hidden' }}>
            {wrLoading
              ? <div style={{ padding: 60, textAlign: 'center' }}><Spinner /></div>
              : (
                <>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Technician</th>
                        <th style={{ textAlign: 'right' }}>Amount</th>
                        <th>Payment Method</th>
                        <th>Status</th>
                        <th>Requested At</th>
                        <th style={{ textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wrItems.length === 0
                        ? <tr><td colSpan={6} style={{ textAlign: 'center', color: '#94A3B8', padding: 50 }}>No withdrawal requests found</td></tr>
                        : wrItems.map((wr: any) => (
                          <tr key={wr.id}>
                            <td>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{wr.technician_name}</div>
                              {wr.technician_code && <div style={{ fontSize: 11, color: '#64748B' }}>#{wr.technician_code} · {wr.technician_mobile}</div>}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 15, color: '#0F172A' }}>{fmt(wr.amount)}</td>
                            <td>
                              {wr.upi_id
                                ? <div><span style={{ fontSize: 11, background: '#EFF6FF', color: '#1B4FD8', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>UPI</span><div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>{wr.upi_id}</div></div>
                                : wr.bank_account
                                  ? <div><span style={{ fontSize: 11, background: '#F0FDF4', color: '#059669', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>Bank</span><div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>{wr.bank_name} · {wr.bank_account}</div><div style={{ fontSize: 11, color: '#94A3B8' }}>IFSC: {wr.bank_ifsc}</div></div>
                                  : <span style={{ color: '#94A3B8', fontSize: 12 }}>—</span>
                              }
                            </td>
                            <td>
                              {(() => {
                                const colors: Record<string, [string, string]> = {
                                  PENDING: ['#FEF3C7', '#D97706'],
                                  APPROVED: ['#D1FAE5', '#059669'],
                                  REJECTED: ['#FEE2E2', '#DC2626'],
                                }
                                const [bg, color] = colors[wr.status] || ['#F1F5F9', '#64748B']
                                return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: bg, color }}>{wr.status}</span>
                              })()}
                              {wr.admin_notes && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>{wr.admin_notes}</div>}
                            </td>
                            <td style={{ fontSize: 12, color: '#64748B' }}>{fmtDate(wr.created_at)}</td>
                            <td style={{ textAlign: 'center' }}>
                              {wr.status === 'PENDING'
                                ? (
                                  <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => { setErr(''); setReviewNotes(''); setReviewing(wr) }}
                                  >Review</button>
                                )
                                : <span style={{ fontSize: 12, color: '#94A3B8' }}>{fmtDate(wr.reviewed_at)}</span>
                              }
                            </td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                  <Pagination page={wrPage} pages={wrPages} onPage={p => setWrPage(p)} />
                </>
              )
            }
          </div>
        </>
      )}

      {/* ═══════════ SETTLE MODAL ═══════════ */}
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
                        <td style={{ textAlign: 'right', padding: '6px 8px', color: item.commission_amount != null ? '#059669' : '#F59E0B', fontWeight: 700 }}>
                          {item.commission_amount != null ? fmt(item.commission_amount) : 'No rule'}
                        </td>
                        <td style={{ textAlign: 'right', padding: '6px 8px' }}>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Override"
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
              className="input"
              rows={2}
              value={settleNotes}
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

      {/* ═══════════ REVIEW MODAL ═══════════ */}
      {reviewing && (
        <Modal title={`Review Withdrawal — ${reviewing.technician_name}`} onClose={() => setReviewing(null)}>
          <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '14px 16px', marginBottom: 16, border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Requested Amount</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#0F172A' }}>{fmt(reviewing.amount)}</span>
            </div>
            <div style={{ fontSize: 12, color: '#64748B', marginBottom: 4 }}>
              {reviewing.upi_id
                ? <><b>UPI:</b> {reviewing.upi_id}</>
                : <><b>Bank:</b> {reviewing.bank_name} · A/c {reviewing.bank_account} · IFSC {reviewing.bank_ifsc}</>
              }
            </div>
            {reviewing.notes && <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}><b>Technician note:</b> {reviewing.notes}</div>}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Admin Notes (optional)</label>
            <textarea
              className="input"
              rows={3}
              value={reviewNotes}
              onChange={e => setReviewNotes(e.target.value)}
              placeholder="Reason for approval/rejection, UTR number, etc."
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#92400E' }}>
            <b>Approving</b> will immediately deduct ₹{fmt(reviewing.amount)} from the technician's wallet balance and record a WITHDRAWAL transaction. This cannot be undone.
          </div>

          {err && <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 12 }}>{err}</div>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn"
              style={{ background: '#059669', color: '#fff', borderRadius: 8, padding: '8px 20px', border: 'none', cursor: 'pointer', fontWeight: 700 }}
              disabled={saving}
              onClick={() => handleReview('APPROVE')}
            >{saving ? <Spinner size="sm" /> : '✓ Approve'}</button>
            <button
              className="btn"
              style={{ background: '#DC2626', color: '#fff', borderRadius: 8, padding: '8px 20px', border: 'none', cursor: 'pointer', fontWeight: 700 }}
              disabled={saving}
              onClick={() => handleReview('REJECT')}
            >{saving ? <Spinner size="sm" /> : '✕ Reject'}</button>
            <button className="btn btn-secondary" onClick={() => setReviewing(null)}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
