/**
 * CallbackRequests.tsx — Advanced Admin Callback Management
 *
 * Workflow per callback:
 *  1. View detail modal (status, notes, customer info, bookings)
 *  2a. If customer exists  → Mark Called / Resolved / Skip / Save Notes
 *                          → Make Booking (opens BookingModal pre-filled)
 *  2b. If NO customer      → "Create Customer" sub-panel inside modal
 *                          → After create → address auto-added → "Make Booking"
 *
 * All actions show toast feedback. No silent errors.
 */
import { todayIST, fmtDateIST, fmtDateTimeIST, fmtTimeIST } from "../lib/tz";
import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuthStore } from '@/store/authStore'
import BookingModal from '@/components/bookings/BookingModal'

import { API_BASE_URL as API } from '@/services/api'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  PENDING:  '#F59E0B',
  CALLED:   '#3B82F6',
  RESOLVED: '#10B981',
  SKIPPED:  '#6B7280',
}
const STATUS_LABELS: Record<string, string> = {
  PENDING:  '⏳ Pending',
  CALLED:   '📞 Called',
  RESOLVED: '✅ Resolved',
  SKIPPED:  '⏭️ Skipped',
}
const INDIA_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan',
  'Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli','Daman and Diu',
  'Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry',
]

// ─── Types ────────────────────────────────────────────────────────────────────

interface CallbackItem {
  id: string
  mobile: string
  name?: string
  message?: string
  source: string
  status: string
  admin_notes?: string
  called_at?: string
  created_at: string
  has_customer: boolean
  customer_id?: string
  customer_name?: string
}

interface CustomerDetail {
  id: string
  name: string
  mobile: string
  email?: string
  customer_code?: string
  total_bookings?: string | number
  addresses: {
    id: string; label: string; address_line1: string
    city: string; state: string; pincode: string; is_default: boolean
  }[]
  last_bookings: {
    id: string; booking_number: string; service_name?: string
    status: string; scheduled_date?: string; total_amount?: number
  }[]
}

interface DetailData {
  id: string; mobile: string; name?: string; message?: string
  source: string; status: string; admin_notes?: string
  called_at?: string; created_at: string
  customer?: CustomerDetail
  page_url?: string; ip_address?: string; location?: string
}

interface Toast { id: number; type: 'success' | 'error' | 'info'; message: string }

// ─── Toast ────────────────────────────────────────────────────────────────────

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  const colors: Record<Toast['type'], { bg: string; border: string; icon: string }> = {
    success: { bg: '#ECFDF5', border: '#10B981', icon: '✅' },
    error:   { bg: '#FEF2F2', border: '#EF4444', icon: '❌' },
    info:    { bg: '#EFF6FF', border: '#3B82F6', icon: 'ℹ️' },
  }
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {toasts.map(t => {
        const c = colors[t.type]
        return (
          <div key={t.id} style={{
            background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 10,
            padding: '12px 16px', minWidth: 280, maxWidth: 380,
            display: 'flex', alignItems: 'center', gap: 10,
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)', animation: 'fadeInUp 0.25s ease',
          }}>
            <span style={{ fontSize: 18 }}>{c.icon}</span>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#1E293B' }}>{t.message}</span>
            <button onClick={() => onDismiss(t.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#94A3B8' }}>✕</button>
          </div>
        )
      })}
    </div>
  )
}

// ─── Create Customer Sub-Panel ────────────────────────────────────────────────

interface CreateCustomerPanelProps {
  prefillMobile: string
  prefillName?: string
  token: string
  onCreated: (customer: any, addresses: any[]) => void
  onCancel: () => void
}

