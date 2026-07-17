import { useState, useEffect, useCallback } from 'react'
import { api } from '@/services/api'
import Toast, { useToast } from '@/components/ui/Toast'

// ── helpers ──────────────────────────────────────────────────────────────────
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

// ── Main Component ────────────────────────────────────────────────────────────
export default function SalarySettlement() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year,  setYear]  = useState(now.getFullYear())
  const [list,  setList]  = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // Generate/Edit modal
  const [genModal,   setGenModal]   = useState<any | null>(null)  // row from list
  const [genForm,    setGenForm]    = useState<any>({})
  const [genLoading, setGenLoading] = useState(false)

  // View details modal
  const [viewData,    setViewData]    = useState<any | null>(null)
  const [viewLoading, setViewLoading] = useState(false)

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

  // ── Open Generate Modal ──────────────────────────────────────────────────
  const openGenerate = (row: any) => {
    setGenModal(row)
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
  }

  const openEdit = async (row: any) => {
    if (!row.settlement_id) { openGenerate(row); return }
    setViewLoading(true)
    setViewData(null)
    try {
      const res = await api.get(`/salary-settlements/${row.settlement_id}`)
      const d = res.data?.data || {}
      setGenModal(row)
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
        // Update existing
        await api.patch(`/salary-settlements/${genForm._settlement_id}`, genForm)
        toast.success('Settlement updated')
      } else {
        // Generate new
        await api.post('/salary-settlements/generate', {
          technician_id:  genModal.technician_id,
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
    // Load wallet info
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

  // ── Gross preview ─────────────────────────────────────────────────────────
  const gross = (f: any) =>
    (Number(f.monthly_salary)||0) + (Number(f.petrol_amount)||0) +
    (Number(f.mobile_recharge)||0) + (Number(f.bonus_amount)||0) +
    (Number(f.hra_amount)||0) + (Number(f.other_allowances)||0)
  const net = (f: any) => gross(f) - (Number(f.deductions)||0)

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="page-container">
      <Toast toasts={toasts} onRemove={removeToast} />

      <div className="page-header">
        <div>
          <h1 className="page-title">🏦 Salary Settlement</h1>
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
        <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Loading salary technicians…</div>
      ) : list.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>
          No salary-group technicians found. Create a salary commission group and assign technicians.
        </div>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Technician</th>
                <th>Group</th>
                <th>Monthly Salary</th>
                <th>Bookings</th>
                <th>Attendance</th>
                <th>Hours</th>
                <th>Net Salary</th>
                <th>Status</th>
                <th>Actions</th>
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
                  <td style={{ fontWeight: 700, color: '#065F46' }}>{row.net_salary != null ? INR(row.net_salary) : '—'}</td>
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

      {/* ── Generate / Edit Modal ── */}
      {genModal && (
        <div className="modal-overlay" onClick={() => setGenModal(null)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{genForm._settlement_id ? 'Edit' : 'Generate'} Salary — {genModal.technician_name}</h2>
              <button className="modal-close" onClick={() => setGenModal(null)}>✕</button>
            </div>
            <div style={{ padding: '0 24px 24px' }}>
              <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: '#92400E' }}>
                📅 {MONTHS[month-1]} {year} &nbsp;|&nbsp; Group: {genModal.group_name} &nbsp;|&nbsp; Bookings: {genModal.total_bookings} &nbsp;|&nbsp; Attendance: {genModal.attendance_days} days
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { key: 'monthly_salary',   label: 'Basic Salary (₹) *' },
                  { key: 'petrol_amount',    label: 'Petrol (₹)' },
                  { key: 'mobile_recharge',  label: 'Mobile Recharge (₹)' },
                  { key: 'bonus_amount',     label: 'Bonus (₹)' },
                  { key: 'hra_amount',       label: 'HRA (₹)' },
                  { key: 'other_allowances', label: 'Other Allowances (₹)' },
                  { key: 'deductions',       label: 'Deductions (₹)' },
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

              {/* Summary */}
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
                  {genLoading ? 'Saving…' : genForm._settlement_id ? 'Update Settlement' : 'Generate Settlement'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── View Details Modal ── */}
      {viewData && (
        <div className="modal-overlay" onClick={() => setViewData(null)}>
          <div className="modal" style={{ maxWidth: 680, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📋 Salary Report — {viewData.technician_name}</h2>
              <button className="modal-close" onClick={() => setViewData(null)}>✕</button>
            </div>
            <div style={{ padding: '0 24px 24px' }}>

              {/* Header Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                {[
                  ['Period', `${MONTHS[(viewData.month||1)-1]} ${viewData.year}`],
                  ['Group',  viewData.commission_group_name || '—'],
                  ['Status', ''],
                  ['Total Bookings', viewData.total_bookings],
                  ['Attendance Days', viewData.attendance_days],
                  ['Hours Worked',   `${viewData.total_hours_worked}h`],
                ].map(([label, val], i) => (
                  <div key={i} style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, color: '#64748B', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>
                      {label === 'Status' ? statusBadge(viewData.status) : val}
                    </div>
                  </div>
                ))}
              </div>

              {/* Salary Breakdown */}
              <div style={{ background: '#EFF6FF', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#1D4ED8', marginBottom: 12 }}>💰 Salary Breakdown</div>
                {[
                  ['Basic Salary',       viewData.monthly_salary],
                  ['Petrol',             viewData.petrol_amount],
                  ['Mobile Recharge',    viewData.mobile_recharge],
                  ['Bonus',              viewData.bonus_amount],
                  ['HRA',                viewData.hra_amount],
                  ['Other Allowances',   viewData.other_allowances],
                ].filter(([, v]) => (v as number) > 0).map(([label, val]) => (
                  <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                    <span style={{ color: '#475569' }}>{label}</span>
                    <span style={{ fontWeight: 600 }}>{INR(val as number)}</span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid #BFDBFE', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>Gross Salary</span><span style={{ fontWeight: 700 }}>{INR(viewData.gross_salary)}</span>
                </div>
                {viewData.deductions > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#EF4444' }}>
                    <span>Deductions {viewData.deduction_notes ? `(${viewData.deduction_notes})` : ''}</span>
                    <span style={{ fontWeight: 700 }}>-{INR(viewData.deductions)}</span>
                  </div>
                )}
                {viewData.market_reimbursement > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#059669' }}>
                    <span>🛒 Market Part Reimbursement</span>
                    <span style={{ fontWeight: 700 }}>{INR(viewData.market_reimbursement)}</span>
                  </div>
                )}
                <div style={{ borderTop: '2px solid #1D4ED8', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 15 }}>
                  <span style={{ fontWeight: 700, color: '#1D4ED8' }}>Net Salary</span>
                  <span style={{ fontWeight: 800, color: '#1D4ED8' }}>{INR(viewData.net_salary)}</span>
                </div>
              </div>

              {/* Attendance */}
              {viewData.attendance?.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A', marginBottom: 8 }}>🗓️ Attendance</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px,1fr))', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                    {viewData.attendance.map((a: any) => (
                      <div key={a.date} style={{ background: a.status === 'PRESENT' ? '#ECFDF5' : a.status === 'ABSENT' ? '#FEF2F2' : '#FFFBEB', borderRadius: 6, padding: '6px 10px', fontSize: 12 }}>
                        <div style={{ fontWeight: 600 }}>{a.date}</div>
                        <div style={{ color: '#64748B' }}>{a.status} · {a.hours_worked}h</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bookings */}
              {viewData.bookings?.length > 0 && (
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A', marginBottom: 8 }}>📦 Bookings ({viewData.bookings.length})</div>
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    <table className="data-table">
                      <thead><tr><th>#</th><th>Booking No</th><th>Status</th><th>Date</th></tr></thead>
                      <tbody>
                        {viewData.bookings.map((b: any, i: number) => (
                          <tr key={b.id}>
                            <td>{i+1}</td>
                            <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{b.booking_number || b.id.slice(0,8)}</td>
                            <td><span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: '#EFF6FF', color: '#1D4ED8' }}>{b.status}</span></td>
                            <td style={{ fontSize: 11 }}>{b.created_at?.slice(0,10)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="modal-footer" style={{ marginTop: 20 }}>
                <button className="btn-secondary" onClick={() => setViewData(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Pay Salary Modal ── */}
      {payModal && (
        <div className="modal-overlay" onClick={() => setPayModal(null)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{payModal.settlement_status === 'PAID' ? '🏦 Send to Bank/UPI' : '💰 Pay Salary'}</h2>
              <button className="modal-close" onClick={() => setPayModal(null)}>✕</button>
            </div>
            <div style={{ padding: '0 24px 24px' }}>
              <div style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{payModal.technician_name}</div>
                <div style={{ color: '#065F46' }}>Net Salary: <strong>{INR(payModal.net_salary)}</strong></div>
              </div>

              {/* Wallet Info */}
              {walletInfo && (
                <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13 }}>👛 Current Wallet</div>
                  <div>Balance: <strong>{INR(walletInfo.wallet?.balance)}</strong></div>
                  {walletInfo.upi_id && <div style={{ marginTop: 4 }}>UPI: {walletInfo.upi_id}</div>}
                  {walletInfo.bank_account && <div>Bank A/C: {walletInfo.bank_account} | IFSC: {walletInfo.bank_ifsc}</div>}
                </div>
              )}

              {payModal.settlement_status === 'GENERATED' ? (
                <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: 12, fontSize: 12, color: '#92400E', marginBottom: 16 }}>
                  This will credit <strong>{INR(payModal.net_salary)}</strong> to the technician's wallet as a SALARY transaction. Then you can send it to their bank/UPI.
                </div>
              ) : (
                <>
                  <div style={{ background: '#EDE9FE', border: '1px solid #C4B5FD', borderRadius: 8, padding: 12, fontSize: 12, color: '#5B21B6', marginBottom: 16 }}>
                    Salary is already in wallet (balance: <strong>{INR(walletInfo?.wallet?.balance)}</strong>). This will transfer <strong>entire wallet balance</strong> to bank/UPI.
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
                    {payLoading ? 'Processing…' : `Credit ${INR(payModal.net_salary)} to Wallet`}
                  </button>
                ) : (
                  <button className="btn-primary" style={{ background: '#7C3AED' }} onClick={sendToBank} disabled={payLoading}>
                    {payLoading ? 'Processing…' : 'Send to Bank/UPI'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
