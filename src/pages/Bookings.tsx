/**
 * Bookings.tsx — Advanced Booking Management Page
 *
 * Features:
 *  ✅ SL# column, all fields populated (customer, service, technician, city)
 *  ✅ Advanced search: booking#, customer name/mobile, service name, technician
 *  ✅ Filters: status, priority, date range — server-side, with Clear All
 *  ✅ Correct pagination with total count
 *  ✅ Row click → full detail modal (timeline, appliance, notes, all amounts)
 *  ✅ Inline actions per status: Assign, Reschedule, Cancel, Edit, View
 *  ✅ Assign technician modal
 *  ✅ Reschedule modal
 *  ✅ Cancel modal
 *  ✅ Edit booking modal (date, slot, priority, notes)
 *  ✅ New Booking → BookingModal (3-step: mobile → preview → form)
 *  ✅ Status color coding + priority badges
 */
import { useEffect, useState, useCallback } from 'react'
import { bookingsAPI, assignmentsAPI } from '@/services/api'
import PageHeader from '@/components/layout/PageHeader'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'
import StatusBadge from '@/components/ui/StatusBadge'
import BookingModal from '@/components/bookings/BookingModal'
import BookingWorkflow from '@/components/bookings/BookingWorkflow'
import { QuotationFromBookingModal } from '@/pages/Quotations'
import AssignTechnicianModal from '@/components/bookings/AssignTechnicianModal'
import { useAdminWebSocket } from '@/hooks/useAdminWebSocket'

// ─── helpers ──────────────────────────────────────────────────────────────────
const money   = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtDT   = (d: string) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

const lbl: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }

const Err = ({ msg }: { msg: string }) =>
  msg ? <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 12 }}>{msg}</div> : null

const PRIORITY_STYLE: Record<string, { bg: string; color: string }> = {
  URGENT: { bg: '#FEE2E2', color: '#DC2626' },
  HIGH:   { bg: '#FEF3C7', color: '#D97706' },
  NORMAL: { bg: '#F1F5F9', color: '#475569' },
}

// Statuses that still require admin attention — used in Action Mode
const ACTION_STATUSES = [
  'PENDING', 'CONFIRMED', 'ASSIGNED', 'ACCEPTED',
  'EN_ROUTE', 'ARRIVED', 'INSPECTING', 'IN_PROGRESS',
  'COMPLETED', 'RESCHEDULED',
  'INVOICE_GENERATED', 'PAYMENT_PENDING',
  'PENDING_VERIFICATION',   // visiting charge — needs admin collect + close
]
// Terminal statuses that need no further admin action
const TERMINAL_STATUSES = ['PAID', 'CLOSED', 'SETTLED', 'CANCELLED']

