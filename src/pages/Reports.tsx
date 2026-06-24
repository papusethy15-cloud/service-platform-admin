import { useEffect, useState } from 'react'
import { reportsAPI } from '@/services/api'
import PageHeader from '@/components/layout/PageHeader'
import Spinner from '@/components/ui/Spinner'

function StatCard({ label, value, sub, color }: any) {
  return (
    <div className="stat-card">
      <p style={{ fontSize: 12, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 700, color: color || '#0F172A' }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>{sub}</p>}
    </div>
  )
}

export default function Reports() {
  const [tab, setTab] = useState<'revenue' | 'gst'>('revenue')
  const [revenue, setRevenue] = useState<any>(null)
  const [gst, setGst] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [period, setPeriod] = useState('monthly')
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)

  const fetchRevenue = async () => {
    setLoading(true)
    try { const r = await reportsAPI.revenue({ period, year, month }); setRevenue(r.data.data) }
    catch { setRevenue(null) } finally { setLoading(false) }
  }

  const fetchGst = async () => {
    setLoading(true)
    try { const r = await reportsAPI.gst({ year, month }); setGst(r.data.data) }
    catch { setGst(null) } finally { setLoading(false) }
  }

  useEffect(() => { if (tab === 'revenue') fetchRevenue(); else fetchGst() }, [tab, period, year, month])

  const tabStyle = (t: string) => ({
    padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
    background: tab === t ? '#1B4FD8' : '#F1F5F9', color: tab === t ? '#fff' : '#334155'
  })

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader title="Reports" subtitle="Business analytics and financial reports" />
      <div style={{ height: 20 }} />

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={tabStyle('revenue')} onClick={() => setTab('revenue')}>Revenue Report</button>
          <button style={tabStyle('gst')} onClick={() => setTab('gst')}>GST Report</button>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {tab === 'revenue' && (
            <select className="input" style={{ width: 130 }} value={period} onChange={e => setPeriod(e.target.value)}>
              <option value="daily">Daily</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          )}
          <select className="input" style={{ width: 90 }} value={month} onChange={e => setMonth(+e.target.value)}>
            {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select className="input" style={{ width: 90 }} value={year} onChange={e => setYear(+e.target.value)}>
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" onClick={() => tab === 'revenue' ? fetchRevenue() : fetchGst()}>Refresh</button>
        </div>
      </div>

      {loading ? <div style={{ padding: 60, textAlign: 'center' }}><Spinner size="lg" /></div> : (
        <>
          {tab === 'revenue' && revenue && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                <StatCard label="Total Revenue" value={`₹${(revenue.total_revenue || 0).toLocaleString('en-IN')}`} color="#059669" />
                <StatCard label="Total Bookings" value={revenue.total_bookings || 0} />
                <StatCard label="Completed" value={revenue.completed_bookings || 0} color="#1B4FD8" />
                <StatCard label="Avg. Booking" value={`₹${Math.round(revenue.average_booking_value || 0).toLocaleString('en-IN')}`} color="#7C3AED" />
              </div>
              {revenue.breakdown && revenue.breakdown.length > 0 && (
                <div className="card">
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', fontWeight: 600, fontSize: 14 }}>Revenue Breakdown</div>
                  <table className="data-table">
                    <thead><tr><th>Period</th><th>Revenue</th><th>Bookings</th><th>Avg Value</th></tr></thead>
                    <tbody>
                      {revenue.breakdown.map((r: any, i: number) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 500 }}>{r.period || r.date || r.month || r.week}</td>
                          <td style={{ fontWeight: 700, color: '#059669' }}>₹{(r.revenue || 0).toLocaleString('en-IN')}</td>
                          <td>{r.bookings || 0}</td>
                          <td>₹{Math.round(r.avg_value || 0).toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {tab === 'gst' && gst && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                <StatCard label="Taxable Amount" value={`₹${(gst.total_taxable || 0).toLocaleString('en-IN')}`} />
                <StatCard label="CGST Collected" value={`₹${(gst.total_cgst || 0).toLocaleString('en-IN')}`} color="#1B4FD8" />
                <StatCard label="SGST Collected" value={`₹${(gst.total_sgst || 0).toLocaleString('en-IN')}`} color="#7C3AED" />
                <StatCard label="Total Tax" value={`₹${(gst.total_tax || 0).toLocaleString('en-IN')}`} color="#059669" />
              </div>
              <div className="card">
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', fontWeight: 600, fontSize: 14 }}>GST Summary — {months[month - 1]} {year}</div>
                <div style={{ padding: 24 }}>
                  {[['Period', `${months[month - 1]} ${year}`], ['Total Invoices', gst.total_invoices || 0],
                    ['B2C Invoices', gst.b2c_invoices || 0], ['B2B Invoices', gst.b2b_invoices || 0],
                    ['Total Taxable', `₹${(gst.total_taxable || 0).toLocaleString('en-IN')}`],
                    ['Total CGST', `₹${(gst.total_cgst || 0).toLocaleString('en-IN')}`],
                    ['Total SGST', `₹${(gst.total_sgst || 0).toLocaleString('en-IN')}`],
                    ['Total IGST', `₹${(gst.total_igst || 0).toLocaleString('en-IN')}`]].map(([l, v]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                      <span style={{ color: '#64748B', fontSize: 14 }}>{l}</span>
                      <span style={{ fontWeight: 600 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {((tab === 'revenue' && !revenue) || (tab === 'gst' && !gst)) && (
            <div className="card" style={{ padding: 60, textAlign: 'center', color: '#94A3B8' }}>
              No report data available for selected period
            </div>
          )}
        </>
      )}
    </div>
  )
}
