import { useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { usePlatformStore } from '@/store/platformStore'

// ── Nav structure ─────────────────────────────────────────────────────────────
// Each section has a label, icon, and children list.
// Items without children render as a direct link.
// Items with children render as a collapsible group.

type NavItem =
  | { kind: 'section'; label: string }
  | { kind: 'link'; to: string; icon: string; label: string }
  | { kind: 'group'; icon: string; label: string; id: string; children: { to: string; icon: string; label: string }[] }

const nav: NavItem[] = [
  // ── Overview ──────────────────────────────────────────────────────────────
  { kind: 'section', label: 'Overview' },
  { kind: 'link', to: '/',         icon: '📊', label: 'Dashboard' },

  // ── Operations ────────────────────────────────────────────────────────────
  { kind: 'section', label: 'Operations' },
  { kind: 'link', to: '/bookings',   icon: '📋', label: 'Bookings' },
  { kind: 'link', to: '/dispatch',   icon: '🚀', label: 'Dispatch Monitor' },
  { kind: 'link', to: '/quotations', icon: '📄', label: 'Quotations' },
  { kind: 'link', to: '/invoices',   icon: '🧾', label: 'Invoices' },
  { kind: 'link', to: '/escalations',icon: '⚠️', label: 'Escalations' },

  // ── Finance ───────────────────────────────────────────────────────────────
  { kind: 'section', label: 'Finance' },
  { kind: 'link', to: '/payments',             icon: '💳', label: 'Payments' },
  { kind: 'link', to: '/refunds',              icon: '↩️', label: 'Refunds' },
  { kind: 'link', to: '/razorpay-transactions',icon: '💰', label: 'Razorpay Txns' },
  { kind: 'link', to: '/cash-collections',     icon: '💵', label: 'Cash Collections' },
  { kind: 'link', to: '/wallet',               icon: '👛', label: 'Wallet' },
  { kind: 'link', to: '/withdrawals',          icon: '💸', label: 'Withdrawals' },
  { kind: 'link', to: '/settlements',          icon: '🏦', label: 'Settlements' },
  {
    kind: 'group', id: 'commissions', icon: '📊', label: 'Commissions',
    children: [
      { to: '/commissions',       icon: '💰', label: 'Commission List' },
      { to: '/commission-groups', icon: '📋', label: 'Commission Groups' },
    ],
  },

  // ── Catalog ───────────────────────────────────────────────────────────────
  { kind: 'section', label: 'Catalog' },
  { kind: 'link', to: '/domains',   icon: '🌐', label: 'Domains' },
  { kind: 'link', to: '/services',  icon: '⚙️', label: 'Services' },
  { kind: 'link', to: '/cities',    icon: '🏙️', label: 'Cities & Areas' },
  { kind: 'link', to: '/appliances',icon: '🏠', label: 'Appliances' },
  { kind: 'link', to: '/coupons',   icon: '🎟️', label: 'Coupons' },

  // ── People ────────────────────────────────────────────────────────────────
  { kind: 'section', label: 'People' },
  { kind: 'link', to: '/customers',   icon: '👥', label: 'Customers' },
  { kind: 'link', to: '/technicians', icon: '🔧', label: 'Technicians' },
  { kind: 'link', to: '/attendance',  icon: '🗓️', label: 'Attendance' },
  { kind: 'link', to: '/franchises',  icon: '🏪', label: 'Franchises' },

  // ── Products & Contracts ──────────────────────────────────────────────────
  { kind: 'section', label: 'Products' },
  { kind: 'link', to: '/amc',       icon: '🔄', label: 'AMC Plans' },
  { kind: 'link', to: '/warranty',  icon: '🛡️', label: 'Warranty' },
  { kind: 'link', to: '/inventory', icon: '📦', label: 'Inventory' },

  // ── CRM ───────────────────────────────────────────────────────────────────
  { kind: 'section', label: 'CRM' },
  { kind: 'link', to: '/callback-requests', icon: '📞', label: 'Callback Requests' },
  { kind: 'link', to: '/notifications',     icon: '🔔', label: 'Notifications' },

  // ── Reports ───────────────────────────────────────────────────────────────
  { kind: 'section', label: 'Reports' },
  { kind: 'link', to: '/reports',    icon: '📈', label: 'Reports' },
  { kind: 'link', to: '/gst-report', icon: '🧾', label: 'GST Reports' },
  { kind: 'link', to: '/audit',      icon: '📜', label: 'Audit Logs' },

  // ── System ────────────────────────────────────────────────────────────────
  { kind: 'section', label: 'System' },
  { kind: 'link', to: '/users',    icon: '👤', label: 'Admin Users' },
  { kind: 'link', to: '/settings', icon: '⚙️', label: 'Settings' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function isLinkActive(pathname: string, to: string) {
  return to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(to + '/')
}

// ── Styles ────────────────────────────────────────────────────────────────────
const linkBase: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '7px 10px', borderRadius: 7, textDecoration: 'none',
  fontSize: 13, marginBottom: 1, transition: 'all 0.12s',
  borderLeft: '2px solid transparent',
}
const linkActive: React.CSSProperties = {
  fontWeight: 600, color: '#fff',
  background: 'rgba(59,130,246,0.18)',
  borderLeft: '2px solid #3B82F6',
}
const linkIdle: React.CSSProperties = {
  fontWeight: 400, color: '#94A3B8',
}

// ── Sub-link (inside a group) ─────────────────────────────────────────────────
function SubLink({ to, icon, label, pathname }: { to: string; icon: string; label: string; pathname: string }) {
  const active = isLinkActive(pathname, to)
  return (
    <Link to={to} style={{
      ...linkBase,
      padding: '6px 10px 6px 28px',
      fontSize: 12,
      ...(active ? linkActive : linkIdle),
    }}>
      <span style={{ fontSize: 12 }}>{icon}</span>
      <span>{label}</span>
    </Link>
  )
}

// ── Collapsible group ─────────────────────────────────────────────────────────
function NavGroup({ item, pathname }: { item: Extract<NavItem, { kind: 'group' }>; pathname: string }) {
  const anyActive = item.children.some(c => isLinkActive(pathname, c.to))
  const [open, setOpen] = useState(anyActive)
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          ...linkBase,
          width: '100%', border: 'none', cursor: 'pointer', background: 'transparent',
          ...(anyActive ? { ...linkActive, background: 'transparent', borderLeft: '2px solid transparent' } : linkIdle),
          justifyContent: 'space-between',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>{item.icon}</span>
          <span>{item.label}</span>
        </span>
        <span style={{
          fontSize: 10, color: '#475569',
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.15s',
          display: 'inline-block',
        }}>▶</span>
      </button>
      {open && (
        <div style={{ marginBottom: 2 }}>
          {item.children.map(c => (
            <SubLink key={c.to} {...c} pathname={pathname} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
export default function Sidebar() {
  const { pathname } = useLocation()
  const { logout, user } = useAuthStore()
  const { settings } = usePlatformStore()

  return (
    <div style={{
      width: 224, minHeight: '100vh', background: '#0F1729', color: '#CBD5E1',
      display: 'flex', flexDirection: 'column',
      position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 40,
    }}>
      {/* ── Brand ── */}
      <div style={{
        padding: '14px 14px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        flexShrink: 0,
      }}>
        {settings.logo_url ? (
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 32, height: 32,
              background: settings.primary_color || '#1B4FD8',
              borderRadius: 8,
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

      {/* ── Nav (scrollable) ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 12px' }}>
        {nav.map((item, i) => {
          if (item.kind === 'section') {
            return (
              <div key={i} style={{
                fontSize: 10, fontWeight: 700, color: '#334155',
                padding: '14px 8px 4px', letterSpacing: '0.09em',
                textTransform: 'uppercase',
              }}>
                {item.label}
              </div>
            )
          }
          if (item.kind === 'group') {
            return <NavGroup key={item.id} item={item} pathname={pathname} />
          }
          // kind === 'link'
          const active = isLinkActive(pathname, item.to)
          return (
            <Link key={item.to} to={item.to} style={{
              ...linkBase,
              ...(active ? linkActive : linkIdle),
            }}>
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>

      {/* ── User footer ── */}
      <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'linear-gradient(135deg,#1B4FD8,#7C3AED)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0,
          }}>
            {(user?.name || 'A').charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontSize: 12, fontWeight: 600, color: '#E2E8F0',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {user?.name || 'Admin'}
            </div>
            <div style={{ fontSize: 10, color: '#475569' }}>{user?.role || 'SUPER_ADMIN'}</div>
          </div>
        </div>
        <button onClick={logout} style={{
          width: '100%', padding: '7px',
          background: 'rgba(255,255,255,0.06)',
          color: '#94A3B8',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 7, cursor: 'pointer', fontSize: 12,
        }}>
          Sign out
        </button>
      </div>
    </div>
  )
}
