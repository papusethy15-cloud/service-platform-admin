import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { usePlatformStore } from '@/store/platformStore'

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

export default function Topbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { settings } = usePlatformStore()
  const label = ROUTE_LABELS[location.pathname] || 'Admin'

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
        <button onClick={() => navigate('/notifications')} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: 6, color: '#64748B', fontSize: 18, display: 'flex', alignItems: 'center',
        }} title="Notifications">🔔</button>

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