const STATUS_GROUPS = {
  active:    ['PENDING', 'CONFIRMED', 'ASSIGNED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'INSPECTING', 'IN_PROGRESS'],
  completed: ['COMPLETED', 'INVOICE_GENERATED', 'PAYMENT_PENDING', 'PAID', 'CLOSED', 'SETTLED'],
  cancelled: ['CANCELLED', 'RESCHEDULED'],
}

const statusDot: Record<string, string> = {
  PENDING: '#F59E0B', CONFIRMED: '#3B82F6', ASSIGNED: '#8B5CF6',
  ACCEPTED: '#6366F1', EN_ROUTE: '#0EA5E9', ARRIVED: '#06B6D4',
  INSPECTING: '#F97316', IN_PROGRESS: '#10B981',
  COMPLETED: '#22C55E', CANCELLED: '#EF4444', RESCHEDULED: '#F97316',
  PAID: '#059669', CLOSED: '#374151', SETTLED: '#1E3A5F', INVOICE_GENERATED: '#7C3AED', PAYMENT_PENDING: '#F97316',
  PENDING_VERIFICATION: '#7C3AED',
}

// Canonical slot values stored in DB — HH:MM-HH:MM (24h)
const SLOTS = [
  { value: '08:00-10:00', label: '8:00 – 10:00 AM'    },
  { value: '10:00-12:00', label: '10:00 AM – 12:00 PM' },
  { value: '12:00-14:00', label: '12:00 – 2:00 PM'    },
  { value: '14:00-16:00', label: '2:00 – 4:00 PM'     },
  { value: '16:00-18:00', label: '4:00 – 6:00 PM'     },
  { value: '18:00-20:00', label: '6:00 – 8:00 PM'     },
]

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Bookings() {
  // ── view mode: 'action' = excludes terminal statuses, 'all' = everything ──
  type ViewMode = 'action' | 'all'
  const [viewMode, setViewMode] = useState<ViewMode>('action')

  // ── list state ──
  const [bookings, setBookings] = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [page,     setPage]     = useState(1)
  const [pages,    setPages]    = useState(1)
  const [total,    setTotal]    = useState(0)

  // ── filters ──
  const [search,         setSearch]       = useState('')
  const [searchInput,    setSearchInput]  = useState('')  // debounce buffer
  const [statusFilter,   setStatusFilter] = useState('')
  const [priorityFilter, setPriority]     = useState('')
  const [dateFrom,       setDateFrom]     = useState('')
  const [dateTo,         setDateTo]       = useState('')

  // ── modals ──
  const [detail,         setDetail]         = useState<any>(null)
  const [detailTimeline, setDetailTimeline] = useState<any[]>([])
  const [detailLoading,  setDetailLoading]  = useState(false)

  const [cancelBkg,    setCancelBkg]    = useState<any>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelSaving, setCancelSaving] = useState(false)

  const [assignBkg,    setAssignBkg]    = useState<any>(null)

  const [reschBkg,    setReschBkg]    = useState<any>(null)
  const [reschDate,   setReschDate]   = useState('')
  const [reschSlot,   setReschSlot]   = useState('')
  const [reschSaving, setReschSaving] = useState(false)

  // Edit booking
  const [editBkg,    setEditBkg]    = useState<any>(null)
  const [editForm,   setEditForm]   = useState({ scheduled_date: '', scheduled_slot: '', priority: 'NORMAL', notes: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [editErr,    setEditErr]    = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [quotationBkg, setQuotationBkg] = useState<any>(null)
  const [workflowBkg, setWorkflowBkg] = useState<any>(null)

  // ── Manual assign needed alerts ──────────────────────────────────────────
  const [manualAlerts, setManualAlerts] = useState<Array<{ booking_id: string; booking_number: string; message: string; ts: number }>>([])

  // ── settle modal (from bookings detail) ──
  const [settleBooking, setSettleBooking] = useState<any>(null)
  const [settlePreview, setSettlePreview] = useState<any>(null)
  const [settleLoading, setSettleLoading] = useState(false)
  const [settleNotes, setSettleNotes]     = useState('')
  const [settleOverrides, setSettleOverrides] = useState<Record<number, string>>({})
  const [settleErr, setSettleErr]         = useState('')

  const openSettleModal = async (b: any) => {
    setSettleBooking(b); setSettlePreview(null); setSettleNotes(''); setSettleOverrides({}); setSettleErr('')
    try {
      const r = await bookingsAPI.commissionPreview(b.id)
      setSettlePreview(r.data.data)
    } catch (ex: any) {
      setSettleErr(ex.response?.data?.detail || 'Failed to load commission preview')
    }
  }

  const handleSettle = async () => {
    if (!settleBooking) return
    setSettleLoading(true); setSettleErr('')
    try {
      const overrideList = Object.entries(settleOverrides).map(([idx, amt]) => ({ item_index: Number(idx), override_amount: Number(amt) }))
      await bookingsAPI.settleBooking(settleBooking.id, { overrides: overrideList, notes: settleNotes || undefined })
      setSettleBooking(null); fetchBookings()
    } catch (ex: any) {
      setSettleErr(ex.response?.data?.detail || 'Failed to settle booking')
    } finally { setSettleLoading(false) }
  }

  // ── fetch ──
  const fetchBookings = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { page, per_page: 20 }
      if (priorityFilter) params.priority  = priorityFilter
      if (search)         params.search    = search
      if (dateFrom)       params.date_from = dateFrom
      if (dateTo)         params.date_to   = dateTo
      if (statusFilter) {
        // Explicit status filter always wins
        params.status = statusFilter
      } else if (viewMode === 'action') {
        // Action Mode: only pass statuses that need attention
        params.status = ACTION_STATUSES.join(',')
      }
      // All Mode with no status filter: no status param = backend returns everything
      const res = await bookingsAPI.list(params)
      const d   = res.data.data
      setBookings(d.items || d.bookings || [])
      setPages(d.pages || 1)
      setTotal(d.total  || 0)
    } catch { setBookings([]) }
    finally  { setLoading(false) }
  }, [page, statusFilter, priorityFilter, search, dateFrom, dateTo, viewMode])

  useEffect(() => { fetchBookings() }, [fetchBookings])

  // ── Live WebSocket: auto-refresh bookings list on assignment events ────────
  const { subscribe } = useAdminWebSocket()
  useEffect(() => {
    const unsub1 = subscribe('ASSIGNMENT_CREATED',        () => fetchBookings())
    const unsub2 = subscribe('ASSIGNMENT_ACCEPTED',       () => fetchBookings())
    const unsub3 = subscribe('ASSIGNMENT_REJECTED',       () => fetchBookings())
    const unsub4 = subscribe('ASSIGNMENT_AUTO_CANCELLED', () => fetchBookings())
    const unsub5 = subscribe('BOOKING_STATUS_CHANGED',    () => fetchBookings())
    const unsub6 = subscribe('BOOKING_NEEDS_MANUAL_ASSIGN', (payload: any) => {
      fetchBookings()
      setManualAlerts(prev => [
        { booking_id: payload?.booking_id || '', booking_number: payload?.booking_number || '', message: payload?.message || `Booking ${payload?.booking_number} needs manual assignment.`, ts: Date.now() },
        ...prev.slice(0, 4),  // keep latest 5
      ])
    })
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); unsub6() }
  }, [subscribe, fetchBookings])

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  const clearFilters = () => {
    setSearchInput(''); setSearch('')
    setStatusFilter(''); setPriority('')
    setDateFrom(''); setDateTo('')
    setPage(1)
  }
  const hasFilter = search || statusFilter || priorityFilter || dateFrom || dateTo

  // ── detail ──
  const openDetail = async (b: any) => {
    setDetail(b); setDetailTimeline([]); setDetailLoading(true)
    try {
      const [dr, tr] = await Promise.all([
        bookingsAPI.get(b.id),
        bookingsAPI.timeline(b.id),
      ])
      setDetail(dr.data.data)
      setDetailTimeline(tr.data.data || [])
    } catch {} finally { setDetailLoading(false) }
  }

  // ── assign ──
  const openAssign = (b: any) => { setAssignBkg(b) }

  // ── cancel ──
  const doCancel = async () => {
    if (!cancelBkg || !cancelReason.trim()) return
    setCancelSaving(true)
    try { await bookingsAPI.cancel(cancelBkg.id, cancelReason); setCancelBkg(null); setCancelReason(''); fetchBookings() }
    catch {} finally { setCancelSaving(false) }
  }

  // ── reschedule ──
  const doReschedule = async () => {
    if (!reschBkg || !reschDate) return
    setReschSaving(true)
    try {
      await bookingsAPI.reschedule(reschBkg.id, {
        scheduled_date: reschDate + 'T00:00:00',
        scheduled_slot: reschSlot || undefined,
      })
      setReschBkg(null); setReschDate(''); setReschSlot(''); fetchBookings()
    } catch {} finally { setReschSaving(false) }
  }

  // ── edit ──
  const openEdit = (b: any) => {
    setEditBkg(b)
    setEditErr('')
    setEditForm({
      scheduled_date: b.scheduled_date ? b.scheduled_date.split('T')[0] : '',
      scheduled_slot: b.scheduled_slot && b.scheduled_slot !== '—' ? b.scheduled_slot : '',
      priority: b.priority || 'NORMAL',
      notes: b.notes || '',
    })
  }
  const doEdit = async () => {
    if (!editBkg || !editForm.scheduled_date) { setEditErr('Scheduled date is required'); return }
    setEditSaving(true); setEditErr('')
    try {
      await bookingsAPI.update(editBkg.id, {
        scheduled_date: editForm.scheduled_date + 'T00:00:00',
        scheduled_slot: editForm.scheduled_slot || undefined,
        priority: editForm.priority,
        notes: editForm.notes || undefined,
      })
      setEditBkg(null)
      fetchBookings()
      // refresh detail if open
      if (detail && detail.id === editBkg.id) openDetail(editBkg)
    } catch (ex: any) {
      setEditErr(ex.response?.data?.detail || 'Failed to update booking')
    } finally { setEditSaving(false) }
  }

  const isTerminal = (s: string) => ['COMPLETED','CANCELLED','CLOSED','PAID','SETTLED'].includes(s)

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader
        title="Bookings"
        subtitle={`${total} booking${total !== 1 ? 's' : ''}${viewMode === 'action' ? ' needing action' : ''}`}
        actions={
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + New Booking
          </button>
        }
      />

      {/* ── Manual Assign Needed Alert Banners ───────────────────────────── */}
      {manualAlerts.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          {manualAlerts.map((alert, i) => (
            <div
              key={`${alert.booking_id}-${alert.ts}`}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
                background: '#FEF2F2', border: '2px solid #FECACA', borderRadius: 10,
                padding: '10px 16px', marginBottom: 6,
                animation: 'pulse 1s ease-in-out 3',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>🚨</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#B91C1C' }}>
                    Manual Assignment Required — #{alert.booking_number}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{alert.message}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-sm"
                  style={{ background: '#1B4FD8', color: 'white', border: 'none', fontWeight: 700 }}
                  onClick={() => {
                    const bkg = bookings.find(b => b.id === alert.booking_id)
                    if (bkg) openAssign(bkg)
                    else fetchBookings().then(() => {
                      const found = bookings.find(b => b.id === alert.booking_id)
                      if (found) openAssign(found)
                    })
                    setManualAlerts(prev => prev.filter((_, idx) => idx !== i))
                  }}
                >
                  👷 Assign Now
                </button>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => setManualAlerts(prev => prev.filter((_, idx) => idx !== i))}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Mode Toggle ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B', marginRight: 4 }}>View:</span>
        <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 8, padding: 3, gap: 2 }}>
          {(['action', 'all'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => { setViewMode(mode); setPage(1); setStatusFilter('') }}
              style={{
                padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700, transition: 'all 0.15s',
                background: viewMode === mode ? (mode === 'action' ? '#1B4FD8' : '#374151') : 'transparent',
                color: viewMode === mode ? 'white' : '#64748B',
                boxShadow: viewMode === mode ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
              }}
            >
              {mode === 'action' ? '⚡ Needs Action' : '📋 All Bookings'}
            </button>
          ))}
        </div>
        {viewMode === 'action' && (
          <span style={{ fontSize: 11, color: '#64748B', fontStyle: 'italic', marginLeft: 4 }}>
            Hiding: Paid · Closed · Settled · Cancelled
          </span>
        )}
      </div>

      {/* ── Filter Bar ── */}
      <div className="card" style={{ padding: '14px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {/* Search */}
          <div style={{ flex: '2 1 220px', minWidth: 180 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>Search</div>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                placeholder="Booking #, customer name/mobile, service…"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                style={{ paddingLeft: 32 }}
              />
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: 14 }}>🔍</span>
            </div>
          </div>

          {/* Status */}
          <div style={{ flex: '1 1 150px', minWidth: 130 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>Status</div>
            <select className="input" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
              <option value="">{viewMode === 'action' ? 'Action Statuses' : 'All Statuses'}</option>
              <optgroup label="── Active ──">
                {STATUS_GROUPS.active.map(s => <option key={s} value={s}>{s}</option>)}
              </optgroup>
              <optgroup label="── Done ──">
                <option value="COMPLETED">COMPLETED</option>
                <option value="RESCHEDULED">RESCHEDULED</option>
                <option value="INVOICE_GENERATED">INVOICE_GENERATED</option>
                <option value="PAYMENT_PENDING">PAYMENT_PENDING</option>
                {viewMode === 'all' && <>
                  <option value="PAID">PAID</option>
                  <option value="CLOSED">CLOSED</option>
                  <option value="SETTLED">SETTLED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </>}
                <option value="PENDING_VERIFICATION">PENDING_VERIFICATION</option>
              </optgroup>
            </select>
          </div>

          {/* Priority */}
          <div style={{ flex: '1 1 120px', minWidth: 110 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>Priority</div>
            <select className="input" value={priorityFilter} onChange={e => { setPriority(e.target.value); setPage(1) }}>
              <option value="">All</option>
              <option value="URGENT">🔴 URGENT</option>
              <option value="HIGH">🟡 HIGH</option>
              <option value="NORMAL">⚪ NORMAL</option>
            </select>
          </div>

          {/* Date range */}
          <div style={{ flex: '1 1 130px', minWidth: 120 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>From Date</div>
            <input className="input" type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }} />
          </div>
          <div style={{ flex: '1 1 130px', minWidth: 120 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>To Date</div>
            <input className="input" type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }} />
          </div>

          {/* Clear */}
          {hasFilter && (
            <div style={{ alignSelf: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={clearFilters} style={{ whiteSpace: 'nowrap' }}>
                ✕ Clear All
              </button>
            </div>
          )}
        </div>

        {/* Active filter pills */}
        {hasFilter && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            {search && (
              <span style={{ fontSize: 11, background: '#EFF6FF', color: '#1D4ED8', padding: '2px 8px', borderRadius: 20, border: '1px solid #BFDBFE' }}>
                🔍 "{search}"
              </span>
            )}
            {statusFilter && (
              <span style={{ fontSize: 11, background: '#F0FDF4', color: '#166534', padding: '2px 8px', borderRadius: 20, border: '1px solid #86EFAC' }}>
                Status: {statusFilter}
              </span>
            )}
            {priorityFilter && (
              <span style={{ fontSize: 11, background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: 20, border: '1px solid #FDE68A' }}>
                Priority: {priorityFilter}
              </span>
            )}
            {(dateFrom || dateTo) && (
              <span style={{ fontSize: 11, background: '#F5F3FF', color: '#6D28D9', padding: '2px 8px', borderRadius: 20, border: '1px solid #DDD6FE' }}>
                📅 {dateFrom || '…'} → {dateTo || '…'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Table ── */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center' }}><Spinner /></div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ minWidth: 900 }}>
                <thead>
                  <tr>
                    <th style={{ width: 44, textAlign: 'center' }}>#</th>
                    <th>Booking #</th>
                    <th>Customer</th>
                    <th>Domain</th>
                    <th>Service</th>
                    <th>Technician</th>
                    <th>Scheduled</th>
                    <th>Amount</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th style={{ minWidth: 180 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.length === 0 ? (
                    <tr>
                      <td colSpan={11} style={{ textAlign: 'center', color: '#94A3B8', padding: 48 }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                        <div style={{ fontSize: 14 }}>{viewMode === 'action' ? 'No bookings needing action' : 'No bookings found'}</div>
                        {viewMode === 'action' && !hasFilter && <div style={{ fontSize: 12, marginTop: 4, color: '#22C55E' }}>🎉 All caught up! Switch to All Bookings to see closed records.</div>}
                        {hasFilter && <div style={{ fontSize: 12, marginTop: 4 }}>Try clearing your filters</div>}
                      </td>
                    </tr>
                  ) : bookings.map((b: any, i: number) => (
                    <tr key={b.id} style={{ cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      {/* SL# */}
                      <td style={{ textAlign: 'center', color: '#94A3B8', fontSize: 12 }}>
                        {(page - 1) * 20 + i + 1}
                      </td>

                      {/* Booking # */}
                      <td>
                        <div
                          style={{ fontWeight: 700, color: '#1B4FD8', fontSize: 13, fontFamily: 'monospace', cursor: 'pointer' }}
                          onClick={() => openDetail(b)}
                        >
                          {b.booking_number}
                        </div>
                        {b.coupon_code && (
                          <div style={{ marginTop: 3 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A', borderRadius: 10, padding: '1px 7px', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              🏷️ {b.coupon_code}
                            </span>
                          </div>
                        )}
                        {b.source && b.source !== '—' && (
                          <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>{b.source}</div>
                        )}
                      </td>

                      {/* Customer */}
                      <td>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{b.customer_name || '—'}</div>
                        <div style={{ fontSize: 11, color: '#64748B' }}>{b.customer_mobile || ''}</div>
                      </td>
                      <td>
                        {b.domain_name
                          ? <span style={{ fontSize: 11, background: '#EFF6FF', color: '#1B4FD8', padding: '2px 8px', borderRadius: 20, fontWeight: 600, whiteSpace: 'nowrap' }}>{b.domain_name}</span>
                          : <span style={{ color: '#CBD5E1', fontSize: 11 }}>—</span>}
                      </td>

                      {/* Service — shows quotation item summary if quotation exists */}
                      <td>
                        {b.has_quotation ? (
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#7C3AED' }}>
                              📋 {b.quotation_service_count || 0} service{(b.quotation_service_count || 0) !== 1 ? 's' : ''}
                              {(b.quotation_part_count || 0) > 0 && (
                                <span style={{ color: '#92400E', marginLeft: 5 }}>· {b.quotation_part_count} part{b.quotation_part_count !== 1 ? 's' : ''}</span>
                              )}
                            </div>
                            <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>
                              {b.service_name && <span>{b.service_name} · </span>}
                              {b.city && <span>📍 {b.city}</span>}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div style={{ fontSize: 13, color: '#0F172A', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {b.service_name || '—'}
                            </div>
                            {b.city && <div style={{ fontSize: 11, color: '#94A3B8' }}>📍 {b.city}</div>}
                          </div>
                        )}
                      </td>

                      {/* Technician */}
                      <td>
                        {b.technician_name ? (
                          <>
                            <div style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 5,
                              // Mute name color when dispatched but not yet accepted
                              color: (!b.technician_confirmed && b.status === 'ASSIGNED') ? '#94A3B8' : '#0F172A',
                            }}>
                              {b.technician_name}
                              {!b.technician_confirmed && b.status === 'ASSIGNED' && (
                                <span title="Dispatched — awaiting technician acceptance" style={{
                                  fontSize: 9, fontWeight: 700, padding: '1px 5px',
                                  background: '#FFF7ED', color: '#C2410C',
                                  border: '1px solid #FED7AA', borderRadius: 4,
                                  whiteSpace: 'nowrap',
                                }}>⏳ Awaiting Accept</span>
                              )}
                            </div>
                            {b.technician_confirmed && (
                              <div style={{ fontSize: 11, color: '#94A3B8' }}>{b.technician_mobile}</div>
                            )}
                          </>
                        ) : (
                          <span style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic' }}>Unassigned</span>
                        )}
                      </td>

                      {/* Scheduled */}
                      <td>
                        <div style={{ fontSize: 13, color: '#0F172A' }}>{fmtDate(b.scheduled_date)}</div>
                        {b.scheduled_slot && b.scheduled_slot !== '—' && (
                          <div style={{ fontSize: 11, color: '#64748B' }}>{b.scheduled_slot}</div>
                        )}
                      </td>

                      {/* Amount — show SUM of ALL quotation totals, else booking amount */}
                      <td>
                        {b.has_quotation ? (
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 13, color: '#7C3AED' }}>{money(b.quotation_total)}</div>
                            <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1, display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{
                                background: b.quotation_status === 'APPROVED' ? '#DCFCE7' : b.quotation_status === 'SUBMITTED' ? '#DBEAFE' : '#F1F5F9',
                                color: b.quotation_status === 'APPROVED' ? '#166534' : b.quotation_status === 'SUBMITTED' ? '#1D4ED8' : '#475569',
                                borderRadius: 4, padding: '1px 5px', fontSize: 9, fontWeight: 700,
                              }}>
                                {b.quotation_status}
                              </span>
                              {(b.quotation_count || 0) > 1 && (
                                <span style={{ background: '#FEF3C7', color: '#92400E', borderRadius: 4, padding: '1px 5px', fontSize: 9, fontWeight: 700 }}>
                                  {b.quotation_count} quotations
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: '#059669' }}>{money(b.total_amount)}</div>
                            {b.coupon_discount > 0 && (
                              <div style={{ fontSize: 10, color: '#DC2626', marginTop: 2 }}>
                                🏷️ −{money(b.coupon_discount)}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Priority */}
                      <td>
                        {(() => {
                          const ps = PRIORITY_STYLE[b.priority] || PRIORITY_STYLE.NORMAL
                          return (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: ps.bg, color: ps.color }}>
                              {b.priority}
                            </span>
                          )
                        })()}
                      </td>

                      {/* Status */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: statusDot[b.status] || '#94A3B8', flexShrink: 0 }} />
                          <StatusBadge status={b.status} />
                        </div>
                      </td>

                      {/* Actions */}
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => openDetail(b)}
                            style={{ fontSize: 11 }}
                          >
                            View
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setWorkflowBkg(b)}
                            style={{ fontSize: 11, background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA' }}
                          >
                            ⚙ Manage
                          </button>
                          {!['COMPLETED','INVOICE_GENERATED','PAYMENT_PENDING','PAID','CLOSED','SETTLED','CANCELLED'].includes(b.status) && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => openAssign(b)}
                              style={{ fontSize: 11, background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}
                            >
                              {b.technician_name ? '🔄 Reassign' : 'Assign'}
                            </button>
                          )}
                          {!isTerminal(b.status) && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => openEdit(b)}
                              style={{ fontSize: 11, background: '#F0FDF4', color: '#166534', border: '1px solid #86EFAC' }}
                            >
                              Edit
                            </button>
                          )}
                          {!isTerminal(b.status) && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => { setReschBkg(b); setReschDate(''); setReschSlot('') }}
                              style={{ fontSize: 11 }}
                            >
                              Reschedule
                            </button>
                          )}
                          {!isTerminal(b.status) && (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => { setCancelBkg(b); setCancelReason('') }}
                              style={{ fontSize: 11 }}
                            >
                              Cancel
                            </button>
                          )}
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setQuotationBkg(b)}
                            style={{ fontSize: 11, background: isTerminal(b.status) ? '#F8FAFC' : '#F5F3FF', color: isTerminal(b.status) ? '#94A3B8' : '#7C3AED', border: `1px solid ${isTerminal(b.status) ? '#E2E8F0' : '#DDD6FE'}`, position: 'relative' }}
                          >
                            📄 Quotation
                            {(b.quotation_count || 0) > 0 && (
                              <span style={{ marginLeft: 4, background: isTerminal(b.status) ? '#CBD5E1' : '#7C3AED', color: '#fff', borderRadius: 10, fontSize: 9, fontWeight: 800, padding: '1px 5px' }}>
                                {b.quotation_count}
                              </span>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ borderTop: '1px solid #F1F5F9', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: '#94A3B8' }}>
                Showing {bookings.length ? (page - 1) * 20 + 1 : 0}–{Math.min(page * 20, total)} of {total}
              </div>
              <Pagination page={page} pages={pages} onPage={p => { setPage(p); window.scrollTo(0, 0) }} />
            </div>
          </>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          DETAIL MODAL
      ══════════════════════════════════════════════════════════════ */}
      {detail && (
        <Modal title={`Booking ${detail.booking_number}`} onClose={() => setDetail(null)} size="lg">
          {detailLoading ? <div style={{ textAlign: 'center', padding: 40 }}><Spinner /></div> : (
            <>
              {/* Status + Priority bar */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: statusDot[detail.status] }} />
                  <StatusBadge status={detail.status} />
                </div>
                {(() => {
                  const ps = PRIORITY_STYLE[detail.priority] || PRIORITY_STYLE.NORMAL
                  return <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: ps.bg, color: ps.color }}>{detail.priority}</span>
                })()}
                {detail.source && <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 4 }}>via {detail.source}</span>}
              </div>

              {/* Info grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                {[
                  ['👤 Customer',    `${detail.customer_name || '—'} · ${detail.customer_mobile || ''}`],
                  ['🔧 Service',     detail.service_name || '—'],
                  ['👷 Technician',  detail.technician_name ? `${detail.technician_name} · ${detail.technician_mobile || ''}` : 'Unassigned'],
                  ['📅 Scheduled',   fmtDate(detail.scheduled_date)],
                  ['🕐 Slot',        detail.scheduled_slot && detail.scheduled_slot !== '—' ? detail.scheduled_slot : 'Any'],
                  ['📍 City',        detail.city || '—'],
                ].map(([l, v]) => (
                  <div key={l as string} style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginBottom: 3 }}>{l}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Amount breakdown */}
              <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
                <div><div style={{ fontSize: 11, color: '#94A3B8' }}>Base</div><div style={{ fontWeight: 700, color: '#0F172A' }}>{money(detail.base_amount)}</div></div>
                {(detail.coupon_discount > 0) && (
                  <div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>Coupon Discount</div>
                    <div style={{ fontWeight: 700, color: '#DC2626' }}>− {money(detail.coupon_discount)}</div>
                  </div>
                )}
                <div><div style={{ fontSize: 11, color: '#94A3B8' }}>GST</div><div style={{ fontWeight: 700, color: '#64748B' }}>{money(detail.gst_amount)}</div></div>
                <div style={{ borderLeft: '2px solid #86EFAC', paddingLeft: 20 }}>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>Total</div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: '#059669' }}>{money(detail.total_amount)}</div>
                </div>
              </div>

              {/* Coupon details strip */}
              {detail.coupon_code && (
                <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15 }}>🏷️</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E' }}>Coupon Applied</div>
                    <div style={{ fontSize: 13, color: '#0F172A' }}>
                      <code style={{ background: '#FEF3C7', padding: '1px 8px', borderRadius: 4, fontWeight: 800, color: '#B45309' }}>{detail.coupon_code}</code>
                      <span style={{ marginLeft: 8, color: '#DC2626', fontWeight: 700 }}>− {money(detail.coupon_discount)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Appliance */}
              {(detail.appliance_brand || detail.appliance_model) && (
                <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>
                  🔧 Appliance: <b>{detail.appliance_brand || '—'}</b> · {detail.appliance_model || '—'}
                </div>
              )}

              {/* Notes */}
              {detail.notes && (
                <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>
                  📝 <b>Notes:</b> {detail.notes}
                </div>
              )}

              {/* Cancel reason */}
              {detail.cancelled_reason && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>
                  ❌ <b>Cancelled:</b> {detail.cancelled_reason}
                </div>
              )}

              {/* Timeline */}
              <div style={{ marginTop: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Status Timeline</div>
                {detailTimeline.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#94A3B8' }}>No timeline events yet.</div>
                ) : (
                  <div style={{ borderLeft: '2px solid #E2E8F0', paddingLeft: 16 }}>
                    {detailTimeline.map((t: any, i: number) => (
                      <div key={i} style={{ position: 'relative', marginBottom: 14 }}>
                        <div style={{
                          position: 'absolute', left: -22, top: 3,
                          width: 10, height: 10, borderRadius: '50%',
                          background: statusDot[t.status] || '#94A3B8',
                          border: '2px solid white', boxShadow: '0 0 0 1px #E2E8F0',
                        }} />
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{t.status}</div>
                        {t.notes && <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{t.notes}</div>}
                        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{fmtDT(t.at || t.created_at)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8, marginTop: 20, borderTop: '1px solid #F1F5F9', paddingTop: 16, flexWrap: 'wrap' }}>
                {!['COMPLETED','INVOICE_GENERATED','PAYMENT_PENDING','PAID','CLOSED','SETTLED','CANCELLED'].includes(detail.status) && (
                  <button className="btn btn-primary btn-sm" onClick={() => { setDetail(null); openAssign(detail) }}>
                    {detail.technician_name ? '🔄 Reassign Technician' : '👷 Assign Technician'}
                  </button>
                )}
                {!isTerminal(detail.status) && (
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ background: '#F0FDF4', color: '#166534', border: '1px solid #86EFAC' }}
                    onClick={() => { openEdit(detail); setDetail(null) }}
                  >
                    ✏️ Edit
                  </button>
                )}
                {!isTerminal(detail.status) && (
                  <button className="btn btn-secondary btn-sm" onClick={() => { setDetail(null); setReschBkg(detail); setReschDate(''); setReschSlot('') }}>
                    📅 Reschedule
                  </button>
                )}
                {!isTerminal(detail.status) && (
                  <button className="btn btn-danger btn-sm" onClick={() => { setDetail(null); setCancelBkg(detail); setCancelReason('') }}>
                    ✕ Cancel
                  </button>
                )}
                {['PAID', 'COMPLETED', 'INVOICE_GENERATED', 'PAYMENT_PENDING'].includes(detail.status) && (
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ background: '#059669', color: '#fff', border: 'none' }}
                    onClick={() => { openSettleModal(detail); setDetail(null) }}
                  >
                    🔒 Settle & Close
                  </button>
                )}
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE' }}
                  onClick={() => { setQuotationBkg(detail); setDetail(null) }}
                >
                  📄 Create / View Quotation
                </button>
              </div>
            </>
          )}
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════════════
          EDIT MODAL
      ══════════════════════════════════════════════════════════════ */}
      {editBkg && (
        <Modal title={`Edit Booking ${editBkg.booking_number}`} onClose={() => setEditBkg(null)} size="sm">
          <div style={{ background: '#EFF6FF', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
            <b>{editBkg.customer_name || editBkg.booking_number}</b>
            {editBkg.service_name && <span style={{ color: '#64748B' }}> · {editBkg.service_name}</span>}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Scheduled Date *</label>
            <input
              className="input" type="date"
              value={editForm.scheduled_date}
              onChange={e => setEditForm(f => ({ ...f, scheduled_date: e.target.value }))}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Time Slot</label>
            <select className="input" value={editForm.scheduled_slot} onChange={e => setEditForm(f => ({ ...f, scheduled_slot: e.target.value }))}>
              <option value="">— Keep existing / Any —</option>
              {SLOTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Priority</label>
            <select className="input" value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}>
              {['NORMAL','HIGH','URGENT'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Notes</label>
            <textarea
              className="input" rows={3}
              placeholder="Optional notes…"
              value={editForm.notes}
              onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
              style={{ resize: 'vertical' }}
            />
          </div>

          <Err msg={editErr} />

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" onClick={doEdit} disabled={!editForm.scheduled_date || editSaving}>
              {editSaving ? <Spinner size="sm" /> : 'Save Changes'}
            </button>
            <button className="btn btn-secondary" onClick={() => setEditBkg(null)}>Cancel</button>
          </div>
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════════════
          ASSIGN MODAL
      ══════════════════════════════════════════════════════════════ */}
      {assignBkg && (
        <AssignTechnicianModal
          booking={assignBkg}
          onClose={() => setAssignBkg(null)}
          onDone={fetchBookings}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════
          CANCEL MODAL
      ══════════════════════════════════════════════════════════════ */}
      {cancelBkg && (
        <Modal title="Cancel Booking" onClose={() => setCancelBkg(null)} size="sm">
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
            Cancel <b>{cancelBkg.booking_number}</b> for <b>{cancelBkg.customer_name}</b>?
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>This action cannot be undone.</div>
          </div>
          <label style={lbl}>Reason *</label>
          <textarea className="input" rows={3} value={cancelReason} onChange={e => setCancelReason(e.target.value)}
            placeholder="Enter cancellation reason…" style={{ resize: 'vertical', marginBottom: 16 }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-danger" onClick={doCancel} disabled={!cancelReason.trim() || cancelSaving}>
              {cancelSaving ? <Spinner size="sm" /> : 'Confirm Cancel'}
            </button>
            <button className="btn btn-secondary" onClick={() => setCancelBkg(null)}>Back</button>
          </div>
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════════════
          RESCHEDULE MODAL
      ══════════════════════════════════════════════════════════════ */}
      {reschBkg && (
        <Modal title="Reschedule Booking" onClose={() => setReschBkg(null)} size="sm">
          <div style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
            <b>{reschBkg.booking_number}</b> · {reschBkg.customer_name}
            <div style={{ fontSize: 12, color: '#7C3AED', marginTop: 2 }}>Currently: {fmtDate(reschBkg.scheduled_date)}{reschBkg.scheduled_slot && reschBkg.scheduled_slot !== '—' ? ` · ${reschBkg.scheduled_slot}` : ''}</div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>New Date *</label>
            <input className="input" type="date" value={reschDate} onChange={e => setReschDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>New Time Slot</label>
            <select className="input" value={reschSlot} onChange={e => setReschSlot(e.target.value)}>
              <option value="">— Keep existing —</option>
              {SLOTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" onClick={doReschedule} disabled={!reschDate || reschSaving}>
              {reschSaving ? <Spinner size="sm" /> : 'Reschedule'}
            </button>
            <button className="btn btn-secondary" onClick={() => setReschBkg(null)}>Cancel</button>
          </div>
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════════════
          CREATE BOOKING MODAL (reuses advanced BookingModal)
      ══════════════════════════════════════════════════════════════ */}
      {showCreate && (
        <BookingModal
          onClose={() => setShowCreate(false)}
          onDone={fetchBookings}
        />
      )}

      {/* ── Quotation flow for a specific booking ── */}
      {quotationBkg && (
        <QuotationFromBookingModal
          booking={quotationBkg}
          onClose={() => setQuotationBkg(null)}
          onDone={fetchBookings}
          userRole="ADMIN"
          readOnly={isTerminal(quotationBkg.status)}
        />
      )}

      {/* ── Booking Work Workflow Manager ── */}
      {workflowBkg && (
        <BookingWorkflow
          booking={workflowBkg}
          onClose={() => setWorkflowBkg(null)}
          onRefresh={fetchBookings}
          userRole="ADMIN"
        />
      )}

      {/* ══════════════════════════════════════════════════════════════
          SETTLE MODAL
      ══════════════════════════════════════════════════════════════ */}
      {settleBooking && (
        <Modal title={`Settle & Close — #${settleBooking.booking_number}`} onClose={() => setSettleBooking(null)} size="md">
          {settleErr && <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 12 }}>{settleErr}</div>}
          {!settlePreview && !settleErr && (
            <div style={{ textAlign: 'center', padding: 40 }}><Spinner /></div>
          )}
          {settlePreview && (
            <>
              <div style={{ background: '#F0FDF4', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>
                <b>Commission breakdown</b>
                <div style={{ marginTop: 8 }}>
                  {(settlePreview.line_items || []).map((item: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ color: '#374151', flex: 1 }}>{item.name} ({item.type})</span>
                      <span style={{ color: '#059669', fontWeight: 700, marginLeft: 8 }}>
                        ₹{item.matched ? Number(settleOverrides[idx] ?? item.commission_amount).toLocaleString('en-IN') : '—'}
                      </span>
                      {!item.matched && (
                        <input
                          type="number"
                          placeholder="Override ₹"
                          value={settleOverrides[idx] ?? ''}
                          onChange={e => setSettleOverrides(o => ({ ...o, [idx]: e.target.value }))}
                          style={{ width: 90, marginLeft: 8, padding: '2px 6px', border: '1px solid #D1D5DB', borderRadius: 4, fontSize: 12 }}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: '1px solid #BBF7D0', marginTop: 8, paddingTop: 8, fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total Commission</span>
                  <span style={{ color: '#059669' }}>₹{settlePreview.total_commission?.toLocaleString('en-IN')}</span>
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Settlement Notes (optional)</label>
                <textarea
                  className="input"
                  rows={2}
                  value={settleNotes}
                  onChange={e => setSettleNotes(e.target.value)}
                  placeholder="Internal notes…"
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setSettleBooking(null)}>Cancel</button>
                <button
                  className="btn btn-primary btn-sm"
                  style={{ background: '#059669', color: '#fff', border: 'none' }}
                  onClick={handleSettle}
                  disabled={settleLoading}
                >
                  {settleLoading ? 'Settling…' : '🔒 Confirm Settlement'}
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  )
}
