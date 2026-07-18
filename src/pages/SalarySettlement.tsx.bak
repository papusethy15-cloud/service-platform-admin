import { useState, useEffect, useCallback } from 'react'
import { api } from '@/services/api'
import Toast, { useToast } from '@/components/ui/Toast'
import Modal from '@/components/ui/Modal'

// ── helpers ───────────────────────────────────────────────────────────────────
const INR = (n: number | null | undefined) =>
  `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function statusBadge(status: string | null) {
  if (!status) return <span style={{ fontSize: 11, color: '#94A3B8' }}>Not Generated</span>
  const cfg: Record<string, { bg: string; color: string }> = {
    GENERATED:    { bg: '#EFF6FF', color: '#1D4ED8' },
    PAID:         { bg: '#ECFDF5', color: '#065F46' },
    SENT_TO_BANK: { bg: '#F0FDF4', color: '#14532D' },
  }
  const c = cfg[status] || { bg: '#F1F5F9', color: '#475569' }
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: c.bg, color: c.color }}>{status.replace('_',' ')}</span>
}

function bookingStatusColor(status: string) {
  const m: Record<string, string> = {
    COMPLETED: '#059669', CANCELLED: '#EF4444', IN_PROGRESS: '#F59E0B',
    CONFIRMED: '#1D4ED8', PENDING: '#64748B', CALLED: '#7C3AED',
  }
  return m[status] || '#64748B'
}

// ── Tab bar ───────────────────────────────────────────────────────────────────
type TabKey = 'bookings' | 'attendance' | 'cash' | 'revenue' | 'salary'

function TabBar({ tabs, active, onSelect }: { tabs: { key: TabKey; label: string }[]; active: TabKey; onSelect: (k: TabKey) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 10, padding: 4, marginBottom: 20 }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => onSelect(t.key)}
          style={{
            flex: 1, padding: '7px 10px', border: 'none', cursor: 'pointer', borderRadius: 8,
            fontSize: 12, fontWeight: active === t.key ? 700 : 500,
            background: active === t.key ? 'white' : 'transparent',
            color: active === t.key ? '#1B4FD8' : '#64748B',
            boxShadow: active === t.key ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
            transition: 'all 0.15s',
          }}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function SalarySettlement() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year,  setYear]  = useState(now.getFullYear())
  const [list,  setList]  = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // Generate/Edit modal
  const [genModal,    setGenModal]    = useState<any | null>(null)
  const [genForm,     setGenForm]     = useState<any>({})
  const [genLoading,  setGenLoading]  = useState(false)
  const [genTab,      setGenTab]      = useState<TabKey>('bookings')
  const [preview,     setPreview]     = useState<any | null>(null)
  const [prevLoading, setPrevLoading] = useState(false)

  // View details modal
  const [viewData,    setViewData]    = useState<any | null>(null)
  const [viewLoading, setViewLoading] = useState(false)
  const [viewTab,     setViewTab]     = useState<TabKey>('bookings')

  // Pay modal
  const [payModal,   setPayModal]   = useState<any | null>(null)
  const [payLoading, setPayLoading] = useState(false)
  const [walletInfo, setWalletInfo] = useState<any | null>(null)
  const [payForm,    setPayForm]    = useState({ payout_method: 'UPI', payment_reference: '' })

  const { toasts, removeToast, toast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(`/salary-settlements/groups/salary-technicians?month=${month}&year=${year}`)
      setList(res.data?.data?.technicians || [])
    } catch {
      toast.error('Failed to load salary technicians')
    } finally {
      setLoading(false)
    }
  }, [month, year])

  useEffect(() => { load() }, [load])

  // ── Load preview data ─────────────────────────────────────────────────────
  const loadPreview = async (row: any) => {
    setPrevLoading(true)
    setPreview(null)
    try {
      const res = await api.get(`/salary-settlements/preview?technician_id=${row.technician_id}&month=${month}&year=${year}`)
      setPreview(res.data?.data || null)
    } catch {
      setPreview(null)
    } finally {
      setPrevLoading(false)
    }
  }

  // ── Open Generate Modal ──────────────────────────────────────────────────
  const openGenerate = (row: any) => {
    setGenModal(row)
    setGenTab('bookings')
    setGenForm({
      monthly_salary:   row.monthly_salary || 0,
      petrol_amount:    0,
      mobile_recharge:  0,
      bonus_amount:     0,
      hra_amount:       0,
      other_allowances: 0,
      deductions:       0,
      deduction_notes:  '',
      admin_notes:      '',
    })
    loadPreview(row)
  }

  const openEdit = async (row: any) => {
    if (!row.settlement_id) { openGenerate(row); return }
    setViewLoading(true)
    try {
      const res = await api.get(`/salary-settlements/${row.settlement_id}`)
      const d = res.data?.data || {}
      setGenModal(row)
      setGenTab('bookings')
      setGenForm({
        monthly_salary:   d.monthly_salary   || 0,
        petrol_amount:    d.petrol_amount    || 0,
        mobile_recharge:  d.mobile_recharge  || 0,
        bonus_amount:     d.bonus_amount     || 0,
        hra_amount:       d.hra_amount       || 0,
        other_allowances: d.other_allowances || 0,
        deductions:       d.deductions       || 0,
        deduction_notes:  d.deduction_notes  || '',
        admin_notes:      d.admin_notes      || '',
        _settlement_id:   d.id,
        _status:          d.status,
      })
      setPreview({
        summary: {
          total_bookings:     d.total_bookings    || 0,
          attendance_days:    d.attendance_days   || 0,
          total_hours_worked: d.total_hours_worked || 0,
          cash_in_hand_total: d.cash_collections?.reduce((s: number, c: any) => s + (c.amount || 0), 0) || 0,
          cash_in_hand_count: d.cash_collections?.length || 0,
          revenue_cash:       d.revenue_summary?.cash_total     || 0,
          revenue_online:     d.revenue_summary?.online_total   || 0,
          revenue_pay_later:  d.revenue_summary?.pay_later_total || 0,
          revenue_total:      d.revenue_summary?.total_revenue  || 0,
        },
        bookings:             d.bookings            || [],
        attendance:           d.attendance          || [],
        cash_collections:     d.cash_collections    || [],
        revenue_transactions: d.revenue_transactions || [],
      })
    } catch {
      toast.error('Failed to load settlement')
    } finally {
      setViewLoading(false)
    }
  }

  const saveGenerate = async () => {
    if (!genModal) return
    setGenLoading(true)
    try {
      if (genForm._settlement_id && genForm._status === 'GENERATED') {
        await api.patch(`/salary-settlements/${genForm._settlement_id}`, genForm)
        toast.success('Settlement updated')
      } else {
        await api.post('/salary-settlements/generate', {
          technician_id: genModal.technician_id,
          month, year,
          ...genForm,
        })
        toast.success('Salary settlement generated')
      }
      setGenModal(null)
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to save settlement')
    } finally {
      setGenLoading(false)
    }
  }

  // ── View Details ──────────────────────────────────────────────────────────
  const openView = async (row: any) => {
    if (!row.settlement_id) return
    setViewLoading(true)
    setViewTab('bookings')
    try {
      const res = await api.get(`/salary-settlements/${row.settlement_id}`)
      setViewData(res.data?.data || null)
    } catch {
      toast.error('Failed to load details')
    } finally {
      setViewLoading(false)
    }
  }

  // ── Pay Salary ────────────────────────────────────────────────────────────
  const openPay = async (row: any) => {
    if (!row.settlement_id) return
    setPayModal(row)
    setPayForm({ payout_method: 'UPI', payment_reference: '' })
    try {
      const res = await api.get(`/salary-settlements/technician/${row.technician_id}/wallet-info`)
      setWalletInfo(res.data?.data || null)
    } catch {
      setWalletInfo(null)
    }
  }

  const paySalary = async () => {
    if (!payModal) return
    setPayLoading(true)
    try {
      await api.post(`/salary-settlements/${payModal.settlement_id}/pay`, payForm)
      toast.success(`Salary credited to ${payModal.technician_name}'s wallet`)
      setPayModal(null)
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to pay salary')
    } finally {
      setPayLoading(false)
    }
  }

  const sendToBank = async () => {
    if (!payModal) return
    setPayLoading(true)
    try {
      await api.post(`/salary-settlements/${payModal.settlement_id}/send-to-bank`, payForm)
      toast.success(`Transfer initiated for ${payModal.technician_name}`)
      setPayModal(null)
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to initiate transfer')
    } finally {
      setPayLoading(false)
    }
  }

  // ── Salary form calc ──────────────────────────────────────────────────────
  const gross = (f: any) =>
    (Number(f.monthly_salary)||0) + (Number(f.petrol_amount)||0) +
    (Number(f.mobile_recharge)||0) + (Number(f.bonus_amount)||0) +
    (Number(f.hra_amount)||0) + (Number(f.other_allowances)||0)
  const net = (f: any) => gross(f) - (Number(f.deductions)||0)

  // ── Shared summary bar ────────────────────────────────────────────────────
  const SummaryBar = ({ s }: { s: any }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 16 }}>
      {[
        { icon: '\u{1F4CB}', label: 'Bookings',    val: s.total_bookings    || 0 },
        { icon: '\u{1F5D3}\uFE0F', label: 'Attendance', val: `${s.attendance_days || 0} days` },
        { icon: '\u{1F4B5}', label: 'Cash in Hand', val: INR(s.cash_in_hand_total || 0) },
        { icon: '\u{1F4B0}', label: 'Revenue',      val: INR(s.revenue_total  || 0) },
      ].map(({ icon, label, val }) => (
        <div key={label} style={{ background: '#F8FAFC', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 18 }}>{icon}</div>
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{label}</div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A', marginTop: 2 }}>{val}</div>
        </div>
      ))}
    </div>
  )

  // ── Tab content renderer ──────────────────────────────────────────────────
  const renderPreviewTab = (tab: TabKey, data: any) => {
    if (!data) return <div style={{ padding: 30, textAlign: 'center', color: '#94A3B8' }}>No data available</div>

    if (tab === 'bookings') {
      const bk = data.bookings || []
      if (!bk.length) return <div style={{ padding: 20, textAlign: 'center', color: '#94A3B8' }}>No bookings this month</div>
      const counts: Record<string, number> = {}
      bk.forEach((b: any) => { counts[b.status] = (counts[b.status] || 0) + 1 })
      return (
        <div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {Object.entries(counts).map(([st, cnt]) => (
              <span key={st} style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20,
                background: bookingStatusColor(st) + '18', color: bookingStatusColor(st), border: `1px solid ${bookingStatusColor(st)}40` }}>
                {st}: {cnt}
              </span>
            ))}
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>#</th><th>Booking No</th><th>Service</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {bk.map((b: any, i: number) => (
                  <tr key={b.id}>
                    <td style={{ fontSize: 11 }}>{i+1}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{b.booking_number || b.id.slice(0,8)}</td>
                    <td style={{ fontSize: 12 }}>{b.service_name || '\u2014'}</td>
                    <td style={{ fontSize: 11, color: '#64748B' }}>{b.scheduled_date || b.created_at?.slice(0,10)}</td>
                    <td style={{ fontSize: 12, fontWeight: 600 }}>{b.total_amount ? INR(b.total_amount) : '\u2014'}</td>
                    <td>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                        background: bookingStatusColor(b.status) + '18', color: bookingStatusColor(b.status) }}>
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    }

    if (tab === 'attendance') {
      const att = data.attendance || []
      if (!att.length) return <div style={{ padding: 20, textAlign: 'center', color: '#94A3B8' }}>No attendance records</div>
      const statusColor = (s: string) => s === 'PRESENT' ? '#059669' : s === 'ABSENT' ? '#EF4444' : s === 'HALF_DAY' ? '#F59E0B' : '#64748B'
      const presentDays = att.filter((a: any) => a.status === 'PRESENT').length
      const halfDays    = att.filter((a: any) => a.status === 'HALF_DAY').length
      const absentDays  = att.filter((a: any) => a.status === 'ABSENT').length
      return (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            {([['Present', presentDays, '#059669'], ['Half Day', halfDays, '#F59E0B'], ['Absent', absentDays, '#EF4444']] as const).map(([l, v, c]) => (
              <div key={l} style={{ flex: 1, background: c + '12', borderRadius: 8, padding: '8px 12px', textAlign: 'center', border: `1px solid ${c}30` }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: c }}>{v}</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(148px,1fr))', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
            {att.map((a: any) => (
              <div key={a.date} style={{ background: statusColor(a.status) + '10', border: `1px solid ${statusColor(a.status)}25`, borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: '#0F172A' }}>{a.date}</div>
                <div style={{ fontSize: 11, color: statusColor(a.status), fontWeight: 600, marginTop: 2 }}>{a.status}</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>{a.hours_worked}h worked</div>
                {a.check_in  && <div style={{ fontSize: 10, color: '#94A3B8' }}>In: {String(a.check_in).slice(11,16)}</div>}
                {a.check_out && <div style={{ fontSize: 10, color: '#94A3B8' }}>Out: {String(a.check_out).slice(11,16)}</div>}
              </div>
            ))}
          </div>
        </div>
      )
    }

    if (tab === 'cash') {
      const cc = data.cash_collections || []
      if (!cc.length) return <div style={{ padding: 20, textAlign: 'center', color: '#94A3B8' }}>No cash collection records</div>
      const total = cc.reduce((s: number, c: any) => s + (c.amount || 0), 0)
      return (
        <div>
          <div style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 10, padding: '10px 16px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#065F46', fontWeight: 600 }}>Total Cash Collected</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#059669' }}>{INR(total)}</span>
          </div>
          <div style={{ maxHeight: 250, overflowY: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>#</th><th>Amount</th><th>Status</th><th>Collected At</th><th>Notes</th></tr></thead>
              <tbody>
                {cc.map((c: any, i: number) => (
                  <tr key={c.id}>
                    <td style={{ fontSize: 11 }}>{i+1}</td>
                    <td style={{ fontWeight: 700, color: '#059669' }}>{INR(c.amount)}</td>
                    <td>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                        background: c.status === 'SUBMITTED' ? '#ECFDF5' : '#FFFBEB',
                        color:      c.status === 'SUBMITTED' ? '#059669' : '#92400E' }}>
                        {c.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: '#64748B' }}>{c.collected_at ? c.collected_at.slice(0,10) : '\u2014'}</td>
                    <td style={{ fontSize: 11, color: '#94A3B8' }}>{c.notes || '\u2014'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    }

    if (tab === 'revenue') {
      const txns = data.revenue_transactions || []
      const s    = data.summary || {}
      return (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
            {[
              { label: 'Cash',      val: INR(s.revenue_cash      || 0), bg: '#ECFDF5', color: '#059669' },
              { label: 'Online',    val: INR(s.revenue_online    || 0), bg: '#EFF6FF', color: '#1D4ED8' },
              { label: 'Pay Later', val: INR(s.revenue_pay_later || 0), bg: '#FFFBEB', color: '#92400E' },
            ].map(({ label, val, bg, color }) => (
              <div key={label} style={{ background: bg, borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color, fontWeight: 600 }}>{label}</div>
                <div style={{ fontWeight: 800, fontSize: 15, color, marginTop: 4 }}>{val}</div>
              </div>
            ))}
          </div>
          {txns.length ? (
            <div style={{ maxHeight: 240, overflowY: 'auto' }}>
              <table className="data-table">
                <thead><tr><th>#</th><th>Method</th><th>Amount</th><th>Txn No</th><th>Date</th></tr></thead>
                <tbody>
                  {txns.map((p: any, i: number) => (
                    <tr key={p.id}>
                      <td style={{ fontSize: 11 }}>{i+1}</td>
                      <td>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                          background: p.method === 'CASH' ? '#ECFDF5' : p.method === 'PAY_LATER' ? '#FFFBEB' : '#EFF6FF',
                          color:      p.method === 'CASH' ? '#059669' : p.method === 'PAY_LATER' ? '#92400E' : '#1D4ED8' }}>
                          {p.method}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: '#059669' }}>{INR(p.amount)}</td>
                      <td style={{ fontSize: 11, fontFamily: 'monospace' }}>{p.transaction_number || '\u2014'}</td>
                      <td style={{ fontSize: 11, color: '#64748B' }}>{p.created_at?.slice(0,10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 20, textAlign: 'center', color: '#94A3B8' }}>No payment transactions</div>
          )}
        </div>
      )
    }

    return null
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="page-container">
      <Toast toasts={toasts} onRemove={removeToast} />

      <div className="page-header">
        <div>
          <h1 className="page-title">Salary Settlement</h1>
          <p className="page-subtitle">Manage monthly salary for salary-group technicians</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select className="input" style={{ width: 130 }} value={month} onChange={e => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select className="input" style={{ width: 90 }} value={year} onChange={e => setYear(Number(e.target.value))}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Loading salary technicians...</div>
      ) : list.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>
          No salary-group technicians found. Create a salary commission group and assign technicians.
        </div>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th><th>Technician</th><th>Group</th><th>Monthly Salary</th>
                <th>Bookings</th><th>Attendance</th><th>Hours</th>
                <th>Net Salary</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((row, i) => (
                <tr key={row.technician_id}>
                  <td>{i+1}</td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{row.technician_name}</div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>{row.technician_mobile}</div>
                  </td>
                  <td style={{ fontSize: 12 }}>{row.group_name}</td>
                  <td style={{ fontWeight: 600 }}>{INR(row.monthly_salary)}</td>
                  <td style={{ textAlign: 'center' }}>{row.total_bookings}</td>
                  <td style={{ textAlign: 'center' }}>{row.attendance_days} days</td>
                  <td style={{ textAlign: 'center' }}>{row.total_hours_worked}h</td>
                  <td style={{ fontWeight: 700, color: '#065F46' }}>{row.net_salary != null ? INR(row.net_salary) : '\u2014'}</td>
                  <td>{statusBadge(row.settlement_status)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {!row.settlement_id ? (
                        <button className="btn-primary" style={{ fontSize: 11, padding: '4px 10px' }}
                          onClick={() => openGenerate(row)}>Generate</button>
                      ) : (
                        <>
                          <button className="btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }}
                            onClick={() => openView(row)}>View</button>
                          {row.settlement_status === 'GENERATED' && (
                            <button className="btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }}
                              onClick={() => openEdit(row)}>Edit</button>
                          )}
                          {row.settlement_status === 'GENERATED' && (
                            <button className="btn-primary" style={{ fontSize: 11, padding: '4px 10px', background: '#059669' }}
                              onClick={() => openPay(row)}>Pay</button>
                          )}
                          {row.settlement_status === 'PAID' && (
                            <button className="btn-primary" style={{ fontSize: 11, padding: '4px 10px', background: '#7C3AED' }}
                              onClick={() => openPay(row)}>Send to Bank</button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Generate / Edit Modal */}
      {genModal && (
        <Modal
          title={`${genForm._settlement_id ? 'Edit' : 'Generate'} Salary \u2014 ${genModal.technician_name}`}
          onClose={() => setGenModal(null)}
          size="xl"
        >
          <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 12, color: '#92400E', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span>Period: {MONTHS[month-1]} {year}</span>
            <span>Group: {genModal.group_name}</span>
            <span>Bookings: {genModal.total_bookings}</span>
            <span>Attendance: {genModal.attendance_days} days</span>
          </div>

          {prevLoading && (
            <div style={{ padding: '12px 0', textAlign: 'center', fontSize: 12, color: '#94A3B8' }}>Loading technician data...</div>
          )}
          {preview && !prevLoading && <SummaryBar s={preview.summary} />}

          <TabBar
            tabs={[
              { key: 'bookings',   label: 'Bookings'    },
              { key: 'attendance', label: 'Attendance'  },
              { key: 'cash',       label: 'Cash In Hand' },
              { key: 'revenue',    label: 'Revenue'     },
              { key: 'salary',     label: 'Salary Form' },
            ]}
            active={genTab}
            onSelect={setGenTab}
          />

          {genTab !== 'salary' ? (
            prevLoading
              ? <div style={{ padding: 30, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>Loading data...</div>
              : renderPreviewTab(genTab, preview)
          ) : (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { key: 'monthly_salary',   label: 'Basic Salary (Rs.) *' },
                  { key: 'petrol_amount',    label: 'Petrol (Rs.)' },
                  { key: 'mobile_recharge',  label: 'Mobile Recharge (Rs.)' },
                  { key: 'bonus_amount',     label: 'Bonus (Rs.)' },
                  { key: 'hra_amount',       label: 'HRA (Rs.)' },
                  { key: 'other_allowances', label: 'Other Allowances (Rs.)' },
                  { key: 'deductions',       label: 'Deductions (Rs.)' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>{label}</label>
                    <input className="input" type="number" min="0"
                      value={genForm[key] ?? ''}
                      onChange={e => setGenForm((f: any) => ({ ...f, [key]: Number(e.target.value) }))} />
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Deduction Notes</label>
                  <input className="input" value={genForm.deduction_notes || ''}
                    onChange={e => setGenForm((f: any) => ({ ...f, deduction_notes: e.target.value }))} />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Admin Notes</label>
                  <input className="input" value={genForm.admin_notes || ''}
                    onChange={e => setGenForm((f: any) => ({ ...f, admin_notes: e.target.value }))} />
                </div>
              </div>

              <div style={{ marginTop: 16, background: '#EFF6FF', borderRadius: 10, padding: 14, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: '#475569' }}>Gross Salary</span>
                  <span style={{ fontWeight: 700 }}>{INR(gross(genForm))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: '#EF4444' }}>Deductions</span>
                  <span style={{ fontWeight: 700, color: '#EF4444' }}>-{INR(genForm.deductions || 0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #BFDBFE', paddingTop: 6, marginTop: 6 }}>
                  <span style={{ fontWeight: 700, color: '#1D4ED8' }}>Net Salary</span>
                  <span style={{ fontWeight: 800, fontSize: 16, color: '#1D4ED8' }}>{INR(net(genForm))}</span>
                </div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 6 }}>* Market part reimbursement will be auto-calculated and added</div>
              </div>

              <div className="modal-footer" style={{ marginTop: 20 }}>
                <button className="btn-secondary" onClick={() => setGenModal(null)}>Cancel</button>
                <button className="btn-primary" onClick={saveGenerate} disabled={genLoading}>
                  {genLoading ? 'Saving...' : genForm._settlement_id ? 'Update Settlement' : 'Generate Settlement'}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* View Details Modal */}
      {viewLoading && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 32, fontSize: 14, color: '#64748B' }}>Loading details...</div>
        </div>
      )}
      {viewData && !viewLoading && (
        <Modal
          title={`Salary Report \u2014 ${viewData.technician_name}`}
          onClose={() => setViewData(null)}
          size="xl"
        >
          <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#64748B' }}>Period: {MONTHS[(viewData.month||1)-1]} {viewData.year}</span>
            <span style={{ fontSize: 12, color: '#64748B' }}>Group: {viewData.commission_group_name || '\u2014'}</span>
            {statusBadge(viewData.status)}
          </div>

          <SummaryBar s={{
            total_bookings:    viewData.total_bookings || 0,
            attendance_days:   viewData.attendance_days || 0,
            total_hours_worked: viewData.total_hours_worked || 0,
            cash_in_hand_total: viewData.cash_collections?.reduce((s: number, c: any) => s + (c.amount || 0), 0) || 0,
            revenue_total:     viewData.revenue_summary?.total_revenue || 0,
          }} />

          <div style={{ background: '#EFF6FF', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 13 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#1D4ED8', marginBottom: 10 }}>Salary Breakdown</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px' }}>
              {[
                ['Basic Salary',     viewData.monthly_salary],
                ['Petrol',           viewData.petrol_amount],
                ['Mobile Recharge',  viewData.mobile_recharge],
                ['Bonus',            viewData.bonus_amount],
                ['HRA',              viewData.hra_amount],
                ['Other Allowances', viewData.other_allowances],
              ].filter(([, v]) => (v as number) > 0).map(([label, val]) => (
                <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#475569' }}>{label}</span>
                  <span style={{ fontWeight: 600 }}>{INR(val as number)}</span>
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid #BFDBFE', marginTop: 8, paddingTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Gross</span><span style={{ fontWeight: 700 }}>{INR(viewData.gross_salary)}</span>
              </div>
              {viewData.deductions > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#EF4444' }}>
                  <span>Deductions {viewData.deduction_notes ? `(${viewData.deduction_notes})` : ''}</span>
                  <span style={{ fontWeight: 700 }}>-{INR(viewData.deductions)}</span>
                </div>
              )}
              {viewData.market_reimbursement > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669' }}>
                  <span>Market Reimbursement</span>
                  <span style={{ fontWeight: 700 }}>{INR(viewData.market_reimbursement)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #1D4ED8', marginTop: 6, paddingTop: 6, fontSize: 15 }}>
                <span style={{ fontWeight: 700, color: '#1D4ED8' }}>Net Salary</span>
                <span style={{ fontWeight: 800, color: '#1D4ED8' }}>{INR(viewData.net_salary)}</span>
              </div>
            </div>
          </div>

          <TabBar
            tabs={[
              { key: 'bookings',   label: 'Bookings'    },
              { key: 'attendance', label: 'Attendance'  },
              { key: 'cash',       label: 'Cash In Hand' },
              { key: 'revenue',    label: 'Revenue'     },
            ]}
            active={viewTab}
            onSelect={setViewTab}
          />
          {renderPreviewTab(viewTab, {
            bookings:            viewData.bookings            || [],
            attendance:          viewData.attendance          || [],
            cash_collections:    viewData.cash_collections    || [],
            revenue_transactions: viewData.revenue_transactions || [],
            summary: {
              revenue_cash:       viewData.revenue_summary?.cash_total      || 0,
              revenue_online:     viewData.revenue_summary?.online_total    || 0,
              revenue_pay_later:  viewData.revenue_summary?.pay_later_total || 0,
              revenue_total:      viewData.revenue_summary?.total_revenue   || 0,
              cash_in_hand_total: viewData.cash_collections?.reduce((s: number, c: any) => s + (c.amount || 0), 0) || 0,
            },
          })}

          <div className="modal-footer" style={{ marginTop: 20 }}>
            <button className="btn-secondary" onClick={() => setViewData(null)}>Close</button>
          </div>
        </Modal>
      )}

      {/* Pay Salary Modal */}
      {payModal && (
        <Modal
          title={payModal.settlement_status === 'PAID' ? 'Send to Bank/UPI' : 'Pay Salary'}
          onClose={() => setPayModal(null)}
          size="sm"
        >
          <div style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{payModal.technician_name}</div>
            <div style={{ color: '#065F46' }}>Net Salary: <strong>{INR(payModal.net_salary)}</strong></div>
          </div>

          {walletInfo && (
            <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13 }}>Current Wallet</div>
              <div>Balance: <strong>{INR(walletInfo.wallet?.balance)}</strong></div>
              {walletInfo.upi_id     && <div style={{ marginTop: 4 }}>UPI: {walletInfo.upi_id}</div>}
              {walletInfo.bank_account && <div>Bank A/C: {walletInfo.bank_account} | IFSC: {walletInfo.bank_ifsc}</div>}
            </div>
          )}

          {payModal.settlement_status === 'GENERATED' ? (
            <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: 12, fontSize: 12, color: '#92400E', marginBottom: 16 }}>
              This will credit <strong>{INR(payModal.net_salary)}</strong> to the technician wallet as a SALARY transaction.
            </div>
          ) : (
            <>
              <div style={{ background: '#EDE9FE', border: '1px solid #C4B5FD', borderRadius: 8, padding: 12, fontSize: 12, color: '#5B21B6', marginBottom: 16 }}>
                Salary is in wallet (balance: <strong>{INR(walletInfo?.wallet?.balance)}</strong>). This will transfer the entire wallet balance to bank/UPI.
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Payout Method *</label>
                <select className="input" value={payForm.payout_method}
                  onChange={e => setPayForm(f => ({ ...f, payout_method: e.target.value }))}>
                  <option value="UPI">UPI</option>
                  <option value="BANK">Bank Transfer</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  {payForm.payout_method === 'UPI' ? 'UPI ID / Transaction Ref' : 'Bank A/C / UTR Reference'}
                </label>
                <input className="input" placeholder="Payment reference / UTR"
                  value={payForm.payment_reference}
                  onChange={e => setPayForm(f => ({ ...f, payment_reference: e.target.value }))} />
              </div>
            </>
          )}

          <div className="modal-footer" style={{ marginTop: 20 }}>
            <button className="btn-secondary" onClick={() => setPayModal(null)}>Cancel</button>
            {payModal.settlement_status === 'GENERATED' ? (
              <button className="btn-primary" style={{ background: '#059669' }} onClick={paySalary} disabled={payLoading}>
                {payLoading ? 'Processing...' : `Credit ${INR(payModal.net_salary)} to Wallet`}
              </button>
            ) : (
              <button className="btn-primary" style={{ background: '#7C3AED' }} onClick={sendToBank} disabled={payLoading}>
                {payLoading ? 'Processing...' : 'Send to Bank/UPI'}
              </button>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
