import { useEffect, useState } from 'react'
import { reportsAPI, techniciansAPI } from '@/services/api'
import PageHeader from '@/components/layout/PageHeader'
import Spinner from '@/components/ui/Spinner'

// ─── Shared helpers ───────────────────────────────────────────────────────────
const INR = (v: number) => `₹${(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const YEARS  = [2024, 2025, 2026]

function StatCard({ label, value, sub, color, icon }: any) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '18px 20px',
      boxShadow: '0 1px 3px rgba(0,0,0,.08)', border: '1px solid #F1F5F9',
    }}>
      {icon && <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>}
      <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 800, color: color || '#0F172A', lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 5 }}>{sub}</p>}
    </div>
  )
}

function Badge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    COMPLETED: ['#059669', '#ECFDF5'], PAID: ['#059669', '#ECFDF5'],
    CANCELLED: ['#DC2626', '#FEF2F2'], PENDING: ['#D97706', '#FFFBEB'],
    CONFIRMED: ['#1B4FD8', '#EFF6FF'], ASSIGNED: ['#7C3AED', '#F5F3FF'],
    IN_PROGRESS: ['#0891B2', '#ECFEFF'], CLOSED: ['#64748B', '#F8FAFC'],
    SETTLED: ['#059669', '#ECFDF5'], INVOICE_GENERATED: ['#0891B2', '#ECFEFF'],
    PAYMENT_PENDING: ['#D97706', '#FFFBEB'], APPROVED: ['#059669', '#ECFDF5'],
    DRAFT: ['#94A3B8', '#F8FAFC'], SUBMITTED: ['#1B4FD8', '#EFF6FF'],
    REJECTED: ['#DC2626', '#FEF2F2'],
  }
  const [c, bg] = map[status] || ['#64748B', '#F8FAFC']
  return (
    <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700, color: c, background: bg }}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

const Stars = ({ rating }: { rating: number | null }) => {
  if (!rating) return <span style={{ color: '#94A3B8', fontSize: 12 }}>—</span>
  return (
    <span style={{ color: '#F59E0B', fontSize: 14 }}>
      {'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}
      <span style={{ color: '#64748B', fontSize: 11, marginLeft: 4 }}>({rating.toFixed(1)})</span>
    </span>
  )
}

// ─── TAB STYLES ──────────────────────────────────────────────────────────────
function TabBar({ tabs, active, onSelect }: { tabs: { key: string; label: string }[]; active: string; onSelect: (k: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => onSelect(t.key)} style={{
          padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 600,
          background: active === t.key ? '#1B4FD8' : '#F1F5F9',
          color:      active === t.key ? '#fff'    : '#334155',
          transition: 'all .15s',
        }}>{t.label}</button>
      ))}
    </div>
  )
}

// ─── REVENUE TAB ─────────────────────────────────────────────────────────────
function RevenueTab() {
  const [data, setData]       = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [period, setPeriod]   = useState('monthly')
  const [year, setYear]       = useState(new Date().getFullYear())
  const [month, setMonth]     = useState(new Date().getMonth() + 1)

  const fetch = async () => {
    setLoading(true)
    try { const r = await reportsAPI.revenue({ period, year, month }); setData(r.data.data) }
    catch { setData(null) } finally { setLoading(false) }
  }
  useEffect(() => { fetch() }, [period, year, month])

  return (
    <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <select className="input" style={{ width: 130 }} value={period} onChange={e => setPeriod(e.target.value)}>
          <option value="daily">Daily</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
        <select className="input" style={{ width: 90 }} value={month} onChange={e => setMonth(+e.target.value)}>
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select className="input" style={{ width: 90 }} value={year} onChange={e => setYear(+e.target.value)}>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button className="btn btn-primary btn-sm" onClick={fetch}>Refresh</button>
      </div>

      {loading ? <div style={{ padding: 60, textAlign: 'center' }}><Spinner size="lg" /></div> : !data
        ? <div className="card" style={{ padding: 60, textAlign: 'center', color: '#94A3B8' }}>No data for selected period</div>
        : <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <StatCard label="Total Revenue"   value={INR(data.total_revenue)}                            color="#059669" icon="💰" />
            <StatCard label="Total Bookings"  value={data.total_bookings || 0}                           icon="📋" />
            <StatCard label="Completed"       value={data.completed_bookings || 0}                       color="#1B4FD8" icon="✅" />
            <StatCard label="Avg. Booking"    value={INR(Math.round(data.average_booking_value || 0))}   color="#7C3AED" icon="📊" />
          </div>
          {data.breakdown?.length > 0 && (
            <div className="card">
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', fontWeight: 700, fontSize: 14 }}>Revenue Breakdown</div>
              <table className="data-table">
                <thead><tr><th>Period</th><th>Revenue</th><th>Bookings</th><th>Avg Value</th></tr></thead>
                <tbody>
                  {data.breakdown.map((r: any, i: number) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{r.period || r.date || r.month || r.week}</td>
                      <td style={{ fontWeight: 700, color: '#059669' }}>{INR(r.revenue)}</td>
                      <td>{r.bookings || 0}</td>
                      <td>{INR(Math.round(r.avg_value || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      }
    </>
  )
}

// ─── GST TAB ─────────────────────────────────────────────────────────────────
function GstTab() {
  const [data, setData]       = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [year, setYear]       = useState(new Date().getFullYear())
  const [month, setMonth]     = useState(new Date().getMonth() + 1)

  const fetch = async () => {
    setLoading(true)
    try { const r = await reportsAPI.gst({ year, month }); setData(r.data.data) }
    catch { setData(null) } finally { setLoading(false) }
  }
  useEffect(() => { fetch() }, [year, month])

  return (
    <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20 }}>
        <select className="input" style={{ width: 90 }} value={month} onChange={e => setMonth(+e.target.value)}>
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select className="input" style={{ width: 90 }} value={year} onChange={e => setYear(+e.target.value)}>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button className="btn btn-primary btn-sm" onClick={fetch}>Refresh</button>
      </div>

      {loading ? <div style={{ padding: 60, textAlign: 'center' }}><Spinner size="lg" /></div> : !data
        ? <div className="card" style={{ padding: 60, textAlign: 'center', color: '#94A3B8' }}>No data for selected period</div>
        : <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <StatCard label="Taxable Amount"  value={INR(data.total_taxable)} icon="🧾" />
            <StatCard label="CGST Collected"  value={INR(data.total_cgst)}   color="#1B4FD8" icon="🏛️" />
            <StatCard label="SGST Collected"  value={INR(data.total_sgst)}   color="#7C3AED" icon="🏛️" />
            <StatCard label="Total Tax"       value={INR(data.total_tax)}    color="#059669" icon="💹" />
          </div>
          <div className="card">
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', fontWeight: 700, fontSize: 14 }}>
              GST Summary — {MONTHS[month - 1]} {year}
            </div>
            <div style={{ padding: 24 }}>
              {([
                ['Period',         `${MONTHS[month - 1]} ${year}`],
                ['Total Invoices', data.total_invoices  || 0],
                ['B2C Invoices',   data.b2c_invoices    || 0],
                ['B2B Invoices',   data.b2b_invoices    || 0],
                ['Total Taxable',  INR(data.total_taxable)],
                ['Total CGST',     INR(data.total_cgst)],
                ['Total SGST',     INR(data.total_sgst)],
                ['Total IGST',     INR(data.total_igst)],
              ] as [string, any][]).map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <span style={{ color: '#64748B', fontSize: 14 }}>{l}</span>
                  <span style={{ fontWeight: 700 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      }
    </>
  )
}

// ─── TECHNICIAN REPORT TAB ────────────────────────────────────────────────────
function TechnicianReportTab() {
  const [technicians, setTechnicians] = useState<any[]>([])
  const [techId,   setTechId]   = useState('')
  const [period,   setPeriod]   = useState('monthly')
  const [year,     setYear]     = useState(new Date().getFullYear())
  const [month,    setMonth]    = useState(new Date().getMonth() + 1)
  const [week,     setWeek]     = useState(1)
  const [report,   setReport]   = useState<any>(null)
  const [loading,  setLoading]  = useState(false)
  const [techLoad, setTechLoad] = useState(true)
  const [section,  setSection]  = useState<'bookings' | 'quotations' | 'payments' | 'commissions' | 'wallet' | 'withdrawals' | 'ratings'>('bookings')
  const [pdfLoading, setPdfLoading] = useState(false)

  // Load technicians for dropdown
  useEffect(() => {
    techniciansAPI.list({ page_size: 200, is_active: true })
      .then(r => { setTechnicians(r.data.data?.technicians || r.data.data || []); setTechLoad(false) })
      .catch(() => setTechLoad(false))
  }, [])

  const generateReport = async () => {
    if (!techId) return
    setLoading(true); setReport(null)
    try {
      const params: any = { technician_id: techId, period, year }
      if (period === 'monthly') params.month = month
      if (period === 'weekly')  params.week  = week
      const r = await reportsAPI.technicianDetail(params)
      setReport(r.data.data)
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Failed to generate report')
    } finally { setLoading(false) }
  }

  const downloadPdf = async () => {
    if (!techId || !report) return
    setPdfLoading(true)
    try {
      const params: any = { technician_id: techId, period, year }
      if (period === 'monthly') params.month = month
      if (period === 'weekly')  params.week  = week
      const r = await reportsAPI.technicianDetailPdf(params)
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      const tech = report?.technician
      a.download = `report_${(tech?.name || 'technician').replace(/\s+/g, '_').toLowerCase()}_${period}_${year}${period === 'monthly' ? month : period === 'weekly' ? `w${week}` : ''}.pdf`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      alert('PDF download failed. Please try again.')
    } finally { setPdfLoading(false) }
  }

  const secBtn = (key: typeof section, label: string, count?: number) => (
    <button onClick={() => setSection(key)} style={{
      padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
      fontSize: 12, fontWeight: 600,
      background: section === key ? '#1B4FD8' : '#F1F5F9',
      color:      section === key ? '#fff'    : '#334155',
    }}>
      {label}{count !== undefined ? ` (${count})` : ''}
    </button>
  )

  const isoDate = (s: string | null) => s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  return (
    <>
      {/* ── Controls ── */}
      <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,.07)', border: '1px solid #E2E8F0', marginBottom: 24 }}>
        <p style={{ fontWeight: 700, fontSize: 13, color: '#334155', marginBottom: 14 }}>Generate Technician Report</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>

          {/* Technician picker */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>TECHNICIAN</label>
            {techLoad
              ? <div style={{ width: 220, height: 36, background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }} />
              : <select className="input" style={{ width: 220 }} value={techId} onChange={e => setTechId(e.target.value)}>
                  <option value="">— Select Technician —</option>
                  {technicians.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.mobile})</option>
                  ))}
                </select>
            }
          </div>

          {/* Period */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>PERIOD</label>
            <select className="input" style={{ width: 130 }} value={period} onChange={e => setPeriod(e.target.value)}>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          {/* Month — shown for monthly */}
          {period === 'monthly' && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>MONTH</label>
              <select className="input" style={{ width: 90 }} value={month} onChange={e => setMonth(+e.target.value)}>
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
          )}

          {/* Week — shown for weekly */}
          {period === 'weekly' && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>WEEK #</label>
              <select className="input" style={{ width: 90 }} value={week} onChange={e => setWeek(+e.target.value)}>
                {Array.from({ length: 52 }, (_, i) => i + 1).map(w => <option key={w} value={w}>Week {w}</option>)}
              </select>
            </div>
          )}

          {/* Year */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>YEAR</label>
            <select className="input" style={{ width: 90 }} value={year} onChange={e => setYear(+e.target.value)}>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <button className="btn btn-primary" style={{ height: 36, paddingLeft: 24, paddingRight: 24 }}
            onClick={generateReport} disabled={!techId || loading}>
            {loading ? 'Generating…' : '⚡ Generate Report'}
          </button>

          {report && (
            <button className="btn" onClick={downloadPdf} disabled={pdfLoading}
              style={{ height: 36, paddingLeft: 20, paddingRight: 20, background: '#DC2626', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: pdfLoading ? 'not-allowed' : 'pointer', opacity: pdfLoading ? .7 : 1 }}>
              {pdfLoading ? '⏳ Generating PDF…' : '📥 Download PDF'}
            </button>
          )}
        </div>
      </div>

      {loading && <div style={{ padding: 80, textAlign: 'center' }}><Spinner size="lg" /></div>}

      {!loading && !report && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94A3B8' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
          <p style={{ fontWeight: 600 }}>Select a technician and click Generate Report</p>
        </div>
      )}

      {!loading && report && (() => {
        const { technician: tech, period: pd, summary: s, bookings, quotations, ratings, commissions, commission_summary: cs, wallet, wallet_summary: ws, wallet_transactions: walletTxns, withdrawal_requests: withdrawals } = report

        return (
          <>
            {/* ── Technician Profile Header ── */}
            <div style={{
              background: 'linear-gradient(135deg, #1B4FD8 0%, #7C3AED 100%)',
              borderRadius: 14, padding: '24px 28px', marginBottom: 24,
              display: 'flex', alignItems: 'center', gap: 20, color: '#fff',
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, fontWeight: 800, flexShrink: 0,
                backgroundImage: tech.profile_image ? `url(${tech.profile_image})` : undefined,
                backgroundSize: 'cover', backgroundPosition: 'center',
              }}>
                {!tech.profile_image && tech.name?.charAt(0)}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{tech.name}</p>
                <p style={{ fontSize: 13, opacity: .85 }}>{tech.mobile} {tech.email ? `· ${tech.email}` : ''} {tech.city ? `· ${tech.city}` : ''}</p>
                <p style={{ fontSize: 12, opacity: .7, marginTop: 4 }}>
                  Report Period: {pd.type.toUpperCase()} · {pd.start_date} → {pd.end_date}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 11, opacity: .7, textTransform: 'uppercase', letterSpacing: '.05em' }}>Overall Rating</p>
                <p style={{ fontSize: 28, fontWeight: 800 }}>{tech.rating ? `${tech.rating} ★` : 'N/A'}</p>
              </div>
            </div>

            {/* ── KPI Cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
              <StatCard label="Total Bookings"     value={s.total_bookings}                       icon="📋" />
              <StatCard label="Completed"          value={s.completed_bookings}  color="#059669"  icon="✅" />
              <StatCard label="Cancelled"          value={s.cancelled_bookings}  color="#DC2626"  icon="❌" />
              <StatCard label="Completion Rate"    value={`${s.completion_rate}%`} color="#1B4FD8" icon="📈"
                sub={`${s.active_bookings} active`} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
              <StatCard label="Total Revenue"    value={INR(s.total_revenue)}   color="#059669" icon="💰" />
              <StatCard label="Cash Collected"   value={INR(s.total_cash)}      color="#D97706" icon="💵" />
              <StatCard label="Online Collected" value={INR(s.total_online)}    color="#0891B2" icon="💳" />
              <StatCard label="Avg Rating"       value={s.avg_rating ? `${s.avg_rating} ★` : 'N/A'} color="#F59E0B" icon="⭐"
                sub={`${s.total_ratings} reviews`} />
            </div>

            {/* ── Commission Summary ── */}
            {cs && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
                <StatCard label="Commission Earned"   value={INR(cs.total_earned)}   color="#7C3AED" icon="🏆" />
                <StatCard label="Commission Pending"  value={INR(cs.total_pending)}  color="#D97706" icon="⏳" />
                <StatCard label="Commission Approved" value={INR(cs.total_approved)} color="#0891B2" icon="👍" />
                <StatCard label="Commission Paid"     value={INR(cs.total_paid)}     color="#059669" icon="✔️" />
              </div>
            )}

            {/* ── Wallet Summary ── */}
            {wallet && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
                <StatCard label="Wallet Balance"      value={INR(wallet.balance)}        color="#1B4FD8"  icon="👛" />
                <StatCard label="Total Earned"        value={INR(wallet.total_earned)}   color="#059669"  icon="💰" />
                <StatCard label="Total Withdrawn"     value={INR(wallet.total_withdrawn)} color="#D97706" icon="🏧" />
                <StatCard label="Period Credits"      value={INR(ws?.credits_in_period || 0)} color="#0891B2" icon="⬆️"
                  sub={`${ws?.txn_count || 0} transactions`} />
              </div>
            )}

            {/* ── Payment Split Visual ── */}
            {(s.total_revenue > 0) && (
              <div className="card" style={{ marginBottom: 24, padding: '18px 24px' }}>
                <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Payment Method Split</p>
                <div style={{ display: 'flex', gap: 0, height: 32, borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
                  {s.total_cash > 0 && (
                    <div style={{
                      width: `${(s.total_cash / s.total_revenue) * 100}%`,
                      background: '#D97706', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700,
                    }}>💵 {Math.round((s.total_cash / s.total_revenue) * 100)}%</div>
                  )}
                  {s.total_online > 0 && (
                    <div style={{
                      width: `${(s.total_online / s.total_revenue) * 100}%`,
                      background: '#0891B2', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700,
                    }}>💳 {Math.round((s.total_online / s.total_revenue) * 100)}%</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 24 }}>
                  <span style={{ fontSize: 12 }}><span style={{ color: '#D97706', fontWeight: 700 }}>●</span> Cash {INR(s.total_cash)}</span>
                  <span style={{ fontSize: 12 }}><span style={{ color: '#0891B2', fontWeight: 700 }}>●</span> Online {INR(s.total_online)}</span>
                </div>
              </div>
            )}

            {/* ── Section Nav ── */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {secBtn('bookings',    'Bookings',    s.total_bookings)}
              {secBtn('quotations',  'Quotations',  s.total_quotations)}
              {secBtn('payments',    'Payments')}
              {secBtn('commissions', 'Commissions', cs?.total_records || 0)}
              {wallet && secBtn('wallet',      'Wallet Txns', ws?.txn_count || 0)}
              {wallet && secBtn('withdrawals', 'Withdrawals', ws?.withdrawal_count || 0)}
              {secBtn('ratings',     'Ratings',     s.total_ratings)}
            </div>

            {/* ── BOOKINGS SECTION ── */}
            {section === 'bookings' && (
              <div className="card">
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', fontWeight: 700, fontSize: 14 }}>
                  Booking Details ({bookings.length})
                </div>
                {bookings.length === 0
                  ? <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>No bookings in this period</div>
                  : <table className="data-table">
                      <thead>
                        <tr>
                          <th>#</th><th>Booking No.</th><th>Service</th>
                          <th>Status</th><th>Date</th><th>Amount</th>
                          <th>Quotation</th><th>Invoice</th>
                          <th>Cash</th><th>Online</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bookings.map((b: any, i: number) => (
                          <tr key={b.booking_id}>
                            <td style={{ color: '#94A3B8', fontSize: 11 }}>{i + 1}</td>
                            <td style={{ fontWeight: 700, fontSize: 12 }}>{b.booking_number}</td>
                            <td style={{ maxWidth: 140, fontSize: 12 }}>{b.service_name || '—'}</td>
                            <td><Badge status={b.status} /></td>
                            <td style={{ fontSize: 12 }}>{b.scheduled_date ? isoDate(b.scheduled_date) : isoDate(b.created_at)}</td>
                            <td style={{ fontWeight: 700, color: '#059669' }}>{INR(b.total_amount)}</td>
                            <td>
                              {b.quotation_number
                                ? <><div style={{ fontSize: 11, fontWeight: 600 }}>{b.quotation_number}</div><Badge status={b.quotation_status} /></>
                                : <span style={{ color: '#94A3B8' }}>—</span>}
                            </td>
                            <td>
                              {b.invoice_number
                                ? <><div style={{ fontSize: 11, fontWeight: 600 }}>{b.invoice_number}</div><Badge status={b.invoice_status} /></>
                                : <span style={{ color: '#94A3B8' }}>—</span>}
                            </td>
                            <td style={{ color: '#D97706', fontWeight: 600 }}>{b.paid_cash > 0 ? INR(b.paid_cash) : '—'}</td>
                            <td style={{ color: '#0891B2', fontWeight: 600 }}>{b.paid_online > 0 ? INR(b.paid_online) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                }
              </div>
            )}

            {/* ── QUOTATIONS SECTION ── */}
            {section === 'quotations' && (
              <div className="card">
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', fontWeight: 700, fontSize: 14 }}>
                  Quotations ({quotations.length})
                </div>
                {quotations.length === 0
                  ? <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>No quotations in this period</div>
                  : <table className="data-table">
                      <thead><tr><th>#</th><th>Quotation No.</th><th>Status</th><th>Amount</th><th>Date</th></tr></thead>
                      <tbody>
                        {quotations.map((q: any, i: number) => (
                          <tr key={i}>
                            <td style={{ color: '#94A3B8', fontSize: 11 }}>{i + 1}</td>
                            <td style={{ fontWeight: 700 }}>{q.quotation_number}</td>
                            <td><Badge status={q.status} /></td>
                            <td style={{ fontWeight: 700, color: '#059669' }}>{q.total_amount ? INR(q.total_amount) : '—'}</td>
                            <td style={{ fontSize: 12 }}>{isoDate(q.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                }
              </div>
            )}

            {/* ── PAYMENTS SECTION ── */}
            {section === 'payments' && (
              <div className="card">
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', fontWeight: 700, fontSize: 14 }}>
                  Payment Details (from completed bookings)
                </div>
                {bookings.filter((b: any) => b.paid_total > 0).length === 0
                  ? <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>No payments in this period</div>
                  : <table className="data-table">
                      <thead>
                        <tr><th>#</th><th>Booking No.</th><th>Status</th><th>Cash</th><th>Online</th><th>Total Paid</th></tr>
                      </thead>
                      <tbody>
                        {bookings.filter((b: any) => b.paid_total > 0).map((b: any, i: number) => (
                          <tr key={b.booking_id}>
                            <td style={{ color: '#94A3B8', fontSize: 11 }}>{i + 1}</td>
                            <td style={{ fontWeight: 700, fontSize: 12 }}>{b.booking_number}</td>
                            <td><Badge status={b.status} /></td>
                            <td style={{ color: '#D97706', fontWeight: 700 }}>{b.paid_cash > 0 ? INR(b.paid_cash) : '—'}</td>
                            <td style={{ color: '#0891B2', fontWeight: 700 }}>{b.paid_online > 0 ? INR(b.paid_online) : '—'}</td>
                            <td style={{ fontWeight: 800, color: '#059669' }}>{INR(b.paid_total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                }
              </div>
            )}

            {/* ── COMMISSIONS SECTION ── */}
            {section === 'commissions' && (
              <div className="card">
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', fontWeight: 700, fontSize: 14 }}>
                  Commission Records ({commissions?.length || 0})
                </div>
                {(!commissions || commissions.length === 0)
                  ? <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>No commission records in this period</div>
                  : <table className="data-table">
                      <thead>
                        <tr>
                          <th>#</th><th>Type</th><th>Item</th><th>Base Amt</th>
                          <th>Commission</th><th>Status</th><th>Source</th><th>Payout Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commissions.map((c: any, i: number) => (
                          <tr key={c.id}>
                            <td style={{ color: '#94A3B8', fontSize: 11 }}>{i + 1}</td>
                            <td style={{ fontSize: 12, fontWeight: 600 }}>{c.item_type || '—'}</td>
                            <td style={{ fontSize: 12, maxWidth: 160 }}>{c.item_name || '—'}</td>
                            <td>{c.base_amount ? INR(c.base_amount) : '—'}</td>
                            <td style={{ fontWeight: 800, color: '#7C3AED' }}>{INR(c.commission_amount)}</td>
                            <td><Badge status={c.status || 'PENDING'} /></td>
                            <td style={{ fontSize: 11 }}>{c.part_source || '—'}</td>
                            <td style={{ fontSize: 12 }}>{c.payout_date ? isoDate(c.payout_date) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                }
              </div>
            )}

            {/* ── WALLET TRANSACTIONS SECTION ── */}
            {section === 'wallet' && (
              <div className="card">
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', fontWeight: 700, fontSize: 14 }}>
                  Wallet Transactions ({walletTxns?.length || 0})
                </div>
                {(!walletTxns || walletTxns.length === 0)
                  ? <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>No wallet transactions in this period</div>
                  : <table className="data-table">
                      <thead>
                        <tr>
                          <th>#</th><th>Type</th><th>Description</th><th>Ref ID</th>
                          <th>Date</th><th>Amount</th><th>Balance After</th>
                        </tr>
                      </thead>
                      <tbody>
                        {walletTxns.map((t: any, i: number) => {
                          const tc = t.type === 'CREDIT' ? '#059669' : t.type === 'DEBIT' || t.type === 'WITHDRAWAL' ? '#DC2626' : '#334155'
                          return (
                            <tr key={t.id}>
                              <td style={{ color: '#94A3B8', fontSize: 11 }}>{i + 1}</td>
                              <td><span style={{ fontWeight: 700, color: tc, fontSize: 12 }}>{t.type}</span></td>
                              <td style={{ fontSize: 12, maxWidth: 200 }}>{t.description || '—'}</td>
                              <td style={{ fontSize: 11, color: '#64748B' }}>{t.reference_id || '—'}</td>
                              <td style={{ fontSize: 12 }}>{isoDate(t.created_at)}</td>
                              <td style={{ fontWeight: 700, color: tc }}>{INR(t.amount)}</td>
                              <td style={{ fontWeight: 600, color: '#334155' }}>{INR(t.balance_after)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                }
              </div>
            )}

            {/* ── WITHDRAWALS SECTION ── */}
            {section === 'withdrawals' && (
              <div className="card">
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', fontWeight: 700, fontSize: 14 }}>
                  Withdrawal Requests ({withdrawals?.length || 0})
                </div>
                {(!withdrawals || withdrawals.length === 0)
                  ? <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>No withdrawal requests in this period</div>
                  : <table className="data-table">
                      <thead>
                        <tr>
                          <th>#</th><th>Amount</th><th>Status</th>
                          <th>UPI / Bank</th><th>Payment Ref</th>
                          <th>Requested</th><th>Reviewed</th><th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {withdrawals.map((wr: any, i: number) => {
                          const sc = wr.status === 'APPROVED' ? '#059669' : wr.status === 'REJECTED' ? '#DC2626' : '#D97706'
                          const dest = wr.upi_id || wr.bank_account || '—'
                          return (
                            <tr key={wr.id}>
                              <td style={{ color: '#94A3B8', fontSize: 11 }}>{i + 1}</td>
                              <td style={{ fontWeight: 800, color: sc }}>{INR(wr.amount)}</td>
                              <td><Badge status={wr.status || 'PENDING'} /></td>
                              <td style={{ fontSize: 11 }}>{String(dest).slice(0, 24)}</td>
                              <td style={{ fontSize: 11, color: '#64748B' }}>{wr.payment_reference || '—'}</td>
                              <td style={{ fontSize: 12 }}>{isoDate(wr.created_at)}</td>
                              <td style={{ fontSize: 12 }}>{wr.reviewed_at ? isoDate(wr.reviewed_at) : '—'}</td>
                              <td style={{ fontSize: 11, color: '#64748B' }}>{wr.admin_notes || wr.notes || '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                }
              </div>
            )}

            {/* ── RATINGS SECTION ── */}
            {section === 'ratings' && (
              <div className="card">
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', fontWeight: 700, fontSize: 14 }}>
                  Customer Ratings ({ratings?.length || 0})
                </div>
                {(!ratings || ratings.length === 0)
                  ? <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>No ratings in this period</div>
                  : <div style={{ padding: '0 0 8px' }}>
                      {ratings.map((r: any, i: number) => (
                        <div key={i} style={{
                          padding: '16px 24px', borderBottom: '1px solid #F1F5F9',
                          display: 'flex', gap: 16, alignItems: 'flex-start',
                        }}>
                          <div style={{
                            width: 40, height: 40, borderRadius: '50%', background: '#F1F5F9',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 800, color: '#1B4FD8', flexShrink: 0,
                          }}>{i + 1}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                              <Stars rating={r.rating} />
                              <span style={{ fontSize: 11, color: '#94A3B8' }}>{isoDate(r.created_at)}</span>
                            </div>
                            <p style={{ fontSize: 13, color: '#334155', margin: 0 }}>{r.review || <em style={{ color: '#94A3B8' }}>No written review</em>}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                }
              </div>
            )}
          </>
        )
      })()}
    </>
  )
}

// ─── MAIN REPORTS PAGE ────────────────────────────────────────────────────────
const TABS = [
  { key: 'revenue',    label: '📈 Revenue Report' },
  { key: 'gst',       label: '🏛️ GST Report' },
  { key: 'technician', label: '👷 Technician Report' },
]

export default function Reports() {
  const [tab, setTab] = useState<'revenue' | 'gst' | 'technician'>('revenue')

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader title="Reports" subtitle="Business analytics, tax reports and technician performance" />
      <div style={{ height: 20 }} />
      <TabBar tabs={TABS} active={tab} onSelect={k => setTab(k as any)} />
      <div style={{ height: 24 }} />
      {tab === 'revenue'     && <RevenueTab />}
      {tab === 'gst'         && <GstTab />}
      {tab === 'technician'  && <TechnicianReportTab />}
    </div>
  )
}
