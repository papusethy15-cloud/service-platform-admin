import { useEffect, useState, useRef, useCallback } from 'react'
import { assignmentsAPI, settingsAPI } from '@/services/api'
import PageHeader from '@/components/layout/PageHeader'
import Pagination from '@/components/ui/Pagination'
import Spinner from '@/components/ui/Spinner'
import { useAdminWebSocket } from '@/hooks/useAdminWebSocket'

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  ASSIGNED:   { label: 'Pending',    color: '#B45309', bg: '#FEF3C7', icon: '⏳' },
  ACCEPTED:   { label: 'Accepted',   color: '#059669', bg: '#D1FAE5', icon: '✅' },
  REJECTED:   { label: 'Rejected',   color: '#DC2626', bg: '#FEE2E2', icon: '❌' },
  TIMEOUT:    { label: 'Timed Out',  color: '#7C3AED', bg: '#EDE9FE', icon: '⌛' },
  REASSIGNED: { label: 'Superseded', color: '#94A3B8', bg: '#F1F5F9', icon: '🔄' },
}
const TYPE_META: Record<string, { label: string; color: string }> = {
  AUTO:   { label: 'Auto',   color: '#1B4FD8' },
  MANUAL: { label: 'Manual', color: '#7C3AED' },
}

interface LiveEvent {
  id: string
  type: string
  payload: any
  timestamp: string
}

