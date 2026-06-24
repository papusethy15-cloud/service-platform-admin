import { useEffect, useState } from 'react'
import { attendanceAPI, leavesAPI } from '@/services/api'
import PageHeader from '@/components/layout/PageHeader'
import StatusBadge from '@/components/ui/StatusBadge'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'

export default function Attendance() {
  const [tab, setTab] = useState<'attendance' | 'leaves'>('attendance')
  const [records, setRecords] = useState<any[]>([])
  const [leaves, setLeaves] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [reviewModal, setReviewModal] = useState<any>(null)
  const [reviewAction, setReviewAction] = useState<'APPROVED' | 'REJECTED'>('APPROVED')
  const [saving, setSaving] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      if (tab === 'attendance') {
        const r = await attendanceAPI.list({ page, per_page: 20 })
        const d = r.data.data
        setRecords(d.items || []); setPages(d.pages || 1); setTotal(d.total || 0)
      } else {
        const r = await leavesAPI.list({ page, per_page: 20 })
        const d = r.data.data
        setLeaves(d.items || []); setPages(d.pages || 1); setTotal(d.total || 0)
      }
    } catch { setRecords([]); setLeaves([]) } finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [tab, page])

  const handleLeaveReview = async () => {
    if (!reviewModal) return
    setSaving(true)
    try {
      await leavesAPI.review(reviewModal.id, { status: reviewAction })
      setReviewModal(null); fetchData()
    } catch {} finally { setSaving(false) }
  }

  const tabStyle = (t: string) => ({
    padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
    background: tab === t ? '#1B4FD8' : '#F1F5F9', color: tab === t ? '#fff' : '#334155'
  })

  const fmt = (d: string) => d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader title="Attendance & Leaves" subtitle={`${total} records`} />
      <div style={{ height: 20 }} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button style={tabStyle('attendance')} onClick={() => { setTab('attendance'); setPage(1) }}>Attendance Log</button>
        <button style={tabStyle('leaves')} onClick={() => { setTab('leaves'); setPage(1) }}>Leave Requests</button>
      </div>

      <div className="card">
        {loading ? <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div> : (
          <>
            {tab === 'attendance' ? (
              <table className="data-table">
                <thead>
                  <tr><th>Technician</th><th>Date</th><th>Check-In</th><th>Check-Out</th><th>Duration</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {records.length === 0
                    ? <tr><td colSpan={6} style={{ textAlign: 'center', color: '#94A3B8', padding: 32 }}>No attendance records</td></tr>
                    : records.map((r: any) => {
                      const duration = r.check_in && r.check_out
                        ? `${Math.round((new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 3600000)}h`
                        : '—'
                      return (
                        <tr key={r.id}>
                          <td style={{ fontWeight: 500 }}>{r.technician_name || r.technician_id}</td>
                          <td>{r.date ? new Date(r.date).toLocaleDateString('en-IN') : '—'}</td>
                          <td style={{ fontSize: 12, color: '#059669' }}>{fmt(r.check_in)}</td>
                          <td style={{ fontSize: 12, color: '#DC2626' }}>{fmt(r.check_out)}</td>
                          <td style={{ fontWeight: 600 }}>{duration}</td>
                          <td><StatusBadge status={r.status || 'PRESENT'} /></td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th>Technician</th><th>Leave Type</th><th>From</th><th>To</th><th>Reason</th><th>Status</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {leaves.length === 0
                    ? <tr><td colSpan={7} style={{ textAlign: 'center', color: '#94A3B8', padding: 32 }}>No leave requests</td></tr>
                    : leaves.map((l: any) => (
                      <tr key={l.id}>
                        <td style={{ fontWeight: 500 }}>{l.technician_name || l.user_id}</td>
                        <td>{l.leave_type || '—'}</td>
                        <td style={{ fontSize: 12 }}>{l.from_date ? new Date(l.from_date).toLocaleDateString('en-IN') : '—'}</td>
                        <td style={{ fontSize: 12 }}>{l.to_date ? new Date(l.to_date).toLocaleDateString('en-IN') : '—'}</td>
                        <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: '#64748B' }}>{l.reason || '—'}</td>
                        <td><StatusBadge status={l.status || 'PENDING'} /></td>
                        <td>
                          {l.status === 'PENDING' && (
                            <button className="btn btn-primary btn-sm" onClick={() => setReviewModal(l)}>Review</button>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
            <Pagination page={page} pages={pages} onPage={setPage} />
          </>
        )}
      </div>

      {reviewModal && (
        <Modal title="Review Leave Request" onClose={() => setReviewModal(null)}>
          <p style={{ fontSize: 14, color: '#374151', marginBottom: 4 }}>
            <b>{reviewModal.technician_name || reviewModal.user_id}</b> — {reviewModal.leave_type}
          </p>
          <p style={{ fontSize: 13, color: '#64748B', marginBottom: 20 }}>
            {reviewModal.from_date} → {reviewModal.to_date}<br />{reviewModal.reason}
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: reviewAction === 'APPROVED' ? '#059669' : '#F1F5F9', color: reviewAction === 'APPROVED' ? '#fff' : '#334155' }}
              onClick={() => setReviewAction('APPROVED')}>✓ Approve</button>
            <button
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: reviewAction === 'REJECTED' ? '#DC2626' : '#F1F5F9', color: reviewAction === 'REJECTED' ? '#fff' : '#334155' }}
              onClick={() => setReviewAction('REJECTED')}>✗ Reject</button>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" onClick={handleLeaveReview} disabled={saving}>
              {saving ? <Spinner size="sm" /> : `Confirm ${reviewAction === 'APPROVED' ? 'Approval' : 'Rejection'}`}
            </button>
            <button className="btn btn-secondary" onClick={() => setReviewModal(null)}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