function CreateCustomerPanel({ prefillMobile, prefillName, token, onCreated, onCancel }: CreateCustomerPanelProps) {
  const [step, setStep] = useState<'info' | 'address'>('info')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [createdCustomer, setCreatedCustomer] = useState<any>(null)

  // Customer info form
  const [form, setForm] = useState({
    name: prefillName || '',
    mobile: prefillMobile,
    email: '',
    alternate_mobile: '',
    city: '',
    notes: '',
  })

  // Address form
  const [addrForm, setAddrForm] = useState({
    label: 'Home',
    address_line1: '',
    address_line2: '',
    city: '',
    state: 'Odisha',
    pincode: '',
    is_default: true,
  })
  const [addrSaving, setAddrSaving] = useState(false)
  const [addrError, setAddrError] = useState('')
  const [skipAddr, setSkipAddr] = useState(false)

  const hdr = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const setF = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))
  const setA = (k: string, v: string | boolean) => setAddrForm(f => ({ ...f, [k]: v }))

  const createCustomer = async () => {
    setError('')
    if (!form.name.trim()) { setError('Name is required'); return }
    if (!form.mobile || form.mobile.length < 10) { setError('Valid 10-digit mobile is required'); return }
    setSaving(true)
    try {
      const res = await fetch(`${API}/customers`, {
        method: 'POST', headers: hdr,
        body: JSON.stringify({
          name: form.name.trim(),
          mobile: form.mobile.trim(),
          email: form.email.trim() || null,
          alternate_mobile: form.alternate_mobile.trim() || null,
          city: form.city.trim() || null,
          notes: form.notes.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || data.message || `HTTP ${res.status}`)
      setCreatedCustomer(data.data)
      setStep('address')
    } catch (e: any) {
      setError(e.message)
    } finally { setSaving(false) }
  }

  const saveAddress = async () => {
    setAddrError('')
    if (!addrForm.address_line1.trim()) { setAddrError('Address line 1 is required'); return }
    if (!addrForm.city.trim()) { setAddrError('City is required'); return }
    if (!addrForm.pincode.trim()) { setAddrError('Pincode is required'); return }
    if (!addrForm.state.trim()) { setAddrError('State is required'); return }
    setAddrSaving(true)
    try {
      const res = await fetch(`${API}/customers/${createdCustomer.id}/addresses`, {
        method: 'POST', headers: hdr,
        body: JSON.stringify({
          label: addrForm.label,
          address_line1: addrForm.address_line1.trim(),
          address_line2: addrForm.address_line2.trim() || null,
          city: addrForm.city.trim(),
          state: addrForm.state.trim(),
          pincode: addrForm.pincode.trim(),
          is_default: addrForm.is_default,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || data.message || `HTTP ${res.status}`)
      const addr = data.data
      onCreated(createdCustomer, addr ? [addr] : [])
    } catch (e: any) {
      setAddrError(e.message)
    } finally { setAddrSaving(false) }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 11px', borderRadius: 7,
    border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none',
    boxSizing: 'border-box', background: 'white',
  }
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }
  const field = (label: string, children: React.ReactNode, required = false) => (
    <div style={{ marginBottom: 12 }}>
      <label style={lbl}>{label}{required && <span style={{ color: '#EF4444' }}> *</span>}</label>
      {children}
    </div>
  )

  return (
    <div style={{ border: '2px solid #6366F1', borderRadius: 12, overflow: 'hidden', marginTop: 4 }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>
            {step === 'info' ? '👤 Create New Customer' : '📍 Add Service Address'}
          </div>
          <div style={{ color: '#C7D2FE', fontSize: 12, marginTop: 2 }}>
            {step === 'info'
              ? 'Register this caller as a customer to enable booking'
              : `Address for ${createdCustomer?.name || 'customer'} — needed to create a booking`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#4F46E5' }}>1</div>
          <div style={{ width: 40, height: 2, background: step === 'address' ? '#fff' : '#818CF8', alignSelf: 'center', borderRadius: 2 }} />
          <div style={{ width: 20, height: 20, borderRadius: '50%', background: step === 'address' ? '#fff' : '#818CF8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: step === 'address' ? '#4F46E5' : 'white' }}>2</div>
        </div>
      </div>

      <div style={{ padding: '16px 16px 12px' }}>
        {/* ── Step 1: Customer Info ── */}
        {step === 'info' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {field('Full Name', (
                <input style={inp} value={form.name} onChange={e => setF('name', e.target.value)}
                  placeholder="Customer full name" autoFocus />
              ), true)}
              {field('Mobile', (
                <input style={inp} value={form.mobile} onChange={e => setF('mobile', e.target.value)}
                  placeholder="10-digit mobile" maxLength={10} readOnly />
              ), true)}
              {field('Email', (
                <input style={inp} type="email" value={form.email} onChange={e => setF('email', e.target.value)}
                  placeholder="Optional" />
              ))}
              {field('Alternate Mobile', (
                <input style={inp} value={form.alternate_mobile} onChange={e => setF('alternate_mobile', e.target.value)}
                  placeholder="Optional" maxLength={10} />
              ))}
              {field('City', (
                <input style={inp} value={form.city} onChange={e => setF('city', e.target.value)}
                  placeholder="e.g. Bhubaneswar" />
              ))}
            </div>
            {field('Internal Note', (
              <input style={inp} value={form.notes} onChange={e => setF('notes', e.target.value)}
                placeholder="e.g. Called from chatbot, referred by..." />
            ))}

            {error && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 7, padding: '8px 12px', color: '#DC2626', fontSize: 13, marginBottom: 10 }}>
                ❌ {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={createCustomer} disabled={saving}
                style={{ flex: 1, padding: '9px 0', borderRadius: 8, background: saving ? '#A5B4FC' : '#6366F1', color: 'white', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 13 }}>
                {saving ? '⏳ Creating…' : 'Create Customer →'}
              </button>
              <button onClick={onCancel}
                style={{ padding: '9px 16px', borderRadius: 8, background: '#F1F5F9', color: '#64748B', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                Cancel
              </button>
            </div>
          </>
        )}

        {/* ── Step 2: Address ── */}
        {step === 'address' && createdCustomer && (
          <>
            <div style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 13, color: '#065F46' }}>
              ✅ Customer <strong>{createdCustomer.name}</strong> created — Code: <code style={{ fontFamily: 'monospace', background: '#D1FAE5', padding: '1px 6px', borderRadius: 4 }}>{createdCustomer.customer_code}</code>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {field('Address Label', (
                <select style={inp} value={addrForm.label} onChange={e => setA('label', e.target.value)}>
                  {['Home', 'Work', 'Office', 'Other'].map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              ))}
              {field('Pincode', (
                <input style={inp} value={addrForm.pincode} onChange={e => setA('pincode', e.target.value)}
                  placeholder="6-digit pincode" maxLength={6} />
              ), true)}
            </div>

            {field('Address Line 1', (
              <input style={inp} value={addrForm.address_line1} onChange={e => setA('address_line1', e.target.value)}
                placeholder="House/Flat no., Street, Area" autoFocus />
            ), true)}

            {field('Address Line 2', (
              <input style={inp} value={addrForm.address_line2} onChange={e => setA('address_line2', e.target.value)}
                placeholder="Landmark, Building (optional)" />
            ))}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {field('City', (
                <input style={inp} value={addrForm.city} onChange={e => setA('city', e.target.value)}
                  placeholder="e.g. Bhubaneswar" />
              ), true)}
              {field('State', (
                <select style={inp} value={addrForm.state} onChange={e => setA('state', e.target.value)}>
                  {INDIA_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              ), true)}
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={addrForm.is_default}
                  onChange={e => setA('is_default', e.target.checked)} style={{ width: 15, height: 15 }} />
                <span style={{ fontWeight: 600, color: '#374151' }}>Set as default address</span>
              </label>
            </div>

            {addrError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 7, padding: '8px 12px', color: '#DC2626', fontSize: 13, marginBottom: 10 }}>
                ❌ {addrError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveAddress} disabled={addrSaving}
                style={{ flex: 1, padding: '9px 0', borderRadius: 8, background: addrSaving ? '#6EE7B7' : '#10B981', color: 'white', border: 'none', cursor: addrSaving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 13 }}>
                {addrSaving ? '⏳ Saving…' : '💾 Save Address & Continue →'}
              </button>
              <button onClick={() => onCreated(createdCustomer, [])}
                style={{ padding: '9px 14px', borderRadius: 8, background: '#F1F5F9', color: '#64748B', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                Skip Address
              </button>
            </div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 6, textAlign: 'center' }}>
              Skipping address will still allow booking creation, but address must be added before confirming.
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CallbackRequests() {
  const { token } = useAuthStore()

  // List state
  const [items, setItems] = useState<CallbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Detail modal
  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState<DetailData | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Admin notes
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Create customer panel (inside detail modal)
  const [showCreateCustomer, setShowCreateCustomer] = useState(false)

  // Booking modal (opened from callback detail)
  const [bookingCustomer, setBookingCustomer] = useState<any>(null)
  const [bookingAddresses, setBookingAddresses] = useState<any[]>([])
  const [bookingAppliances, setBookingAppliances] = useState<any[]>([])
  const [showBookingModal, setShowBookingModal] = useState(false)

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastCounter = useRef(0)

  const stats = {
    total:    items.length,
    pending:  items.filter(i => i.status === 'PENDING').length,
    called:   items.filter(i => i.status === 'CALLED').length,
    resolved: items.filter(i => i.status === 'RESOLVED').length,
  }

  const hdr = useCallback(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token])

  // ── Toasts ─────────────────────────────────────────────────────────────────
  const toast = useCallback((type: Toast['type'], message: string) => {
    const id = ++toastCounter.current
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500)
  }, [])

  // ── Fetch list ──────────────────────────────────────────────────────────────
  const fetchList = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`${API}/chatbot/callback-requests?${params}`, { headers: hdr() })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setItems(data.data?.items || [])
    } catch (e: any) {
      toast('error', `Failed to load: ${e.message}`)
    } finally { setLoading(false) }
  }, [search, statusFilter, hdr, toast])

  useEffect(() => { fetchList() }, [fetchList])

  // ── Open detail modal ───────────────────────────────────────────────────────
  const openDetail = async (id: string) => {
    setDetailOpen(true)
    setDetail(null)
    setDetailLoading(true)
    setShowCreateCustomer(false)
    try {
      const res = await fetch(`${API}/chatbot/callback-requests/${id}`, { headers: hdr() })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setDetail(data.data)
      setNotes(data.data?.admin_notes || '')
    } catch (e: any) {
      toast('error', `Failed to load details: ${e.message}`)
      setDetailOpen(false)
    } finally { setDetailLoading(false) }
  }

  const closeDetail = () => {
    setDetailOpen(false)
    setDetail(null)
    setDetailLoading(false)
    setShowCreateCustomer(false)
  }

  // ── Update status ───────────────────────────────────────────────────────────
  const updateStatus = async (id: string, newStatus: string, extraNotes?: string, key?: string) => {
    const actionKey = key || `${id}-${newStatus}`
    setActionLoading(actionKey)
    setSaving(true)
    try {
      const body: Record<string, unknown> = { status: newStatus }
      if (extraNotes !== undefined) body.admin_notes = extraNotes

      const res = await fetch(`${API}/chatbot/callback-requests/${id}`, {
        method: 'PUT', headers: hdr(), body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || err.message || `HTTP ${res.status}`)
      }
      const resData = await res.json().catch(() => ({}))
      const srv = resData?.data || {}

      const label = STATUS_LABELS[newStatus] || newStatus
      toast('success', `Marked as ${label.replace(/^\S+\s*/, '')} successfully`)

      setItems(prev => prev.map(item => item.id === id ? { ...item, status: newStatus } : item))
      if (detail?.id === id) {
        setDetail(prev => prev ? {
          ...prev,
          status: srv.status || newStatus,
          admin_notes: srv.admin_notes !== undefined ? srv.admin_notes : (extraNotes !== undefined ? extraNotes : prev.admin_notes),
          called_at: srv.called_at || prev.called_at,
        } : prev)
      }
      fetchList(true)
    } catch (e: any) {
      toast('error', `Action failed: ${e.message}`)
    } finally { setActionLoading(null); setSaving(false) }
  }

  // ── Save notes ──────────────────────────────────────────────────────────────
  const saveNotes = async () => {
    if (!detail) return
    setSaving(true)
    try {
      const res = await fetch(`${API}/chatbot/callback-requests/${detail.id}`, {
        method: 'PUT', headers: hdr(),
        body: JSON.stringify({ status: detail.status, admin_notes: notes }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || err.message || `HTTP ${res.status}`)
      }
      toast('success', 'Notes saved')
      setDetail(prev => prev ? { ...prev, admin_notes: notes } : prev)
      setItems(prev => prev.map(item => item.id === detail.id ? { ...item, admin_notes: notes } : item))
    } catch (e: any) {
      toast('error', `Save failed: ${e.message}`)
    } finally { setSaving(false) }
  }

  // ── Customer created callback → load appliances → open BookingModal ─────────
  const handleCustomerCreated = async (newCustomer: any, newAddresses: any[]) => {
    setShowCreateCustomer(false)
    toast('success', `Customer "${newCustomer.name}" created (${newCustomer.customer_code})`)

    // Update list item to reflect customer now exists
    if (detail) {
      setDetail(prev => prev ? {
        ...prev,
        customer: {
          id: newCustomer.id,
          name: newCustomer.name,
          mobile: newCustomer.mobile,
          email: newCustomer.email,
          customer_code: newCustomer.customer_code,
          total_bookings: 0,
          addresses: newAddresses.map(a => ({
            id: a.id, label: a.label, address_line1: a.address_line1,
            city: a.city, state: a.state, pincode: a.pincode, is_default: a.is_default,
          })),
          last_bookings: [],
        },
      } : prev)
    }

    // Fetch appliances (likely empty for new customer, but be correct)
    let appliances: any[] = []
    try {
      const res = await fetch(`${API}/appliances/customer/${newCustomer.id}`, { headers: hdr() })
      if (res.ok) { const d = await res.json(); appliances = d.data || [] }
    } catch {}

    setBookingCustomer({ ...newCustomer, total_bookings: 0 })
    setBookingAddresses(newAddresses)
    setBookingAppliances(appliances)

    // Small delay so toast is visible before modal opens
    setTimeout(() => setShowBookingModal(true), 600)
  }

  // ── Open booking modal for existing customer ────────────────────────────────
  const openBookingForCustomer = async (customer: CustomerDetail) => {
    let appliances: any[] = []
    try {
      const res = await fetch(`${API}/appliances/customer/${customer.id}`, { headers: hdr() })
      if (res.ok) { const d = await res.json(); appliances = d.data || [] }
    } catch {}

    // Reload fresh addresses
    let addresses = customer.addresses
    try {
      const res = await fetch(`${API}/customers/${customer.id}/addresses`, { headers: hdr() })
      if (res.ok) { const d = await res.json(); addresses = d.data || customer.addresses }
    } catch {}

    setBookingCustomer({
      id: customer.id, name: customer.name, mobile: customer.mobile,
      email: customer.email, customer_code: customer.customer_code,
      total_bookings: customer.total_bookings,
    })
    setBookingAddresses(addresses)
    setBookingAppliances(appliances)
    setShowBookingModal(true)
  }

  const fmt = (dt?: string) => {
    if (!dt) return '—'
    return new Date(dt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  // ─── Reusable sub-components ───────────────────────────────────────────────

  const StatCard = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <div style={{ background: 'white', borderRadius: 10, padding: '16px 20px', border: `2px solid ${color}20`, flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 12, color: '#64748B', fontWeight: 500, marginTop: 2 }}>{label}</div>
    </div>
  )

  const Btn = ({ actionKey, label, onClick, bg, color, disabled }: {
    actionKey: string; label: string; onClick: () => void
    bg: string; color: string; disabled?: boolean
  }) => {
    const busy = actionLoading === actionKey
    return (
      <button onClick={onClick} disabled={disabled || busy || saving}
        style={{
          padding: '4px 10px', borderRadius: 6,
          background: busy ? '#E2E8F0' : bg,
          color: busy ? '#94A3B8' : color,
          border: 'none', cursor: (disabled || busy || saving) ? 'not-allowed' : 'pointer',
          fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', opacity: disabled && !busy ? 0.6 : 1,
        }}>
        {busy ? '⏳' : label}
      </button>
    )
  }

  const ModalBtn = ({ actionKey, label, onClick, bg, textColor = 'white' }: {
    actionKey: string; label: string; onClick: () => void; bg: string; textColor?: string
  }) => {
    const busy = actionLoading === actionKey
    return (
      <button onClick={onClick} disabled={saving}
        style={{
          padding: '8px 14px', borderRadius: 8,
          background: busy ? '#E2E8F0' : bg,
          color: busy ? '#94A3B8' : textColor,
          border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
          fontWeight: 600, fontSize: 13, opacity: saving && !busy ? 0.6 : 1, whiteSpace: 'nowrap',
        }}>
        {busy ? '⏳ …' : label}
      </button>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── BookingModal (opens over detail modal) ── */}
      {showBookingModal && bookingCustomer && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 3000 }}>
          <BookingModal
            customer={bookingCustomer}
            addresses={bookingAddresses}
            appliances={bookingAppliances}
            onClose={() => { setShowBookingModal(false); fetchList(true) }}
            onDone={() => {
              setShowBookingModal(false)
              toast('success', 'Booking created successfully!')
              fetchList(true)
              // Auto mark as CALLED if still PENDING
              if (detail && detail.status === 'PENDING') {
                updateStatus(detail.id, 'CALLED', notes, `auto-called-${detail.id}`)
              }
            }}
          />
        </div>
      )}

      {/* ── Detail Modal ── */}
      {detailOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }} onClick={closeDetail}>
          <div style={{
            background: 'white', borderRadius: 16, maxWidth: 740, width: '100%',
            maxHeight: '92vh', overflowY: 'auto', padding: 28,
            animation: 'fadeInUp 0.2s ease',
          }} onClick={e => e.stopPropagation()}>

            {detailLoading ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#94A3B8' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>Loading details…
              </div>
            ) : !detail ? null : (
              <>
                {/* ── Modal Header ── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>📞 Callback Details</h2>
                    <p style={{ color: '#64748B', fontSize: 13, marginTop: 4 }}>Requested: {fmt(detail.created_at)}</p>
                  </div>
                  <button onClick={closeDetail}
                    style={{ background: '#F1F5F9', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    ✕ Close
                  </button>
                </div>

                {/* ── Info grid ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                  {[
                    ['Mobile',    detail.mobile],
                    ['Name',      detail.name || '—'],
                    ['Source',    detail.source],
                    ['Status',    STATUS_LABELS[detail.status] || detail.status],
                    ['Called At', fmt(detail.called_at)],
                    ['Message',   detail.message || '—'],
                    ...(detail.location ? [['📍 Location', detail.location]] : []),
                    ...(detail.page_url ? [['🌐 Page URL',  detail.page_url]]  : []),
                  ].map(([k, v]) => (
                    <div key={k} style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', marginTop: 3, wordBreak: 'break-word' }}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* ── Current status badge ── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Status:</span>
                  <span style={{
                    padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 700,
                    background: `${STATUS_COLORS[detail.status]}20`, color: STATUS_COLORS[detail.status],
                  }}>{STATUS_LABELS[detail.status] || detail.status}</span>
                </div>

                {/* ── Status action buttons ── */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                  {detail.status !== 'CALLED' && (
                    <ModalBtn actionKey={`m-${detail.id}-CALLED`} label="📞 Mark Called" bg="#6366F1"
                      onClick={() => updateStatus(detail.id, 'CALLED', notes, `m-${detail.id}-CALLED`)} />
                  )}
                  {detail.status !== 'RESOLVED' && (
                    <ModalBtn actionKey={`m-${detail.id}-RESOLVED`} label="✅ Mark Resolved" bg="#10B981"
                      onClick={() => updateStatus(detail.id, 'RESOLVED', notes, `m-${detail.id}-RESOLVED`)} />
                  )}
                  {detail.status !== 'SKIPPED' && (
                    <ModalBtn actionKey={`m-${detail.id}-SKIPPED`} label="⏭️ Skip" bg="#F1F5F9" textColor="#64748B"
                      onClick={() => updateStatus(detail.id, 'SKIPPED', notes, `m-${detail.id}-SKIPPED`)} />
                  )}
                  {detail.status === 'RESOLVED' && (
                    <div style={{ padding: '8px 14px', borderRadius: 8, background: '#ECFDF5', color: '#10B981', fontSize: 13, fontWeight: 600 }}>
                      ✅ This request is resolved
                    </div>
                  )}
                </div>

                {/* ── Admin Notes ── */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Admin Notes</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="Add notes about this callback…" rows={3}
                    style={{ width: '100%', borderRadius: 8, border: '1.5px solid #E2E8F0', padding: '8px 12px', fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
                  <button onClick={saveNotes} disabled={saving}
                    style={{ marginTop: 6, padding: '6px 14px', borderRadius: 7, background: saving ? '#94A3B8' : '#1B4FD8', color: 'white', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}>
                    {saving ? '⏳ Saving…' : '💾 Save Notes'}
                  </button>
                </div>

                {/* ═══════════════════════════════════════════════════════════
                    CUSTOMER SECTION — Exists vs New
                ═══════════════════════════════════════════════════════════ */}

                {detail.customer ? (
                  /* ── Existing Customer ── */
                  <div style={{ border: '1.5px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ background: '#F8FAFC', padding: '12px 16px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>👤 Existing Customer</h3>
                      <button
                        onClick={() => openBookingForCustomer(detail.customer!)}
                        style={{
                          padding: '7px 14px', borderRadius: 8, background: 'linear-gradient(135deg, #1B4FD8 0%, #6366F1 100%)',
                          color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                          boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
                        }}>
                        📋 Make Booking
                      </button>
                    </div>
                    <div style={{ padding: '14px 16px' }}>
                      {/* Customer info */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                        {[
                          ['Name',           detail.customer.name],
                          ['Mobile',         detail.customer.mobile],
                          ['Email',          detail.customer.email || '—'],
                          ['Code',           detail.customer.customer_code || '—'],
                          ['Total Bookings', String(detail.customer.total_bookings ?? '0')],
                        ].map(([k, v]) => (
                          <div key={k}>
                            <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700 }}>{k}: </span>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{v}</span>
                          </div>
                        ))}
                      </div>

                      {/* Addresses */}
                      {detail.customer.addresses.length > 0 && (
                        <div style={{ marginBottom: 14 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 6 }}>📍 SAVED ADDRESSES</div>
                          {detail.customer.addresses.map(a => (
                            <div key={a.id} style={{ fontSize: 12, color: '#374151', marginBottom: 4, background: '#F8FAFC', borderRadius: 6, padding: '6px 10px' }}>
                              <strong>{a.label}{a.is_default ? ' ★' : ''}:</strong> {a.address_line1}, {a.city}, {a.state} — {a.pincode}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Last bookings table */}
                      {detail.customer.last_bookings.length > 0 && (
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 6 }}>📋 LAST BOOKINGS</div>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                              <tr style={{ background: '#F1F5F9' }}>
                                {['Booking #', 'Service', 'Status', 'Date', 'Amount'].map(h => (
                                  <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: '#64748B' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {detail.customer.last_bookings.map(b => (
                                <tr key={b.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                  <td style={{ padding: '6px 10px', fontWeight: 600, color: '#1B4FD8', fontFamily: 'monospace' }}>{b.booking_number}</td>
                                  <td style={{ padding: '6px 10px' }}>{b.service_name || '—'}</td>
                                  <td style={{ padding: '6px 10px' }}>
                                    <span style={{
                                      fontSize: 11, padding: '2px 6px', borderRadius: 10,
                                      background: b.status === 'COMPLETED' ? '#ECFDF5' : '#FEF3C7',
                                      color: b.status === 'COMPLETED' ? '#10B981' : '#F59E0B', fontWeight: 600,
                                    }}>{b.status}</span>
                                  </td>
                                  <td style={{ padding: '6px 10px', color: '#64748B' }}>
                                    {b.scheduled_date ? new Date(b.scheduled_date).toLocaleDateString('en-IN') : '—'}
                                  </td>
                                  <td style={{ padding: '6px 10px', fontWeight: 600 }}>
                                    {b.total_amount != null ? `₹${b.total_amount}` : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {detail.customer.addresses.length === 0 && (
                        <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, padding: '10px 14px', color: '#92400E', fontSize: 13, marginTop: 8 }}>
                          ⚠️ No saved addresses. Click <strong>Make Booking</strong> and add an address during the booking flow.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* ── No customer found ── */
                  <div>
                    {!showCreateCustomer ? (
                      <div style={{ background: 'linear-gradient(135deg, #FFF7ED 0%, #FEF3C7 100%)', border: '1.5px solid #FED7AA', borderRadius: 12, padding: '18px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
                          <span style={{ fontSize: 28, lineHeight: 1 }}>⚠️</span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 15, color: '#92400E', marginBottom: 4 }}>New Contact — No Customer Record</div>
                            <div style={{ fontSize: 13, color: '#B45309', lineHeight: 1.6 }}>
                              Mobile <strong>{detail.mobile}</strong> is not registered as a customer yet.
                              Create a customer profile to enable booking management.
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          <button
                            onClick={() => setShowCreateCustomer(true)}
                            style={{
                              padding: '10px 20px', borderRadius: 9, fontWeight: 700, fontSize: 14,
                              background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
                              color: 'white', border: 'none', cursor: 'pointer',
                              boxShadow: '0 3px 10px rgba(99,102,241,0.35)',
                            }}>
                            👤 Create Customer Profile
                          </button>
                          <div style={{ fontSize: 12, color: '#92400E', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>→</span>
                            <span>After creating, you can immediately make a booking for them</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ animation: 'slideDown 0.2s ease' }}>
                        <CreateCustomerPanel
                          prefillMobile={detail.mobile}
                          prefillName={detail.name}
                          token={token || ''}
                          onCreated={handleCustomerCreated}
                          onCancel={() => setShowCreateCustomer(false)}
                        />
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Main Page ── */}
      <div style={{ padding: 24, maxWidth: 1200 }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0F1729', margin: 0 }}>📞 Callback Requests</h1>
          <p style={{ color: '#64748B', fontSize: 13, marginTop: 4 }}>
            Customers who requested a callback from the chatbot
          </p>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <StatCard label="Total"    value={stats.total}    color="#6366F1" />
          <StatCard label="Pending"  value={stats.pending}  color="#F59E0B" />
          <StatCard label="Called"   value={stats.called}   color="#3B82F6" />
          <StatCard label="Resolved" value={stats.resolved} color="#10B981" />
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Search by mobile or name..."
            style={{ padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, minWidth: 220, outline: 'none' }} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, background: 'white', outline: 'none', cursor: 'pointer' }}>
            <option value="">All Statuses</option>
            <option value="PENDING">⏳ Pending</option>
            <option value="CALLED">📞 Called</option>
            <option value="RESOLVED">✅ Resolved</option>
            <option value="SKIPPED">⏭️ Skipped</option>
          </select>
          <button onClick={() => fetchList()} disabled={loading}
            style={{ padding: '8px 16px', borderRadius: 8, background: '#1B4FD8', color: 'white', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            {loading ? '⏳ Loading…' : '🔄 Refresh'}
          </button>
        </div>

        {/* Table */}
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                {['Mobile', 'Name', 'Message', 'Source', 'Status', 'Requested At', 'Customer', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>⏳ Loading…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>No callback requests found</td></tr>
              ) : items.map((item, idx) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #F1F5F9', background: idx % 2 === 0 ? 'white' : '#FAFAFA' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13 }}>
                    <a href={`tel:${item.mobile}`} style={{ color: '#1B4FD8', textDecoration: 'none' }}>{item.mobile}</a>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13 }}>{item.name || '—'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#64748B', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.message || '—'}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12 }}>
                    <span style={{ background: '#EFF6FF', color: '#1B4FD8', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>{item.source}</span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: `${STATUS_COLORS[item.status]}20`, color: STATUS_COLORS[item.status] }}>
                      {STATUS_LABELS[item.status] || item.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#64748B' }}>{fmt(item.created_at)}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12 }}>
                    {item.has_customer
                      ? <span style={{ color: '#10B981', fontWeight: 600 }}>✅ {item.customer_name || 'Yes'}</span>
                      : <span style={{ color: '#F59E0B', fontWeight: 600 }}>⚠️ New</span>}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      <Btn actionKey={`${item.id}-view`} label="View" onClick={() => openDetail(item.id)} bg="#EFF6FF" color="#1B4FD8" />
                      {item.status === 'PENDING' && (
                        <Btn actionKey={`${item.id}-CALLED`} label="Mark Called"
                          onClick={() => updateStatus(item.id, 'CALLED', undefined, `${item.id}-CALLED`)}
                          bg="#EEF2FF" color="#6366F1" />
                      )}
                      {item.status !== 'RESOLVED' && (
                        <Btn actionKey={`${item.id}-RESOLVED`} label="Resolve"
                          onClick={() => updateStatus(item.id, 'RESOLVED', undefined, `${item.id}-RESOLVED`)}
                          bg="#ECFDF5" color="#10B981" />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ToastContainer toasts={toasts} onDismiss={id => setToasts(prev => prev.filter(t => t.id !== id))} />
    </>
  )
}
