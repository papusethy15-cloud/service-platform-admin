import { useEffect, useState } from 'react'
import { amcAPI } from '@/services/api'
import PageHeader from '@/components/layout/PageHeader'
import StatusBadge from '@/components/ui/StatusBadge'
import Spinner from '@/components/ui/Spinner'

export default function AMC() {
  const [plans, setPlans] = useState<any[]>([])
  const [renewals, setRenewals] = useState<any[]>([])
  const [tab, setTab] = useState<'plans' | 'renewals'>('plans')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      try {
        const [pRes, rRes] = await Promise.all([amcAPI.plans(), amcAPI.renewals()])
        setPlans(pRes.data.data || [])
        setRenewals(rRes.data.data || [])
      } catch { setPlans([]); setRenewals([]) } finally { setLoading(false) }
    }
    fetchAll()
  }, [])

  const tabStyle = (t: string) => ({
    padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
    background: tab === t ? '#1B4FD8' : '#F1F5F9', color: tab === t ? '#fff' : '#334155'
  })

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader title="AMC Plans" subtitle="Annual Maintenance Contract management" />
      <div style={{ height: 20 }} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button style={tabStyle('plans')} onClick={() => setTab('plans')}>Plans ({plans.length})</button>
        <button style={tabStyle('renewals')} onClick={() => setTab('renewals')}>Upcoming Renewals ({renewals.length})</button>
      </div>
      {loading ? <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div> : (
        <div className="card">
          {tab === 'plans' ? (
            <table className="data-table">
              <thead><tr><th>Plan Name</th><th>Duration</th><th>Price ₹</th><th>Services Covered</th><th>Status</th></tr></thead>
              <tbody>
                {plans.length === 0
                  ? <tr><td colSpan={5} style={{ textAlign: 'center', color: '#94A3B8', padding: 32 }}>No AMC plans found</td></tr>
                  : plans.map((p: any) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td>{p.duration_months} months</td>
                      <td style={{ fontWeight: 700, color: '#059669' }}>₹{p.price?.toLocaleString('en-IN')}</td>
                      <td>{p.services_covered || '—'}</td>
                      <td><StatusBadge status={p.is_active ? 'ACTIVE' : 'INACTIVE'} /></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : (
            <table className="data-table">
              <thead><tr><th>Customer</th><th>Plan</th><th>Expiry Date</th><th>Days Left</th><th>Status</th></tr></thead>
              <tbody>
                {renewals.length === 0
                  ? <tr><td colSpan={5} style={{ textAlign: 'center', color: '#94A3B8', padding: 32 }}>No upcoming renewals</td></tr>
                  : renewals.map((r: any) => {
                    const days = Math.ceil((new Date(r.expiry_date).getTime() - Date.now()) / 86400000)
                    return (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 500 }}>{r.customer_name || r.customer_id}</td>
                        <td>{r.plan_name || '—'}</td>
                        <td>{new Date(r.expiry_date).toLocaleDateString('en-IN')}</td>
                        <td><span style={{ fontWeight: 700, color: days <= 7 ? '#DC2626' : days <= 30 ? '#D97706' : '#059669' }}>{days}d</span></td>
                        <td><StatusBadge status={r.status || 'ACTIVE'} /></td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
