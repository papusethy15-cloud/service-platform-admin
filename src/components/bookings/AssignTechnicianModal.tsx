/**
 * AssignTechnicianModal
 * ─────────────────────
 * Advanced assignment modal for admin / CCO.
 *
 * Features
 * ════════
 *  • Two tabs: Auto  |  Manual
 *  • Auto tab  – one-click auto-assign with score preview after success
 *               – live polling of booking status every 3 s after assignment
 *               – "Disable Auto → Switch to Manual" if booking already has a
 *                 pending/auto assignment
 *  • Manual tab– calls GET /assignments/candidates/{id} for scored list
 *               – tech cards with rank badge, score bar, skill/city/workload
 *                 badges, score breakdown tooltip
 *               – search filter on tech name / city / area
 *               – overloaded techs shown dimmed (still selectable for admin)
 *               – notes field + confirm button
 *  • On success – shows success card, refreshes parent after 1.5 s
 */

import { useState, useEffect, useCallback } from 'react'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'
import { assignmentsAPI, settingsAPI } from '@/services/api'
import { useBookingWebSocket } from '@/hooks/useAdminWebSocket'

// ─── helpers ────────────────────────────────────────────────────────────────

function errMsg(ex: any): string {
  const d = ex?.response?.data?.detail
  if (typeof d === 'string') return d
  if (Array.isArray(d)) return d.map((e: any) => e.msg || JSON.stringify(e)).join('; ')
  if (d) return JSON.stringify(d)
  return ex?.message || 'Unknown error'
}

const STATUS_COLOR: Record<string, string> = {
  PENDING:    '#F59E0B',
  CONFIRMED:  '#3B82F6',
  ASSIGNED:   '#8B5CF6',
  ACCEPTED:   '#10B981',
  ARRIVED:    '#06B6D4',
  INSPECTING: '#F97316',
  IN_PROGRESS:'#F97316',
  COMPLETED:  '#22C55E',
  CANCELLED:  '#EF4444',
}

// ─── sub-components ─────────────────────────────────────────────────────────

function ScoreBar({ value, max = 150, color = '#6366F1' }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div style={{ background: '#E2E8F0', borderRadius: 4, height: 6, flex: 1 }}>
      <div style={{ width: `${pct}%`, background: color, borderRadius: 4, height: '100%', transition: 'width .4s' }} />
    </div>
  )
}

function RankBadge({ rank }: { rank: number }) {
  const colors: Record<number, { bg: string; text: string }> = {
    1: { bg: '#FEF3C7', text: '#D97706' },
    2: { bg: '#F1F5F9', text: '#64748B' },
    3: { bg: '#FEF9EE', text: '#B45309' },
  }
  const style = colors[rank] || { bg: '#F1F5F9', text: '#94A3B8' }
  return (
    <div style={{
      width: 28, height: 28, borderRadius: '50%',
      background: style.bg, color: style.text,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize: 11, flexShrink: 0,
    }}>
      #{rank}
    </div>
  )
}

function WorkloadBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0
  const color = pct >= 100 ? '#EF4444' : pct >= 70 ? '#F59E0B' : '#22C55E'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ background: '#E2E8F0', borderRadius: 4, height: 5, width: 60 }}>
        <div style={{ width: `${pct}%`, background: color, borderRadius: 4, height: '100%', transition: 'width .4s' }} />
      </div>
      <span style={{ fontSize: 10, color: pct >= 100 ? '#EF4444' : '#64748B' }}>
        {current}/{max}
      </span>
    </div>
  )
}

