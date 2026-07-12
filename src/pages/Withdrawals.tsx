// src/pages/Withdrawals.tsx — Admin Withdrawal Request Management
import { useEffect, useState, useCallback } from 'react'
import { walletAPI } from '@/services/api'
import PageHeader from '@/components/layout/PageHeader'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'

const fmt = (n: number) =>
  `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtDate = (iso: string) =>
  iso
    ? new Date(iso).toLocaleString('en-IN', {
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

export default function Withdrawals() {
  const [items, setItems]         = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [page, setPage]           = useState(1)
  const [pages, setPages]         = useState(1)
  const [total, setTotal]         = useState(0)
  const [statusFilter, setStatusFilter] = useState('')
  const [reviewModal, setReviewModal] = useState<any>(null)
  const [action, setAction]       = useState<'APPROVE' | 'REJECT'>('APPROVE')
  const [adminNotes, setAdminNotes] = useState('')
  const [saving, setSaving]       = useState(false)
  const [err, setErr]             = useState('')
  const [successMsg, setSuccessMsg] = useState('')

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
    setReviewModal(wr); setAction(act); setAdminNotes(''); setErr('')
  }

  const handleReview = async (e: any) => {
    e.preventDefault(); setSaving(true); setErr('')
    try {
      await walletAPI.reviewWithdrawal(reviewModal.id, { action, admin_notes: adminNotes || undefined })
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
          {successMsg}
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
                            : <span style={{ fontSize: 12, color: '#94A3B8' }}>Processed</span>
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

      {reviewModal && (
        <Modal title={action === 'APPROVE' ? '✅ Approve Withdrawal' : '❌ Reject Withdrawal'} onClose={() => setReviewModal(null)}>
          <form onSubmit={handleReview}>
            <div style={{ background: action === 'APPROVE' ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${action === 'APPROVE' ? '#86EFAC' : '#FECACA'}`, borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>{reviewModal.technician_name}</div>
                  {reviewModal.technician_code && <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>#{reviewModal.technician_code}</div>}
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: action === 'APPROVE' ? '#065F46' : '#B91C1C' }}>{fmt(reviewModal.amount)}</div>
              </div>
              {(reviewModal.upi_id || reviewModal.bank_account) && (
                <div style={{ marginTop: 10, fontSize: 12, color: '#475569' }}>
                  <strong>Pay to:</strong>{' '}
                  {reviewModal.upi_id
                    ? `UPI — ${reviewModal.upi_id}`
                    : `Bank ••••${String(reviewModal.bank_account).slice(-4)}${reviewModal.bank_name ? ` / ${reviewModal.bank_name}` : ''}${reviewModal.bank_ifsc ? ` / IFSC: ${reviewModal.bank_ifsc}` : ''}`}
                </div>
              )}
              {reviewModal.notes && <div style={{ marginTop: 6, fontSize: 12, color: '#64748B', fontStyle: 'italic' }}>Technician note: {reviewModal.notes}</div>}
            </div>

            {action === 'APPROVE' && (
              <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#92400E' }}>
                ⚠️ Approving will <strong>immediately deduct {fmt(reviewModal.amount)}</strong> from this technician's wallet. Please ensure you have transferred the funds externally before confirming.
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                Admin Notes {action === 'REJECT' ? '*' : '(optional)'}
              </label>
              <textarea className="input" rows={3} value={adminNotes} onChange={e => setAdminNotes(e.target.value)}
                required={action === 'REJECT'}
                placeholder={action === 'APPROVE' ? 'e.g. Transferred via UPI, UTR: 123456789' : 'Reason for rejection (visible to technician)'}
                style={{ resize: 'vertical' as const, fontFamily: 'inherit' }} />
            </div>

            {err && <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 12 }}>{err}</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" disabled={saving} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, color: '#fff', background: action === 'APPROVE' ? '#065F46' : '#DC2626' }}>
                {saving ? <Spinner size="sm" /> : action === 'APPROVE' ? '✅ Confirm Approval' : '❌ Confirm Rejection'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setReviewModal(null)} disabled={saving}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
