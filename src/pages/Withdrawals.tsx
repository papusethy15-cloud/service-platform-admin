// src/pages/Withdrawals.tsx — Admin Withdrawal Request Management
import { useEffect, useState, useCallback } from 'react'
import { walletAPI } from '@/services/api'
import PageHeader from '@/components/layout/PageHeader'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'

const fmt = (n: number) =>
  `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const fmtDate = (iso: string) =>
  iso
    ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata',
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '—'

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    PENDING:  { bg: '#FEF3C7', color: '#D97706', label: '⏳ Pending' },
    APPROVED: { bg: '#D1FAE5', color: '#065F46', label: '✅ Approved' },
    REJECTED: { bg: '#FEE2E2', color: '#B91C1C', label: '❌ Rejected' },
  }
  const s = map[status] || { bg: '#F1F5F9', color: '#475569', label: status }
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: '3px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
    }}>{s.label}</span>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '16px 20px',
      border: '1px solid #E2E8F0', flex: 1, minWidth: 150,
    }}>
      <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: color || '#0F172A' }}>{value}</div>
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 13 }}>
      <span style={{ color: '#64748B', minWidth: 120, fontWeight: 600 }}>{label}:</span>
      <span style={{ color: '#0F172A', fontFamily: mono ? 'monospace' : 'inherit', wordBreak: 'break-all' as const }}>{value}</span>
    </div>
  )
}

export default function Withdrawals() {
  const [items, setItems]               = useState<any[]>([])
  const [loading, setLoading]           = useState(true)
  const [page, setPage]                 = useState(1)
  const [pages, setPages]               = useState(1)
  const [total, setTotal]               = useState(0)
  const [statusFilter, setStatusFilter] = useState('')
  const [reviewModal, setReviewModal]   = useState<any>(null)
  const [action, setAction]             = useState<'APPROVE' | 'REJECT'>('APPROVE')
  const [adminNotes, setAdminNotes]     = useState('')
  const [paymentRef, setPaymentRef]     = useState('')
  const [saving, setSaving]             = useState(false)
  const [err, setErr]                   = useState('')
  const [successMsg, setSuccessMsg]     = useState('')

  const pendingCount  = items.filter(i => i.status === 'PENDING').length
  const approvedTotal = items.filter(i => i.status === 'APPROVED').reduce((s: number, i: any) => s + (i.amount || 0), 0)
  const pendingTotal  = items.filter(i => i.status === 'PENDING').reduce((s: number, i: any) => s + (i.amount || 0), 0)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const r = await walletAPI.withdrawalRequests({ page, per_page: 20, status: statusFilter || undefined })
      const d = r.data.data
      setItems(d.items || [])
      setPages(d.pages || 1)
      setTotal(d.total || 0)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  useEffect(() => { fetchAll() }, [fetchAll])

  const openReview = (wr: any, act: 'APPROVE' | 'REJECT') => {
    setReviewModal(wr)
    setAction(act)
    setAdminNotes('')
    setPaymentRef('')
    setErr('')
  }

  const handleReview = async (e: any) => {
    e.preventDefault()
    if (action === 'APPROVE' && !paymentRef.trim()) {
      setErr('Payment Reference (UTR / UPI Ref) is required when approving.')
      return
    }
    setSaving(true); setErr('')
    try {
      await walletAPI.reviewWithdrawal(reviewModal.id, {
        action,
        admin_notes: adminNotes || undefined,
        payment_reference: action === 'APPROVE' ? paymentRef.trim() : undefined,
      })
      setReviewModal(null)
      setSuccessMsg(`Withdrawal ${action === 'APPROVE' ? 'approved' : 'rejected'} successfully`)
      setTimeout(() => setSuccessMsg(''), 4000)
      fetchAll()
    } catch (ex: any) {
      setErr(ex.response?.data?.detail || 'Failed to process request')
    } finally { setSaving(false) }
  }

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader title="Withdrawal Requests" subtitle={`${total} total requests`} />

      {successMsg && (
        <div style={{ background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 10, padding: '12px 16px', marginTop: 16, color: '#065F46', fontWeight: 600, fontSize: 13 }}>
          ✅ {successMsg}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' as const }}>
        <SummaryCard label="Total Requests" value={String(total)} />
        <SummaryCard label="Pending Requests" value={String(pendingCount)} color="#D97706" />
        <SummaryCard label="Pending Amount" value={fmt(pendingTotal)} color="#D97706" />
        <SummaryCard label="Approved (This Page)" value={fmt(approvedTotal)} color="#065F46" />
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 20, marginBottom: 14 }}>
        {[
          { val: '', label: 'All' },
          { val: 'PENDING', label: '⏳ Pending' },
          { val: 'APPROVED', label: '✅ Approved' },
          { val: 'REJECTED', label: '❌ Rejected' },
        ].map(tab => (
          <button key={tab.val} onClick={() => { setStatusFilter(tab.val); setPage(1) }}
            style={{ padding: '7px 18px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
              background: statusFilter === tab.val ? '#1D4ED8' : '#F1F5F9',
              color: statusFilter === tab.val ? '#fff' : '#475569' }}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? <div style={{ padding: 60, textAlign: 'center' }}><Spinner /></div> : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Technician</th>
                  <th>Amount</th>
                  <th>Payment To</th>
                  <th>Notes</th>
                  <th>Requested</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0
                  ? <tr><td colSpan={7} style={{ textAlign: 'center', color: '#94A3B8', padding: 48 }}>
                      <div style={{ fontSize: 32 }}>💸</div>
                      <div style={{ marginTop: 8 }}>No withdrawal requests found</div>
                    </td></tr>
                  : items.map((wr: any) => {
                    const payTo = wr.upi_id
                      ? `UPI: ${wr.upi_id}`
                      : wr.bank_account
                        ? `Bank ••••${String(wr.bank_account).slice(-4)}${wr.bank_name ? ` (${wr.bank_name})` : ''}`
                        : '—'
                    return (
                      <tr key={wr.id} style={{ background: wr.status === 'PENDING' ? '#FFFBEB' : undefined }}>
                        <td>
                          <div style={{ fontWeight: 700, color: '#0F172A', fontSize: 13 }}>{wr.technician_name || 'Unknown'}</div>
                          {wr.technician_code && <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>#{wr.technician_code} · {wr.technician_mobile || ''}</div>}
                        </td>
                        <td><span style={{ fontSize: 16, fontWeight: 900, color: '#0F172A' }}>{fmt(wr.amount)}</span></td>
                        <td style={{ fontSize: 12, color: '#475569' }}>{payTo}</td>
                        <td style={{ fontSize: 12, color: '#475569', maxWidth: 180 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, maxWidth: 180 }} title={wr.notes || ''}>{wr.notes || '—'}</div>
                          {wr.admin_notes && <div style={{ fontSize: 11, color: '#065F46', fontStyle: 'italic', marginTop: 2 }}>Admin: {wr.admin_notes}</div>}
                          {wr.payment_reference && <div style={{ fontSize: 11, color: '#1D4ED8', fontFamily: 'monospace', marginTop: 2 }}>Ref: {wr.payment_reference}</div>}
                        </td>
                        <td style={{ fontSize: 12, color: '#64748B', whiteSpace: 'nowrap' as const }}>
                          {fmtDate(wr.created_at)}
                          {wr.reviewed_at && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Reviewed: {fmtDate(wr.reviewed_at)}</div>}
                        </td>
                        <td><StatusPill status={wr.status} /></td>
                        <td style={{ textAlign: 'center' }}>
                          {wr.status === 'PENDING'
                            ? <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                <button className="btn btn-sm" onClick={() => openReview(wr, 'APPROVE')}
                                  style={{ background: '#065F46', color: '#fff', border: '1px solid #065F46', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>
                                  ✅ Approve
                                </button>
                                <button className="btn btn-sm" onClick={() => openReview(wr, 'REJECT')}
                                  style={{ background: '#FEE2E2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>
                                  ❌ Reject
                                </button>
                              </div>
                            : <button onClick={() => openReview(wr, 'APPROVE')}
                                style={{ background: 'transparent', border: '1px solid #E2E8F0', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontSize: 11, color: '#64748B' }}>
                                👁 Details
                              </button>
                          }
                        </td>
                      </tr>
                    )
                  })
                }
              </tbody>
            </table>
            <Pagination page={page} pages={pages} onPage={p => setPage(p)} />
          </>
        )}
      </div>

      {/* ── Review / Details Modal ─────────────────────────────────────────── */}
      {reviewModal && (
        <Modal
          title={
            reviewModal.status !== 'PENDING'
              ? `📋 Withdrawal Details`
              : action === 'APPROVE' ? '✅ Approve Withdrawal' : '❌ Reject Withdrawal'
          }
          onClose={() => setReviewModal(null)}
        >
          {/* ── Technician & Amount header ── */}
          <div style={{
            background: '#F8FAFC', border: '1px solid #E2E8F0',
            borderRadius: 12, padding: '16px 18px', marginBottom: 18,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#0F172A' }}>{reviewModal.technician_name}</div>
                {reviewModal.technician_code && (
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                    Code: #{reviewModal.technician_code}
                    {reviewModal.technician_mobile ? ` · 📱 ${reviewModal.technician_mobile}` : ''}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' as const }}>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#0F172A' }}>{fmt(reviewModal.amount)}</div>
                <StatusPill status={reviewModal.status} />
              </div>
            </div>

            {/* ── Payment destination ── */}
            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 8 }}>
                Payment Destination
              </div>
              {reviewModal.upi_id ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>UPI</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 14, color: '#0F172A', fontWeight: 600 }}>{reviewModal.upi_id}</span>
                </div>
              ) : reviewModal.bank_account ? (
                <div style={{ display: 'grid', gap: 4 }}>
                  <InfoRow label="Account No" value={reviewModal.bank_account} mono />
                  <InfoRow label="IFSC Code"  value={reviewModal.bank_ifsc}    mono />
                  <InfoRow label="Bank Name"  value={reviewModal.bank_name} />
                </div>
              ) : (
                <span style={{ fontSize: 13, color: '#94A3B8' }}>No payment details provided</span>
              )}
            </div>

            {/* ── Technician notes ── */}
            {reviewModal.notes && (
              <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 10, marginTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 4 }}>Technician Note</div>
                <div style={{ fontSize: 13, color: '#475569', fontStyle: 'italic' }}>"{reviewModal.notes}"</div>
              </div>
            )}

            {/* ── Already reviewed — show result ── */}
            {reviewModal.status !== 'PENDING' && (
              <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 10, marginTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 6 }}>Review Info</div>
                <InfoRow label="Reviewed At"   value={fmtDate(reviewModal.reviewed_at)} />
                {reviewModal.payment_reference && (
                  <InfoRow label="Payment Ref"  value={reviewModal.payment_reference} mono />
                )}
                {reviewModal.admin_notes && (
                  <InfoRow label="Admin Notes"  value={reviewModal.admin_notes} />
                )}
              </div>
            )}
          </div>

          {/* ── Action form — only for PENDING ── */}
          {reviewModal.status === 'PENDING' && (
            <form onSubmit={handleReview}>

              {action === 'APPROVE' && (
                <>
                  {/* Transfer checklist */}
                  <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1D4ED8', marginBottom: 6 }}>📋 Before you confirm approval:</div>
                    <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#1E3A5F', lineHeight: 1.8 }}>
                      {reviewModal.upi_id
                        ? <li>Transfer <strong>{fmt(reviewModal.amount)}</strong> to UPI ID: <strong style={{ fontFamily: 'monospace' }}>{reviewModal.upi_id}</strong></li>
                        : <>
                            <li>Transfer <strong>{fmt(reviewModal.amount)}</strong> to Account: <strong style={{ fontFamily: 'monospace' }}>{reviewModal.bank_account}</strong></li>
                            {reviewModal.bank_ifsc && <li>IFSC: <strong style={{ fontFamily: 'monospace' }}>{reviewModal.bank_ifsc}</strong>{reviewModal.bank_name ? ` · ${reviewModal.bank_name}` : ''}</li>}
                          </>
                      }
                      <li>Copy the <strong>UTR / Transaction Reference</strong> from your bank/UPI app</li>
                      <li>Paste it in the field below and click Confirm</li>
                    </ol>
                  </div>

                  {/* Payment Reference — required for APPROVE */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: '#0F172A' }}>
                      Payment Reference / UTR <span style={{ color: '#DC2626' }}>*</span>
                    </label>
                    <input
                      className="input"
                      type="text"
                      value={paymentRef}
                      onChange={e => setPaymentRef(e.target.value)}
                      placeholder="e.g. UTR123456789012 or UPI Ref: 4056789123"
                      style={{ fontFamily: 'monospace', letterSpacing: 0.5 }}
                      autoFocus
                    />
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                      This reference will be saved and visible to the technician in their wallet history.
                    </div>
                  </div>
                </>
              )}

              {/* Admin Notes */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                  Admin Notes {action === 'REJECT' ? <span style={{ color: '#DC2626' }}>*</span> : <span style={{ color: '#94A3B8' }}>(optional)</span>}
                </label>
                <textarea className="input" rows={3} value={adminNotes} onChange={e => setAdminNotes(e.target.value)}
                  required={action === 'REJECT'}
                  placeholder={action === 'APPROVE'
                    ? 'e.g. Paid via PhonePe, processed on 12 Jul 2026'
                    : 'Reason for rejection — this will be shown to the technician'}
                  style={{ resize: 'vertical' as const, fontFamily: 'inherit' }} />
              </div>

              {/* Warning banner for approval */}
              {action === 'APPROVE' && (
                <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#92400E' }}>
                  ⚠️ Confirming will <strong>immediately deduct {fmt(reviewModal.amount)}</strong> from this technician's wallet balance.
                </div>
              )}

              {err && <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 12 }}>{err}</div>}

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" disabled={saving} style={{
                  padding: '10px 24px', borderRadius: 10, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                  fontWeight: 700, fontSize: 13, color: '#fff',
                  background: action === 'APPROVE' ? '#065F46' : '#DC2626',
                  opacity: saving ? 0.7 : 1,
                }}>
                  {saving ? <Spinner size="sm" /> : action === 'APPROVE' ? '✅ Confirm Payment & Approve' : '❌ Confirm Rejection'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setReviewModal(null)} disabled={saving}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  )
}
