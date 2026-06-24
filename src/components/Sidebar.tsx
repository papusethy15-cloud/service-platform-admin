import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

const NAV_GROUPS = [
  {
    group: 'Overview',
    items: [
      { path: '/', icon: '⊞', label: 'Dashboard' },
    ]
  },
  {
    group: 'Operations',
    items: [
      { path: '/bookings',    icon: '📋', label: 'Bookings' },
      { path: '/quotations',  icon: '📝', label: 'Quotations' },
      { path: '/invoices',    icon: '🧾', label: 'Invoices' },
      { path: '/payments',    icon: '💳', label: 'Payments' },
      { path: '/refunds',     icon: '↩️', label: 'Refunds' },
      { path: '/escalations', icon: '🚨', label: 'Escalations' },
    ]
  },
  {
    group: 'Catalog',
    items: [
      { path: '/domains',   icon: '🌐', label: 'Domains' },
      { path: '/services',  icon: '⚙️',  label: 'Services' },
      { path: '/cities',    icon: '🏙️', label: 'Cities & Areas' },
      { path: '/coupons',   icon: '🎫', label: 'Coupons' },
    ]
  },
  {
    group: 'People',
    items: [
      { path: '/customers',   icon: '👥', label: 'Customers' },
      { path: '/technicians', icon: '🔧', label: 'Technicians' },
      { path: '/attendance',  icon: '🗓️', label: 'Attendance' },
      { path: '/commissions', icon: '💰', label: 'Commissions' },
      { path: '/wallet',      icon: '👛', label: 'Wallet' },
    ]
  },
  {
    group: 'Products',
    items: [
      { path: '/amc',       icon: '🔄', label: 'AMC' },
      { path: '/warranty',  icon: '🛡️', label: 'Warranty' },
      { path: '/inventory', icon: '📦', label: 'Inventory' },
      { path: '/franchises',icon: '🏪', label: 'Franchises' },
    ]
  },
  {
    group: 'System',
    items: [
      { path: '/users',         icon: '👤', label: 'Admin Users' },
      { path: '/callback-requests', icon: '📞', label: 'Callback Requests' },
      { path: '/notifications', icon: '🔔', label: 'Notifications' },
      { path: '/reports',       icon: '📊', label: 'Reports' },
      { path: '/audit',         icon: '📜', label: 'Audit Logs' },
      { path: '/settings',      icon: '⚙️', label: 'Settings' },
    ]
  },
]

export function Sidebar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  return (
    <aside style={{
      width: 220, minWidth: 220, background: '#0F1729', color: '#CBD5E1',
      display: 'flex', flexDirection: 'column', height: '100vh',
      position: 'sticky', top: 0, flexShrink: 0, overflowY: 'auto',
    }}>
      {/* Logo */}
      <div style={{ padding: '18px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 17, color: '#fff', letterSpacing: 0.3 }}>Palei Solutions</div>
        <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Admin Portal</div>
      </div>

      {/* Nav — scrollable */}
      <nav style={{ flex: 1, padding: '8px 0 16px', overflowY: 'auto' }}>
        {NAV_GROUPS.map(group => (
          <div key={group.group} style={{ marginBottom: 4 }}>
            <div style={{ padding: '10px 16px 4px', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {group.group}
            </div>
            {group.items.map(item => (
              <NavLink key={item.path} to={item.path} end={item.path === '/'}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '7px 14px 7px 16px', textDecoration: 'none',
                  fontSize: 13, fontWeight: isActive ? 600 : 400,
                  color: isActive ? '#fff' : '#94A3B8',
                  background: isActive ? 'rgba(27,79,216,0.35)' : 'transparent',
                  borderLeft: isActive ? '2px solid #3B82F6' : '2px solid transparent',
                  borderRadius: '0 6px 6px 0', marginRight: 8,
                  transition: 'all 0.12s',
                })}>
                <span style={{ fontSize: 15 }}>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#1B4FD8,#7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
            {(user?.name || 'A').charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#E2E8F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name || 'Admin'}</div>
            <div style={{ fontSize: 10, color: '#475569' }}>{user?.role || 'SUPER_ADMIN'}</div>
          </div>
        </div>
        <button onClick={() => { logout(); navigate('/login') }} style={{
          width: '100%', padding: '7px', background: 'rgba(255,255,255,0.06)',
          color: '#94A3B8', border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: 7, cursor: 'pointer', fontSize: 12, textAlign: 'center',
        }}>Sign out</button>
      </div>
    </aside>
  )
}
