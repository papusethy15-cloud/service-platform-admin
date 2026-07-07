import { useEffect, useState, useCallback } from 'react'
import { walletAPI } from '@/services/api'
import PageHeader from '@/components/layout/PageHeader'
import Pagination from '@/components/ui/Pagination'
import Spinner from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'

const fmt = (n: number) =>
  `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtDate = (iso: string) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

function CommBadge({ paid }: { paid: boolean }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
      background: paid ? '#D1FAE5' : '#FEF3C7',
      color: paid ? '#059669' : '#D97706',
    }}>{paid ? 'Commission Paid' : 'Commission Pending'}</span>
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

  const filtered = techSearch
    ? items.filter(i =>
        (i.technician_name || '').toLowerCase().includes(techSearch.toLowerCase()) ||
        (i.technician_code || '').toLowerCase().includes(techSearch.toLowerCase()) ||
        (i.booking_number || '').toLowerCase().includes(techSearch.toLowerCase())
      )
    : items

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
            Showing {filtered.length} of {total} settled bookings. Commission is earned at settlement; <b>Mark Paid</b> on the Commissions page enables technician withdrawal.
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
                        <th style={{ textAlign: 'right' }}>Booking Amount</th>
                        <th style={{ textAlign: 'right' }}>Commission</th>
                        <th>Commission Status</th>
                        <th>Settled At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0
                        ? <tr><td colSpan={7} style={{ textAlign: 'center', color: '#94A3B8', padding: 50 }}>No settled bookings found</td></tr>
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
                                ? <CommBadge paid={s.commission_paid} />
                                : <span style={{ fontSize: 11, color: '#94A3B8' }}>No commission</span>
                              }
                            </td>
                            <td style={{ fontSize: 12, color: '#64748B' }}>{fmtDate(s.settled_at)}</td>
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
