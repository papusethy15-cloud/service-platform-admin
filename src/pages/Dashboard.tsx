import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { analyticsAPI } from '@/services/api'
import Spinner from '@/components/ui/Spinner'

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  n >= 100000
    ? `₹${(n / 100000).toFixed(1)}L`
    : n >= 1000
    ? `₹${(n / 1000).toFixed(1)}K`
    : `₹${n.toLocaleString('en-IN')}`

const fmtFull = (n: number) =>
  `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

const fmtDate = (d: string) => {
  const dt = new Date(d)
  return dt.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' })
}

const fmtDateTime = (d: string) => {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: '#F59E0B',
  CONFIRMED: '#3B82F6',
  ASSIGNED: '#8B5CF6',
  ACCEPTED: '#7C3AED',
  EN_ROUTE: '#06B6D4',
  ARRIVED: '#0284C7',
  INSPECTING: '#0EA5E9',
  IN_PROGRESS: '#0EA5E9',
  WORK_STARTED: '#0284C7',
  WORK_PAUSED: '#F97316',
  PENDING_VERIFICATION: '#D97706',
  TECHNICIAN_ACCEPTED: '#7C3AED',
  QUOTATION_APPROVED: '#059669',
  INVOICE_GENERATED: '#10B981',
  PAYMENT_PENDING: '#D97706',
  PAID: '#059669',
  COMPLETED: '#10B981',
  CLOSED: '#166534',
  SETTLED: '#15803D',
  CANCELLED: '#EF4444',
  RESCHEDULED: '#F97316',
  CANCELLATION_REQUESTED: '#DC2626',
  REFUND_INITIATED: '#7F1D1D',
  NO_SHOW: '#6B7280',
}

const CHART_COLORS = ['#1B4FD8', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4']

// ─── Sub-components ──────────────────────────────────────────────────────────
function KPICard({
  icon, label, value, sub, trend, trendUp, color, onClick,
}: {
  icon: string; label: string; value: string | number
  sub?: string; trend?: string; trendUp?: boolean; color: string; onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'white', borderRadius: 14, padding: '20px 22px',
        border: '1px solid #E2E8F0', cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.18s', position: 'relative', overflow: 'hidden',
      }}
      onMouseEnter={e => { if (onClick) (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}
    >
      {/* Accent bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: color, borderRadius: '14px 0 0 14px' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 20, background: `${color}15`,
        }}>{icon}</div>
        {trend && (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
            background: trendUp ? '#DCFCE7' : '#FEE2E2',
            color: trendUp ? '#166534' : '#991B1B',
          }}>
            {trendUp ? '↑' : '↓'} {trend}
          </span>
        )}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.5px', marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function SectionTitle({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{sub}</div>}
      </div>
      {action}
    </div>
  )
}

function StarRating({ rating }: { rating: number }) {
  const filled = Math.round(rating || 0)
  return (
    <span style={{ fontSize: 12 }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ color: i <= filled ? '#F59E0B' : '#CBD5E1' }}>★</span>
      ))}
      <span style={{ color: '#64748B', marginLeft: 4, fontSize: 11 }}>{(rating || 0).toFixed(1)}</span>
    </span>
  )
}

const CustomTooltipRevenue = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
      <div style={{ fontSize: 11, color: '#64748B', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#1B4FD8' }}>{fmtFull(payload[0]?.value)}</div>
      {payload[1] && <div style={{ fontSize: 12, color: '#10B981', marginTop: 2 }}>{payload[1].value} bookings</div>}
    </div>
  )
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const load = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true)
    try {
      const r = await analyticsAPI.dashboard()
      setData(r.data.data)
      setLastRefresh(new Date())
    } catch {}
    finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 2 minutes
  useEffect(() => {
    const t = setInterval(() => load(true), 120_000)
    return () => clearInterval(t)
  }, [load])

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 400, gap: 16 }}>
      <Spinner size="lg" />
      <div style={{ color: '#64748B', fontSize: 14 }}>Loading dashboard…</div>
    </div>
  )

  const d = data || {}
  const bk = d.bookings || {}
  const rev = d.revenue || {}
  const cust = d.customers || {}
  const tech = d.technicians || {}
  const charts = d.charts || {}
  const revenueChart: any[] = charts.revenue_last_30_days || []
  const statusChart = charts.booking_status || {}
  const monthlyTrend: any[] = charts.monthly_trend || []
  const topTechs: any[] = d.top_technicians || []
  const recentBk: any[] = d.recent_bookings || []

  // Pie data from status breakdown
  const pieData = Object.entries(statusChart)
    .map(([status, count]) => ({ name: status, value: count as number }))
    .filter(x => x.value > 0)
    .sort((a, b) => b.value - a.value)

  const monthGrowthUp = (rev.month_growth || 0) >= 0

  return (
    <div style={{ padding: '24px 28px', minHeight: '100vh', background: '#F8FAFC' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>Business Dashboard</h1>
          <div style={{ fontSize: 13, color: '#94A3B8' }}>
            Last updated: {lastRefresh.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
            {refreshing && <span style={{ marginLeft: 10, color: '#1B4FD8' }}>● Refreshing…</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => load(true)} disabled={refreshing}>
            🔄 Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/bookings')}>
            + New Booking
          </button>
        </div>
      </div>

      {/* ── Alert banner if escalations open ── */}
      {d.open_escalations > 0 && (
        <div
          onClick={() => navigate('/escalations')}
          style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
        >
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div>
            <span style={{ fontWeight: 700, color: '#DC2626', fontSize: 13 }}>{d.open_escalations} Open Escalation{d.open_escalations > 1 ? 's' : ''}</span>
            <span style={{ color: '#991B1B', fontSize: 12, marginLeft: 8 }}>— Click to review and resolve</span>
          </div>
        </div>
      )}

      {/* ── ROW 1: Revenue KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 18 }}>
        <KPICard
          icon="💰" label="Total Revenue" color="#10B981"
          value={fmt(rev.total || 0)} sub="All time, completed bookings"
        />
        <KPICard
          icon="📅" label="This Month" color="#1B4FD8"
          value={fmt(rev.this_month || 0)}
          trend={`${Math.abs(rev.month_growth || 0)}%`}
          trendUp={monthGrowthUp}
          sub={`vs ₹${((rev.prev_month || 0) / 1000).toFixed(1)}K last month`}
        />
        <KPICard
          icon="📆" label="This Week" color="#8B5CF6"
          value={fmt(rev.this_week || 0)} sub="Current week revenue"
        />
        <KPICard
          icon="☀️" label="Today" color="#F59E0B"
          value={fmt(rev.today || 0)} sub="Revenue collected today"
        />
      </div>

      {/* ── ROW 2: Booking KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <KPICard
          icon="📋" label="Total Bookings" color="#1B4FD8"
          value={bk.total || 0} sub={`${bk.total_completed || 0} completed`}
          onClick={() => navigate('/bookings')}
        />
        <KPICard
          icon="⏳" label="Pending" color="#F59E0B"
          value={bk.pending || 0} sub="Awaiting confirmation"
          onClick={() => navigate('/bookings?status=PENDING')}
        />
        <KPICard
          icon="🔧" label="In Progress" color="#0EA5E9"
          value={bk.in_progress || 0} sub={`${bk.confirmed || 0} confirmed · rest active`}
        />
        <KPICard
          icon="✅" label="Closed (Month)" color="#10B981"
          value={bk.completed_this_month || 0}
          sub={`${bk.completion_rate || 0}% overall closure rate`}
        />
      </div>

      {/* ── ROW 3: Customers + Technicians ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        <KPICard icon="👥" label="Total Customers" color="#10B981" value={cust.total || 0} sub={`+${cust.new_this_month || 0} this month`} onClick={() => navigate('/customers')} />
        <KPICard icon="🆕" label="New Today" color="#06B6D4" value={cust.new_today || 0} sub="New signups today" />
        <KPICard icon="🔧" label="Active Technicians" color="#8B5CF6" value={tech.active || 0} sub={`of ${tech.total || 0} total`} onClick={() => navigate('/technicians')} />
        <KPICard icon="📊" label="Today's Bookings" color="#F97316" value={bk.today || 0} sub={`${bk.this_week || 0} this week`} />
      </div>

      {/* ── ROW 4: Revenue Chart + Booking Status Pie ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18, marginBottom: 18 }}>

        {/* Revenue Area Chart */}
        <div className="card" style={{ padding: '20px 22px' }}>
          <SectionTitle
            title="Revenue — Last 30 Days"
            sub="Daily completed booking revenue"
            action={<a href="/reports" style={{ fontSize: 12, color: '#1B4FD8', textDecoration: 'none', fontWeight: 600 }}>Full Report →</a>}
          />
          {revenueChart.length === 0 ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 13 }}>No revenue data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={revenueChart} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1B4FD8" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#1B4FD8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} />
                <YAxis tickFormatter={v => fmt(v).replace('₹', '')} tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltipRevenue />} />
                <Area type="monotone" dataKey="revenue" stroke="#1B4FD8" strokeWidth={2} fill="url(#revGrad)" dot={false} activeDot={{ r: 4, fill: '#1B4FD8' }} />
                <Area type="monotone" dataKey="bookings" stroke="#10B981" strokeWidth={1.5} fill="none" dot={false} activeDot={{ r: 3, fill: '#10B981' }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Booking Status Pie */}
        <div className="card" style={{ padding: '20px 22px' }}>
          <SectionTitle title="Booking Status" sub="Last 30 days distribution" />
          {pieData.length === 0 ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 13 }}>No data yet</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={STATUS_COLOR[entry.name] || CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any, n: any) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6 }}>
                {pieData.slice(0, 5).map((entry, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[entry.name] || CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
                      <span style={{ color: '#64748B' }}>{entry.name.replace(/_/g, ' ')}</span>
                    </div>
                    <span style={{ fontWeight: 700, color: '#0F172A' }}>{entry.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── ROW 5: Monthly Trend Bar + Top Technicians ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 18, marginBottom: 18 }}>

        {/* Monthly Booking Trend */}
        <div className="card" style={{ padding: '20px 22px' }}>
          <SectionTitle title="Monthly Booking Trend" sub="Last 6 months — Total vs Completed" />
          {monthlyTrend.length === 0 ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 13 }}>No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyTrend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barSize={18} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 12 }}
                  cursor={{ fill: '#F1F5F9' }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="total" name="Total" fill="#DBEAFE" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" name="Completed" fill="#1B4FD8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top Technicians */}
        <div className="card" style={{ padding: '20px 22px' }}>
          <SectionTitle
            title="Top Technicians"
            sub="By total jobs"
            action={<a href="/technicians" style={{ fontSize: 12, color: '#1B4FD8', textDecoration: 'none', fontWeight: 600 }}>View All →</a>}
          />
          {topTechs.length === 0 ? (
            <div style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>No technicians found</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {topTechs.map((t: any, i: number) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%', background: i === 0 ? '#FEF3C7' : i === 1 ? '#F3F4F6' : i === 2 ? '#FEF3C7' : '#EFF6FF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
                    color: i === 0 ? '#D97706' : i === 1 ? '#64748B' : i === 2 ? '#B45309' : '#1B4FD8', flexShrink: 0,
                  }}>
                    {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                    <StarRating rating={t.rating} />
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1B4FD8' }}>{t.total_jobs}</div>
                    <div style={{ fontSize: 10, color: '#94A3B8' }}>jobs</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── ROW 6: Recent Bookings ── */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>Recent Bookings</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Latest 8 across all statuses</div>
          </div>
          <a href="/bookings" style={{ fontSize: 12, color: '#1B4FD8', textDecoration: 'none', fontWeight: 600 }}>View All →</a>
        </div>
        {recentBk.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>No bookings yet</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Booking #</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {recentBk.map((bk: any) => (
                <tr key={bk.id} style={{ cursor: 'pointer' }} onClick={() => navigate('/bookings')}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#1B4FD8' }}>
                    {bk.booking_number || bk.id?.slice(0, 8).toUpperCase()}
                  </td>
                  <td style={{ fontSize: 13, fontWeight: 500 }}>{bk.customer_name}</td>
                  <td>
                    <span style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: `${STATUS_COLOR[bk.status] || '#94A3B8'}20`,
                      color: STATUS_COLOR[bk.status] || '#64748B',
                    }}>
                      {(bk.status || '').replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700, color: bk.total_amount > 0 ? '#059669' : '#94A3B8' }}>
                    {bk.total_amount > 0 ? fmtFull(bk.total_amount) : '—'}
                  </td>
                  <td style={{ fontSize: 12, color: '#94A3B8' }}>{fmtDateTime(bk.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── ROW 7: Quick Actions ── */}
      <div className="card" style={{ padding: '20px 22px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 14 }}>Quick Actions</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { label: '📋 Bookings', to: '/bookings', color: '#EFF6FF', text: '#1B4FD8' },
            { label: '👥 Customers', to: '/customers', color: '#F0FDF4', text: '#059669' },
            { label: '🔧 Technicians', to: '/technicians', color: '#F5F3FF', text: '#7C3AED' },
            { label: '💰 Payments', to: '/payments', color: '#FFF7ED', text: '#C2410C' },
            { label: '📄 Invoices', to: '/invoices', color: '#F0FDF4', text: '#059669' },
            { label: '📊 Reports', to: '/reports', color: '#EFF6FF', text: '#1B4FD8' },
            { label: '🧾 GST Report', to: '/gst-report', color: '#F5F3FF', text: '#7C3AED' },
            { label: '⚠️ Escalations', to: '/escalations', color: '#FEF2F2', text: '#DC2626' },
            { label: '🔔 Notifications', to: '/notifications', color: '#FFFBEB', text: '#D97706' },
            { label: '⚙️ Settings', to: '/settings', color: '#F8FAFC', text: '#64748B' },
          ].map(({ label, to, color, text }) => (
            <a
              key={to} href={to}
              style={{
                padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600,
                textDecoration: 'none', background: color, color: text, transition: 'opacity 0.15s',
                border: `1px solid ${color}`,
              }}
              onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.opacity = '0.8'}
              onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.opacity = '1'}
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
