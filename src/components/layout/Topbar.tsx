import { useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { usePlatformStore } from '@/store/platformStore'
import { useAdminWebSocket } from '@/hooks/useAdminWebSocket'
import { useAdminNotifications } from '@/hooks/useAdminNotifications'

const ROUTE_LABELS: Record<string, string> = {
  '/': 'Dashboard', '/bookings': 'Bookings', '/quotations': 'Quotations',
  '/invoices': 'Invoices', '/payments': 'Payments', '/refunds': 'Refunds',
  '/escalations': 'Escalations', '/domains': 'Domains', '/services': 'Services',
  '/cities': 'Cities & Areas', '/coupons': 'Coupons', '/customers': 'Customers',
  '/technicians': 'Technicians', '/attendance': 'Attendance', '/commissions': 'Commissions',
  '/wallet': 'Wallet', '/amc': 'AMC Plans', '/warranty': 'Warranty',
  '/inventory': 'Inventory', '/franchises': 'Franchises', '/users': 'Admin Users',
  '/notifications': 'Notifications', '/reports': 'Reports', '/audit': 'Audit Logs',
  '/settings': 'Settings',
}

// Notification type → accent colour
const NOTIF_COLOR: Record<string, string> = {
  BOOKING_CREATED:           '#1B4FD8',
  BOOKING_NEEDS_MANUAL_ASSIGN: '#DC2626',
  ASSIGNMENT_CREATED:        '#7C3AED',
  ASSIGNMENT_ACCEPTED:       '#059669',
  ASSIGNMENT_REJECTED:       '#DC2626',
  ASSIGNMENT_AUTO_CANCELLED: '#D97706',
  QUOTATION_SUBMITTED:       '#0369A1',
  QUOTATION_CREATED:         '#64748B',
  PAYMENT_COLLECTED:         '#059669',
  BOOKING_STATUS_CHANGED:    '#475569',
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60)  return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

export default function Topbar() {
  const location = useLocation()
  const navigate  = useNavigate()
  const { user, logout } = useAuthStore()
  const { settings } = usePlatformStore()
  const label = ROUTE_LABELS[location.pathname] || 'Admin'
  const { status: wsStatus } = useAdminWebSocket()

  const {
    notifications, unread,
    permission, requestPermission,
    markAllRead, markRead, clear,
  } = useAdminNotifications()

  const [bellOpen, setBellOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)

  // Close bell dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Mark all read when dropdown opens
  useEffect(() => {
    if (bellOpen && unread > 0) {
      setTimeout(markAllRead, 800)
    }
  }, [bellOpen, unread, markAllRead])

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <header style={{
      height: 54, background: '#fff', borderBottom: '1px solid #E2E8F0',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', flexShrink: 0, position: 'sticky', top: 0, zIndex: 30,
    }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: '#94A3B8' }}>{settings.app_name || 'Palei Solutions'}</span>
        <span style={{ color: '#CBD5E1', fontSize: 14 }}>/</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{label}</span>
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>

        {/* WebSocket status pill */}
        <div title={`WebSocket: ${wsStatus}`} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '3px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700,
          background: wsStatus === 'connected' ? '#F0FDF4' : wsStatus === 'connecting' ? '#FFF7ED' : '#FEF2F2',
          color:      wsStatus === 'connected' ? '#166534' : wsStatus === 'connecting' ? '#C2410C' : '#DC2626',
          border: `1px solid ${wsStatus === 'connected' ? '#86EFAC' : wsStatus === 'connecting' ? '#FED7AA' : '#FECACA'}`,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: wsStatus === 'connected' ? '#22C55E' : wsStatus === 'connecting' ? '#F59E0B' : '#EF4444',
            display: 'inline-block',
          }} />
          {wsStatus === 'connected' ? 'Live' : wsStatus === 'connecting' ? 'Connecting…' : 'Offline'}
        </div>

        {/* ── Notification Bell ─────────────────────────────────────── */}
        <div ref={bellRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setBellOpen(p => !p)}
            style={{
              background: bellOpen ? '#F1F5F9' : 'none',
              border: 'none', cursor: 'pointer',
              padding: '6px 8px', borderRadius: 8,
              color: '#374151', fontSize: 18,
              display: 'flex', alignItems: 'center',
              position: 'relative', transition: 'background 0.15s',
            }}
            title="Notifications"
          >
            🔔
            {unread > 0 && (
              <span style={{
                position: 'absolute', top: 2, right: 2,
                width: 16, height: 16, borderRadius: '50%',
                background: '#DC2626', color: '#fff',
                fontSize: 9, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid #fff', lineHeight: 1,
              }}>
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {/* ── Dropdown ── */}
          {bellOpen && (
            <div style={{
              position: 'absolute', top: 42, right: 0,
              width: 360, maxHeight: 520,
              background: '#fff', borderRadius: 14,
              border: '1px solid #E2E8F0',
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              zIndex: 200, overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
            }}>
              {/* Header */}
              <div style={{
                padding: '14px 16px 10px',
                borderBottom: '1px solid #F1F5F9',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>
                  Notifications
                  {notifications.length > 0 && (
                    <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, color: '#94A3B8' }}>
                      ({notifications.length})
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {notifications.length > 0 && (
                    <button
                      onClick={clear}
                      style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
                    >
                      Clear all
                    </button>
                  )}
                </div>
              </div>

              {/* Permission prompt */}
              {permission !== 'granted' && (
                <div style={{
                  padding: '10px 16px',
                  background: permission === 'denied' ? '#FEF2F2' : '#FFF7ED',
                  borderBottom: '1px solid #F1F5F9',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ fontSize: 16 }}>{permission === 'denied' ? '🔕' : '🔔'}</span>
                  <div style={{ flex: 1 }}>
                    {permission === 'denied' ? (
                      <div style={{ fontSize: 12, color: '#DC2626', fontWeight: 600 }}>
                        Browser notifications blocked. Enable in browser site settings to receive alerts.
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#92400E' }}>
                          Enable browser notifications to get alerts even when the tab is in the background.
                        </div>
                        <button
                          onClick={requestPermission}
                          style={{
                            marginTop: 5, padding: '4px 12px',
                            background: '#D97706', color: '#fff', border: 'none',
                            borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                          }}
                        >
                          Enable Notifications
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* List */}
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '40px 16px', textAlign: 'center', color: '#94A3B8' }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>🔔</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>No notifications yet</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>Events will appear here in real time</div>
                  </div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => {
                        markRead(n.id)
                        if (n.bookingId) {
                          setBellOpen(false)
                          navigate('/bookings')
                        }
                      }}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #F8FAFC',
                        cursor: n.bookingId ? 'pointer' : 'default',
                        background: n.read ? '#fff' : '#F8FAFF',
                        display: 'flex', gap: 10, alignItems: 'flex-start',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                      onMouseLeave={e => (e.currentTarget.style.background = n.read ? '#fff' : '#F8FAFF')}
                    >
                      {/* Accent bar */}
                      <div style={{
                        width: 3, borderRadius: 4, flexShrink: 0, alignSelf: 'stretch',
                        background: NOTIF_COLOR[n.type] || '#94A3B8',
                        minHeight: 36,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: n.read ? 600 : 700, color: '#0F172A', marginBottom: 2 }}>
                          {n.title}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.4 }}>
                          {n.body}
                        </div>
                        <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>
                          {timeAgo(n.ts)}
                        </div>
                      </div>
                      {!n.read && (
                        <div style={{
                          width: 7, height: 7, borderRadius: '50%',
                          background: '#1B4FD8', flexShrink: 0, marginTop: 5,
                        }} />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}
          onClick={handleLogout} title="Click to logout">
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg,#1B4FD8,#7C3AED)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 13, fontWeight: 700,
          }}>
            {(user?.name || 'A').charAt(0).toUpperCase()}
          </div>
          <div style={{ lineHeight: 1.3 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{user?.name || 'Admin'}</div>
            <div style={{ fontSize: 11, color: '#94A3B8' }}>{user?.role || 'SUPER_ADMIN'}</div>
          </div>
          <span style={{ fontSize: 10, color: '#CBD5E1' }}>▼</span>
        </div>
      </div>
    </header>
  )
}
