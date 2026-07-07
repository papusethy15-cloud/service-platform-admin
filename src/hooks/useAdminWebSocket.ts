/**
 * useAdminWebSocket
 * ═════════════════
 * React hook that opens a persistent WebSocket connection to the
 * /ws/admin/assignments endpoint and dispatches incoming events to
 * registered listeners.
 *
 * Features
 * ────────
 *  • Auto-reconnect with exponential back-off (1 s → 2 → 4 → 8 → 16 s max)
 *  • Heartbeat PING every 30 s to keep connection alive through proxies/NAT
 *  • Singleton per page — multiple components call this hook but only ONE
 *    WebSocket is opened (connection is shared via a module-level ref)
 *  • Type-safe event subscription: subscribe(eventType, handler)
 *  • Connection status exposed: 'connecting' | 'connected' | 'disconnected'
 *
 * URL Strategy
 * ────────────
 *  VITE_API_URL  = "http://localhost:8000/api/v1"   (dev via .env.local)
 *  WS base       = "ws://localhost:8000"             (strip /api/v1 path)
 *  WS endpoint   = "ws://localhost:8000/ws/admin/assignments?token=…"
 *
 *  WebSocket endpoints are mounted WITHOUT the /api/v1 prefix in FastAPI
 *  (app.include_router(ws_router) — no prefix), so we must NOT carry the
 *  HTTP API path into the WS URL.
 */

import { useEffect, useCallback, useState } from 'react'
import { useAuthStore } from '@/store/authStore'

export type WSStatus = 'connecting' | 'connected' | 'disconnected'
export type WSHandler = (payload: any, event: WSMessage) => void

export interface WSMessage {
  type: string
  room: string | null
  payload: any
  timestamp: string
}

// ── module-level singleton ──────────────────────────────────────────────────
let _ws: WebSocket | null = null
let _listeners: Map<string, Set<WSHandler>> = new Map()
let _statusListeners: Set<(s: WSStatus) => void> = new Set()
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null
let _pingTimer: ReturnType<typeof setInterval> | null = null
let _backoff = 1000      // ms, doubles on each failed attempt
let _intentionalClose = false

/**
 * Build the WebSocket base URL from VITE_API_URL.
 *
 * VITE_API_URL is the HTTP REST base, e.g.:
 *   "http://localhost:8000/api/v1"   (dev)
 *   "https://api.bibekenterprises.com/api/v1"  (prod)
 *
 * We need ONLY the origin (scheme + host + port) with the protocol
 * switched to ws:// or wss://, because the WS endpoints live at
 * /ws/… (not /api/v1/ws/…).
 */
function _getWsBase(): string {
  const apiUrl = (import.meta as any).env?.VITE_API_URL as string | undefined
    ?? 'http://localhost:8000/api/v1'

  try {
    const parsed = new URL(apiUrl)
    // Use only origin (protocol + hostname + port), switch http→ws
    const wsProtocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${wsProtocol}//${parsed.host}`
  } catch {
    // Fallback: naive replace on the scheme only, strip any path
    return apiUrl.replace(/^https/, 'wss').replace(/^http/, 'ws').replace(/\/api\/v1.*$/, '')
  }
}

function _getWsUrl(token: string): string {
  return `${_getWsBase()}/ws/admin/assignments?token=${token}`
}

function _notifyStatus(s: WSStatus) {
  _statusListeners.forEach(fn => fn(s))
}

function _dispatch(msg: WSMessage) {
  const handlers = _listeners.get(msg.type)
  if (handlers) handlers.forEach(fn => fn(msg.payload, msg))
  // Also dispatch to wildcard listeners
  const wild = _listeners.get('*')
  if (wild) wild.forEach(fn => fn(msg.payload, msg))
}

function _startPing() {
  _stopPing()
  _pingTimer = setInterval(() => {
    if (_ws?.readyState === WebSocket.OPEN) {
      _ws.send(JSON.stringify({ type: 'PING' }))
    }
  }, 30_000)
}

function _stopPing() {
  if (_pingTimer) { clearInterval(_pingTimer); _pingTimer = null }
}

