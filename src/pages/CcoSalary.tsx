// Admin — CCO Salary Management Page
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/services/api'
import PageHeader from '@/components/layout/PageHeader'
import Spinner from '@/components/ui/Spinner'
import Toast, { useToast } from '@/components/ui/Toast'
import Modal from '@/components/ui/Modal'

// ── Types ─────────────────────────────────────────────────────────────────────
interface CcoUser {
  id: string; name: string; email: string; mobile: string;
  monthly_salary: number; petrol_amount: number; mobile_recharge: number;
  bonus_amount: number; hra_amount: number; other_allowances: number;
  salary_notes: string | null;
  payout_upi_id: string | null; payout_bank_account: string | null;
  payout_bank_ifsc: string | null; payout_bank_name: string | null;
  payout_account_holder: string | null;
}

interface SlipData {
  id?: string; user_id: string; user_name: string;
  month: number; year: number;
  monthly_salary: number; petrol_amount: number; mobile_recharge: number;
  bonus_amount: number; hra_amount: number; other_allowances: number;
  deductions: number; deduction_notes: string | null;
  total_days: number; present_days: number; total_hours: number;
  gross_salary: number; net_salary: number;
  status: string; salary_notes: string | null;
  payment_method?: string | null; payment_ref?: string | null; paid_at?: string | null;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const fmt = (n: number) => `₹${(n||0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`
const fmtH = (h: number) => { const hh = Math.floor(h); const mm = Math.round((h-hh)*60); return mm ? `${hh}h ${mm}m` : `${hh}h` }

// ── CCO Edit Salary Structure Modal ──────────────────────────────────────────
function EditSalaryStructureModal({ cco, onClose, onSaved, toastFn }: {
  cco: CcoUser; onClose: () => void; onSaved: () => void;
  toastFn: { success: (t: string) => void; error: (t: string) => void };
}) {
  const [form, setForm] = useState({
    monthly_salary:   String(cco.monthly_salary   || 0),
    petrol_amount:    String(cco.petrol_amount    || 0),
    mobile_recharge:  String(cco.mobile_recharge  || 0),
    bonus_amount:     String(cco.bonus_amount     || 0),
    hra_amount:       String(cco.hra_amount       || 0),
    other_allowances: String(cco.other_allowances || 0),
    salary_notes:     cco.salary_notes || '',
    payout_upi_id:         cco.payout_upi_id || '',
    payout_bank_account:   cco.payout_bank_account || '',
    payout_bank_ifsc:      cco.payout_bank_ifsc || '',
    payout_bank_name:      cco.payout_bank_name || '',
    payout_account_holder: cco.payout_account_holder || '',
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await api.put(`/cco-attendance/admin/cco/${cco.id}/salary-structure`, {
        monthly_salary:   parseFloat(form.monthly_salary)   || 0,
        petrol_amount:    parseFloat(form.petrol_amount)    || 0,
        mobile_recharge:  parseFloat(form.mobile_recharge)  || 0,
        bonus_amount:     parseFloat(form.bonus_amount)     || 0,
        hra_amount:       parseFloat(form.hra_amount)       || 0,
        other_allowances: parseFloat(form.other_allowances) || 0,
        salary_notes:     form.salary_notes || null,
        payout_upi_id:         form.payout_upi_id         || null,
        payout_bank_account:   form.payout_bank_account   || null,
        payout_bank_ifsc:      form.payout_bank_ifsc      || null,
        payout_bank_name:      form.payout_bank_name      || null,
        payout_account_holder: form.payout_account_holder || null,
      })
      toastFn.success('Salary structure updated')
      onSaved()
      onClose()
    } catch (e: any) {
      toastFn.error(e?.response?.data?.detail || 'Failed to save')
    } finally { setSaving(false) }
  }

  const F = (label: string, key: keyof typeof form, type = 'number') => (
    <div key={key}>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>{label}</label>
      <input className="input" type={type} value={form[key]}
        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} style={{ fontSize: 13 }} />
    </div>
  )

