import { useLocation, Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { usePlatformStore } from '@/store/platformStore'

const nav = [
  { section: 'OVERVIEW' },
  { to: '/',            icon: '📊', label: 'Dashboard' },
  { section: 'OPERATIONS' },
  { to: '/bookings',    icon: '📋', label: 'Bookings' },
  { to: '/dispatch',    icon: '🚀', label: 'Dispatch Monitor' },
  { to: '/quotations',  icon: '📄', label: 'Quotations' },
  { to: '/invoices',    icon: '🧾', label: 'Invoices' },
  { to: '/payments',    icon: '💳', label: 'Payments' },
  { to: '/razorpay-transactions', icon: '💳', label: 'Razorpay Txns' },
  { to: '/refunds',     icon: '↩️', label: 'Refunds' },
  { to: '/escalations', icon: '⚠️', label: 'Escalations' },
  { section: 'CATALOG' },
  { to: '/domains',     icon: '🌐', label: 'Domains' },
  { to: '/services',    icon: '⚙️', label: 'Services' },
  { to: '/cities',      icon: '🏙️', label: 'Cities & Areas' },
  { to: '/coupons',     icon: '🎟️', label: 'Coupons' },
  { section: 'PEOPLE' },
  { to: '/customers',   icon: '👥', label: 'Customers' },
  { to: '/technicians', icon: '🔧', label: 'Technicians' },
  { to: '/attendance',  icon: '🗓️', label: 'Attendance' },
  { to: '/commissions',       icon: '💰', label: 'Commissions' },
  { to: '/cash-collections',   icon: '💵', label: 'Cash Collections' },
  { to: '/commission-groups', icon: '📋', label: 'Commission Groups' },
  { to: '/wallet',      icon: '👛', label: 'Wallet' },
  { to: '/withdrawals',  icon: '💸', label: 'Withdrawals' },
  { to: '/settlements', icon: '🏦', label: 'Settlements' },
  { section: 'PRODUCTS' },
  { to: '/amc',         icon: '🔄', label: 'AMC' },
  { to: '/warranty',    icon: '🛡️', label: 'Warranty' },
  { to: '/inventory',   icon: '📦', label: 'Inventory' },
  { to: '/appliances',  icon: '🏠', label: 'Appliances' },
  { to: '/franchises',  icon: '🏪', label: 'Franchises' },
  { section: 'SYSTEM' },
  { to: '/callback-requests', icon: '📞', label: 'Callback Requests' },
  { to: '/users',         icon: '👤', label: 'Admin Users' },
  { to: '/notifications', icon: '🔔', label: 'Notifications' },
  { to: '/reports',       icon: '📈', label: 'Reports' },
  { to: '/gst-report',    icon: '🧾', label: 'GST Reports' },
  { to: '/audit',         icon: '📜', label: 'Audit Logs' },
  { to: '/settings',      icon: '⚙️', label: 'Settings' },
]

export default function Sidebar() {
  const { pathname } = useLocation()
  const { logout, user } = useAuthStore()
  const { settings } = usePlatformStore()

  const isActive = (to: string) =>
    to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(to + '/')

  return (
    <div style={{
      width: 220, minHeight: '100vh', background: '#0F1729', color: '#CBD5E1',
      display: 'flex', flexDirection: 'column',
      position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 40,
    }}>
      {/* Logo / Brand */}
      <div style={{ padding: '14px 14px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        {settings.logo_url ? (
          /* ── Logo image: full-width, name below ── */
          <div>
            <img
              src={settings.logo_url}
              alt={settings.app_name}
              style={{ display: 'block', height: 32, maxWidth: '100%', objectFit: 'contain', objectPosition: 'left center' }}
            />
            <div style={{ fontSize: 10, color: '#475569', marginTop: 5 }}>
              {settings.tagline || 'Management Console'}
            </div>
          </div>
        ) : (
          /* ── No logo: coloured initial + name inline ── */
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 32, height: 32, background: settings.primary_color || '#1B4FD8', borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 800, fontSize: 15, flexShrink: 0,
            }}>
              {(settings.app_name || 'P').charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontWeight: 700, fontSize: 13, color: '#fff',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {settings.app_name || 'Palei Admin'}
              </div>
              <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>
                {settings.tagline || 'Management Console'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Nav — scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
        {nav.map((item: any, i) =>
          item.section ? (
            <div key={i} style={{ fontSize: 10, fontWeight: 700, color: '#475569',
              padding: '12px 8px 4px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {item.section}
            </div>
          ) : (
            <Link key={item.to} to={item.to} style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '8px 10px', borderRadius: 7, textDecoration: 'none',
              fontSize: 13, marginBottom: 1,
              fontWeight: isActive(item.to) ? 600 : 400,
              color: isActive(item.to) ? '#fff' : '#94A3B8',
              background: isActive(item.to) ? 'rgba(59,130,246,0.2)' : 'transparent',
              borderLeft: isActive(item.to) ? '2px solid #3B82F6' : '2px solid transparent',
              transition: 'all 0.12s',
            }}>
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        )}
      </div>

      {/* User footer */}
      <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%',
            background: 'linear-gradient(135deg,#1B4FD8,#7C3AED)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
            {(user?.name || 'A').charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#E2E8F0',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name || 'Admin'}
            </div>
            <div style={{ fontSize: 10, color: '#475569' }}>{user?.role || 'SUPER_ADMIN'}</div>
          </div>
        </div>
        <button onClick={logout} style={{
          width: '100%', padding: '7px', background: 'rgba(255,255,255,0.06)',
          color: '#94A3B8', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 7, cursor: 'pointer', fontSize: 12,
        }}>Sign out</button>
      </div>
    </div>
  )
}