function Countdown({ deadline }: { deadline: string | null }) {
  const [secs, setSecs] = useState<number | null>(null)
  useEffect(() => {
    if (!deadline) return
    const update = () => setSecs(Math.floor((new Date(deadline).getTime() - Date.now()) / 1000))
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [deadline])
  if (secs === null || !deadline) return <span style={{ color: '#94A3B8' }}>—</span>
  if (secs <= 0) return <span style={{ color: '#DC2626', fontWeight: 700, fontSize: 11 }}>Expired</span>
  const m = Math.floor(secs / 60), s = secs % 60
  const color = secs < 60 ? '#DC2626' : secs < 120 ? '#B45309' : '#059669'
  return (
    <span style={{ color, fontWeight: 700, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
      {m}:{String(s).padStart(2, '0')}
    </span>
  )
}

export default function DispatchMonitor() {
  const [items, setItems]             = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [page, setPage]               = useState(1)
  const [pages, setPages]             = useState(1)
  const [total, setTotal]             = useState(0)
  const [statusFilter, setStatus]     = useState('')
  const [autoEnabled, setAutoEnabled] = useState<boolean | null>(null)
  const [liveEvents, setLiveEvents]   = useState<LiveEvent[]>([])
  const liveRef = useRef<HTMLDivElement>(null)
  const { subscribe, status: wsStatus } = useAdminWebSocket()

  const fmt = (d: string) =>
    d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' }) : '—'

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const r = await assignmentsAPI.history({ page, per_page: 20, status: statusFilter || undefined })
      const d = r.data.data
      setItems(d.items || [])
      setPages(d.pages || 1)
      setTotal(d.total || 0)
    } catch { setItems([]) }
    finally { setLoading(false) }
  }, [page, statusFilter])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    settingsAPI.dispatch().then(r => {
      const v = r.data?.data?.auto_assign_enabled
      setAutoEnabled(v === 'true' || v === true)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const evts = [
      'ASSIGNMENT_CREATED', 'ASSIGNMENT_ACCEPTED', 'ASSIGNMENT_REJECTED',
      'ASSIGNMENT_AUTO_CANCELLED', 'BOOKING_STATUS_CHANGED',
    ]
    const unsubs = evts.map(evt =>
      subscribe(evt, (payload, msg) => {
        setLiveEvents(prev => [{
          id: `${Date.now()}-${Math.random()}`,
          type: msg.type,
          payload,
          timestamp: msg.timestamp || new Date().toISOString(),
        }, ...prev].slice(0, 50))
        if (evt !== 'BOOKING_STATUS_CHANGED') fetchData()
      })
    )
    return () => unsubs.forEach(u => u())
  }, [subscribe, fetchData])

  const handleToggle = async () => {
    const newVal = !autoEnabled
    setAutoEnabled(newVal)
    try {
      await settingsAPI.updateDispatch({ auto_assign_enabled: newVal ? 'true' : 'false' })
    } catch { setAutoEnabled(!newVal) }
  }

  const evtMeta: Record<string, { label: string; color: string; icon: string }> = {
    ASSIGNMENT_CREATED:        { label: 'Assigned',    color: '#1B4FD8', icon: '📤' },
    ASSIGNMENT_ACCEPTED:       { label: 'Accepted',    color: '#059669', icon: '✅' },
    ASSIGNMENT_REJECTED:       { label: 'Rejected',    color: '#DC2626', icon: '❌' },
    ASSIGNMENT_AUTO_CANCELLED: { label: 'Cancelled',   color: '#94A3B8', icon: '🚫' },
    BOOKING_STATUS_CHANGED:    { label: 'Status Upd',  color: '#7C3AED', icon: '🔔' },
  }

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader title="Dispatch Monitor" subtitle={`${total} assignment records · Real-time auto-assign activity`} />

      {/* Control bar */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        {/* Auto-assign toggle */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'white', border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '10px 16px',
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Auto-Assign</span>
          <div onClick={handleToggle} style={{
            width: 44, height: 24, borderRadius: 12, position: 'relative',
            background: autoEnabled ? '#1B4FD8' : '#CBD5E1',
            transition: 'background 0.2s', cursor: 'pointer', flexShrink: 0,
          }}>
            <div style={{
              position: 'absolute', top: 2,
              left: autoEnabled ? 22 : 2,
              width: 20, height: 20, borderRadius: '50%', background: 'white',
              boxShadow: '0 1px 4px rgba(0,0,0,0.2)', transition: 'left 0.2s',
            }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: autoEnabled ? '#1B4FD8' : '#94A3B8' }}>
            {autoEnabled === null ? '…' : autoEnabled ? 'ON' : 'OFF'}
          </span>
        </div>

        {/* WS status */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'white', border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '10px 14px',
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: wsStatus === 'connected' ? '#22C55E' : wsStatus === 'connecting' ? '#F59E0B' : '#EF4444',
          }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'capitalize' }}>
            {wsStatus}
          </span>
        </div>

        {/* Status filter */}
        <select className="input" style={{ maxWidth: 190 }} value={statusFilter}
          onChange={e => { setStatus(e.target.value); setPage(1) }}>
          <option value="">All Statuses</option>
          {Object.entries(STATUS_META).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </select>

        <button className="btn btn-secondary" onClick={fetchData} style={{ marginLeft: 'auto' }}>
          🔄 Refresh
        </button>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>

        {/* History table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #F1F5F9', fontWeight: 700, fontSize: 14, color: '#0F172A' }}>
            📋 Assignment History
          </div>
          {loading
            ? <div style={{ padding: 48, textAlign: 'center' }}><Spinner /></div>
            : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Booking</th>
                        <th>Technician</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Score</th>
                        <th>Deadline</th>
                        <th>Notes</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.length === 0
                        ? <tr><td colSpan={8} style={{ textAlign: 'center', color: '#94A3B8', padding: 32 }}>No assignment records found</td></tr>
                        : items.map((item: any) => {
                          const sm = STATUS_META[item.status] || { label: item.status, color: '#64748B', bg: '#F1F5F9', icon: '•' }
                          const tm = TYPE_META[item.assignment_type] || { label: item.assignment_type, color: '#64748B' }
                          return (
                            <tr key={item.id}>
                              <td>
                                <span style={{ fontWeight: 600, fontSize: 12, color: '#1B4FD8' }}>
                                  {item.booking_number || '—'}
                                </span>
                              </td>
                              <td>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#0F172A' }}>{item.technician_name || '—'}</div>
                                <div style={{ fontSize: 11, color: '#94A3B8' }}>{item.technician_mobile || ''}</div>
                              </td>
                              <td>
                                <span style={{
                                  fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
                                  background: `${tm.color}18`, color: tm.color,
                                }}>
                                  {tm.label}
                                </span>
                              </td>
                              <td>
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                                  background: sm.bg, color: sm.color,
                                }}>
                                  {sm.icon} {sm.label}
                                </span>
                              </td>
                              <td style={{ fontWeight: 700, fontSize: 13, color: '#1B4FD8' }}>
                                {item.score != null ? item.score : '—'}
                              </td>
                              <td>
                                {item.status === 'ASSIGNED'
                                  ? <Countdown deadline={item.response_deadline} />
                                  : <span style={{ fontSize: 11, color: '#94A3B8' }}>
                                      {item.response_deadline ? fmt(item.response_deadline) : '—'}
                                    </span>
                                }
                              </td>
                              <td style={{ fontSize: 11, color: '#64748B', maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {item.notes || '—'}
                              </td>
                              <td style={{ fontSize: 11, color: '#94A3B8', whiteSpace: 'nowrap' }}>
                                {fmt(item.created_at)}
                              </td>
                            </tr>
                          )
                        })
                      }
                    </tbody>
                  </table>
                </div>
                {pages > 1 && (
                  <div style={{ padding: '12px 16px', borderTop: '1px solid #F1F5F9' }}>
                    <Pagination page={page} pages={pages} onPage={setPage} />
                  </div>
                )}
              </>
            )
          }
        </div>

        {/* Live feed */}
        <div className="card" style={{ overflow: 'hidden', position: 'sticky', top: 24 }}>
          <div style={{
            padding: '14px 16px', borderBottom: '1px solid #F1F5F9',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>⚡ Live Feed</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {wsStatus === 'connected' && (
                <span style={{ fontSize: 11, color: '#22C55E', fontWeight: 600 }}>● LIVE</span>
              )}
              {liveEvents.length > 0 && (
                <button onClick={() => setLiveEvents([])}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#94A3B8' }}>
                  Clear
                </button>
              )}
            </div>
          </div>

          <div ref={liveRef} style={{ maxHeight: 580, overflowY: 'auto', padding: '8px 0' }}>
            {liveEvents.length === 0
              ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📡</div>
                  Waiting for dispatch events…
                </div>
              )
              : liveEvents.map(ev => {
                const meta = evtMeta[ev.type] || { label: ev.type, color: '#64748B', icon: '•' }
                const p = ev.payload || {}
                return (
                  <div key={ev.id} style={{
                    padding: '10px 14px', borderBottom: '1px solid #F8FAFC',
                    animation: 'slideIn 0.25s ease',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 5,
                        background: `${meta.color}18`, color: meta.color,
                      }}>
                        {meta.icon} {meta.label}
                      </span>
                      <span style={{ fontSize: 10, color: '#94A3B8', marginLeft: 'auto' }}>
                        {new Date(ev.timestamp).toLocaleTimeString('en-IN')}
                      </span>
                    </div>
                    {p.booking_number && (
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1B4FD8' }}>{p.booking_number}</div>
                    )}
                    {p.technician_name && (
                      <div style={{ fontSize: 11, color: '#374151' }}>→ {p.technician_name}</div>
                    )}
                    {p.score != null && (
                      <div style={{ fontSize: 11, color: '#64748B' }}>Score: {p.score}</div>
                    )}
                    {p.reason === 'TIMEOUT' && (
                      <div style={{ fontSize: 11, color: '#7C3AED', fontWeight: 600 }}>⌛ Timed out — redispatching</div>
                    )}
                    {p.status && (
                      <div style={{ fontSize: 10, color: '#94A3B8' }}>Status: {p.status}</div>
                    )}
                  </div>
                )
              })
            }
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
        {Object.entries(STATUS_META).map(([k, v]) => {
          const count = items.filter((i: any) => i.status === k).length
          return (
            <div key={k} onClick={() => { setStatus(statusFilter === k ? '' : k); setPage(1) }}
              style={{
                cursor: 'pointer', flex: 1, minWidth: 110,
                background: statusFilter === k ? v.bg : 'white',
                border: `1.5px solid ${statusFilter === k ? v.color : '#E2E8F0'}`,
                borderRadius: 10, padding: '12px 14px', textAlign: 'center',
                transition: 'all 0.15s',
              }}>
              <div style={{ fontSize: 20, marginBottom: 2 }}>{v.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: v.color }}>{count}</div>
              <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>{v.label}</div>
            </div>
          )
        })}
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
