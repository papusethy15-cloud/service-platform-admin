import { useEffect, useState } from 'react'
import { gstAPI, reportsAPI } from '@/services/api'
import PageHeader from '@/components/layout/PageHeader'
import Spinner from '@/components/ui/Spinner'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function StatCard({ label, value, sub, color }: any) {
  return (
    <div className="card" style={{ padding: '16px 20px', borderLeft: `4px solid ${color || '#1B4FD8'}` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || '#0F172A' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export default function GSTReport() {
  const [gst, setGst] = useState<any>(null)
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [exporting, setExporting] = useState(false)

  const fetchReport = async () => {
    setLoading(true)
    try {
      const [rptRes, settRes] = await Promise.all([
        reportsAPI.gst({ year, month }),
        gstAPI.settings(),
      ])
      setGst(rptRes.data?.data)
      setSettings(settRes.data?.data)
    } catch { setGst(null) } finally { setLoading(false) }
  }

  useEffect(() => { fetchReport() }, [year, month])

  const fmt = (n: any) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  const handleExportCSV = () => {
    if (!gst?.line_items?.length) return
    setExporting(true)
    try {
      const headers = ['Invoice #', 'Date', 'Customer', 'GSTIN', 'Taxable Amount', 'CGST', 'SGST', 'IGST', 'Total Tax', 'Invoice Total', 'Type']
      const rows = gst.line_items.map((r: any) => [
        r.invoice_number, r.date, r.customer_name, r.gstin || '',
        r.taxable_amount, r.cgst, r.sgst, r.igst || 0, r.total_tax, r.invoice_total, r.type || 'B2C'
      ])
      const csvContent = [headers, ...rows].map(row => row.map((v: any) => `"${v}"`).join(',')).join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `GST_Report_${MONTHS[month-1]}_${year}.csv`; a.click()
      URL.revokeObjectURL(url)
    } finally { setExporting(false) }
  }

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader
        title="GST Reports"
        subtitle="Monthly GST filing data — CGST, SGST, IGST"
        actions={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <select className="input" style={{ width: 100 }} value={month} onChange={e => setMonth(+e.target.value)}>
              {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
            <select className="input" style={{ width: 90 }} value={year} onChange={e => setYear(+e.target.value)}>
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button className="btn btn-secondary" onClick={fetchReport}>Refresh</button>
            {gst?.line_items?.length > 0 && (
              <button className="btn btn-primary" onClick={handleExportCSV} disabled={exporting}>
                {exporting ? '⏳' : '⬇'} Export CSV
              </button>
            )}
          </div>
        }
      />

      {/* Filing period notice */}
      <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '12px 18px', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{ fontSize: 20 }}>📅</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1B4FD8' }}>GST Filing Window</div>
          <div style={{ fontSize: 12, color: '#64748B' }}>
            GST returns for <b>{MONTHS[month-1]} {year}</b> must be filed between <b>1–9 {MONTHS[month % 12]} {month === 12 ? year+1 : year}</b>.
            Use this report to prepare your GSTR-1 (outward supplies) filing.
          </div>
        </div>
      </div>

      {/* GST Settings Banner */}
      {settings && (
        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 18px', marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Business GST Details</div>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            {[
              ['GSTIN', settings.gstin || 'Not configured'],
              ['Business Name', settings.business_name || '—'],
              ['GST Rate', `${settings.gst_rate || 18}%`],
              ['CGST/SGST', `${(settings.gst_rate || 18)/2}% each`],
            ].map(([l, v]) => (
              <div key={l}>
                <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>{l}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', fontFamily: l === 'GSTIN' ? 'monospace' : undefined }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 80, textAlign: 'center' }}><Spinner size="lg" /></div>
      ) : !gst ? (
        <div className="card" style={{ padding: 60, textAlign: 'center', color: '#94A3B8' }}>
          No GST data found for {MONTHS[month-1]} {year}
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
            <StatCard label="Total Invoices" value={gst.total_invoices || 0} color="#1B4FD8" />
            <StatCard label="Taxable Amount" value={fmt(gst.total_taxable)} color="#059669" />
            <StatCard label="CGST Collected" value={fmt(gst.total_cgst)} color="#7C3AED" />
            <StatCard label="SGST Collected" value={fmt(gst.total_sgst)} color="#D97706" />
          </div>

          {/* GST Summary */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>GST Summary — {MONTHS[month-1]} {year}</span>
              <span style={{ fontSize: 12, color: '#94A3B8' }}>For GSTR-1 filing</span>
            </div>
            <div style={{ padding: 24 }}>
              {[
                ['Period', `${MONTHS[month-1]} ${year}`, '#0F172A'],
                ['Total GST Invoices', gst.total_invoices || 0, '#1B4FD8'],
                ['B2C Invoices', gst.b2c_invoices || 0, '#64748B'],
                ['B2B Invoices (with GSTIN)', gst.b2b_invoices || 0, '#64748B'],
                ['Total Taxable Amount', fmt(gst.total_taxable), '#059669'],
                ['Total CGST (Central)', fmt(gst.total_cgst), '#7C3AED'],
                ['Total SGST (State)', fmt(gst.total_sgst), '#7C3AED'],
                ['Total IGST (Inter-state)', fmt(gst.total_igst || 0), '#D97706'],
                ['Grand Total Tax', fmt((gst.total_cgst||0) + (gst.total_sgst||0) + (gst.total_igst||0)), '#DC2626'],
              ].map(([l, v, color]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F8FAFC' }}>
                  <span style={{ color: '#64748B', fontSize: 14 }}>{l}</span>
                  <span style={{ fontWeight: 700, color: color as string, fontSize: 14 }}>{v as string}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Invoice Line Items */}
          {gst.line_items && gst.line_items.length > 0 && (
            <div className="card">
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', fontWeight: 700, fontSize: 14 }}>
                GST Invoice Records ({gst.line_items.length} invoices)
                <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 400, marginLeft: 8 }}>Only GST-applicable invoices shown</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Invoice #</th><th>Date</th><th>Customer</th><th>GSTIN</th>
                      <th>Taxable ₹</th><th>CGST ₹</th><th>SGST ₹</th><th>IGST ₹</th>
                      <th>Total Tax</th><th>Invoice Total</th><th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gst.line_items.map((r: any, i: number) => (
                      <tr key={i}>
                        <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#1B4FD8', fontWeight: 700 }}>{r.invoice_number}</td>
                        <td style={{ fontSize: 12, color: '#64748B', whiteSpace: 'nowrap' }}>{r.date ? new Date(r.date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—'}</td>
                        <td style={{ fontSize: 13 }}>{r.customer_name || '—'}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 11, color: r.gstin ? '#059669' : '#94A3B8' }}>{r.gstin || 'B2C'}</td>
                        <td style={{ fontWeight: 600 }}>₹{(r.taxable_amount||0).toLocaleString('en-IN')}</td>
                        <td style={{ color: '#7C3AED', fontWeight: 600 }}>₹{(r.cgst||0).toLocaleString('en-IN')}</td>
                        <td style={{ color: '#7C3AED', fontWeight: 600 }}>₹{(r.sgst||0).toLocaleString('en-IN')}</td>
                        <td style={{ color: '#D97706' }}>₹{(r.igst||0).toLocaleString('en-IN')}</td>
                        <td style={{ fontWeight: 700, color: '#DC2626' }}>₹{(r.total_tax||0).toLocaleString('en-IN')}</td>
                        <td style={{ fontWeight: 700 }}>₹{(r.invoice_total||0).toLocaleString('en-IN')}</td>
                        <td>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: r.gstin ? '#EFF6FF' : '#F0FDF4', color: r.gstin ? '#1B4FD8' : '#059669', fontWeight: 700 }}>
                            {r.type || (r.gstin ? 'B2B' : 'B2C')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