  return (
    <Modal title={`Edit Salary — ${cco.name}`} onClose={onClose} size="lg">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        {F('Basic Salary (₹)',       'monthly_salary')}
        {F('Petrol Allowance (₹)',   'petrol_amount')}
        {F('Mobile Recharge (₹)',    'mobile_recharge')}
        {F('Bonus (₹)',              'bonus_amount')}
        {F('HRA (₹)',               'hra_amount')}
        {F('Other Allowances (₹)',   'other_allowances')}
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>SALARY NOTES</label>
        <textarea className="input" rows={2} value={form.salary_notes}
          onChange={e => setForm(p => ({ ...p, salary_notes: e.target.value }))}
          style={{ fontSize: 13, resize: 'vertical' }} />
      </div>
      <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 10 }}>PAYOUT DETAILS</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {F('UPI ID',               'payout_upi_id',         'text')}
          {F('Account Holder Name',  'payout_account_holder', 'text')}
          {F('Bank Account No',      'payout_bank_account',   'text')}
          {F('IFSC Code',            'payout_bank_ifsc',      'text')}
          {F('Bank Name',            'payout_bank_name',      'text')}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </Modal>
  )
}

// ── Generate Salary Modal ─────────────────────────────────────────────────────
function GenerateSalaryModal({ cco, onClose, onGenerated, toastFn }: {
  cco: CcoUser; onClose: () => void; onGenerated: (slip: SlipData) => void;
  toastFn: { success: (t: string) => void; error: (t: string) => void };
}) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year,  setYear]  = useState(now.getFullYear())
  const [deductions,    setDeductions]    = useState('0')
  const [deductionNotes,setDeductionNotes] = useState('')
  const [bonusOverride, setBonusOverride]  = useState('')
  const [salaryNotes,   setSalaryNotes]    = useState('')
  const [loading, setLoading] = useState(false)

  const generate = async () => {
    setLoading(true)
    try {
      const res = await api.post(`/cco-attendance/admin/cco/${cco.id}/generate-salary`, {
        month, year,
        deductions:      parseFloat(deductions) || 0,
        deduction_notes: deductionNotes || null,
        bonus_amount:    bonusOverride !== '' ? parseFloat(bonusOverride) : null,
        salary_notes:    salaryNotes || null,
      })
      onGenerated(res.data.data)
      toastFn.success('Salary slip generated')
    } catch (e: any) {
      toastFn.error(e?.response?.data?.detail || 'Failed to generate')
    } finally { setLoading(false) }
  }

  return (
    <Modal title={`Generate Salary — ${cco.name}`} onClose={onClose} size="md">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>MONTH</label>
          <select className="input" value={month} onChange={e => setMonth(Number(e.target.value))} style={{ fontSize: 13 }}>
            {MONTHS.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>YEAR</label>
          <input className="input" type="number" value={year} onChange={e => setYear(Number(e.target.value))} style={{ fontSize: 13 }} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>DEDUCTIONS (₹)</label>
          <input className="input" type="number" value={deductions} onChange={e => setDeductions(e.target.value)} style={{ fontSize: 13 }} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>BONUS OVERRIDE (₹, optional)</label>
          <input className="input" type="number" placeholder={`Default: ${cco.bonus_amount}`}
            value={bonusOverride} onChange={e => setBonusOverride(e.target.value)} style={{ fontSize: 13 }} />
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>DEDUCTION NOTES</label>
        <input className="input" type="text" value={deductionNotes}
          onChange={e => setDeductionNotes(e.target.value)} placeholder="e.g. Late deduction" style={{ fontSize: 13 }} />
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>SALARY NOTES</label>
        <textarea className="input" rows={2} value={salaryNotes}
          onChange={e => setSalaryNotes(e.target.value)} style={{ fontSize: 13, resize: 'vertical' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={generate} disabled={loading}>
          {loading ? 'Generating…' : 'Generate Salary'}
        </button>
      </div>
    </Modal>
  )
}

// ── Pay Salary Modal ───────────────────────────────────────────────────────────
function PaySalaryModal({ cco, slip, onClose, onPaid, toastFn }: {
  cco: CcoUser; slip: SlipData; onClose: () => void; onPaid: () => void;
  toastFn: { success: (t: string) => void; error: (t: string) => void };
}) {
  const [method, setMethod] = useState<'UPI'|'BANK'|'CASH'>('UPI')
  const [ref,    setRef]    = useState('')
  const [paying, setPaying] = useState(false)

  const pay = async () => {
    if (!slip.id) return
    setPaying(true)
    try {
      await api.post('/cco-attendance/admin/cco/pay-salary', {
        slip_id: slip.id, payment_method: method,
        payment_ref: ref || null,
      })
      toastFn.success('Salary marked as paid')
      onPaid()
      onClose()
    } catch (e: any) {
      toastFn.error(e?.response?.data?.detail || 'Failed')
    } finally { setPaying(false) }
  }

  const hasUpi  = !!cco.payout_upi_id
  const hasBank = !!cco.payout_bank_account

  return (
    <Modal title={`Pay Salary — ${cco.name}`} onClose={onClose} size="sm">
      <div style={{ marginBottom: 16 }}>
        <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#1E40AF', fontWeight: 600 }}>Net Payable</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#1B4FD8' }}>{fmt(slip.net_salary)}</div>
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{MONTHS[slip.month-1]} {slip.year}</div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 8 }}>PAYMENT METHOD</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['UPI','BANK','CASH'] as const).map(m => (
              <button key={m} onClick={() => setMethod(m)} style={{
                flex: 1, padding: '8px 0', borderRadius: 8,
                border: `2px solid ${method===m ? '#1B4FD8' : '#E2E8F0'}`,
                background: method===m ? '#EFF6FF' : 'white',
                color: method===m ? '#1B4FD8' : '#374151',
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}>{m}</button>
            ))}
          </div>
        </div>

        {method === 'UPI' && hasUpi && (
          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12 }}>
            <div style={{ fontWeight: 600, color: '#166534' }}>UPI ID</div>
            <div style={{ color: '#374151', marginTop: 2 }}>{cco.payout_upi_id}</div>
          </div>
        )}
        {method === 'BANK' && hasBank && (
          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12 }}>
            <div style={{ fontWeight: 600, color: '#166534' }}>Bank Details</div>
            <div style={{ color: '#374151', marginTop: 4 }}>
              <div>{cco.payout_account_holder}</div>
              <div>A/C: {cco.payout_bank_account}</div>
              <div>IFSC: {cco.payout_bank_ifsc} · {cco.payout_bank_name}</div>
            </div>
          </div>
        )}
        {method === 'UPI' && !hasUpi && (
          <div style={{ color: '#F59E0B', fontSize: 12, marginBottom: 12 }}>⚠️ No UPI ID on file. Add it via Edit Salary Structure.</div>
        )}
        {method === 'BANK' && !hasBank && (
          <div style={{ color: '#F59E0B', fontSize: 12, marginBottom: 12 }}>⚠️ No bank details on file. Add via Edit Salary Structure.</div>
        )}

        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>TRANSACTION REF / UTR (optional)</label>
          <input className="input" type="text" value={ref}
            onChange={e => setRef(e.target.value)} placeholder="e.g. UTR123456789" style={{ fontSize: 13 }} />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={pay} disabled={paying}>
          {paying ? 'Processing…' : `Pay ${fmt(slip.net_salary)}`}
        </button>
      </div>
    </Modal>
  )
}