function _connect(token: string) {
  if (_ws && (_ws.readyState === WebSocket.OPEN || _ws.readyState === WebSocket.CONNECTING)) return

  _intentionalClose = false
  _notifyStatus('connecting')

  const url = _getWsUrl(token)
  console.debug('[WS] Connecting to', url)
  _ws = new WebSocket(url)

  _ws.onopen = () => {
    console.debug('[WS] Connected')
    _backoff = 1000
    _notifyStatus('connected')
    _startPing()
  }

  _ws.onmessage = (e) => {
    try {
      const msg: WSMessage = JSON.parse(e.data)
      if (msg.type === 'PONG') return   // heartbeat ack, ignore
      _dispatch(msg)
    } catch {}
  }

  _ws.onclose = (e) => {
    console.debug('[WS] Closed', e.code, e.reason)
    _stopPing()
    if (_intentionalClose) {
      _notifyStatus('disconnected')
      return
    }
    _notifyStatus('disconnected')
    // Exponential back-off reconnect
    const delay = Math.min(_backoff, 16_000)
    _backoff = Math.min(_backoff * 2, 16_000)
    _reconnectTimer = setTimeout(() => _connect(token), delay)
  }

  _ws.onerror = (e) => {
    console.warn('[WS] Error', e)
    _ws?.close()
  }
}

function _disconnect() {
  _intentionalClose = true
  _stopPing()
  if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null }
  _ws?.close()
  _ws = null
  _notifyStatus('disconnected')
}

// ── React hook ──────────────────────────────────────────────────────────────
let _hookRefCount = 0

export function useAdminWebSocket() {
  const token   = useAuthStore(s => s.token)
  const [status, setStatus] = useState<WSStatus>('disconnected')

  // Register this component's status listener
  useEffect(() => {
    const fn = (s: WSStatus) => setStatus(s)
    _statusListeners.add(fn)
    // sync current state
    if (_ws?.readyState === WebSocket.OPEN) setStatus('connected')
    else if (_ws?.readyState === WebSocket.CONNECTING) setStatus('connecting')
    else setStatus('disconnected')
    return () => { _statusListeners.delete(fn) }
  }, [])

  // Connect / disconnect lifecycle
  useEffect(() => {
    if (!token) return
    _hookRefCount++
    _connect(token)
    return () => {
      _hookRefCount--
      if (_hookRefCount <= 0) {
        _hookRefCount = 0
        _disconnect()
      }
    }
  }, [token])

  // Stable subscribe function
  const subscribe = useCallback((eventType: string, handler: WSHandler): (() => void) => {
    if (!_listeners.has(eventType)) _listeners.set(eventType, new Set())
    _listeners.get(eventType)!.add(handler)
    return () => {
      _listeners.get(eventType)?.delete(handler)
    }
  }, [])

  return { status, subscribe }
}

// ── Booking-specific WS hook ────────────────────────────────────────────────
/**
 * useBookingWebSocket
 * ════════════════════
 * Opens a connection to /ws/booking/{bookingId} and returns a stream
 * of booking events for that specific booking.
 * Used by the AssignTechnicianModal and booking detail modal.
 */
export function useBookingWebSocket(bookingId: string | null) {
  const token = useAuthStore(s => s.token)
  const [status, setStatus] = useState<WSStatus>('disconnected')
  const [lastEvent, setLastEvent] = useState<WSMessage | null>(null)

  useEffect(() => {
    if (!bookingId || !token) return

    // Use the same origin-only base (strips /api/v1) — same fix as admin hook
    const url = `${_getWsBase()}/ws/booking/${bookingId}?token=${token}`
    console.debug('[WS:booking] Connecting to', url)

    let backoff = 1000
    let intentionalClose = false
    let reconnTimer: ReturnType<typeof setTimeout> | null = null
    let pingTimer: ReturnType<typeof setInterval> | null = null
    let ws: WebSocket | null = null

    function connect() {
      if (ws?.readyState === WebSocket.OPEN) return
      setStatus('connecting')
      ws = new WebSocket(url)

      ws.onopen = () => {
        console.debug('[WS:booking] Connected', bookingId)
        backoff = 1000
        setStatus('connected')
        pingTimer = setInterval(() => {
          ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: 'PING' }))
        }, 30_000)
      }

      ws.onmessage = (e) => {
        try {
          const msg: WSMessage = JSON.parse(e.data)
          if (msg.type !== 'PONG' && msg.type !== 'CONNECTED') {
            setLastEvent(msg)
          }
        } catch {}
      }

      ws.onclose = () => {
        if (pingTimer) { clearInterval(pingTimer); pingTimer = null }
        setStatus('disconnected')
        if (!intentionalClose) {
          reconnTimer = setTimeout(connect, Math.min(backoff, 16_000))
          backoff = Math.min(backoff * 2, 16_000)
        }
      }

      ws.onerror = () => ws?.close()
    }

    connect()

    return () => {
      intentionalClose = true
      if (pingTimer) clearInterval(pingTimer)
      if (reconnTimer) clearTimeout(reconnTimer)
      ws?.close()
      ws = null
    }
  }, [bookingId, token])

  return { status, lastEvent }
}