function ScoreBreakdownTooltip({ breakdown }: { breakdown: Record<string, number> }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#6366F1', padding: 0 }}
      >
        ℹ️
      </button>
      {show && (
        <div style={{
          position: 'absolute', bottom: '120%', left: '50%', transform: 'translateX(-50%)',
          background: '#1E293B', color: '#F8FAFC', borderRadius: 8, padding: '10px 12px',
          fontSize: 11, width: 160, zIndex: 1000, boxShadow: '0 4px 16px rgba(0,0,0,.3)',
          pointerEvents: 'none',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: '#94A3B8', fontSize: 10 }}>SCORE BREAKDOWN</div>
          {Object.entries(breakdown).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ color: '#CBD5E1', textTransform: 'capitalize' }}>{k}</span>
              <span style={{ color: '#A5F3FC', fontWeight: 700 }}>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── candidate card ──────────────────────────────────────────────────────────

interface Candidate {
  technician_id: string
  name: string
  mobile: string
  city: string
  area: string
  is_online: boolean
  rating: number
  total_jobs: number
  active_workload: number
  max_workload: number
  profile_image: string | null
  skill_match: boolean
  same_city: boolean
  overloaded: boolean
  slot_available: boolean
  slot_booking_count: number
  slot_unavailable_reason: string | null
  score: number
  score_breakdown: Record<string, number>
  last_lat: number | null
  last_lng: number | null
  distance_km: number | null
}

function CandidateCard({
  candidate,
  rank,
  selected,
  onSelect,
}: {
  candidate: Candidate
  rank: number
  selected: boolean
  onSelect: () => void
}) {
  const overloaded = candidate.overloaded
  const slotBlocked = !candidate.slot_available

  return (
    <div
      onClick={onSelect}
      style={{
        border: selected
          ? '2px solid #6366F1'
          : slotBlocked
          ? '1px solid #FCA5A5'
          : overloaded
          ? '1px solid #FECACA'
          : '1px solid #E2E8F0',
        borderRadius: 10,
        padding: '10px 12px',
        marginBottom: 8,
        cursor: 'pointer',
        background: selected
          ? '#EEF2FF'
          : slotBlocked
          ? '#FFF1F1'
          : overloaded
          ? '#FFF5F5'
          : '#FAFAFA',
        transition: 'all .15s',
        opacity: slotBlocked ? 0.55 : overloaded ? 0.7 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <RankBadge rank={rank} />

        {/* Avatar */}
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: '#E2E8F0', flexShrink: 0, overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16,
        }}>
          {candidate.profile_image
            ? <img src={candidate.profile_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : '👷'}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Name + online */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#1E293B' }}>{candidate.name}</span>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: candidate.is_online ? '#22C55E' : '#94A3B8',
              display: 'inline-block',
            }} />
            {candidate.skill_match && (
              <span style={{ fontSize: 10, background: '#DCFCE7', color: '#166534', borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>
                ✅ Skill Match
              </span>
            )}
            {candidate.same_city && (
              <span style={{ fontSize: 10, background: '#EFF6FF', color: '#1D4ED8', borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>
                📍 Same City
              </span>
            )}
            {overloaded && (
              <span style={{ fontSize: 10, background: '#FEF2F2', color: '#DC2626', borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>
                ⚠ Overloaded
              </span>
            )}
            {!candidate.slot_available && (
              <span style={{ fontSize: 10, background: '#FEF2F2', color: '#991B1B', borderRadius: 4, padding: '1px 6px', fontWeight: 700, border: '1px solid #FECACA' }}>
                🚫 Slot Full ({candidate.slot_booking_count}/2)
              </span>
            )}
          </div>

          {/* Info row */}
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {candidate.mobile && <span>📞 {candidate.mobile}</span>}
            {candidate.city && <span>📍 {candidate.city}{candidate.area ? `, ${candidate.area}` : ''}</span>}
            <span>⭐ {candidate.rating?.toFixed(1) || '0.0'}</span>
            <span>🔧 {candidate.total_jobs} jobs</span>
            {candidate.distance_km != null && (
              <span style={{ color: candidate.distance_km < 5 ? '#16A34A' : candidate.distance_km < 15 ? '#D97706' : '#DC2626', fontWeight: 700 }}>
                📡 {candidate.distance_km < 1 ? `${(candidate.distance_km * 1000).toFixed(0)}m` : `${candidate.distance_km.toFixed(1)}km`} away
              </span>
            )}
            {candidate.slot_unavailable_reason && (
              <span style={{ color: '#991B1B', fontWeight: 600 }}>
                ⏰ {candidate.slot_unavailable_reason}
              </span>
            )}
          </div>

          {/* Workload */}
          <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: '#94A3B8' }}>Workload</span>
            <WorkloadBar current={candidate.active_workload} max={candidate.max_workload} />
          </div>
        </div>

        {/* Score */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontWeight: 800, fontSize: 16, color: '#6366F1' }}>{candidate.score}</span>
            <ScoreBreakdownTooltip breakdown={candidate.score_breakdown} />
          </div>
          <div style={{ marginTop: 4 }}>
            <ScoreBar value={candidate.score} />
          </div>
          <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>score</div>
        </div>
      </div>

      {/* Live GPS map link */}
      {candidate.last_lat && candidate.last_lng && (
        <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
          <a
            href={`https://www.google.com/maps?q=${candidate.last_lat},${candidate.last_lng}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ fontSize: 10, color: '#2563EB', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}
          >
            🗺️ View Live Location
          </a>
          <span style={{ fontSize: 9, color: '#94A3B8' }}>
            ({candidate.last_lat.toFixed(4)}, {candidate.last_lng.toFixed(4)})
          </span>
        </div>
      )}
      {selected && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#6366F1', fontWeight: 600, textAlign: 'center' }}>
          ✓ Selected — confirm below
        </div>
      )}
    </div>
  )
}

// ─── main modal ──────────────────────────────────────────────────────────────

interface Props {
  booking: any
  onClose: () => void
  onDone: () => void   // parent refreshes bookings list
}

type Tab = 'auto' | 'manual'

export default function AssignTechnicianModal({ booking, onClose, onDone }: Props) {
  const [tab, setTab]           = useState<Tab>('auto')

  // shared
  const [notes, setNotes]       = useState('')
  const [err, setErr]           = useState('')
  const [success, setSuccess]   = useState('')
  const [successData, setSuccessData] = useState<any>(null)

  // auto tab
  const [autoLoading, setAutoLoading] = useState(false)
  const [cancellingAuto, setCancellingAuto] = useState(false)
  const [liveStatus, setLiveStatus] = useState<string>(booking?.status || '')

  // Manual assign awaiting response
  const [awaitingResponse, setAwaitingResponse] = useState(false)
  const [responseDeadline, setResponseDeadline] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number>(0)

  // ── WebSocket: real-time booking status ──────────────────────────────────
  // Only activate WS after a successful assignment (bookingId will be set)
  const [wsBookingId, setWsBookingId] = useState<string | null>(null)
  const { status: wsStatus, lastEvent } = useBookingWebSocket(wsBookingId)

  // manual tab
  const [candidates,     setCandidates]     = useState<Candidate[]>([])
  const [candLoading,    setCandLoading]     = useState(false)
  const [candErr,        setCandErr]         = useState('')
  const [search,         setSearch]          = useState('')
  const [selectedTech,   setSelectedTech]    = useState<string>('')
  const [manualSaving,   setManualSaving]    = useState(false)
  const [onlyAvailable,  setOnlyAvailable]   = useState(false)
  const [mapsApiKey,     setMapsApiKey]      = useState<string>('')

  // Is booking already auto-assigned (has technician + status ASSIGNED)?
  const isAutoAssigned = !!(
    booking?.technician_id &&
    ['ASSIGNED'].includes(booking?.status)
  )
  const hasExistingTech = !!booking?.technician_id

  // ── React to WS events from server ──────────────────────────────────────
  useEffect(() => {
    if (!lastEvent) return
    const t = lastEvent.type
    const p = lastEvent.payload
    if (
      p?.booking_id === booking.id &&
      (t === 'BOOKING_STATUS_CHANGED' || t === 'ASSIGNMENT_ACCEPTED' || t === 'ASSIGNMENT_REJECTED' || t === 'ASSIGNMENT_CREATED')
    ) {
      if (p.status) setLiveStatus(p.status)
      if (p.status === 'ACCEPTED') {
        // Booking accepted — auto-close modal after brief delay
        setAwaitingResponse(false)
        onDone()
        setTimeout(() => onClose(), 1800)
      }
      if (t === 'ASSIGNMENT_REJECTED') {
        // Technician rejected — reload candidates so admin can pick another
        setAwaitingResponse(false)
        setSuccess('')
        setSuccessData(null)
        setSelectedTech('')
        if (tab === 'manual') loadCandidates()
        setErr('Technician rejected the job. Please select another technician.')
      }
    }
  }, [lastEvent])

  // ── Manual assign countdown timer ───────────────────────────────────────
  useEffect(() => {
    if (!awaitingResponse || !responseDeadline) { setCountdown(0); return }
    const tick = () => {
      const remaining = Math.max(0, Math.floor((new Date(responseDeadline).getTime() - Date.now()) / 1000))
      setCountdown(remaining)
      if (remaining === 0) setAwaitingResponse(false)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [awaitingResponse, responseDeadline])

  // ── load candidates when switching to manual tab ─────────────────────────
  useEffect(() => {
    settingsAPI.maps().then((r: any) => {
      const d = r?.data?.data || {}; const key = d?.google_maps_api_key || d?.maps?.google_maps_api_key || ''
      setMapsApiKey(key)
    }).catch(() => {})
  }, [])

  const [slotInfo, setSlotInfo] = useState<{ slot: string | null; date: string | null; maxPerSlot: number }>({ slot: null, date: null, maxPerSlot: 2 })

  const loadCandidates = useCallback(async () => {
    setCandLoading(true); setCandErr('')
    try {
      const r = await assignmentsAPI.candidates(booking.id)
      const d = r.data.data || {}
      setCandidates(d.candidates || [])
      setSlotInfo({ slot: d.scheduled_slot || null, date: d.scheduled_date || null, maxPerSlot: d.max_bookings_per_slot ?? 2 })
    } catch (ex: any) {
      setCandErr(errMsg(ex))
    } finally {
      setCandLoading(false)
    }
  }, [booking.id])

  useEffect(() => {
    if (tab === 'manual' && candidates.length === 0 && !candLoading) {
      loadCandidates()
    }
  }, [tab])

  // ── auto assign ──────────────────────────────────────────────────────────
  const doAutoAssign = async () => {
    setAutoLoading(true); setErr('')
    try {
      const r = await assignmentsAPI.auto({ booking_id: booking.id, notes: notes || undefined })
      const d = r.data.data
      setSuccessData(d)
      setSuccess(`Auto-assigned to ${d.technician_name || 'technician'} (Score: ${d.score ?? 0})`)
      setLiveStatus('ASSIGNED')
      setWsBookingId(booking.id)   // activate WS subscription
      // Modal stays open — admin can watch live status or close manually
    } catch (ex: any) {
      setErr(errMsg(ex))
    } finally {
      setAutoLoading(false)
    }
  }

  // ── cancel auto assign ───────────────────────────────────────────────────
  const doCancelAuto = async () => {
    setCancellingAuto(true); setErr('')
    try {
      await assignmentsAPI.cancelAuto(booking.id)
      setTab('manual')
      loadCandidates()
    } catch (ex: any) {
      setErr(errMsg(ex))
    } finally {
      setCancellingAuto(false)
    }
  }

  // ── manual assign ────────────────────────────────────────────────────────
  const doManualAssign = async () => {
    if (!selectedTech) return
    setManualSaving(true); setErr('')
    try {
      const r = await assignmentsAPI.manual({ booking_id: booking.id, technician_id: selectedTech, notes: notes || undefined })
      const d = r.data.data
      const tech = candidates.find(c => c.technician_id === selectedTech)
      setSuccessData({ technician_name: tech?.name, score: tech?.score })
      setSuccess(`Manually assigned to ${tech?.name || 'technician'}`)
      setLiveStatus('ASSIGNED')
      setWsBookingId(booking.id)   // activate WS to watch for accept/reject
      // Activate awaiting response mode — blocks modal close, shows countdown
      if (d?.response_deadline) {
        setResponseDeadline(d.response_deadline)
        setAwaitingResponse(true)
      }
      // Refresh parent list immediately (shows ⏳ Pending badge)
      onDone()
    } catch (ex: any) {
      setErr(errMsg(ex))
    } finally {
      setManualSaving(false)
    }
  }

  // ── filtered candidates ──────────────────────────────────────────────────
  const filtered = candidates.filter(c => {
    if (onlyAvailable && c.overloaded) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.name?.toLowerCase().includes(q) ||
      c.city?.toLowerCase().includes(q) ||
      c.area?.toLowerCase().includes(q) ||
      c.mobile?.includes(q)
    )
  })

  // ─── render ───────────────────────────────────────────────────────────────

  const title = hasExistingTech
    ? `Reassign Technician — ${booking.booking_number}`
    : `Assign Technician — ${booking.booking_number}`

  // Block ✕ close while waiting for technician response
  const handleClose = () => { if (!awaitingResponse) onClose() }

  return (
    <Modal title={title} onClose={handleClose} size="lg">

      {/* ── Booking Info Strip ─────────────────────────────────────────── */}
      <div style={{
        background: '#EFF6FF', border: '1px solid #BFDBFE',
        borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <span style={{ fontWeight: 800, fontFamily: 'monospace', color: '#1B4FD8', fontSize: 14 }}>
              {booking.booking_number}
            </span>
            <div style={{ color: '#64748B', marginTop: 2, fontSize: 12 }}>
              👤 {booking.customer_name || '—'}
              {booking.city && <> · 📍 {booking.city}</>}
              {booking.service_name && <> · 🔧 {booking.service_name}</>}
            </div>
            {(booking.scheduled_slot || booking.scheduled_date) && (
              <div style={{ fontSize: 11, color: '#7C3AED', marginTop: 3, fontWeight: 600 }}>
                📅 {booking.scheduled_date ? new Date(booking.scheduled_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                {booking.scheduled_slot && <> · ⏰ {booking.scheduled_slot}</>}
                <span style={{ marginLeft: 6, color: '#94A3B8', fontWeight: 400, fontSize: 10 }}>
                  (max 2 bookings/slot per technician)
                </span>
              </div>
            )}
            {booking.technician_name && (
              <div style={{ fontSize: 12, color: '#059669', marginTop: 2 }}>
                Currently: 👷 <b>{booking.technician_name}</b>
              </div>
            )}
          </div>
          {/* Live status badge */}
          <div style={{
            padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
            background: (STATUS_COLOR[liveStatus] || '#94A3B8') + '22',
            color: STATUS_COLOR[liveStatus] || '#64748B',
            border: `1px solid ${STATUS_COLOR[liveStatus] || '#E2E8F0'}`,
          }}>
            {liveStatus || booking.status}
            {wsStatus === 'connected' && wsBookingId && <span style={{ marginLeft: 4 }}>⟳</span>}
          </div>
        </div>
      </div>

      {/* ── Success Banner ────────────────────────────────────────────────── */}
      {success && (
        <div style={{
          background: '#F0FDF4', border: '1px solid #86EFAC', color: '#166534',
          borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>✅ {success}</div>
          {successData && (
            <div style={{ fontSize: 12, color: '#15803D' }}>
              Dispatched — waiting for technician to accept.
              {liveStatus === 'ACCEPTED' && <span style={{ fontWeight: 700, color: '#059669' }}> ✅ Job ACCEPTED!</span>}
              {liveStatus === 'CONFIRMED' && <span style={{ fontWeight: 700, color: '#DC2626' }}> ❌ Technician rejected — modal closing to allow reassignment.</span>}
            </div>
          )}
          {wsBookingId && (
            <div style={{ fontSize: 11, color: '#059669', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
                  background: wsStatus === 'connected' ? '#22C55E' : '#F59E0B',
                  animation: wsStatus === 'connected' ? 'pulse 1.5s infinite' : 'none',
                }} />
                WebSocket live — status: <b>{liveStatus}</b>
              </div>
              <button
                onClick={() => { onDone(); onClose() }}
                style={{ fontSize: 11, background: 'none', border: 'none', color: '#059669', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
              >
                Close ✕
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Awaiting Technician Response (Manual Assign) ───────────────────── */}
      {awaitingResponse && (
        <div style={{
          background: '#FFF7ED', border: '2px solid #FCD34D',
          borderRadius: 12, padding: '16px 18px', marginBottom: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {/* Countdown circle */}
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: countdown > 60 ? '#DCFCE7' : countdown > 20 ? '#FEF3C7' : '#FEE2E2',
              border: `3px solid ${countdown > 60 ? '#22C55E' : countdown > 20 ? '#F59E0B' : '#EF4444'}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: countdown > 60 ? '#15803D' : countdown > 20 ? '#B45309' : '#B91C1C', lineHeight: 1 }}>
                {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
              </span>
              <span style={{ fontSize: 9, color: '#94A3B8', marginTop: 1 }}>remain</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#92400E' }}>
                ⏳ Waiting for Technician Response
              </div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 3 }}>
                {successData?.technician_name && <><b>{successData.technician_name}</b> has been notified. </>}
                Job request sent — waiting for accept or reject.
              </div>
              <div style={{ fontSize: 11, color: countdown <= 20 ? '#DC2626' : '#94A3B8', marginTop: 4, fontWeight: countdown <= 20 ? 700 : 400 }}>
                {countdown <= 0 ? '⚠ Time expired — technician did not respond.' : countdown <= 20 ? '⚠ Time running out!' : 'Modal will stay open until technician responds.'}
              </div>
            </div>
          </div>
          {/* Cancel manual assign button */}
          <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              className="btn btn-sm"
              style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', fontWeight: 700 }}
              onClick={async () => {
                try {
                  await assignmentsAPI.cancelAuto(booking.id)
                  setAwaitingResponse(false)
                  setSuccess('')
                  setSuccessData(null)
                  setWsBookingId(null)
                  setTab('manual')
                  loadCandidates()
                } catch (ex: any) { setErr(errMsg(ex)) }
              }}
            >
              🚫 Cancel & Reassign
            </button>
            <span style={{ fontSize: 11, color: '#94A3B8' }}>
              ✕ Close is disabled until technician responds
            </span>
          </div>
        </div>
      )}

      {/* ── Error Banner ─────────────────────────────────────────────────── */}
      {err && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626',
          borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12,
        }}>
          ⚠ {err}
        </div>
      )}

      {/* ── Disable Auto → Manual button (when already auto-assigned) ────── */}
      {isAutoAssigned && !success && (
        <div style={{
          background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8,
          padding: '10px 14px', marginBottom: 14, display: 'flex',
          alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#C2410C' }}>
              ⚡ This booking has a pending auto-assignment
            </div>
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
              Cancel the auto-assign and take manual control instead.
            </div>
          </div>
          <button
            className="btn btn-sm"
            style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', fontWeight: 700, whiteSpace: 'nowrap' }}
            onClick={doCancelAuto}
            disabled={cancellingAuto}
          >
            {cancellingAuto ? <Spinner size="sm" /> : '🚫 Disable Auto → Manual'}
          </button>
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      {!success && (
        <>
          <div style={{ display: 'flex', borderBottom: '2px solid #E2E8F0', marginBottom: 14 }}>
            {(['auto', 'manual'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setErr('') }}
                style={{
                  padding: '8px 20px', border: 'none', background: 'none',
                  cursor: 'pointer', fontSize: 13, fontWeight: 700,
                  color: tab === t ? '#6366F1' : '#94A3B8',
                  borderBottom: tab === t ? '2px solid #6366F1' : '2px solid transparent',
                  marginBottom: -2, transition: 'color .15s',
                }}
              >
                {t === 'auto' ? '⚡ Auto Assign' : '👷 Manual Assign'}
              </button>
            ))}
            <div style={{ flex: 1 }} />
          </div>

          {/* ── AUTO TAB ───────────────────────────────────────────────── */}
          {tab === 'auto' && (
            <div>
              {/* Dispatch Engine Info */}
              <div style={{
                background: '#F5F3FF', border: '1px solid #DDD6FE',
                borderRadius: 10, padding: '12px 14px', marginBottom: 14,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#7C3AED', marginBottom: 8 }}>
                  🤖 Dispatch Engine Scoring
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px', fontSize: 11 }}>
                  {[
                    ['Skill Match', '50 pts'],
                    ['Rating', 'rating × 20'],
                    ['Low Workload', 'up to 30 pts'],
                    ['Experience', 'up to 20 pts'],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                      <span>{label}</span>
                      <span style={{ fontWeight: 700, color: '#7C3AED' }}>{val}</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 8 }}>
                  Highest scoring technician with open workload slot gets FCM push notification.
                  They have 5 min to accept before auto-redispatch.
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                  Notes (optional)
                </label>
                <input
                  className="input"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Assignment notes…"
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn btn-primary"
                  style={{ background: '#7C3AED', borderColor: '#7C3AED', flex: 1 }}
                  onClick={doAutoAssign}
                  disabled={autoLoading}
                >
                  {autoLoading ? <Spinner size="sm" /> : '⚡ Run Auto Assignment'}
                </button>
                <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              </div>
            </div>
          )}

          {/* ── MANUAL TAB ─────────────────────────────────────────────── */}
          {tab === 'manual' && (
            <div>
              {/* Controls */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  className="input"
                  style={{ flex: 1, minWidth: 140, fontSize: 12 }}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search name, city, area, mobile…"
                />
                <label style={{ fontSize: 11, color: '#64748B', display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={onlyAvailable}
                    onChange={e => setOnlyAvailable(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  Hide overloaded
                </label>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={loadCandidates}
                  disabled={candLoading}
                  title="Refresh candidate list"
                >
                  {candLoading ? <Spinner size="sm" /> : '🔄'}
                </button>
              </div>

              {candErr && (
                <div style={{ color: '#DC2626', fontSize: 12, marginBottom: 8 }}>⚠ {candErr}</div>
              )}

              {/* Slot capacity legend */}
              {slotInfo.slot && (
                <div style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 8, padding: '7px 12px', marginBottom: 10, fontSize: 11, color: '#5B21B6', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span>⏰ <b>Slot:</b> {slotInfo.slot}</span>
                  {slotInfo.date && <span>· 📅 {new Date(slotInfo.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
                  <span style={{ marginLeft: 4, color: '#7C3AED' }}>· Max <b>{slotInfo.maxPerSlot} bookings</b> per technician for this slot</span>
                  <span style={{ marginLeft: 4, color: '#DC2626', fontWeight: 600 }}>🚫 = slot full &nbsp; ✅ = slot available</span>
                </div>
              )}

              {/* Candidate List */}
              <div style={{ maxHeight: 360, overflowY: 'auto', marginBottom: 12, paddingRight: 2 }}>
                {candLoading && (
                  <div style={{ textAlign: 'center', padding: 32, color: '#94A3B8' }}>
                    <Spinner size="md" />
                    <div style={{ marginTop: 8, fontSize: 12 }}>Scoring technicians…</div>
                  </div>
                )}
                {!candLoading && filtered.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 32, color: '#94A3B8', fontSize: 13 }}>
                    {search || onlyAvailable
                      ? 'No technicians match filter'
                      : 'No active technicians found'}
                  </div>
                )}
                {!candLoading && filtered.map((c, idx) => (
                  <CandidateCard
                    key={c.technician_id}
                    candidate={c}
                    rank={candidates.indexOf(c) + 1}
                    selected={selectedTech === c.technician_id}
                    onSelect={() => setSelectedTech(
                      selectedTech === c.technician_id ? '' : c.technician_id
                    )}
                  />
                ))}
              </div>

              {/* Notes + Confirm */}
              <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 12 }}>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                    Notes (optional)
                  </label>
                  <input
                    className="input"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Assignment notes…"
                  />
                </div>

                {selectedTech && (() => {
                  const t = candidates.find(c => c.technician_id === selectedTech)
                  return t ? (
                    <div style={{
                      background: '#EEF2FF', border: '1px solid #C7D2FE',
                      borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12,
                    }}>
                      <span style={{ color: '#4338CA', fontWeight: 700 }}>👷 {t.name}</span>
                      <span style={{ color: '#6366F1', marginLeft: 8 }}>Score: {t.score}</span>
                      {t.skill_match && <span style={{ color: '#059669', marginLeft: 8 }}>✅ Skill Match</span>}
                    </div>
                  ) : null
                })()}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    className="btn btn-primary"
                    onClick={doManualAssign}
                    disabled={!selectedTech || manualSaving}
                    style={{ flex: 1 }}
                  >
                    {manualSaving ? <Spinner size="sm" /> : '👷 Confirm Manual Assignment'}
                  </button>
                  <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
