import { todayIST, fmtDateIST, fmtDateTimeIST, fmtTimeIST } from "../lib/tz";
import { useEffect, useState, useCallback } from 'react'
import { attendanceAPI, leavesAPI, techniciansAPI } from '@/services/api'
import PageHeader from '@/components/layout/PageHeader'
import StatusBadge from '@/components/ui/StatusBadge'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'
import Toast, { useToast } from '@/components/ui/Toast'

// ─── Types ────────────────────────────────────────────────────────────────────
interface AttendanceRecord {
  id: string
  technician_id: string
  technician_name?: string
  date: string
  check_in: string | null
  check_out: string | null
  is_active: boolean
  hours_worked: number
  status: string
  notes?: string
}

interface LeaveRecord {
  id: string
  technician_id: string
  technician_name?: string
  leave_type: string
  from_date: string
  to_date: string
  reason: string
  status: string
  created_at?: string
}

interface Technician { id: string; name: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtTime = (d: string | null) =>
  d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'

const fmtDate = (d: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const fmtDuration = (hours: number) => {
  if (!hours) return '—'
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

const daysBetween = (from: string, to: string) => {
  const d1 = new Date(from), d2 = new Date(to)
  return Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1
}

const LEAVE_TYPE_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  SICK:    { bg: '#FEF2F2', color: '#DC2626', label: 'Sick Leave' },
  CASUAL:  { bg: '#FFF7ED', color: '#C2410C', label: 'Casual Leave' },
  ANNUAL:  { bg: '#EFF6FF', color: '#1D4ED8', label: 'Annual Leave' },
  UNPAID:  { bg: '#F1F5F9', color: '#475569', label: 'Unpaid Leave' },
}

const STATUS_ICON: Record<string, string> = {
  PRESENT: '✅', ABSENT: '❌', HALF_DAY: '🌓', LEAVE: '🏖️',
}

// ─── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color }: {
  icon: string; label: string; value: string | number; sub?: string; color: string
}) {
  return (
    <div className="stat-card" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12, background: color + '18',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#0F172A', lineHeight: 1.2, marginTop: 2 }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Attendance() {
  const [tab, setTab] = useState<'attendance' | 'leaves'>('attendance')
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [leaves, setLeaves]   = useState<LeaveRecord[]>([])
  const [techMap, setTechMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [page, setPage]   = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Filters — attendance
  const [filterTech, setFilterTech]   = useState('')
  const [filterFrom, setFilterFrom]   = useState('')
  const [filterTo,   setFilterTo]     = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // Filters — leaves
  const [filterLeaveStatus, setFilterLeaveStatus] = useState('')

  // Stats
  const [stats, setStats] = useState({ present: 0, absent: 0, onLeave: 0, avgHours: 0, pendingLeaves: 0 })

  // Review modal
  const [reviewModal,  setReviewModal]  = useState<LeaveRecord | null>(null)
  const [reviewAction, setReviewAction] = useState<'APPROVED' | 'REJECTED'>('APPROVED')
  const [reviewNotes,  setReviewNotes]  = useState('')
  const [saving, setSaving] = useState(false)

  // Detail modal
  const [detailRecord, setDetailRecord] = useState<AttendanceRecord | null>(null)

  const { toasts, removeToast, toast } = useToast()

  // Load technicians for name mapping
  useEffect(() => {
    techniciansAPI.list({ per_page: 200 }).then(r => {
      const items = r.data?.data?.items || r.data?.data || []
      const map: Record<string, string> = {}
      items.forEach((t: Technician) => { map[t.id] = t.name })
      setTechMap(map)
    }).catch(() => {})
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      if (tab === 'attendance') {
        const params: any = { page, per_page: 20 }
        if (filterTech)   params.technician_id = filterTech
        if (filterFrom)   params.date_from = filterFrom
        if (filterTo)     params.date_to   = filterTo
        if (filterStatus) params.status    = filterStatus
        const r = await attendanceAPI.list(params)
        const d = r.data.data
        const items: AttendanceRecord[] = (d.items || []).map((a: any) => ({
          ...a, technician_name: techMap[a.technician_id] || a.technician_id?.slice(0, 8)
        }))
        setRecords(items); setPages(d.pages || 1); setTotal(d.total || 0)
        // Compute stats from page items
        const present  = items.filter(i => i.status === 'PRESENT').length
        const absent   = items.filter(i => i.status === 'ABSENT').length
        const onLeave  = items.filter(i => i.status === 'LEAVE').length
        const avgH     = items.length ? items.reduce((s, i) => s + (i.hours_worked || 0), 0) / items.length : 0
        setStats(s => ({ ...s, present, absent, onLeave, avgHours: parseFloat(avgH.toFixed(1)) }))
      } else {
        const params: any = { page, per_page: 20 }
        if (filterLeaveStatus) params.status = filterLeaveStatus
        const r = await leavesAPI.list(params)
        const d = r.data.data
        const items: LeaveRecord[] = (d.items || []).map((l: any) => ({
          ...l, technician_name: techMap[l.technician_id] || l.technician_id?.slice(0, 8)
        }))
        setLeaves(items); setPages(d.pages || 1); setTotal(d.total || 0)
        const pending = items.filter(i => i.status === 'PENDING').length
        setStats(s => ({ ...s, pendingLeaves: pending }))
      }
    } catch {
      setRecords([]); setLeaves([])
    } finally { setLoading(false) }
  }, [tab, page, filterTech, filterFrom, filterTo, filterStatus, filterLeaveStatus, techMap])

  useEffect(() => { fetchData() }, [fetchData])

  const handleLeaveReview = async () => {
    if (!reviewModal) return
    setSaving(true)
    try {
      await leavesAPI.review(reviewModal.id, { status: reviewAction, notes: reviewNotes })
      toast.success(`Leave ${reviewAction === 'APPROVED' ? 'approved' : 'rejected'} successfully`)
      setReviewModal(null); setReviewNotes(''); fetchData()
    } catch {
      toast.error('Failed to update leave status')
    } finally { setSaving(false) }
  }

  const resetFilters = () => {
    setFilterTech(''); setFilterFrom(''); setFilterTo(''); setFilterStatus(''); setFilterLeaveStatus(''); setPage(1)
  }

  const techOptions = Object.entries(techMap).map(([id, name]) => ({ id, name }))

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 28px' }}>
      <Toast toasts={toasts} onRemove={removeToast} />

      <PageHeader
        title="Attendance & Leave Management"
        subtitle="Track technician working hours, daily attendance, and manage leave requests"
      />

      {/* ── Stats Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, margin: '20px 0' }}>
        <StatCard icon="✅" label="Present Today" value={stats.present} sub="on current page" color="#059669" />
        <StatCard icon="❌" label="Absent" value={stats.absent} sub="on current page" color="#DC2626" />
        <StatCard icon="🏖️" label="On Leave" value={stats.onLeave} sub="on current page" color="#7C3AED" />
        <StatCard icon="⏱️" label="Avg Hours" value={`${stats.avgHours}h`} sub="per technician" color="#1B4FD8" />
        <StatCard icon="📋" label="Pending Leaves" value={stats.pendingLeaves} sub="need review" color="#D97706" />
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', padding: 4, borderRadius: 10, width: 'fit-content', marginBottom: 20 }}>
        {(['attendance', 'leaves'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setPage(1) }}
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
              background: tab === t ? 'white' : 'transparent',
              color: tab === t ? '#1B4FD8' : '#64748B',
              boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {t === 'attendance' ? '🗓️  Attendance Log' : '📋  Leave Requests'}
          </button>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {tab === 'attendance' ? (
            <>
              <div style={{ flex: '1 1 180px' }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>TECHNICIAN</label>
                <select className="input" value={filterTech} onChange={e => { setFilterTech(e.target.value); setPage(1) }} style={{ fontSize: 13 }}>
                  <option value="">All Technicians</option>
                  {techOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div style={{ flex: '1 1 140px' }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>FROM DATE</label>
                <input className="input" type="date" value={filterFrom} onChange={e => { setFilterFrom(e.target.value); setPage(1) }} style={{ fontSize: 13 }} />
              </div>
              <div style={{ flex: '1 1 140px' }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>TO DATE</label>
                <input className="input" type="date" value={filterTo} onChange={e => { setFilterTo(e.target.value); setPage(1) }} style={{ fontSize: 13 }} />
              </div>
              <div style={{ flex: '1 1 140px' }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>STATUS</label>
                <select className="input" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }} style={{ fontSize: 13 }}>
                  <option value="">All Status</option>
                  <option value="PRESENT">Present</option>
                  <option value="ABSENT">Absent</option>
                  <option value="HALF_DAY">Half Day</option>
                  <option value="LEAVE">On Leave</option>
                </select>
              </div>
            </>
          ) : (
            <div style={{ flex: '1 1 180px' }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>LEAVE STATUS</label>
              <select className="input" value={filterLeaveStatus} onChange={e => { setFilterLeaveStatus(e.target.value); setPage(1) }} style={{ fontSize: 13 }}>
                <option value="">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          )}
          <button className="btn btn-secondary" onClick={resetFilters} style={{ height: 38, fontSize: 13 }}>
            ↺ Reset
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748B', fontWeight: 500 }}>
            <span style={{ background: '#F1F5F9', padding: '4px 10px', borderRadius: 6, fontWeight: 600, color: '#0F172A' }}>{total}</span>
            total records
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center' }}><Spinner /></div>
        ) : (
          <>
            {tab === 'attendance' ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Technician</th>
                    <th>Date</th>
                    <th>Check-In</th>
                    <th>Check-Out</th>
                    <th>Hours Worked</th>
                    <th>Status</th>
                    <th>Session</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {records.length === 0 ? (
                    <tr>
                      <td colSpan={9}>
                        <div style={{ textAlign: 'center', padding: '48px 0', color: '#94A3B8' }}>
                          <div style={{ fontSize: 40, marginBottom: 8 }}>📅</div>
                          <div style={{ fontWeight: 600, color: '#64748B' }}>No attendance records found</div>
                          <div style={{ fontSize: 12, marginTop: 4 }}>Try adjusting your filters</div>
                        </div>
                      </td>
                    </tr>
                  ) : records.map((r, i) => (
                    <tr key={r.id}>
                      <td style={{ color: '#94A3B8', fontSize: 12 }}>{(page - 1) * 20 + i + 1}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: '50%', background: '#EFF6FF',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 14, fontWeight: 700, color: '#1B4FD8', flexShrink: 0
                          }}>
                            {(r.technician_name || '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: '#0F172A' }}>{r.technician_name || '—'}</div>
                            <div style={{ fontSize: 11, color: '#94A3B8' }}>{r.technician_id?.slice(0, 8)}…</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontWeight: 500, fontSize: 13 }}>{fmtDate(r.date)}</td>
                      <td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          background: r.check_in ? '#DCFCE7' : '#F1F5F9',
                          color: r.check_in ? '#059669' : '#94A3B8',
                          padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600
                        }}>
                          {r.check_in ? '↑ ' : ''}{fmtTime(r.check_in)}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          background: r.check_out ? '#FEE2E2' : (r.is_active ? '#FEF3C7' : '#F1F5F9'),
                          color: r.check_out ? '#DC2626' : (r.is_active ? '#D97706' : '#94A3B8'),
                          padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600
                        }}>
                          {r.check_out ? '↓ ' : ''}{r.is_active ? 'Active' : fmtTime(r.check_out)}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{
                            width: 60, height: 6, borderRadius: 3, background: '#F1F5F9', overflow: 'hidden'
                          }}>
                            <div style={{
                              width: `${Math.min(100, (r.hours_worked / 9) * 100)}%`,
                              height: '100%', borderRadius: 3,
                              background: r.hours_worked >= 8 ? '#059669' : r.hours_worked >= 4 ? '#F59E0B' : '#EF4444'
                            }} />
                          </div>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{fmtDuration(r.hours_worked)}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                          {STATUS_ICON[r.status] || '•'}
                          <StatusBadge status={r.status || 'PRESENT'} />
                        </span>
                      </td>
                      <td>
                        {r.is_active ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            background: '#DCFCE7', color: '#059669',
                            padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600
                          }}>
                            <span style={{
                              width: 6, height: 6, borderRadius: '50%', background: '#059669',
                              animation: 'pulse 1.5s infinite'
                            }} />
                            LIVE
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: '#94A3B8' }}>Completed</span>
                        )}
                      </td>
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setDetailRecord(r)}
                          style={{ fontSize: 11 }}
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Technician</th>
                    <th>Leave Type</th>
                    <th>Duration</th>
                    <th>From → To</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {leaves.length === 0 ? (
                    <tr>
                      <td colSpan={8}>
                        <div style={{ textAlign: 'center', padding: '48px 0', color: '#94A3B8' }}>
                          <div style={{ fontSize: 40, marginBottom: 8 }}>🏖️</div>
                          <div style={{ fontWeight: 600, color: '#64748B' }}>No leave requests found</div>
                        </div>
                      </td>
                    </tr>
                  ) : leaves.map((l, i) => {
                    const lt = LEAVE_TYPE_COLORS[l.leave_type] || { bg: '#F1F5F9', color: '#475569', label: l.leave_type }
                    const days = daysBetween(l.from_date, l.to_date)
                    return (
                      <tr key={l.id}>
                        <td style={{ color: '#94A3B8', fontSize: 12 }}>{(page - 1) * 20 + i + 1}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 34, height: 34, borderRadius: '50%', background: '#F0FDF4',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 14, fontWeight: 700, color: '#059669', flexShrink: 0
                            }}>
                              {(l.technician_name || '?')[0].toUpperCase()}
                            </div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{l.technician_name || '—'}</div>
                          </div>
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-block', padding: '3px 10px', borderRadius: 20,
                            background: lt.bg, color: lt.color, fontSize: 12, fontWeight: 600
                          }}>
                            {lt.label}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            fontWeight: 700, fontSize: 14, color: '#1B4FD8'
                          }}>{days}</span>
                          <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 3 }}>day{days !== 1 ? 's' : ''}</span>
                        </td>
                        <td>
                          <div style={{ fontSize: 12, color: '#334155' }}>
                            <span style={{ fontWeight: 500 }}>{fmtDate(l.from_date)}</span>
                            <span style={{ color: '#94A3B8', margin: '0 4px' }}>→</span>
                            <span style={{ fontWeight: 500 }}>{fmtDate(l.to_date)}</span>
                          </div>
                        </td>
                        <td style={{ maxWidth: 220 }}>
                          <div style={{
                            fontSize: 12, color: '#64748B',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                          }} title={l.reason}>
                            {l.reason || '—'}
                          </div>
                        </td>
                        <td><StatusBadge status={l.status || 'PENDING'} /></td>
                        <td>
                          {l.status === 'PENDING' ? (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => { setReviewModal(l); setReviewAction('APPROVED'); setReviewNotes('') }}
                              style={{ fontSize: 12 }}
                            >
                              ⚡ Review
                            </button>
                          ) : (
                            <span style={{ fontSize: 11, color: '#94A3B8' }}>Reviewed</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            <div style={{ padding: '12px 16px', borderTop: '1px solid #F1F5F9' }}>
              <Pagination page={page} pages={pages} onPage={setPage} />
            </div>
          </>
        )}
      </div>

      {/* ── Leave Review Modal ── */}
      {reviewModal && (
        <Modal title="Review Leave Request" onClose={() => setReviewModal(null)}>
          <div style={{ minWidth: 420 }}>
            {/* Technician info */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px', background: '#F8FAFC', borderRadius: 10, marginBottom: 20
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%', background: '#EFF6FF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 700, color: '#1B4FD8'
              }}>
                {(reviewModal.technician_name || '?')[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{reviewModal.technician_name}</div>
                <div style={{ fontSize: 12, color: '#64748B' }}>
                  {LEAVE_TYPE_COLORS[reviewModal.leave_type]?.label || reviewModal.leave_type}
                  {' · '}
                  {daysBetween(reviewModal.from_date, reviewModal.to_date)} day(s)
                </div>
              </div>
            </div>

            {/* Dates */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ padding: '10px 14px', background: '#F0FDF4', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: '#059669', fontWeight: 600, marginBottom: 2 }}>FROM</div>
                <div style={{ fontWeight: 700, color: '#065F46' }}>{fmtDate(reviewModal.from_date)}</div>
              </div>
              <div style={{ padding: '10px 14px', background: '#FEF2F2', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: '#DC2626', fontWeight: 600, marginBottom: 2 }}>TO</div>
                <div style={{ fontWeight: 700, color: '#7F1D1D' }}>{fmtDate(reviewModal.to_date)}</div>
              </div>
            </div>

            {/* Reason */}
            <div style={{
              padding: '12px 14px', background: '#FFFBEB', border: '1px solid #FEF3C7',
              borderRadius: 8, marginBottom: 20
            }}>
              <div style={{ fontSize: 11, color: '#92400E', fontWeight: 600, marginBottom: 4 }}>REASON</div>
              <div style={{ fontSize: 13, color: '#451A03' }}>{reviewModal.reason || 'No reason provided'}</div>
            </div>

            {/* Decision */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>YOUR DECISION</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setReviewAction('APPROVED')}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 10, border: '2px solid',
                    cursor: 'pointer', fontWeight: 600, fontSize: 14, transition: 'all 0.15s',
                    borderColor: reviewAction === 'APPROVED' ? '#059669' : '#E2E8F0',
                    background: reviewAction === 'APPROVED' ? '#DCFCE7' : 'white',
                    color: reviewAction === 'APPROVED' ? '#059669' : '#64748B',
                  }}
                >
                  ✓ Approve
                </button>
                <button
                  onClick={() => setReviewAction('REJECTED')}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 10, border: '2px solid',
                    cursor: 'pointer', fontWeight: 600, fontSize: 14, transition: 'all 0.15s',
                    borderColor: reviewAction === 'REJECTED' ? '#DC2626' : '#E2E8F0',
                    background: reviewAction === 'REJECTED' ? '#FEE2E2' : 'white',
                    color: reviewAction === 'REJECTED' ? '#DC2626' : '#64748B',
                  }}
                >
                  ✗ Reject
                </button>
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                ADMIN NOTES <span style={{ color: '#94A3B8', fontWeight: 400 }}>(optional)</span>
              </label>
              <textarea
                className="input"
                rows={3}
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
                placeholder="Add a note for the technician..."
                style={{ fontSize: 13, resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-primary"
                onClick={handleLeaveReview}
                disabled={saving}
                style={{
                  flex: 1,
                  background: reviewAction === 'APPROVED' ? '#059669' : '#DC2626',
                  fontSize: 14
                }}
              >
                {saving ? <Spinner size="sm" /> : `Confirm ${reviewAction === 'APPROVED' ? 'Approval' : 'Rejection'}`}
              </button>
              <button className="btn btn-secondary" onClick={() => setReviewModal(null)} style={{ fontSize: 14 }}>
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Attendance Detail Modal ── */}
      {detailRecord && (
        <Modal title="Attendance Details" onClose={() => setDetailRecord(null)}>
          <div style={{ minWidth: 380 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px', background: '#F8FAFC', borderRadius: 10, marginBottom: 20
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%', background: '#EFF6FF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 700, color: '#1B4FD8'
              }}>
                {(detailRecord.technician_name || '?')[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{detailRecord.technician_name}</div>
                <div style={{ fontSize: 12, color: '#64748B' }}>{fmtDate(detailRecord.date)}</div>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <StatusBadge status={detailRecord.status} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ padding: '12px 14px', background: '#F0FDF4', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>CHECK-IN</div>
                <div style={{ fontWeight: 700, fontSize: 18, color: '#065F46', marginTop: 2 }}>
                  {fmtTime(detailRecord.check_in)}
                </div>
              </div>
              <div style={{ padding: '12px 14px', background: '#FEF2F2', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: '#DC2626', fontWeight: 600 }}>CHECK-OUT</div>
                <div style={{ fontWeight: 700, fontSize: 18, color: '#7F1D1D', marginTop: 2 }}>
                  {detailRecord.is_active ? '— Active —' : fmtTime(detailRecord.check_out)}
                </div>
              </div>
            </div>

            <div style={{
              padding: '16px', background: '#EFF6FF', borderRadius: 10, textAlign: 'center', marginBottom: 16
            }}>
              <div style={{ fontSize: 12, color: '#1D4ED8', fontWeight: 600 }}>TOTAL HOURS WORKED</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: '#1B4FD8' }}>
                {fmtDuration(detailRecord.hours_worked)}
              </div>
              <div style={{ marginTop: 8, background: '#DBEAFE', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min(100, (detailRecord.hours_worked / 9) * 100)}%`,
                  height: '100%', borderRadius: 6,
                  background: detailRecord.hours_worked >= 8 ? '#059669' : detailRecord.hours_worked >= 4 ? '#F59E0B' : '#EF4444'
                }} />
              </div>
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                {Math.min(100, Math.round((detailRecord.hours_worked / 9) * 100))}% of 9h target
              </div>
            </div>

            {detailRecord.notes && (
              <div style={{ padding: '10px 14px', background: '#FFFBEB', borderRadius: 8, fontSize: 13, color: '#451A03' }}>
                <b style={{ color: '#92400E' }}>Notes:</b> {detailRecord.notes}
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setDetailRecord(null)} style={{ width: '100%' }}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
