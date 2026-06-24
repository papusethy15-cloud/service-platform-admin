import { useEffect, useState } from 'react'
import { analyticsAPI } from '@/services/api'
import PageHeader from '@/components/layout/PageHeader'
import Spinner from '@/components/ui/Spinner'
import type { DashboardKPIs } from '@/types'

function StatCard({ label, value, sub, color }: any) {
  return (
    <div className="stat-card">
      <p style={{ fontSize:12, fontWeight:600, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>{label}</p>
      <p style={{ fontSize:28, fontWeight:700, color: color || '#0F172A' }}>{value}</p>
      {sub && <p style={{ fontSize:12, color:'#94A3B8', marginTop:4 }}>{sub}</p>}
    </div>
  )
}

export default function Dashboard() {
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    analyticsAPI.dashboard().then(r => setKpis(r.data.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding:40, display:'flex', justifyContent:'center' }}><Spinner size="lg" /></div>

  return (
    <div style={{ padding:'24px 28px' }}>
      <PageHeader title="Dashboard" subtitle="Real-time business overview" />
      <div style={{ height:24 }} />

      {/* KPI CARDS */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
        <StatCard label="Total Bookings"       value={kpis?.bookings.total ?? 0}                sub="All time" />
        <StatCard label="Today's Bookings"     value={kpis?.bookings.today ?? 0}                sub="Last 24 hours" color="#1B4FD8" />
        <StatCard label="Pending Bookings"     value={kpis?.bookings.pending ?? 0}              sub="Needs action" color="#D97706" />
        <StatCard label="Completed This Month" value={kpis?.bookings.completed_this_month ?? 0} sub="This month" color="#059669" />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
        <StatCard label="Total Revenue"     value={`₹${(kpis?.revenue.total ?? 0).toLocaleString('en-IN')}`}        sub="All time" color="#059669" />
        <StatCard label="Revenue This Month" value={`₹${(kpis?.revenue.this_month ?? 0).toLocaleString('en-IN')}`} sub="This month" color="#1B4FD8" />
        <StatCard label="Total Customers"   value={kpis?.customers.total ?? 0}       sub="Registered" />
        <StatCard label="Active Technicians" value={kpis?.technicians.active ?? 0}   sub="Available" color="#7C3AED" />
      </div>

      {/* Quick Links */}
      <div className="card" style={{ padding:20 }}>
        <h3 style={{ fontSize:15, fontWeight:600, marginBottom:16 }}>Quick Actions</h3>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
          {[['📋 New Booking','/bookings'],['👤 Add Customer','/customers'],['🔧 Add Technician','/technicians'],
            ['⚙️ Add Service','/services'],['📊 Revenue Report','/reports'],['⚠️ Escalations','/escalations']].map(([label,to]) => (
            <a key={to} href={to} className="btn btn-secondary" style={{ textDecoration:'none' }}>{label}</a>
          ))}
        </div>
      </div>
    </div>
  )
}
