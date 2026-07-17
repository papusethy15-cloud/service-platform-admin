/**
 * BackendLogs.tsx — Real-time backend log streaming via WebSocket
 *
 * Connects to /ws/admin/logs, streams both stdout ([OUT]) and stderr ([ERR])
 * logs from PM2. Supports:
 *  - Auto-scroll (pauses when you scroll up)
 *  - Filter by level: ALL / OUT / ERR
 *  - Search filter with highlight
 *  - Clear display
 *  - Auto-reconnect on disconnect
 *  - Max 2000 lines buffer
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { API_BASE_URL } from '@/services/api'
import PageHeader from '@/components/layout/PageHeader'

const getWsBase = () => {
  const base =
    (import.meta.env.VITE_WS_URL as string | undefined) ||
    API_BASE_URL.replace('/api/v1', '')
  return base.replace(/^http/, 'ws')
}

const fmtTime = () =>
  new Date().toLocaleTimeString('en-IN', { hour12: false, timeZone: 'Asia/Kolkata' })

type LogLevel = 'OUT' | 'ERR' | 'SYS'
type Filter = 'ALL' | 'OUT' | 'ERR'

interface LogLine { id: number; time: string; level: LogLevel; text: string }

const LEVEL_COLORS: Record<LogLevel, { fg: string; bg: string; badge: string }> = {
  OUT: { fg: '#6EE7B7', bg: 'rgba(110,231,183,0.06)', badge: '#059669' },
  ERR: { fg: '#FCA5A5', bg: 'rgba(252,165,165,0.09)', badge: '#DC2626' },
  SYS: { fg: '#93C5FD', bg: 'rgba(147,197,253,0.07)', badge: '#2563EB' },
}

const MAX_LINES = 2000

export default function BackendLogs() {
  const [lines, setLines]           = useState<LogLine[]>([])
  const [filter, setFilter]         = useState<Filter>('ALL')
  const [search, setSearch]         = useState('')
  const [status, setStatus]         = useState<'connecting'|'connected'|'disconnected'|'error'>('disconnected')
  const [autoScroll, setAutoScroll] = useState(true)
  const [streamReady, setStreamReady] = useState(false)

  const wsRef          = useRef<WebSocket | null>(null)
  const counterRef     = useRef(0)
  const bottomRef      = useRef<HTMLDivElement>(null)
  const containerRef   = useRef<HTMLDivElement>(null)
  const reconnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const addLine = useCallback((level: LogLevel, text: string) => {
    const line: LogLine = { id: ++counterRef.current, time: fmtTime(), level, text }
    setLines(prev => {
      const next = [...prev, line]
      return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next
    })
  }, [])

  const connect = useCallback(() => {
    if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close() }
    const token = localStorage.getItem('access_token')
    if (!token) { setStatus('error'); addLine('SYS', '[AUTH ERROR] No access token. Please log in.'); return }
    const url = `${getWsBase()}/ws/admin/logs?token=${token}`
    setStatus('connecting')
    addLine('SYS', `Connecting to log stream…`)
    const ws = new WebSocket(url)
    wsRef.current = ws
    ws.onopen = () => { setStatus('connected') }
    ws.onmessage = (evt) => {
      const raw: string = evt.data
      if (raw === 'PONG') return
      if (raw === '[LOG_STREAM_READY]') {
        setStreamReady(true)
        addLine('SYS', '─── Live stream active — new lines appear in real-time ───')
        return
      }
      const level: LogLevel = raw.startsWith('[ERR]') ? 'ERR' : raw.startsWith('[OUT]') ? 'OUT' : 'SYS'
      const text = raw.replace(/^\[(OUT|ERR)\] /, '')
      addLine(level, text)
    }
    ws.onerror = () => { setStatus('error'); addLine('SYS', '[WS ERROR] Connection error. Retrying in 5s…') }
    ws.onclose = (evt) => {
      setStreamReady(false)
      if (evt.code === 4003) { setStatus('error'); addLine('SYS', '[AUTH] Admin access required.'); return }
      setStatus('disconnected')
      addLine('SYS', `[DISCONNECT] code=${evt.code}. Reconnecting in 5s…`)
      reconnTimerRef.current = setTimeout(connect, 5000)
    }
  }, [addLine])

  useEffect(() => { if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [lines, autoScroll])

  const handleScroll = () => {
    const el = containerRef.current
    if (!el) return
    setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 60)
  }

  useEffect(() => {
    const id = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send('PING')
    }, 25000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    connect()
    return () => {
      if (reconnTimerRef.current) clearTimeout(reconnTimerRef.current)
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close() }
    }
  }, [connect])

  const visible = lines.filter(l => {
    if (filter !== 'ALL' && l.level !== filter && l.level !== 'SYS') return false
    if (search.trim()) return l.text.toLowerCase().includes(search.toLowerCase())
    return true
  })

  const outCount = lines.filter(l => l.level === 'OUT').length
  const errCount = lines.filter(l => l.level === 'ERR').length

  const statusDot = { connecting: { color: '#F59E0B', label: 'Connecting…' }, connected: { color: '#10B981', label: 'Connected' }, disconnected: { color: '#94A3B8', label: 'Disconnected' }, error: { color: '#EF4444', label: 'Error' } }[status]

  return (
    <div style={{ padding: '24px 28px', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' }}>
      <PageHeader title="Backend Logs" subtitle="Real-time PM2 stdout + stderr stream" />

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {/* Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: '#1E293B', borderRadius: 20, flexShrink: 0 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusDot.color, boxShadow: status === 'connected' ? `0 0 7px ${statusDot.color}` : 'none' }} />
          <span style={{ fontSize: 12, color: '#CBD5E1', fontWeight: 600 }}>{statusDot.label}</span>
          {status === 'connected' && streamReady && <span style={{ fontSize: 10, color: '#6EE7B7', marginLeft: 2 }}>● LIVE</span>}
        </div>

        {/* Filter buttons */}
        {(['ALL', 'OUT', 'ERR'] as Filter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
            background: filter === f ? (f === 'ERR' ? '#DC2626' : f === 'OUT' ? '#059669' : '#3B82F6') : '#334155',
            color: 'white',
          }}>
            {f === 'ALL' ? `All (${lines.length})` : f === 'OUT' ? `stdout (${outCount})` : `stderr (${errCount})`}
          </button>
        ))}

        {/* Search */}
        <input type="text" placeholder="Search logs…" value={search} onChange={e => setSearch(e.target.value)} style={{
          flex: 1, minWidth: 160, padding: '5px 12px', background: '#1E293B',
          border: '1px solid #334155', borderRadius: 8, color: '#E2E8F0', fontSize: 13, outline: 'none',
        }} />

        {/* Clear */}
        <button onClick={() => { setLines([]); counterRef.current = 0 }}
          style={{ padding: '5px 14px', background: '#475569', border: 'none', borderRadius: 8, color: '#E2E8F0', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
          Clear
        </button>

        {/* Reconnect */}
        {status !== 'connected' && (
          <button onClick={() => { if (reconnTimerRef.current) clearTimeout(reconnTimerRef.current); connect() }}
            style={{ padding: '5px 14px', background: '#1D4ED8', border: 'none', borderRadius: 8, color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            ↻ Reconnect
          </button>
        )}

        {/* Resume scroll */}
        {!autoScroll && (
          <button onClick={() => { setAutoScroll(true); bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }}
            style={{ padding: '5px 12px', background: '#F59E0B', border: 'none', borderRadius: 8, color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
            ↓ Resume scroll
          </button>
        )}
      </div>

      {/* Terminal */}
      <div ref={containerRef} onScroll={handleScroll} style={{
        flex: 1, background: '#0F172A', borderRadius: 10, border: '1px solid #1E293B',
        overflow: 'auto', fontFamily: '"Cascadia Code","Fira Code","JetBrains Mono",Consolas,monospace',
        fontSize: 12, lineHeight: 1.65, padding: '10px 0',
      }}>
        {visible.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#475569' }}>
            {status === 'connecting' ? '⏳ Connecting to log stream…' : '— No log lines to display —'}
          </div>
        ) : (
          visible.map(l => {
            const col = LEVEL_COLORS[l.level]
            const isErr = l.level === 'ERR'
            const isSys = l.level === 'SYS'
            return (
              <div key={l.id} style={{
                display: 'flex', alignItems: 'flex-start',
                padding: '0.5px 0',
                background: isErr ? col.bg : isSys ? col.bg : 'transparent',
                borderLeft: isErr ? '3px solid #EF4444' : isSys ? '3px solid #3B82F6' : '3px solid transparent',
              }}>
                <span style={{ color: '#334155', padding: '0 8px', whiteSpace: 'nowrap', flexShrink: 0, fontSize: 11, userSelect: 'none' }}>{l.time}</span>
                <span style={{ color: col.badge, padding: '0 4px', fontWeight: 700, fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0, opacity: isSys ? 0 : 1, userSelect: 'none' }}>{l.level}</span>
                <span style={{ color: isSys ? col.fg : isErr ? col.fg : '#CBD5E1', paddingRight: 16, wordBreak: 'break-all', fontStyle: isSys ? 'italic' : 'normal' }}>
                  {search.trim() ? _highlight(l.text, search) : l.text}
                </span>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 11, color: '#475569' }}>
        <span>Showing <b style={{ color: '#94A3B8' }}>{visible.length}</b> / {lines.length} lines (max {MAX_LINES})</span>
        {errCount > 0 && <span style={{ color: '#FCA5A5' }}>⚠ {errCount} stderr line{errCount !== 1 ? 's' : ''}</span>}
      </div>
    </div>
  )
}

function _highlight(text: string, search: string): React.ReactNode {
  const idx = text.toLowerCase().indexOf(search.toLowerCase())
  if (idx === -1) return text
  return <>{text.slice(0, idx)}<mark style={{ background: '#FBBF24', color: '#000', borderRadius: 2, padding: '0 1px' }}>{text.slice(idx, idx + search.length)}</mark>{text.slice(idx + search.length)}</>
}