// ── Salary Slip Detail Modal ───────────────────────────────────────────────────
function SlipDetailModal({ cco, slip, onClose }: { cco: CcoUser; slip: SlipData; onClose: () => void }) {
  const rows = [
    { label: 'Basic Salary',     val: slip.monthly_salary   },
    { label: 'Petrol',           val: slip.petrol_amount    },
    { label: 'Mobile Recharge',  val: slip.mobile_recharge  },
    { label: 'Bonus',            val: slip.bonus_amount     },
    { label: 'HRA',              val: slip.hra_amount       },
    { label: 'Other Allowances', val: slip.other_allowances },
  ].filter(r => r.val > 0)

  return (
    <Modal title={`${MONTHS[slip.month-1]} ${slip.year} — ${cco.name}`} onClose={onClose} size="md">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Days Present', val: `${slip.present_days} / ${slip.total_days}` },
          { label: 'Hours Worked', val: fmtH(slip.total_hours) },
          { label: 'Net Salary',   val: fmt(slip.net_salary), hi: true },
        ].map(c => (
          <div key={c.label} style={{
            background: c.hi ? '#EFF6FF' : '#F8FAFC',
            border: `1px solid ${c.hi ? '#BFDBFE' : '#E2E8F0'}`,
            borderRadius: 10, padding: '10px 12px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 10, color: '#64748B', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: c.hi ? 18 : 16, fontWeight: 800, color: c.hi ? '#1B4FD8' : '#0F172A' }}>{c.val}</div>
          </div>
        ))}
      </div>

      <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ background: '#F8FAFC', padding: '8px 14px', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Earnings</div>
        {rows.map(r => (
          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderTop: '1px solid #F1F5F9', fontSize: 13 }}>
            <span style={{ color: '#374151' }}>{r.label}</span>
            <span style={{ fontWeight: 600, color: '#059669' }}>{fmt(r.val)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderTop: '2px solid #E2E8F0', fontWeight: 800, fontSize: 14, background: '#F0FDF4' }}>
          <span style={{ color: '#166534' }}>Gross Total</span>
          <span style={{ color: '#166534' }}>{fmt(slip.gross_salary)}</span>
        </div>
      </div>

      {slip.deductions > 0 && (
        <div style={{ border: '1px solid #FEE2E2', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ background: '#FEF2F2', padding: '8px 14px', fontSize: 11, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase' }}>Deductions</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', fontSize: 13 }}>
            <span>{slip.deduction_notes || 'Deduction'}</span>
            <span style={{ fontWeight: 600, color: '#DC2626' }}>- {fmt(slip.deductions)}</span>
          </div>
        </div>
      )}

      <div style={{ background: 'linear-gradient(135deg,#EFF6FF,#DBEAFE)', border: '2px solid #93C5FD', borderRadius: 12, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: '#1E40AF', fontWeight: 600 }}>Net Salary Payable</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: '#1B4FD8' }}>{fmt(slip.net_salary)}</div>
      </div>

      {slip.salary_notes && (
        <div style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>📝 {slip.salary_notes}</div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={onClose}>Close</button>
      </div>
    </Modal>
  )
}

