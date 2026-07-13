import { useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'
import { usePlatformStore } from '@/store/platformStore'
import { useAdminWebSocket } from '@/hooks/useAdminWebSocket'
import { useAdminNotifications } from '@/hooks/useAdminNotifications'

// ── All searchable pages ──────────────────────────────────────────────────────
const ALL_PAGES = [
  { to: '/',                   icon: '📊', label: 'Dashboard',          keywords: 'home overview analytics summary' },
  { to: '/bookings',           icon: '📋', label: 'Bookings',           keywords: 'orders jobs service requests schedule' },
  { to: '/dispatch',           icon: '🚀', label: 'Dispatch Monitor',   keywords: 'live track assign monitor real-time' },
  { to: '/quotations',         icon: '📄', label: 'Quotations',         keywords: 'quote estimate price proposal' },
  { to: '/invoices',           icon: '🧾', label: 'Invoices',           keywords: 'bill receipt tax gst payment' },
  { to: '/payments',           icon: '💳', label: 'Payments',           keywords: 'collect money transaction razorpay' },
  { to: '/refunds',            icon: '↩️',  label: 'Refunds',            keywords: 'return cancel reversal credit' },
  { to: '/escalations',        icon: '⚠️',  label: 'Escalations',        keywords: 'complaint urgent priority flag' },
  { to: '/domains',            icon: '🌐', label: 'Domains',            keywords: 'brand tenant enterprise organisation' },
  { to: '/services',           icon: '⚙️',  label: 'Services',           keywords: 'catalogue repair ac washing plumbing' },
  { to: '/cities',             icon: '🏙️', label: 'Cities & Areas',     keywords: 'location zone area pincode coverage' },
  { to: '/coupons',            icon: '🎟️', label: 'Coupons',            keywords: 'discount promo code offer voucher' },
  { to: '/customers',          icon: '👥', label: 'Customers',          keywords: 'clients users people contact profile' },
  { to: '/technicians',        icon: '🔧', label: 'Technicians',        keywords: 'captain staff engineer field worker' },
  { to: '/attendance',         icon: '🗓️', label: 'Attendance',         keywords: 'check-in check-out shift presence' },
  { to: '/commissions',        icon: '💰', label: 'Commissions',        keywords: 'earnings payout incentive revenue share' },
  { to: '/cash-collections',   icon: '💵', label: 'Cash Collections',   keywords: 'cash collect handover payment' },
  { to: '/commission-groups',  icon: '📋', label: 'Commission Groups',  keywords: 'group tier slab incentive structure' },
  { to: '/wallet',             icon: '👛', label: 'Wallet',             keywords: 'balance credit debit ledger' },
  { to: '/withdrawals',        icon: '💸', label: 'Withdrawals',        keywords: 'payout withdraw transfer bank' },
  { to: '/settlements',        icon: '🏦', label: 'Settlements',        keywords: 'settle close balance clear dues' },
  { to: '/amc',                icon: '🔄', label: 'AMC',                keywords: 'annual maintenance contract subscription plan' },
  { to: '/warranty',           icon: '🛡️', label: 'Warranty',           keywords: 'guarantee period service claim' },
  { to: '/inventory',          icon: '📦', label: 'Inventory',          keywords: 'stock parts items warehouse store' },
  { to: '/appliances',         icon: '🏠', label: 'Appliances',         keywords: 'machine device equipment catalogue' },
  { to: '/franchises',         icon: '🏪', label: 'Franchises',         keywords: 'partner franchise branch outlet' },
  { to: '/callback-requests',  icon: '📞', label: 'Callback Requests',  keywords: 'call back enquiry lead contact' },
  { to: '/users',              icon: '👤', label: 'Admin Users',        keywords: 'staff cco admin role permission account' },
  { to: '/notifications',      icon: '🔔', label: 'Notifications',      keywords: 'alerts messages push email sms' },
  { to: '/reports',            icon: '📈', label: 'Reports',            keywords: 'analytics export data revenue summary chart' },
  { to: '/audit',              icon: '📜', label: 'Audit Logs',         keywords: 'history log activity trail change track' },
  { to: '/settings',           icon: '⚙️',  label: 'Settings',           keywords: 'config platform branding gst mpin api keys' },
]

const ROUTE_LABELS: Record<string, string> = Object.fromEntries(ALL_PAGES.map(p => [p.to, p.label]))

const NOTIF_COLOR: Record<string, string> = {
  BOOKING_CREATED:             '#1B4FD8',
  BOOKING_NEEDS_MANUAL_ASSIGN: '#DC2626',
  ASSIGNMENT_CREATED:          '#7C3AED',
  ASSIGNMENT_ACCEPTED:         '#059669',
  ASSIGNMENT_REJECTED:         '#DC2626',
  ASSIGNMENT_AUTO_CANCELLED:   '#D97706',
  QUOTATION_SUBMITTED:         '#0369A1',
  QUOTATION_CREATED:           '#64748B',
  PAYMENT_COLLECTED:           '#059669',
  BOOKING_STATUS_CHANGED:      '#475569',
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60)   return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

// ── Search box ────────────────────────────────────────────────────────────────
function SearchBox() {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState<typeof ALL_PAGES>([])
  const [focused, setFocused]   = useState(false)
  const [hiIdx, setHiIdx]       = useState(0)
  const navigate                = useNavigate()
  const inputRef                = useRef<HTMLInputElement>(null)
  const boxRef                  = useRef<HTMLDivElement>(null)

  const search = useCallback((q: string) => {
    const t = q.trim().toLowerCase()
    if (!t) { setResults([]); return }
    const hits = ALL_PAGES.filter(p =>
      p.label.toLowerCase().includes(t) ||
      p.keywords.toLowerCase().includes(t)
    ).slice(0, 7)
    setResults(hits)
    setHiIdx(0)
  }, [])

  useEffect(() => { search(query) }, [query, search])

  // Global shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setFocused(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const go = (to: string) => {
    navigate(to)
    setQuery('')
    setResults([])
    setFocused(false)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!results.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHiIdx(i => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHiIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter')     { e.preventDefault(); go(results[hiIdx].to) }
    if (e.key === 'Escape')    { setQuery(''); setFocused(false) }
  }

  const showDropdown = focused && results.length > 0

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <span style={{ position: 'absolute', left: 10, color: '#94A3B8', fontSize: 14, pointerEvents: 'none' }}>🔍</span>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={onKeyDown}
          placeholder="Search pages… (Ctrl+K)"
          style={{
            width: 220, paddingLeft: 32, paddingRight: 36,
            padding: '6px 36px 6px 32px',
            fontSize: 13, borderRadius: 8, outline: 'none',
            border: focused ? '1.5px solid #1B4FD8' : '1.5px solid #E2E8F0',
            background: '#F8FAFC', color: '#0F172A',
            transition: 'border-color 0.15s, width 0.2s',
            boxSizing: 'border-box',
          }}
        />
        {query && (
          <button onClick={() => { setQuery(''); inputRef.current?.focus() }}
            style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 13, lineHeight: 1, padding: 2 }}>
            ✕
          </button>
        )}
        {!query && (
          <kbd style={{ position: 'absolute', right: 8, fontSize: 9, color: '#CBD5E1', background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 4, padding: '1px 4px', fontFamily: 'monospace', pointerEvents: 'none' }}>
            ⌘K
          </kbd>
        )}
      </div>

      {showDropdown && (
        <div style={{
          position: 'absolute', top: 38, left: 0,
          width: 280, background: '#fff', borderRadius: 10,
          border: '1px solid #E2E8F0',
          boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
          zIndex: 300, overflow: 'hidden',
        }}>
          {results.map((p, idx) => (
            <div key={p.to} onMouseDown={() => go(p.to)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 14px', cursor: 'pointer',
                background: idx === hiIdx ? '#EFF6FF' : '#fff',
                borderBottom: idx < results.length - 1 ? '1px solid #F8FAFC' : 'none',
                transition: 'background 0.1s',
              }}
              onMouseEnter={() => setHiIdx(idx)}
            >
              <span style={{ fontSize: 15 }}>{p.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: idx === hiIdx ? '#1B4FD8' : '#0F172A' }}>{p.label}</span>
            </div>
          ))}
          <div style={{ padding: '6px 14px', fontSize: 10, color: '#94A3B8', borderTop: '1px solid #F1F5F9', background: '#FAFAFA' }}>
            ↑↓ navigate · Enter open · Esc close
          </div>
        </div>
      )}
    </div>
  )
}

