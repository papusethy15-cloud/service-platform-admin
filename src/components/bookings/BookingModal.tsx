/**
 * BookingModal.tsx — Shared admin booking creation modal
 *
 * Used by:
 *   - Customers page (Book Now from customer detail) → step starts at 'book'
 *   - Bookings page  (+ New Booking button)          → step starts at 'mobile'
 *
 * Flow (Bookings page):
 *   mobile lookup → customer preview + last 5 bookings → booking form
 *
 * Features:
 *  ✅ Mobile lookup with customer preview card
 *  ✅ Last 5 bookings shown with SERVICE NAME + ADDRESS (active sorted first)
 *  ✅ Active bookings prominently highlighted with warning banner
 *  ✅ Domain selector → searchable service list (handles 100+ services)
 *  ✅ Service price panel: base price + GST + city override
 *  ✅ Customer appliance selector (existing) OR skip (technician fills later)
 *  ✅ Duplicate booking guard: same customer + same service + same address + active → blocked
 *  ✅ Multi-booking in one session (different service or address)
 *  ✅ "Continue to New Booking" after reviewing history (admin-aware flow)
 */
import { useEffect, useState } from 'react'
import {
  customersAPI, bookingsAPI, domainsAPI, servicePricingAPI,
} from '@/services/api'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'

// ─── helpers ──────────────────────────────────────────────────────────────────
const lbl: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }

const Err = ({ msg }: { msg: any }) =>
  msg ? (
    <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 12 }}>
      {typeof msg === 'string' ? msg : JSON.stringify(msg)}
    </div>
  ) : null

// Canonical slot values stored in DB — HH:MM-HH:MM (24h)
const SLOTS = [
  { value: '08:00-10:00', label: '8:00 – 10:00 AM'    },
  { value: '10:00-12:00', label: '10:00 AM – 12:00 PM' },
  { value: '12:00-14:00', label: '12:00 – 2:00 PM'    },
  { value: '14:00-16:00', label: '2:00 – 4:00 PM'     },
  { value: '16:00-18:00', label: '4:00 – 6:00 PM'     },
  { value: '18:00-20:00', label: '6:00 – 8:00 PM'     },
]

