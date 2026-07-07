/**
 * useAdminNotifications
 * ══════════════════════
 * Centralised notification system for the admin dashboard.
 *
 * • Subscribes to all relevant WS events via useAdminWebSocket
 * • Maintains an in-memory notification list (max 50, newest first)
 * • Plays notification.mp3 once per event (respects browser autoplay policy)
 * • Fires browser Notification API alerts when permission granted
 * • Exposes permission request helper + "notifications enabled" guard
 *
 * Events handled:
 *   BOOKING_CREATED            — customer booked from website
 *   BOOKING_STATUS_CHANGED     — any booking status update
 *   ASSIGNMENT_CREATED         — technician dispatched
 *   ASSIGNMENT_ACCEPTED        — technician accepted job
 *   ASSIGNMENT_REJECTED        — technician rejected job
 *   ASSIGNMENT_AUTO_CANCELLED  — auto-assignment timed out
 *   BOOKING_NEEDS_MANUAL_ASSIGN — auto-assign failed, needs manual
 *   QUOTATION_SUBMITTED        — technician submitted quotation for approval
 *   QUOTATION_CREATED          — new quotation created
 *   PAYMENT_COLLECTED          — payment received / settled
 */

import { useEffect, useCallback, useRef, useState } from 'react'
import { useAdminWebSocket } from './useAdminWebSocket'

export interface AdminNotification {
  id:        string
  type:      string
  title:     string
  body:      string
  ts:        number
  read:      boolean
  bookingId?: string
  bookingNumber?: string
}

// ── singleton state so all hook consumers share the same list ─────────────────
let _notifications: AdminNotification[] = []
let _unread = 0
const _listeners: Set<() => void> = new Set()

function _notify() { _listeners.forEach(fn => fn()) }

function _push(n: Omit<AdminNotification, 'id' | 'ts' | 'read'>) {
  const notif: AdminNotification = { ...n, id: `${Date.now()}-${Math.random()}`, ts: Date.now(), read: false }
  _notifications = [notif, ..._notifications].slice(0, 50)
  _unread = _notifications.filter(x => !x.read).length
  _notify()
  return notif
}

// ── Audio singleton ────────────────────────────────────────────────────────────
let _audio: HTMLAudioElement | null = null
function _getAudio(): HTMLAudioElement {
  if (!_audio) {
    _audio = new Audio('/notification.mp3')
    _audio.preload = 'auto'
  }
  return _audio
}

function _playSound() {
  try {
    const a = _getAudio()
    a.currentTime = 0
    a.play().catch(() => {
      // Autoplay blocked — silently ignore; user will see visual notification
    })
  } catch {}
}