// ── Profile dropdown ──────────────────────────────────────────────────────────
function ProfileDropdown({ user }: { user: any }) {
  const [open, setOpen]   = useState(false)
  const ref               = useRef<HTMLDivElement>(null)
  const navigate          = useNavigate()
  const { logout }        = useAuthStore()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = () => {
    setOpen(false)
    logout()
    navigate('/login')
  }

  const roleBg: Record<string, string> = {
    SUPER_ADMIN: 'linear-gradient(135deg,#7C3AED,#1B4FD8)',
    ADMIN:       'linear-gradient(135deg,#1B4FD8,#0891B2)',
    CCO:         'linear-gradient(135deg,#0891B2,#059669)',
    default:     'linear-gradient(135deg,#475569,#334155)',
  }
  const gradient = roleBg[user?.role] || roleBg.default

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(p => !p)}
        style={{
          display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer',
          background: open ? '#F1F5F9' : 'none',
          border: 'none', borderRadius: 10, padding: '4px 8px 4px 4px',
          transition: 'background 0.15s',
        }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: gradient,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0,
        }}>
          {(user?.name || 'A').charAt(0).toUpperCase()}
        </div>
        <div style={{ lineHeight: 1.3, textAlign: 'left' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{user?.name || 'Admin'}</div>
          <div style={{ fontSize: 10, color: '#94A3B8' }}>{user?.role || 'ADMIN'}</div>
        </div>
        <span style={{ fontSize: 10, color: '#CBD5E1', marginLeft: 2, transition: 'transform 0.15s', display: 'inline-block', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute', top: 46, right: 0,
          width: 220, background: '#fff', borderRadius: 12,
          border: '1px solid #E2E8F0',
          boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
          zIndex: 300, overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ padding: '14px 16px', background: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, fontWeight: 700, flexShrink: 0 }}>
                {(user?.name || 'A').charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{user?.name || 'Admin'}</div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{user?.role || 'ADMIN'}</div>
              </div>
            </div>
          </div>

          {/* Menu items */}
          <div style={{ padding: '6px 0' }}>
            <button
              onClick={() => { setOpen(false); navigate('/settings') }}
              style={{ width: '100%', textAlign: 'left', padding: '9px 16px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#374151', fontWeight: 500 }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <span>⚙️</span> Settings
            </button>
            <button
              onClick={() => { setOpen(false); navigate('/users') }}
              style={{ width: '100%', textAlign: 'left', padding: '9px 16px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#374151', fontWeight: 500 }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <span>👤</span> Manage Users
            </button>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: '#F1F5F9' }} />

          {/* Logout */}
          <div style={{ padding: '6px 0 4px' }}>
            <button
              onClick={handleLogout}
              style={{ width: '100%', textAlign: 'left', padding: '9px 16px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#DC2626', fontWeight: 600 }}
              onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <span>🚪</span> Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Topbar ───────────────────────────────────────────────────────────────
export default function Topbar() {
  const location = useLocation()
  const navigate  = useNavigate()
  const { user }  = useAuthStore()
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

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (bellOpen && unread > 0) setTimeout(markAllRead, 800)
  }, [bellOpen, unread, markAllRead])

  return (
    <header style={{
      height: 54, background: '#fff', borderBottom: '1px solid #E2E8F0',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', flexShrink: 0, position: 'sticky', top: 0, zIndex: 30,
    }}>
      {/* Left: Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: '#94A3B8' }}>{settings.app_name || 'Palei Solutions'}</span>
        <span style={{ color: '#CBD5E1', fontSize: 14 }}>/</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{label}</span>
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>

        {/* Search */}
        <SearchBox />

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

        {/* Notification Bell */}
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
              <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>
                  Notifications
                  {notifications.length > 0 && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, color: '#94A3B8' }}>({notifications.length})</span>}
                </div>
                {notifications.length > 0 && (
                  <button onClick={clear} style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>Clear all</button>
                )}
              </div>

              {permission !== 'granted' && (
                <div style={{ padding: '10px 16px', background: permission === 'denied' ? '#FEF2F2' : '#FFF7ED', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16 }}>{permission === 'denied' ? '🔕' : '🔔'}</span>
                  <div style={{ flex: 1 }}>
                    {permission === 'denied' ? (
                      <div style={{ fontSize: 12, color: '#DC2626', fontWeight: 600 }}>Browser notifications blocked. Enable in browser site settings.</div>
                    ) : (
                      <>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#92400E' }}>Enable browser notifications for background alerts.</div>
                        <button onClick={requestPermission} style={{ marginTop: 5, padding: '4px 12px', background: '#D97706', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Enable Notifications</button>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div style={{ overflowY: 'auto', flex: 1 }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '40px 16px', textAlign: 'center', color: '#94A3B8' }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>🔔</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>No notifications yet</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>Events will appear here in real time</div>
                  </div>
                ) : notifications.map(n => (
                  <div key={n.id}
                    onClick={() => { markRead(n.id); if (n.bookingId) { setBellOpen(false); navigate('/bookings') } }}
                    style={{ padding: '12px 16px', borderBottom: '1px solid #F8FAFC', cursor: n.bookingId ? 'pointer' : 'default', background: n.read ? '#fff' : '#F8FAFF', display: 'flex', gap: 10, alignItems: 'flex-start', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                    onMouseLeave={e => (e.currentTarget.style.background = n.read ? '#fff' : '#F8FAFF')}
                  >
                    <div style={{ width: 3, borderRadius: 4, flexShrink: 0, alignSelf: 'stretch', background: NOTIF_COLOR[n.type] || '#94A3B8', minHeight: 36 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: n.read ? 600 : 700, color: '#0F172A', marginBottom: 2 }}>{n.title}</div>
                      <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.4 }}>{n.body}</div>
                      <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>{timeAgo(n.ts)}</div>
                    </div>
                    {!n.read && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#1B4FD8', flexShrink: 0, marginTop: 5 }} />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Profile dropdown */}
        <ProfileDropdown user={user} />
      </div>
    </header>
  )
}