const ACTIVE_STATUSES = ['PENDING', 'CONFIRMED', 'ASSIGNED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'INSPECTING', 'IN_PROGRESS']

const statusColor = (s: string): { bg: string; color: string } => {
  if (ACTIVE_STATUSES.includes(s)) return { bg: '#DCFCE7', color: '#166534' }
  if (s === 'COMPLETED')           return { bg: '#F1F5F9', color: '#475569' }
  if (s === 'CANCELLED')           return { bg: '#FEE2E2', color: '#991B1B' }
  if (s === 'RESCHEDULED')         return { bg: '#FEF3C7', color: '#92400E' }
  return { bg: '#F1F5F9', color: '#475569' }
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`

// Extract address from booking — backend now returns address_str directly
const shortAddress = (b: any): string => {
  if (b.address_str && b.address_str !== '—') {
    return b.address_label ? `[${b.address_label}] ${b.address_str}` : b.address_str
  }
  // fallback for older shape
  const a = b.address || b.service_address
  if (a && typeof a === 'object') {
    const parts = [a.address_line1 || a.line1, a.city, a.pincode].filter(Boolean)
    return parts.join(', ') || '—'
  }
  return b.address_line || '—'
}

// Extract service name — backend now returns service_name directly
const bkgService = (b: any): string =>
  b.service_name || b.service?.name || b.domain_name || '—'

// ─── Props ────────────────────────────────────────────────────────────────────
interface BookingModalProps {
  customer?:   any
  addresses?:  any[]
  appliances?: any[]
  onClose: () => void
  onDone:  () => void
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function BookingModal({
  customer:   initCustomer   = null,
  addresses:  initAddresses  = [],
  appliances: initAppliances = [],
  onClose,
  onDone,
}: BookingModalProps) {

  // ── Steps: 'mobile' → 'preview' → 'book' ──
  type Step = 'mobile' | 'preview' | 'book'
  const [step, setStep] = useState<Step>(initCustomer ? 'book' : 'mobile')

  // Step 1 state
  const [mobile,    setMobile]    = useState('')
  const [checking,  setChecking]  = useState(false)
  const [mobileErr, setMobileErr] = useState('')

  // Customer + sub-data
  const [customer,   setCustomer]   = useState<any>(initCustomer)
  const [addresses,  setAddresses]  = useState<any[]>(initAddresses)
  const [appliances, setAppliances] = useState<any[]>(initAppliances)
  const [recentBkgs, setRecentBkgs] = useState<any[]>([])
  const [loadingBkgs, setLoadingBkgs] = useState(false)

  // Step 3 booking form
  const [domains,    setDomains]    = useState<any[]>([])
  const [allSvcs,    setAllSvcs]    = useState<any[]>([])
  const [svcSearch,  setSvcSearch]  = useState('')
  const [loadSvc,    setLoadSvc]    = useState(false)
  const [selSvc,     setSelSvc]     = useState<any>(null)
  const [cityPrices, setCityPrices] = useState<any[]>([])
  const [loadPrice,  setLoadPrice]  = useState(false)
  const [cities,     setCities]     = useState<any[]>([])

  const [form, setForm] = useState({
    domain_id: '', service_id: '', address_id: '',
    scheduled_date: '', scheduled_slot: '',
    appliance_id: '',
    notes: '', priority: 'NORMAL',
  })
  const [saving,  setSaving]  = useState(false)
  const [err,     setErr]     = useState<any>('')
  const [created, setCreated] = useState<any[]>([])
  // Duplicate override (admin only) — shown after a 409 duplicate block
  const [forceDuplicate,   setForceDuplicate]   = useState(false)
  const [showForceOption,  setShowForceOption]  = useState(false)

  // ── Quick-add address (inline, used when the customer has zero saved
  // addresses -- previously this just showed a dead-end warning and left
  // the "Continue to Book Service" button permanently disabled with no
  // way to proceed without abandoning the whole flow) ──
  const [showAddAddr, setShowAddAddr] = useState(false)
  const [addrForm, setAddrForm] = useState({
    label: 'Home', address_line1: '', address_line2: '',
    city: '', state: '', pincode: '',
  })
  const [addrSaving, setAddrSaving] = useState(false)
  const [addrErr,    setAddrErr]    = useState('')

  const setAddrField = (k: string, v: string) => setAddrForm(f => ({ ...f, [k]: v }))

  const saveQuickAddress = async () => {
    if (!customer) return
    if (!addrForm.address_line1.trim() || !addrForm.city.trim() || !addrForm.state.trim() || !addrForm.pincode.trim()) {
      setAddrErr('Address line, city, state and pincode are all required')
      return
    }
    setAddrSaving(true); setAddrErr('')
    try {
      await customersAPI.addAddress(customer.id, { ...addrForm, is_default: true })
      const aRes = await customersAPI.addresses(customer.id)
      setAddresses(aRes.data.data || [])
      setShowAddAddr(false)
      setAddrForm({ label: 'Home', address_line1: '', address_line2: '', city: '', state: '', pincode: '' })
    } catch (ex: any) {
      setAddrErr(ex.response?.data?.detail || 'Failed to save address')
    } finally {
      setAddrSaving(false)
    }
  }

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  // ── load domains once ──
  useEffect(() => {
    domainsAPI.list()
      .then(r => setDomains(r.data.data?.items || r.data.data || []))
      .catch(() => setDomains([]))
  }, [])

  // ── load services when domain changes ──
  // Load cities list on mount for address form dropdown
  useEffect(() => {
    api.get('/cities?limit=100').then((r: any) => {
      const items = r.data?.data?.items ?? r.data?.data ?? []
      setCities(Array.isArray(items) ? items : [])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!form.domain_id) { setAllSvcs([]); setSelSvc(null); setSvcSearch(''); return }
    setLoadSvc(true)
    domainsAPI.services(form.domain_id)
      .then(r => setAllSvcs(r.data.data?.items || r.data.data || []))
      .catch(() => setAllSvcs([]))
      .finally(() => setLoadSvc(false))
    setSelSvc(null); set('service_id', ''); setSvcSearch(''); setShowForceOption(false); setForceDuplicate(false)
  }, [form.domain_id])

  // ── load city prices when service changes ──
  useEffect(() => {
    if (!form.service_id) { setCityPrices([]); return }
    setLoadPrice(true)
    servicePricingAPI.cityPrices(form.service_id)
      .then(r => setCityPrices(r.data.data || []))
      .catch(() => setCityPrices([]))
      .finally(() => setLoadPrice(false))
  }, [form.service_id])

  // ── filtered services ──
  const filteredSvcs = svcSearch.trim()
    ? allSvcs.filter((s: any) =>
        (s.name || s.service_name || '').toLowerCase().includes(svcSearch.toLowerCase()) ||
        (s.category_name || '').toLowerCase().includes(svcSearch.toLowerCase()))
    : allSvcs

  const pickService = (s: any) => {
    setSelSvc(s)
    setForm(f => ({ ...f, service_id: s.service_id || s.id }))
    setSvcSearch(s.name || s.service_name || '')
  }

  // ── price calc ──
  const selAddr        = addresses.find((a: any) => a.id === form.address_id)
  const cityPrice      = selAddr
    ? cityPrices.find((cp: any) => cp.city_name?.toLowerCase() === selAddr.city?.toLowerCase())
    : null
  const basePrice      = selSvc?.base_price ?? 0
  const effectivePrice = cityPrice ? cityPrice.price : basePrice
  const gstPct         = selSvc?.gst_percent ?? 0
  const gstAmt         = +(effectivePrice * gstPct / 100).toFixed(2)
  const totalPrice     = +(effectivePrice + gstAmt).toFixed(2)
  const selAppl        = appliances.find((a: any) => a.id === form.appliance_id)

  // ── mobile lookup → go to preview step ──
  const checkMobile = async () => {
    if (!mobile || mobile.length < 10) { setMobileErr('Enter a valid 10-digit mobile'); return }
    setChecking(true); setMobileErr('')
    try {
      const res = await customersAPI.checkMobile(mobile)
      const cust = res.data.data
      if (!cust) {
        setMobileErr('No customer found for this mobile. Please create the customer first from the Customers page.')
        return
      }
      setCustomer(cust)
      // Load addresses, appliances, recent bookings in parallel
      setLoadingBkgs(true)
      const [aRes, apRes, bkRes] = await Promise.all([
        customersAPI.addresses(cust.id),
        customersAPI.appliances(cust.id),
        customersAPI.bookings(cust.id),
      ])
      setAddresses(aRes.data.data || [])
      setAppliances(apRes.data.data || [])
      // Sort: active first, then by created_at desc — take top 5
      const allBkgs: any[] = bkRes.data.data?.items || bkRes.data.data || []
      const sorted = [...allBkgs].sort((a, b) => {
        const aActive = ACTIVE_STATUSES.includes(a.status) ? 1 : 0
        const bActive = ACTIVE_STATUSES.includes(b.status) ? 1 : 0
        if (bActive !== aActive) return bActive - aActive   // active first
        // then most recent first
        return new Date(b.created_at || b.scheduled_date || 0).getTime() -
               new Date(a.created_at || a.scheduled_date || 0).getTime()
      })
      setRecentBkgs(sorted.slice(0, 5))
      setStep('preview')
    } catch { setMobileErr('Error looking up customer') }
    finally { setChecking(false); setLoadingBkgs(false) }
  }

  // ── reset back to mobile step ──
  const resetToMobile = () => {
    setStep('mobile'); setCustomer(null)
    setAddresses([]); setAppliances([]); setRecentBkgs([])
    setCreated([]); setErr(''); setMobileErr('')
  }

  // ── create booking ──
  const handleCreate = async () => {
    setErr('')
    if (!form.service_id)     { setErr('Please select a service'); return }
    if (!form.address_id)     { setErr('Please select a service address'); return }
    if (!form.scheduled_date) { setErr('Please select a scheduled date'); return }
    setSaving(true)
    try {
      const payload: any = {
        customer_id:     customer.id,
        service_id:      form.service_id,
        address_id:      form.address_id,
        scheduled_date:  form.scheduled_date + 'T00:00:00',
        scheduled_slot:  form.scheduled_slot || undefined,
        notes:           form.notes || undefined,
        priority:        form.priority,
        source:          'CALL_CENTER',
        domain_id:       form.domain_id || undefined,
        city_id:         cityPrice?.city_id || undefined,
        city:            cityPrice?.city_name || (selAddr as any)?.city || undefined,
        force_duplicate: forceDuplicate,
      }
      if (selAppl) {
        payload.appliance_brand = selAppl.brand_name || selAppl.category || undefined
        payload.appliance_model = selAppl.model || undefined
        payload.appliance_id = selAppl.id || undefined
      }
      const res = await bookingsAPI.create(payload)
      const b = res.data.data
      setCreated(prev => [...prev, b])
      setSelSvc(null); setSvcSearch('')
      setForm(f => ({ ...f, service_id: '', scheduled_date: '', scheduled_slot: '', appliance_id: '', notes: '' })); setShowForceOption(false); setForceDuplicate(false)
    } catch (ex: any) {
      const detail: string = ex.response?.data?.detail || ''
      if (detail.startsWith('DUPLICATE:')) {
        const parts = detail.split(':')
        const bkNum = parts[1] ?? ''
        const bkStatus = parts[2] ?? ''
        const catName = parts[3] ?? ''
        const catMsg = catName ? ` in category "${catName}"` : ''
        setErr(`⚠ Duplicate blocked: Booking ${bkNum} (${bkStatus}) is already active${catMsg} at this address. Cancel/complete it first, or tick "Force create" below to override.`)
        setShowForceOption(true)
      } else {
        setErr(detail || 'Failed to create booking')
      }
    } finally { setSaving(false) }
  }

  // ─── active bookings count for badge ──────────────────────────────────────
  const activeBkgCount = recentBkgs.filter(b => ACTIVE_STATUSES.includes(b.status)).length

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <Modal
      title={customer ? `Book Service — ${customer.name}` : 'Create Booking'}
      onClose={onClose}
      size="lg"
    >

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 1 — Mobile lookup
      ══════════════════════════════════════════════════════════════════════ */}
      {step === 'mobile' && (
        <div>
          <div style={{ marginBottom: 20 }}>
            <label style={lbl}>Customer Mobile *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input" type="tel" placeholder="10-digit mobile" maxLength={10}
                value={mobile} onChange={e => setMobile(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && checkMobile()}
                autoFocus
              />
              <button className="btn btn-primary" onClick={checkMobile} disabled={checking} style={{ whiteSpace: 'nowrap' }}>
                {checking ? <Spinner size="sm" /> : 'Find Customer'}
              </button>
            </div>
            {mobileErr && (
              <div style={{ color: '#DC2626', fontSize: 13, marginTop: 6, background: '#FEF2F2', padding: '6px 10px', borderRadius: 6 }}>
                {mobileErr}
              </div>
            )}
          </div>
          <div style={{ fontSize: 13, color: '#94A3B8' }}>
            Enter the customer's registered mobile number to look up their profile, saved addresses, and booking history.
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 2 — Customer preview + recent bookings (sorted: active first)
      ══════════════════════════════════════════════════════════════════════ */}
      {step === 'preview' && customer && (
        <div>
          {/* Customer card */}
          <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#1E40AF', marginBottom: 4 }}>{customer.name}</div>
                <div style={{ fontSize: 13, color: '#3B82F6' }}>📱 {customer.mobile}</div>
                {customer.email && <div style={{ fontSize: 12, color: '#60A5FA', marginTop: 2 }}>✉ {customer.email}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>Customer Code</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1E40AF', background: 'white', padding: '3px 8px', borderRadius: 5, fontSize: 13 }}>
                  {customer.customer_code}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12, color: '#64748B' }}>
                📋 Total Bookings: <b style={{ color: '#1E40AF' }}>{customer.total_bookings || 0}</b>
              </div>
              <div style={{ fontSize: 12, color: '#64748B' }}>
                📍 Addresses: <b style={{ color: '#1E40AF' }}>{addresses.length}</b>
              </div>
              <div style={{ fontSize: 12, color: '#64748B' }}>
                🔧 Appliances: <b style={{ color: '#1E40AF' }}>{appliances.length}</b>
              </div>
            </div>
          </div>

          {/* ── Active booking warning banner ── */}
          {activeBkgCount > 0 && (
            <div style={{
              background: '#FFF7ED', border: '2px solid #F97316', borderRadius: 10,
              padding: '12px 16px', marginBottom: 14,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 22 }}>🟠</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: '#C2410C' }}>
                    {activeBkgCount} Active / Running Booking{activeBkgCount > 1 ? 's' : ''} Found
                  </div>
                  <div style={{ fontSize: 12, color: '#EA580C', marginTop: 1 }}>
                    Review the bookings below. Creating a booking in the <strong>same category</strong> at the <strong>same address</strong> will be blocked as a duplicate.
                    A different category (e.g. AC vs Washing Machine) at the same address is allowed. A different address is always allowed.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Recent bookings (last 5, active first) ── */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              {recentBkgs.length > 0
                ? `Booking History — Last ${recentBkgs.length} Record${recentBkgs.length > 1 ? 's' : ''}`
                : 'Booking History'}
              {activeBkgCount > 0 && (
                <span style={{ fontSize: 11, background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>
                  🟡 {activeBkgCount} active
                </span>
              )}
            </div>

            {loadingBkgs ? (
              <div style={{ textAlign: 'center', padding: 20 }}><Spinner /></div>
            ) : recentBkgs.length === 0 ? (
              <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#166534' }}>
                ✓ No existing bookings — this will be the customer's first booking.
              </div>
            ) : (
              <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
                {recentBkgs.map((b: any, i: number) => {
                  const sc = statusColor(b.status)
                  const isActive = ACTIVE_STATUSES.includes(b.status)
                  const svcName  = bkgService(b)
                  const addrStr  = shortAddress(b)
                  return (
                    <div key={b.id} style={{
                      padding: '12px 16px',
                      borderBottom: i < recentBkgs.length - 1 ? '1px solid #F1F5F9' : 'none',
                      background: isActive ? '#FFFBEB' : 'white',
                      borderLeft: isActive ? '4px solid #F59E0B' : '4px solid transparent',
                    }}>
                      {/* Row 1: booking number + status + amount */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {isActive && <span style={{ fontSize: 14 }}>🟡</span>}
                          <span style={{ fontWeight: 700, fontSize: 13, color: isActive ? '#92400E' : '#0F172A', fontFamily: 'monospace' }}>
                            {b.booking_number || b.id?.slice(0, 8)}
                          </span>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                            background: sc.bg, color: sc.color, whiteSpace: 'nowrap',
                          }}>
                            {b.status}
                          </span>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#059669' }}>
                          {money(b.total_amount || 0)}
                        </div>
                      </div>

                      {/* Row 2: service name */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <span style={{ fontSize: 12 }}>🔧</span>
                        <span style={{
                          fontSize: 12, fontWeight: 600,
                          color: isActive ? '#92400E' : '#1E40AF',
                        }}>
                          {svcName}
                        </span>
                        {b.domain_name && b.domain_name !== svcName && (
                          <span style={{ fontSize: 11, color: '#94A3B8' }}>· {b.domain_name}</span>
                        )}
                      </div>

                      {/* Row 3: address + date */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1, overflow: 'hidden' }}>
                          <span style={{ fontSize: 11 }}>📍</span>
                          <span style={{
                            fontSize: 11, color: '#64748B',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {addrStr}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: '#94A3B8', whiteSpace: 'nowrap' }}>
                          {b.scheduled_date ? fmtDate(b.scheduled_date) : '—'}
                        </div>
                      </div>

                      {/* Active note */}
                      {isActive && (
                        <div style={{ marginTop: 6, fontSize: 11, color: '#B45309', background: '#FEF3C7', padding: '3px 8px', borderRadius: 5, display: 'inline-block' }}>
                          ⚠ Same category + same address = duplicate (will be blocked)
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Address warning + inline quick-add (previously this was a dead end:
              the Continue button was just silently disabled with no way to act
              on it from here) */}
          {addresses.length === 0 && !showAddAddr && (
            <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8, padding: '12px 14px', marginBottom: 14, fontSize: 13, color: '#92400E' }}>
              <div style={{ marginBottom: 8 }}>
                ⚠ This customer has <b>no saved addresses</b>, so booking can't continue yet.
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddAddr(true)}>
                + Add Address Now
              </button>
            </div>
          )}

          {addresses.length === 0 && showAddAddr && (
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 14, marginBottom: 14 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Add Address for {customer?.name}</h4>
              <Err msg={addrErr} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={lbl}>Address Line 1 *</label>
                  <input className="input" value={addrForm.address_line1}
                    onChange={e => setAddrField('address_line1', e.target.value)} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={lbl}>Address Line 2</label>
                  <input className="input" value={addrForm.address_line2}
                    onChange={e => setAddrField('address_line2', e.target.value)} />
                </div>
                <div>
                  <label style={lbl}>City *</label>
                  {cities.length > 0 ? (
                    <select className="input" value={addrForm.city}
                      onChange={e => {
                        const city = cities.find((c: any) => c.name === e.target.value)
                        setAddrField('city', e.target.value)
                        if (city) setAddrField('state', city.state ?? '')
                      }}>
                      <option value="">Select city</option>
                      {cities.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  ) : (
                    <input className="input" value={addrForm.city}
                      onChange={e => setAddrField('city', e.target.value)} />
                  )}
                </div>
                <div>
                  <label style={lbl}>State *</label>
                  <input className="input" value={addrForm.state}
                    onChange={e => setAddrField('state', e.target.value)} />
                </div>
                <div>
                  <label style={lbl}>Pincode *</label>
                  <input className="input" value={addrForm.pincode} maxLength={6}
                    onChange={e => setAddrField('pincode', e.target.value)} />
                </div>
                <div>
                  <label style={lbl}>Label</label>
                  <input className="input" value={addrForm.label}
                    onChange={e => setAddrField('label', e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={saveQuickAddress} disabled={addrSaving}>
                  {addrSaving ? <Spinner size="sm" /> : 'Save Address'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => { setShowAddAddr(false); setAddrErr('') }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button
              className="btn btn-primary"
              onClick={() => setStep('book')}
              disabled={addresses.length === 0}
              title={addresses.length === 0 ? 'Add an address above first' : undefined}
              style={{ flex: 1 }}
            >
              {activeBkgCount > 0
                ? `Continue — Create New Booking →`
                : 'Continue to Book Service →'}
            </button>
            <button className="btn btn-secondary" onClick={resetToMobile}>
              ← Change Customer
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 3 — Booking form
      ══════════════════════════════════════════════════════════════════════ */}
      {step === 'book' && customer && (
        <div>
          {/* Customer summary bar */}
          <div style={{ background: '#EFF6FF', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, color: '#1E40AF', fontSize: 14 }}>{customer.name}</div>
              <div style={{ fontSize: 12, color: '#3B82F6' }}>{customer.mobile} · {customer.customer_code}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {activeBkgCount > 0 && (
                <span style={{ fontSize: 11, background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>
                  🟡 {activeBkgCount} active booking{activeBkgCount > 1 ? 's' : ''}
                </span>
              )}
              {!initCustomer && (
                <button className="btn btn-secondary btn-sm" onClick={() => setStep('preview')}>
                  ← View History
                </button>
              )}
            </div>
          </div>

          {/* Created this session */}
          {created.length > 0 && (
            <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#166534', marginBottom: 4 }}>
                ✓ {created.length} booking{created.length > 1 ? 's' : ''} created this session
              </div>
              {created.map(b => (
                <div key={b.id} style={{ fontSize: 12, color: '#15803D' }}>
                  • <b>{b.booking_number}</b> — {b.status}
                </div>
              ))}
              <div style={{ fontSize: 11, color: '#16A34A', marginTop: 4 }}>
                You can add another booking below (different service or address).
              </div>
            </div>
          )}

          {/* Domain */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Domain / Brand *</label>
            <select className="input" value={form.domain_id} onChange={e => set('domain_id', e.target.value)}>
              <option value="">— Select domain —</option>
              {domains.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          {/* Service search */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>
              Service *
              {allSvcs.length > 0 && (
                <span style={{ fontWeight: 400, color: '#94A3B8', marginLeft: 6 }}>({allSvcs.length} available)</span>
              )}
            </label>
            {!form.domain_id ? (
              <div style={{ padding: '8px 12px', background: '#F8FAFC', borderRadius: 6, fontSize: 13, color: '#94A3B8' }}>Select a domain first</div>
            ) : loadSvc ? <Spinner size="sm" /> : (
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  placeholder={`Search ${allSvcs.length} services...`}
                  value={svcSearch}
                  onChange={e => {
                    setSvcSearch(e.target.value)
                    if (!e.target.value) { setSelSvc(null); set('service_id', '') }
                  }}
                />
                {/* Dropdown */}
                {svcSearch && !selSvc && filteredSvcs.length > 0 && (
                  <div style={{
                    position: 'absolute', zIndex: 50, top: '100%', left: 0, right: 0,
                    background: 'white', border: '1px solid #E2E8F0', borderRadius: 8,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.1)', maxHeight: 240, overflowY: 'auto', marginTop: 2,
                  }}>
                    {filteredSvcs.map((s: any) => (
                      <div key={s.service_id || s.id} onClick={() => pickService(s)}
                        style={{ padding: '9px 14px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9', fontSize: 13 }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#EFF6FF')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                        <div style={{ fontWeight: 600, color: '#0F172A' }}>{s.name || s.service_name}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>
                          {s.category_name && <span>{s.category_name} · </span>}
                          {s.base_price ? `₹${s.base_price}` : 'Price varies'}
                          {s.gst_percent ? ` + ${s.gst_percent}% GST` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {svcSearch && !selSvc && filteredSvcs.length === 0 && (
                  <div style={{ marginTop: 4, fontSize: 12, color: '#F59E0B' }}>No services match "{svcSearch}"</div>
                )}
                {selSvc && (
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, background: '#EFF6FF', color: '#1B4FD8', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>
                      ✓ {selSvc.name || selSvc.service_name}
                    </span>
                    <button onClick={() => { setSelSvc(null); setSvcSearch(''); set('service_id', '') }}
                      style={{ fontSize: 11, color: '#64748B', background: 'none', border: 'none', cursor: 'pointer' }}>
                      ✕ clear
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Price details panel */}
          {selSvc && (
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '12px 16px', marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                Price Details
              </div>
              {loadPrice ? <Spinner size="sm" /> : (
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>Base Price</div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#0F172A' }}>₹{basePrice.toLocaleString('en-IN')}</div>
                  </div>
                  {selAddr && (
                    <div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>City Price ({selAddr.city})</div>
                      {cityPrice
                        ? <div style={{ fontWeight: 700, fontSize: 15, color: '#1B4FD8' }}>₹{cityPrice.price.toLocaleString('en-IN')}</div>
                        : <div style={{ fontSize: 12, color: '#F59E0B' }}>Using base price</div>}
                    </div>
                  )}
                  {gstPct > 0 && (
                    <div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>GST ({gstPct}%)</div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#64748B' }}>+₹{gstAmt.toLocaleString('en-IN')}</div>
                    </div>
                  )}
                  <div style={{ borderLeft: '2px solid #E2E8F0', paddingLeft: 20 }}>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>Total Estimate</div>
                    <div style={{ fontWeight: 800, fontSize: 17, color: '#059669' }}>₹{totalPrice.toLocaleString('en-IN')}</div>
                  </div>
                </div>
              )}
              {cityPrices.length > 0 && !cityPrice && selAddr && (
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 8 }}>
                  City prices: {cityPrices.map((cp: any) => `${cp.city_name} (₹${cp.price})`).join(', ')}
                </div>
              )}
            </div>
          )}

          {/* Address */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Service Address *</label>
            <select className="input" value={form.address_id} onChange={e => set('address_id', e.target.value)}>
              <option value="">— Select address —</option>
              {addresses.map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.label} — {a.address_line1}, {a.city} {a.pincode}
                </option>
              ))}
            </select>
            {addresses.length === 0 && (
              <div style={{ fontSize: 12, color: '#F59E0B', marginTop: 4 }}>
                ⚠ No addresses saved. Go to the customer's Addresses tab to add one first.
              </div>
            )}
          </div>

          {/* Date + slot */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={lbl}>Scheduled Date *</label>
              <input className="input" type="date" value={form.scheduled_date}
                onChange={e => set('scheduled_date', e.target.value)}
                min={new Date().toISOString().split('T')[0]} />
            </div>
            <div>
              <label style={lbl}>Time Slot</label>
              <select className="input" value={form.scheduled_slot} onChange={e => set('scheduled_slot', e.target.value)}>
                <option value="">— Any slot —</option>
                {SLOTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {/* Appliance selector */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>
              Appliance
              <span style={{ fontSize: 11, fontWeight: 400, color: '#94A3B8', marginLeft: 6 }}>
                (optional — technician can fill during service if unknown)
              </span>
            </label>
            {(() => {
              // Filter appliances by selected service category
              const _svcCatId = selSvc?.appliance_category_id || selSvc?.category_id || null
              const catFiltered: any[] = _svcCatId
                ? appliances.filter((a: any) =>
                    !a.appliance_category_id ||
                    a.appliance_category_id === _svcCatId
                  )
                : appliances
              const displayAppl = catFiltered.length > 0 ? catFiltered : appliances
              return appliances.length === 0 ? (
                <div style={{ padding: '8px 12px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 6, fontSize: 12, color: '#92400E' }}>
                  No appliances registered for this customer. Will be added by technician during service.
                </div>
              ) : (
                <>
                  {catFiltered.length < appliances.length && selSvc && (
                    <div style={{ fontSize: 11, color: '#1D4ED8', background: '#EFF6FF', padding: '4px 10px', borderRadius: 5, marginBottom: 6 }}>
                      🔧 Showing {catFiltered.length} {selSvc.category_name || 'category'}-related appliance{catFiltered.length !== 1 ? 's' : ''} · {appliances.length - catFiltered.length} other{appliances.length - catFiltered.length !== 1 ? 's' : ''} hidden
                    </div>
                  )}
                  <select className="input" value={form.appliance_id} onChange={e => set('appliance_id', e.target.value)}>
                    <option value="">— Skip / Not known yet —</option>
                    {displayAppl.map((a: any) => (
                      <option key={a.id} value={a.id}>
                        {a.category || a.category_name || 'Appliance'}
                        {a.brand_name ? ` — ${a.brand_name}` : ''}
                        {a.model ? ` (${a.model})` : ''}
                        {a.serial_number ? ` · S/N: ${a.serial_number}` : ''}
                      </option>
                    ))}
                  </select>
                </>
              )
            })()}
            {selAppl && (
              <div style={{ marginTop: 6, fontSize: 12, color: '#1B4FD8', background: '#EFF6FF', padding: '5px 10px', borderRadius: 6 }}>
                Selected: <b>{selAppl.brand_name || '—'}</b> · {selAppl.model || '—'}
                {selAppl.is_under_warranty && (
                  <span style={{ marginLeft: 6, background: '#D1FAE5', color: '#065F46', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                    Under Warranty
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Priority + notes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={lbl}>Priority</label>
              <select className="input" value={form.priority} onChange={e => set('priority', e.target.value)}>
                {['NORMAL', 'HIGH', 'URGENT'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Internal Notes</label>
              <input className="input" placeholder="Optional notes for CCO / technician"
                value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>

          {/* Duplicate rule reminder */}
          <div style={{ background: '#EFF6FF', borderRadius: 6, padding: '7px 12px', fontSize: 12, color: '#1D4ED8', marginBottom: 14 }}>
            ℹ <b>Duplicate rule:</b> Same customer + same <b>service category</b> + same address + active booking = blocked.
            Different category (e.g. AC vs Washing Machine) or different address = allowed. Admins can override with "Force create".
          </div>

          <Err msg={err} />

          {showForceOption && (
            <div style={{ background: '#FFF7ED', border: '1px solid #FDBA74', borderRadius: 8, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <input
                type="checkbox"
                id="force-dup"
                checked={forceDuplicate}
                onChange={e => setForceDuplicate(e.target.checked)}
                style={{ marginTop: 3, cursor: 'pointer', accentColor: '#EA580C' }}
              />
              <label htmlFor="force-dup" style={{ fontSize: 13, color: '#92400E', cursor: 'pointer', lineHeight: 1.4 }}>
                <b>Force create</b> — Override the duplicate block and create this booking anyway.
                <span style={{ display: 'block', fontSize: 11, color: '#B45309', marginTop: 2 }}>
                  Use only when you are certain the duplicate is intentional (e.g. second technician, split job).
                </span>
              </label>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
              {saving ? <Spinner size="sm" /> : created.length > 0 ? 'Add Another Booking' : 'Create Booking'}
            </button>
            {created.length > 0 && (
              <button className="btn btn-secondary" onClick={() => { onDone(); onClose() }}>Done</button>
            )}
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </div>
      )}
    </Modal>
  )
}