// ── Need Generate First Modal ─────────────────────────────────────────────────
function NeedGenerateModal({ cco, onClose, onGenerate }: { cco: CcoUser; onClose: () => void; onGenerate: () => void }) {
  return (
    <Modal title={`Pay — ${cco.name}`} onClose={onClose} size="sm">
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#0F172A', marginBottom: 8 }}>Generate salary first</div>
        <div style={{ color: '#64748B', fontSize: 13, marginBottom: 20 }}>You need to generate a salary slip before making a payment.</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onGenerate}>Generate Salary</button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main CCO Salary Page ──────────────────────────────────────────────────────
export default function CcoSalary() {
  const [ccos, setCcos]     = useState<CcoUser[]>([])
  const [total, setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [page, setPage]       = useState(1)

  const [editCco,      setEditCco]      = useState<CcoUser | null>(null)
  const [generateCco,  setGenerateCco]  = useState<CcoUser | null>(null)
  const [generatedSlip,setGeneratedSlip]= useState<SlipData | null>(null)
  const [payCco,       setPayCco]       = useState<CcoUser | null>(null)
  const [needGenCco,   setNeedGenCco]   = useState<CcoUser | null>(null)
  const [viewSlip,     setViewSlip]     = useState<{ cco: CcoUser; slip: SlipData } | null>(null)

  const { toasts, removeToast, toast } = useToast()

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), per_page: '20', ...(search ? { search } : {}) })
    api.get(`/cco-attendance/admin/cco-list?${params}`)
      .then((r: any) => { setCcos(r.data?.data?.items || []); setTotal(r.data?.data?.total || 0) })
      .catch(() => setCcos([]))
      .finally(() => setLoading(false))
  }, [page, search])

  useEffect(() => { load() }, [load])

  const handleGenerated = (cco: CcoUser, slip: SlipData) => {
    setGeneratedSlip(slip)
    setGenerateCco(null)
    setViewSlip({ cco, slip })
  }

  const handlePayClick = (cco: CcoUser) => {
    if (!generatedSlip) {
      setNeedGenCco(cco)
    } else {
      setPayCco(cco)
    }
  }

  const toastFn = { success: toast.success, error: toast.error }

  return (
    <div>
      <Toast toasts={toasts} onRemove={removeToast} />
      <PageHeader title="CCO Salary" subtitle="Manage CCO salary structures, generate slips, and process payments" />

      {/* Search */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        <input
          className="input"
          type="text"
          placeholder="Search CCO by name or mobile…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ flex: 1, maxWidth: 360, fontSize: 13 }}
        />
        <div style={{ fontSize: 12, color: '#94A3B8', marginLeft: 'auto' }}>{total} CCO{total !== 1 ? 's' : ''}</div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Spinner /></div>
        ) : ccos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#94A3B8' }}>No CCO users found.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                {['Name','Mobile','Basic Salary','Total Package','Payout','Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#64748B', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ccos.map((c, i) => {
                const pkg = (c.monthly_salary||0) + (c.petrol_amount||0) + (c.mobile_recharge||0)
                          + (c.bonus_amount||0) + (c.hra_amount||0) + (c.other_allowances||0)
                const hasPayoutInfo = c.payout_upi_id || c.payout_bank_account
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid #F1F5F9', background: i%2===0 ? 'white' : '#FAFAFA' }}>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontWeight: 600, color: '#0F172A' }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>{c.email}</div>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#374151' }}>{c.mobile}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#374151' }}>{fmt(c.monthly_salary)}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#1B4FD8' }}>{fmt(pkg)}</td>
                    <td style={{ padding: '10px 14px' }}>
                      {hasPayoutInfo
                        ? <span style={{ color: '#059669', fontWeight: 600, fontSize: 11 }}>✅ {c.payout_upi_id ? 'UPI' : 'Bank'}</span>
                        : <span style={{ color: '#F59E0B', fontSize: 11 }}>⚠️ Not set</span>}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setEditCco(c)}
                          style={{ background: '#F1F5F9', color: '#374151', border: '1px solid #E2E8F0', borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          ✏️ Edit
                        </button>
                        <button onClick={() => setGenerateCco(c)}
                          style={{ background: '#EFF6FF', color: '#1B4FD8', border: '1px solid #BFDBFE', borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          📄 Generate
                        </button>
                        <button onClick={() => handlePayClick(c)}
                          style={{ background: '#DCFCE7', color: '#166534', border: '1px solid #BBF7D0', borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          💸 Pay
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals — rendered conditionally so Modal is always "open" when shown */}
      {editCco && (
        <EditSalaryStructureModal cco={editCco} onClose={() => setEditCco(null)} onSaved={load} toastFn={toastFn} />
      )}

      {generateCco && (
        <GenerateSalaryModal
          cco={generateCco}
          onClose={() => setGenerateCco(null)}
          onGenerated={(slip) => handleGenerated(generateCco, slip)}
          toastFn={toastFn}
        />
      )}

      {needGenCco && (
        <NeedGenerateModal
          cco={needGenCco}
          onClose={() => setNeedGenCco(null)}
          onGenerate={() => { setGenerateCco(needGenCco); setNeedGenCco(null) }}
        />
      )}

      {payCco && generatedSlip && (
        <PaySalaryModal
          cco={payCco}
          slip={generatedSlip}
          onClose={() => { setPayCco(null); setGeneratedSlip(null) }}
          onPaid={() => { setPayCco(null); setGeneratedSlip(null); load() }}
          toastFn={toastFn}
        />
      )}

      {viewSlip && (
        <SlipDetailModal
          cco={viewSlip.cco}
          slip={viewSlip.slip}
          onClose={() => setViewSlip(null)}
        />
      )}
    </div>
  )
}