// ── Event → notification mapping ──────────────────────────────────────────────
function _mapEvent(type: string, payload: any): Omit<AdminNotification, 'id' | 'ts' | 'read'> | null {
  const bn = payload?.booking_number || payload?.bookingNumber || ''
  const bId = payload?.booking_id || payload?.bookingId || ''

  switch (type) {
    case 'BOOKING_CREATED':
      return {
        type,
        title: '📥 New Booking',
        body: `${payload?.customer_name || 'A customer'} booked "${payload?.service_name || 'a service'}"${bn ? ` — #${bn}` : ''}`,
        bookingId: bId, bookingNumber: bn,
      }

    case 'BOOKING_NEEDS_MANUAL_ASSIGN':
      return {
        type,
        title: '⚠️ Manual Assignment Needed',
        body: `Booking #${bn} could not be auto-assigned. Please assign a technician.`,
        bookingId: bId, bookingNumber: bn,
      }

    case 'ASSIGNMENT_CREATED':
      return {
        type,
        title: '👷 Technician Dispatched',
        body: `Booking #${bn}: ${payload?.technician_name || 'Technician'} has been assigned.`,
        bookingId: bId, bookingNumber: bn,
      }

    case 'ASSIGNMENT_ACCEPTED':
      return {
        type,
        title: '✅ Job Accepted',
        body: `Booking #${bn}: Technician accepted the assignment.`,
        bookingId: bId, bookingNumber: bn,
      }

    case 'ASSIGNMENT_REJECTED':
      return {
        type,
        title: '❌ Job Rejected',
        body: `Booking #${bn}: Technician rejected the assignment. Re-dispatching…`,
        bookingId: bId, bookingNumber: bn,
      }

    case 'ASSIGNMENT_AUTO_CANCELLED':
      return {
        type,
        title: '⏱️ Assignment Timed Out',
        body: `Booking #${bn}: No technician responded in time.`,
        bookingId: bId, bookingNumber: bn,
      }

    case 'QUOTATION_SUBMITTED':
      return {
        type,
        title: '📋 Quotation Awaiting Approval',
        body: `${payload?.submitted_by || 'Technician'} submitted a quotation${bn ? ` for #${bn}` : ''}.`,
        bookingId: bId, bookingNumber: bn,
      }

    case 'QUOTATION_CREATED':
      return {
        type,
        title: '📄 Quotation Created',
        body: `A new quotation was created${bn ? ` for booking #${bn}` : ''}.`,
        bookingId: bId, bookingNumber: bn,
      }

    case 'PAYMENT_COLLECTED':
      return {
        type,
        title: '💰 Payment Collected',
        body: `Payment received${bn ? ` for booking #${bn}` : ''}${payload?.amount ? ` — ₹${Number(payload.amount).toLocaleString('en-IN')}` : ''}.`,
        bookingId: bId, bookingNumber: bn,
      }

    case 'BOOKING_STATUS_CHANGED':
      // Only surface key status transitions — suppress noise
      const s = payload?.status || payload?.new_status || ''
      const NOISY = ['CONFIRMED', 'ASSIGNED', 'ACCEPTED']
      if (!NOISY.includes(s)) return null
      return {
        type,
        title: `🔄 Booking ${s}`,
        body: `Booking #${bn} is now ${s}.`,
        bookingId: bId, bookingNumber: bn,
      }

    default:
      return null
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAdminNotifications() {
  const { subscribe } = useAdminWebSocket()
  const [, forceUpdate] = useState(0)
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  )

  // Subscribe to re-renders when notifications change
  useEffect(() => {
    const fn = () => forceUpdate(n => n + 1)
    _listeners.add(fn)
    return () => { _listeners.delete(fn) }
  }, [])

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return
    const result = await Notification.requestPermission()
    setPermission(result)
  }, [])

  // Subscribe to all WS events
  useEffect(() => {
    const EVENTS = [
      'BOOKING_CREATED',
      'BOOKING_NEEDS_MANUAL_ASSIGN',
      'ASSIGNMENT_CREATED',
      'ASSIGNMENT_ACCEPTED',
      'ASSIGNMENT_REJECTED',
      'ASSIGNMENT_AUTO_CANCELLED',
      'QUOTATION_SUBMITTED',
      'QUOTATION_CREATED',
      'PAYMENT_COLLECTED',
      'BOOKING_STATUS_CHANGED',
    ]

    const unsubs = EVENTS.map(eventType =>
      subscribe(eventType, (payload: any) => {
        const mapped = _mapEvent(eventType, payload)
        if (!mapped) return
        _push(mapped)
        _playSound()
        // Browser notification
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification(mapped.title, { body: mapped.body, icon: '/favicon.ico' })
        }
      })
    )

    return () => unsubs.forEach(u => u())
  }, [subscribe])

  const markAllRead = useCallback(() => {
    _notifications = _notifications.map(n => ({ ...n, read: true }))
    _unread = 0
    _notify()
  }, [])

  const markRead = useCallback((id: string) => {
    _notifications = _notifications.map(n => n.id === id ? { ...n, read: true } : n)
    _unread = _notifications.filter(x => !x.read).length
    _notify()
  }, [])

  const clear = useCallback(() => {
    _notifications = []
    _unread = 0
    _notify()
  }, [])

  return {
    notifications: _notifications,
    unread: _unread,
    permission,
    requestPermission,
    markAllRead,
    markRead,
    clear,
  }
}
