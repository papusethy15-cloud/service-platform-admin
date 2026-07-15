/**
 * BookingWorkflow.tsx — Admin/CCO Booking Work Management Panel
 *
 * Multi-quotation support:
 *   - Each APPROVED quotation can independently start repair → complete → generate invoice
 *   - Admin can REJECT an APPROVED quotation with a reason (traced in status log)
 *   - Booking is only marked COMPLETED when all APPROVED quotations have been
 *     CONVERTED_TO_INVOICE or REJECTED (no pending approved quotation remains)
 *   - CONVERTED_TO_INVOICE quotation shows a "Start New Repair" cycle badge
 */

import { todayIST, fmtDateIST, fmtDateTimeIST, fmtTimeIST } from "../../lib/tz";
import { useEffect, useState, useCallback } from 'react'
import { useBookingWebSocket } from '@/hooks/useAdminWebSocket'
import { useAuthStore } from '@/store/authStore'
import Modal from '@/components/ui/Modal'
import SettleModal from '@/components/ui/SettleModal'
import Spinner from '@/components/ui/Spinner'
import {
  bookingsAPI, quotationsAPI, invoicesAPI, paymentsAPI, customersAPI,
} from '@/services/api'

// ─── helpers ──────────────────────────────────────────────────────────────────
const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`

/** Extract a human-readable error message from an Axios error.
 *  Handles both FastAPI HTTPException (detail: string)
 *  and Pydantic 422 validation errors (detail: array of {loc, msg, type}). */
const extractApiError = (ex: any, fallback = 'Request failed'): string => {
  const d = ex?.response?.data?.detail
  if (!d) return fallback
  if (typeof d === 'string') return d
  if (Array.isArray(d)) {
    // Pydantic 422: [{loc: [...], msg: '...', type: '...'}]
    return d.map((e: any) => {
      const field = Array.isArray(e.loc) ? e.loc.join(' → ') : String(e.loc || '')
      return field ? `${field}: ${e.msg}` : e.msg
    }).join('; ')
  }
  return fallback
}
const fmtDT = (d: string) => d
  ? new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—'
const fmtDate = (d: string) => d
  ? new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' })
  : '—'

const lbl: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }

const Err = ({ msg }: { msg: string }) =>
  msg ? <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 10 }}>{msg}</div> : null

const OK = ({ msg }: { msg: string }) =>
  msg ? <div style={{ background: '#F0FDF4', color: '#166534', border: '1px solid #86EFAC', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 10 }}>{msg}</div> : null

// Booking status ordering for the stepper
const STATUS_ORDER = [
  'PENDING', 'CONFIRMED', 'ASSIGNED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED',
  'INSPECTING', 'QUOTATION_APPROVED', 'IN_PROGRESS', 'COMPLETED', 'INVOICE_GENERATED', 'PAYMENT_PENDING', 'PAID',
  'PENDING_VERIFICATION', 'CLOSED',
]

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending', CONFIRMED: 'Confirmed', ASSIGNED: 'Assigned',
  ACCEPTED: 'Accepted', EN_ROUTE: 'On the Way', ARRIVED: 'Arrived',
  INSPECTING: 'Inspecting', QUOTATION_APPROVED: 'Quotation Approved', IN_PROGRESS: 'Work in Progress', CANCELLATION_REQUESTED: 'Cancel Requested',
  COMPLETED: 'Work Done', INVOICE_GENERATED: 'Invoice Ready',
  PAYMENT_PENDING: 'Payment Pending', PAID: 'Fully Paid', CLOSED: 'Closed & Settled', SETTLED: 'Settled',
  PENDING_VERIFICATION: 'Awaiting Admin Verification',
  CANCELLED: 'Cancelled', RESCHEDULED: 'Rescheduled',
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: '#F59E0B', CONFIRMED: '#3B82F6', ASSIGNED: '#8B5CF6',
  ACCEPTED: '#6366F1', EN_ROUTE: '#0EA5E9', ARRIVED: '#06B6D4',
  INSPECTING: '#F97316', QUOTATION_APPROVED: '#059669', IN_PROGRESS: '#10B981', CANCELLATION_REQUESTED: '#F59E0B',
  COMPLETED: '#22C55E', INVOICE_GENERATED: '#7C3AED',
  PAYMENT_PENDING: '#EF4444', PAID: '#059669', CLOSED: '#374151',
  CANCELLED: '#DC2626', RESCHEDULED: '#F59E0B', PENDING_VERIFICATION: '#7C3AED',
}

const PAYMENT_METHODS = [
  { value: 'CASH',          label: '💵 Cash',         desc: 'Collect cash from customer' },
  { value: 'UPI',           label: '📱 UPI / QR',      desc: 'Generate QR code for scan' },
  { value: 'BANK_TRANSFER', label: '🏦 Bank Transfer', desc: 'Record UTR / NEFT reference' },
  { value: 'RAZORPAY',      label: '🔗 Payment Link',  desc: 'Send Razorpay link to customer' },
  { value: 'PAY_LATER',     label: '⏰ Pay Later',      desc: 'Schedule collection date' },
]

// ─── Quotation status helpers ─────────────────────────────────────────────────

/** All approved quotations that are NOT yet converted to invoice */
const pendingApprovedQuotations = (quotations: any[]) =>
  quotations.filter((q: any) => q.status === 'APPROVED')

/** All approved quotations that have already been converted to invoice */
const convertedQuotations = (quotations: any[]) =>
  quotations.filter((q: any) => q.status === 'CONVERTED_TO_INVOICE')

/**
 * Booking can be considered "all repairs done" when:
 * - At least one quotation exists
 * - No quotation is in APPROVED state (all are either CONVERTED_TO_INVOICE or REJECTED/DRAFT/etc.)
 */
const allRepairsDone = (quotations: any[]) => {
  if (quotations.length === 0) return false
  return pendingApprovedQuotations(quotations).length === 0
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface BookingWorkflowProps {
  booking: any
  onClose: () => void
  onRefresh: () => void
  userRole?: string
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function BookingWorkflow({ booking: initBooking, onClose, onRefresh, userRole = 'ADMIN' }: BookingWorkflowProps) {

  // ── live booking data ──
  const [booking,    setBooking]    = useState<any>(initBooking)
  const [timeline,   setTimeline]   = useState<any[]>([])
  const [quotations, setQuotations] = useState<any[]>([])
  const [invoices,   setInvoices]   = useState<any[]>([])
  const [payments,   setPayments]   = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [acting,     setActing]     = useState(false)
  const [err,        setErr]        = useState('')
  const [ok,         setOk]         = useState('')

  // ── invoice create form ──
  const [showInvoiceForm,  setShowInvoiceForm]  = useState(false)
  const [invTargetQuotation, setInvTargetQuotation] = useState<any>(null)
  const [invForm, setInvForm] = useState({ quotation_id: '', gstin: '', business_name: '', business_address: '', notes: '' })
  const [invSaving, setInvSaving] = useState(false)
  const [invErr,    setInvErr]    = useState('')
  const [custGst,   setCustGst]   = useState<{ gst_number?: string; gst_name?: string; gst_address?: string } | null>(null)
  const [custGstLoading, setCustGstLoading] = useState(false)

  // ── reject approved quotation form ──
  const [rejectingQuotation, setRejectingQuotation] = useState<any>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [rejectErr, setRejectErr] = useState('')

  // ── payment form ──
  const [showPayForm, setShowPayForm] = useState(false)
  const [payTargetInvoice, setPayTargetInvoice] = useState<any>(null)  // which invoice to pay
  const [payMethod, setPayMethod] = useState('CASH')
  const [payAmount, setPayAmount] = useState('')
  const [payRef,    setPayRef]    = useState('')
  const [payNotes,  setPayNotes]  = useState('')
  const [payDue,    setPayDue]    = useState('')
  const [paySaving, setPaySaving] = useState(false)
  const [payErr,    setPayErr]    = useState('')
  const [payQR,     setPayQR]     = useState('')
  const [payLink,   setPayLink]   = useState('')

  // ── loss inspection panel ──
  const [showLoss, setShowLoss] = useState(false)
  // ── settlement — uses shared SettleModal component ──
  const [showSettleModal, setShowSettleModal] = useState(false)

  // ── cancel booking form ──
  const [showCancelForm, setShowCancelForm] = useState(false)
  const [cancelReason,   setCancelReason]   = useState('')
  const [cancelling,     setCancelling]     = useState(false)

  // ── load all data ──
  const load = useCallback(async () => {
    setLoading(true); setErr(''); setOk('')
    try {
      // Use allSettled so one failing call doesn't block the rest
      const [bRes, tRes, qRes, iRes, pRes] = await Promise.allSettled([
        bookingsAPI.get(booking.id),
        bookingsAPI.timeline(booking.id),
        quotationsAPI.list({ booking_id: booking.id, per_page: 50 }),
        invoicesAPI.list({ booking_id: booking.id }),
        paymentsAPI.history({ booking_id: booking.id }),
      ])

      // Booking detail (required — surface error if it fails)
      if (bRes.status === 'fulfilled') {
        setBooking(bRes.value.data.data)
      } else {
        const detail = (bRes.reason as any)?.response?.data?.detail
        setErr(`Failed to load booking: ${detail || (bRes.reason as any)?.message || 'Unknown error'}`)
        setLoading(false)
        return
      }

      // Timeline (optional — non-fatal)
      if (tRes.status === 'fulfilled') {
        setTimeline(tRes.value.data.data || [])
      } else {
        console.warn('[BookingWorkflow] timeline load failed:', (tRes.reason as any)?.message)
        setTimeline([])
      }

      // Quotations (optional — non-fatal)
      if (qRes.status === 'fulfilled') {
        setQuotations(qRes.value.data.data?.items || [])
      } else {
        console.warn('[BookingWorkflow] quotations load failed:', (qRes.reason as any)?.message)
        setQuotations([])
      }

      // Invoices (optional — non-fatal)
      if (iRes.status === 'fulfilled') {
        setInvoices(iRes.value.data.data?.items || iRes.value.data.data || [])
      } else {
        console.warn('[BookingWorkflow] invoices load failed:', (iRes.reason as any)?.message)
        setInvoices([])
      }

      // Payments (optional — non-fatal)
      if (pRes.status === 'fulfilled') {
        setPayments(pRes.value.data.data?.items || [])
      } else {
        console.warn('[BookingWorkflow] payments load failed:', (pRes.reason as any)?.message)
        setPayments([])
      }
    } catch (ex: any) {
      setErr(`Failed to load booking data: ${ex?.response?.data?.detail || ex?.message || 'Unknown error'}`)
    }
    finally { setLoading(false) }
  }, [booking.id])

  useEffect(() => { load() }, [load])

  // ── Real-time sync via WebSocket ──────────────────────────────────────────
  // Subscribes to /ws/booking/{bookingId}. When the technician submits/edits
  // a quotation, or any quotation status changes, we silently reload so the
  // admin always sees the latest state without a manual refresh.
  const currentUserId = useAuthStore(s => s.user?.id)
  const { lastEvent: workflowWsEvent } = useBookingWebSocket(booking?.id || null)
  useEffect(() => {
    if (!workflowWsEvent) return
    const isQuotationEvent  = ['QUOTATION_CREATED', 'QUOTATION_UPDATED', 'QUOTATION_DELETED', 'QUOTATION_SUBMITTED'].includes(workflowWsEvent.type)
    const isBookingEvent    = workflowWsEvent.type === 'BOOKING_STATUS_CHANGED'
    const isInspection      = workflowWsEvent.type === 'INSPECTION_SUBMITTED'
    if (!isQuotationEvent && !isBookingEvent && !isInspection) return
    // Skip own actions — we already reload after every button click
    const actorId = workflowWsEvent.payload?.actor_user_id
    if (actorId && currentUserId && actorId === currentUserId) return
    load()
  }, [workflowWsEvent])

  // ── derived state ──
  const status    = booking?.status || 'PENDING'
  const statusIdx = STATUS_ORDER.indexOf(status)
  // No technician assigned yet — quotation approval, invoice generation, payment
  // collection, and on-site status updates (arrived/inspect/work/complete) are all
  // blocked server-side without one; the UI mirrors that here.
  const noTechnician = !booking?.technician_id

  // Multi-quotation awareness
  const approvedQuotations  = pendingApprovedQuotations(quotations)  // APPROVED, not yet invoiced
  const hasAnyApproved      = approvedQuotations.length > 0
  const firstApproved       = approvedQuotations[0]                  // used for single-quotation flows
  const hasInvoice = invoices.length > 0

  // ── Authoritative balance: use server balance_amount — not transaction sum ──────────────────
  // Summing SUCCESS payments is unreliable if legacy duplicate records exist in DB.
  // The backend's _apply_invoice_payment_state() is the single source of truth.
  const balanceByInvoiceId: Record<string, number> = {}
  invoices.forEach((inv: any) => {
    const serverBalance = inv.balance_amount
    balanceByInvoiceId[inv.id] = Math.max(
      serverBalance !== undefined && serverBalance !== null
        ? serverBalance
        : (inv.total_amount || 0),
      0
    )
  })

  // Totals across ALL invoices
  const totalInvoiced       = invoices.reduce((s: number, inv: any) => s + (inv.total_amount || 0), 0)
  const totalOutstanding    = invoices.reduce((s: number, inv: any) => s + balanceByInvoiceId[inv.id], 0)
  // Derived from invoiced - outstanding (avoids double-counting any legacy duplicate transactions)
  const totalPaid           = Math.max(totalInvoiced - totalOutstanding, 0)

  // Keep paidByInvoiceId for audit trail display only (not used for balance/button logic)
  const paidByInvoiceId: Record<string, number> = {}
  payments.filter((p: any) => p.status === 'SUCCESS').forEach((p: any) => {
    if (p.invoice_id) paidByInvoiceId[p.invoice_id] = (paidByInvoiceId[p.invoice_id] || 0) + (p.amount || 0)
  })

  // PAY_LATER scheduled amounts per invoice (PENDING, not yet collected)
  const payLaterByInvoiceId: Record<string, { amount: number; due: string | null }> = {}
  payments.filter((p: any) => (p.method === 'PAY_LATER' || p.reference_number === 'PAY_LATER') && p.status === 'PENDING').forEach((p: any) => {
    if (p.invoice_id) payLaterByInvoiceId[p.invoice_id] = {
      amount: (payLaterByInvoiceId[p.invoice_id]?.amount || 0) + (p.amount || 0),
      due: p.due_collect_at || payLaterByInvoiceId[p.invoice_id]?.due || null,
    }
  })

  // For legacy single-invoice references (settle/close flow uses first unpaid invoice)
  const latestInvoice       = invoices[0]
  const balance             = totalOutstanding  // overall outstanding across all invoices
  const repairsAllDone      = allRepairsDone(quotations)             // no pending APPROVED quotation left

  // Map invoice quotation_id → invoice for quick lookup
  const invoiceByQuotationId: Record<string, any> = {}
  invoices.forEach((inv: any) => {
    if (inv.quotation_id) invoiceByQuotationId[inv.quotation_id] = inv
  })

  // ── transition helper ──
  const transition = async (action: string, label: string, body?: any) => {
    setActing(true); setErr(''); setOk('')
    try {
      await (bookingsAPI as any)[action](booking.id, body)
      setOk(`✅ ${label}`)
      await load(); onRefresh()
    } catch (ex: any) {
      setErr(extractApiError(ex, `Failed: ${label}`))
    } finally { setActing(false) }
  }

  // ── open invoice form for a specific quotation ──
  // Derive invoice_type from quotation.tax_mode:
  //   NONE → NON_GST | B2C → GST_B2C | B2B → GST_B2B
  const deriveInvoiceType = (q: any): string => {
    const mode = (q.tax_mode || 'B2C').toUpperCase()
    if (mode === 'NONE') return 'NON_GST'
    if (mode === 'B2B')  return 'GST_B2B'
    return 'GST_B2C'
  }

  const openInvoiceForm = (quotation: any) => {
    setInvTargetQuotation(quotation)
    // Pre-fill GST/business fields from the quotation itself — the customer's GST
    // details were already captured at quotation time (B2B), so the admin should
    // never have to retype them here.
    setInvForm({
      quotation_id: quotation.id,
      gstin: quotation.customer_gst_number || '',
      business_name: quotation.customer_gst_name || '',
      business_address: quotation.customer_gst_address || '',
      notes: '',
    })
    setInvErr('')
    setCustGst(null)
    setShowInvoiceForm(true)

    // Fallback: if the quotation is B2B but is missing GST details for some reason,
    // look up the customer's saved GST profile so the admin can pick it instead of
    // typing it from scratch.
    const custId = quotation.customer_id || booking?.customer_id
    if ((quotation.tax_mode || '').toUpperCase() === 'B2B' && !quotation.customer_gst_number && custId) {
      setCustGstLoading(true)
      customersAPI.get(custId)
        .then((r: any) => {
          const c = r.data?.data || r.data
          if (c?.gst_number) setCustGst({ gst_number: c.gst_number, gst_name: c.gst_name, gst_address: c.gst_address })
        })
        .catch(() => {})
        .finally(() => setCustGstLoading(false))
    }
  }

  // Apply the customer's saved GST profile into the invoice form
  const useSavedCustomerGst = () => {
    if (!custGst) return
    setInvForm(f => ({
      ...f,
      gstin: custGst.gst_number || f.gstin,
      business_name: custGst.gst_name || f.business_name,
      business_address: custGst.gst_address || f.business_address,
    }))
  }

  // ── invoice create ──
  const createInvoice = async () => {
    if (!invForm.quotation_id) { setInvErr('Select a quotation'); return }
    setInvSaving(true); setInvErr('')
    try {
      const derivedType = invTargetQuotation ? deriveInvoiceType(invTargetQuotation) : 'GST_B2C'
      await invoicesAPI.create({
        quotation_id:     invForm.quotation_id,
        invoice_type:     derivedType,
        gstin:            invForm.gstin || undefined,
        business_name:    invForm.business_name || undefined,
        business_address: invForm.business_address || undefined,
        notes:            invForm.notes || undefined,
      })
      setShowInvoiceForm(false)
      setInvTargetQuotation(null)
      setOk('✅ Invoice generated successfully')
      await load(); onRefresh()
    } catch (ex: any) {
      setInvErr(extractApiError(ex, 'Failed to create invoice'))
    } finally { setInvSaving(false) }
  }

  // ── reject an APPROVED quotation ──
  const rejectApprovedQuotation = async () => {
    if (!rejectingQuotation) return
    if (!rejectReason.trim()) { setRejectErr('Rejection reason is required'); return }
    setRejecting(true); setRejectErr('')
    try {
      await quotationsAPI.reject(rejectingQuotation.id, { reason: rejectReason.trim() })
      setOk(`✅ Quotation ${rejectingQuotation.quotation_number} rejected`)
      setRejectingQuotation(null)
      setRejectReason('')
      await load(); onRefresh()
    } catch (ex: any) {
      setRejectErr(extractApiError(ex, 'Rejection failed'))
    } finally { setRejecting(false) }
  }

  // ── payment submit ──
  const submitPayment = async () => {
    if (!payTargetInvoice) return
    const invBalance = balanceByInvoiceId[payTargetInvoice.id] || 0

    // PAY_LATER: amount field is skipped — record the outstanding balance as a scheduled debt
    if (payMethod === 'PAY_LATER') {
      if (!payDue) { setPayErr('Select collection date'); return }
      setPaySaving(true); setPayErr('')
      try {
        // Record the actual outstanding balance amount so P&L tracking is accurate.
        // The reference_number = 'PAY_LATER' marks it as a future collection, NOT yet collected.
        // Treat payDue as IST date, convert 23:59 IST to UTC ISO
        const _istOffset = 5.5 * 60 * 60 * 1000;
        const _dueMidIST = new Date(new Date(`${payDue}T23:59:00`).getTime() - _istOffset);
        const dueDateTime = _dueMidIST.toISOString()
        await paymentsAPI.cash({
          invoice_id:            payTargetInvoice.id,
          amount:                invBalance,
          is_pay_later:          true,
          due_collect_at:        dueDateTime,
          notes:                 payNotes || undefined,
          reference_number:      'PAY_LATER',
          on_behalf_technician_id: booking?.technician_id || undefined,
        })
        setOk(`✅ Pay Later scheduled for ${fmtDate(payDue)} — ${money(invBalance)} outstanding`)
        setShowPayForm(false)
        await load(); onRefresh()
      } catch (ex: any) {
        setPayErr(extractApiError(ex, 'Payment failed'))
      } finally { setPaySaving(false) }
      return
    }

    // All other methods: require a positive amount
    const amt = parseFloat(payAmount)
    if (!payAmount || payAmount.trim() === '' || isNaN(amt) || amt <= 0) {
      setPayErr('Enter a valid payment amount greater than ₹0')
      return
    }
    if (amt > invBalance + 0.01) {
      setPayErr(`Amount ${money(amt)} exceeds outstanding balance of ${money(invBalance)}`)
      return
    }

    setPaySaving(true); setPayErr(''); setPayQR(''); setPayLink('')
    try {
      const base = {
        invoice_id: payTargetInvoice.id,
        amount: amt,
        notes: payNotes || undefined,
        // Tell backend this cash was collected on-site by the assigned technician,
        // not directly by admin — so a PENDING CashCollectionRecord is created
        // and the tech must deposit it to admin (tracked in Cash Collections page).
        on_behalf_technician_id: booking?.technician_id || undefined,
      }
      if (payMethod === 'CASH') {
        await paymentsAPI.cash({ ...base, reference_number: payRef || undefined })
        setOk(`✅ Cash payment of ${money(amt)} recorded`)
        setShowPayForm(false)
      } else if (payMethod === 'BANK_TRANSFER') {
        if (!payRef) { setPayErr('Reference / UTR number required for bank transfer'); setPaySaving(false); return }
        await paymentsAPI.bankTransfer({ ...base, reference_number: payRef })
        setOk(`✅ Bank transfer of ${money(amt)} recorded`)
        setShowPayForm(false)
      } else if (payMethod === 'UPI') {
        const r = await paymentsAPI.generateQR({ ...base })
        setPayQR(r.data.data?.qr_payload || '')
        setOk('✅ UPI QR generated — show to customer to scan')
      } else if (payMethod === 'RAZORPAY') {
        const r = await paymentsAPI.generateLink({ ...base })
        setPayLink(r.data.data?.payment_link || '')
        setOk('✅ Payment link generated')
      }
      await load(); onRefresh()
    } catch (ex: any) {
      setPayErr(extractApiError(ex, 'Payment failed'))
    } finally { setPaySaving(false) }
  }

  // ── loss inspection calculations ──
  // Market purchase parts cost — list API doesn't return parts array, only parts_total per quotation.
  // We count parts_total only for CONVERTED_TO_INVOICE quotations (invoiced = real cost incurred).
  const invoicedQuotations  = quotations.filter((q: any) => q.status === 'CONVERTED_TO_INVOICE')
  const totalMarketCost     = invoicedQuotations.reduce((s: number, q: any) => s + (q.parts_total || 0), 0)
  const marketPartsCount    = invoicedQuotations.filter((q: any) => (q.parts_total || 0) > 0).length
  // Discount: only from quotations that were actually invoiced
  const totalDiscount       = invoicedQuotations.reduce((s: number, q: any) => s + (q.discount_amount || 0) + (q.coupon_discount || 0), 0)
  const outstandingBalance  = totalOutstanding
  const platformRisk        = totalMarketCost + totalDiscount + outstandingBalance  // parts cost + discount + outstanding

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <Modal
      title={`Work Management — ${booking.booking_number}`}
      onClose={onClose}
      size="xl"
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spinner /></div>
      ) : (
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>

          {/* ═══════════════════════════════════════════════════════════
              LEFT COLUMN — Status + Actions
          ═══════════════════════════════════════════════════════════ */}
          <div style={{ flex: '1 1 340px', minWidth: 300 }}>

            {/* Booking header card */}
            <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: '#1E40AF', fontFamily: 'monospace' }}>{booking.booking_number}</div>
                  <div style={{ fontSize: 13, color: '#374151', marginTop: 4 }}>
                    👤 {booking.customer_name || '—'} · {booking.customer_mobile || ''}
                  </div>
                  {booking.domain_name && (
                    <div style={{ fontSize: 11, background: '#DBEAFE', color: '#1E40AF', display: 'inline-block', padding: '1px 8px', borderRadius: 20, marginTop: 4 }}>{booking.domain_name}</div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                    <div style={{ width: 9, height: 9, borderRadius: '50%', background: STATUS_COLOR[status] || '#94A3B8' }} />
                    <span style={{ fontWeight: 700, fontSize: 13, color: STATUS_COLOR[status] || '#374151' }}>
                      {STATUS_LABEL[status] || status}
                    </span>
                  </div>
                  {booking.technician_name && (
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>👷 {booking.technician_name}</div>
                  )}
                </div>
              </div>
              {booking.service_name && (
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 8 }}>🔧 {booking.service_name} · 📅 {fmtDate(booking.scheduled_date)}</div>
              )}
            </div>

            <OK msg={ok} />
            <Err msg={err} />

            {/* ─── WORKFLOW STEPPER ─── */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                Workflow Progress
              </div>

              {[
                { key: 'ASSIGNED',           icon: '📋', label: 'Assigned to Technician' },
                { key: 'ACCEPTED',           icon: '✅', label: 'Technician Accepted' },
                { key: 'EN_ROUTE',           icon: '🚗', label: 'On the Way' },
                { key: 'ARRIVED',            icon: '📍', label: 'Arrived at Customer' },
                { key: 'INSPECTING',         icon: '🔍', label: 'Inspection Started' },
                { key: 'QUOTATION_APPROVED', icon: '✅', label: 'Quotation Approved' },
                { key: 'IN_PROGRESS',        icon: '🔧', label: 'Work in Progress' },
                { key: 'COMPLETED',          icon: '🏁', label: 'Work Completed' },
                { key: 'INVOICE_GENERATED',  icon: '📄', label: 'Invoice Generated' },
                { key: 'PAID',               icon: '💰', label: 'Payment Collected' },
                { key: 'PENDING_VERIFICATION', icon: '🔍', label: 'Awaiting Admin Verification' },
                { key: 'CLOSED',             icon: '🔒', label: 'Settled & Closed' },
              ].map((step, i, arr) => {
                const stepIdx = STATUS_ORDER.indexOf(step.key)
                const isDone  = stepIdx < statusIdx || status === step.key || (step.key === 'PAID' && totalInvoiced > 0 && totalPaid >= totalInvoiced)
                const isActive = step.key === status
                const isPast  = stepIdx < statusIdx

                return (
                  <div key={step.key} style={{ display: 'flex', gap: 10, marginBottom: i < arr.length - 1 ? 0 : 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 28 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isPast ? STATUS_COLOR[step.key] || '#22C55E' : isActive ? STATUS_COLOR[step.key] || '#3B82F6' : '#F1F5F9',
                        border: isActive ? `2px solid ${STATUS_COLOR[step.key]}` : 'none',
                        fontSize: 13, flexShrink: 0,
                        boxShadow: isActive ? `0 0 0 3px ${STATUS_COLOR[step.key]}30` : 'none',
                      }}>
                        {isPast ? '✓' : step.icon}
                      </div>
                      {i < arr.length - 1 && (
                        <div style={{ width: 2, flex: 1, minHeight: 18, background: isPast ? '#22C55E' : '#E2E8F0', margin: '2px 0' }} />
                      )}
                    </div>
                    <div style={{ paddingBottom: 16, flex: 1 }}>
                      <div style={{
                        fontSize: 13, fontWeight: isActive ? 700 : 500,
                        color: isPast ? '#059669' : isActive ? '#0F172A' : '#94A3B8',
                      }}>
                        {step.label}
                      </div>
                      {isActive && (
                        <div style={{ fontSize: 11, color: STATUS_COLOR[step.key] || '#3B82F6', fontWeight: 600 }}>← Current stage</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ─── ACTION BUTTONS by stage ─── */}
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                Admin / CCO Actions
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

                {/* ── Rescheduled visit — show repair stage context & smart actions ── */}
                {status === 'RESCHEDULED' && (() => {
                  const preStatus = booking.pre_reschedule_status as string | undefined
                  const isResumingWork    = preStatus === 'IN_PROGRESS'
                  const isResumingInspect = preStatus === 'INSPECTING' || preStatus === 'ARRIVED'
                  return (
                    <div style={{ background:'#FEF3C7', border:'1px solid #FCD34D', borderRadius:10, padding:'12px 14px', marginBottom:4, display:'flex', flexDirection:'column', gap:8 }}>
                      <div style={{ fontSize:13, fontWeight:800, color:'#92400E' }}>🔄 Rescheduled Visit</div>
                      <div style={{ fontSize:12, color:'#92400E' }}>
                        {isResumingWork
                          ? '⚠️ Repair was IN PROGRESS — resume work directly after arrival. No re-inspection needed.'
                          : isResumingInspect
                            ? '⚠️ Inspection was underway — continue inspection after technician arrives.'
                            : 'Booking rescheduled — proceed with normal visit workflow.'}
                      </div>
                      {preStatus && (
                        <div style={{ fontSize:11, color:'#92400E' }}>
                          Stage before reschedule: <b>{preStatus.replace(/_/g,' ')}</b>
                        </div>
                      )}
                      {booking.scheduled_date && (
                        <div style={{ fontSize:12, fontWeight:700, color:'#92400E' }}>
                          📅 {booking.scheduled_date}{booking.scheduled_slot ? ` · ${booking.scheduled_slot.replace('-',' – ')}` : ''}
                        </div>
                      )}
                      {isResumingWork && (
                        <ActionBtn icon="🔧" label="Resume Work (Skip to In Progress)"
                          color="#166534" bg="#DCFCE7" border="#86EFAC"
                          hint="Repair was in progress — skip en-route/inspection and go straight to work"
                          onClick={() => transition('startWork', '🔧 Resumed — work in progress')} loading={acting} disabled={noTechnician} />
                      )}
                      {isResumingInspect && (
                        <ActionBtn icon="🔍" label="Continue Inspection"
                          color="#92400E" bg="#FEF3C7" border="#FCD34D"
                          hint="Inspection was underway — mark arrived and proceed"
                          onClick={() => transition('arrived', 'Technician arrived (rescheduled)')} loading={acting} disabled={noTechnician} />
                      )}
                      {!isResumingWork && !isResumingInspect && (
                        <ActionBtn icon="📍" label="Mark Arrived"
                          color="#0E7490" bg="#CFFAFE" border="#67E8F9"
                          hint="Technician reached customer — begin visit"
                          onClick={() => transition('arrived', 'Technician arrived (rescheduled)')} loading={acting} disabled={noTechnician} />
                      )}
                      {quotations.length > 0 && (
                        <div style={{ fontSize:11, color:'#92400E', background:'#FFFBEB', borderRadius:8, padding:'6px 10px', border:'1px solid #FDE68A' }}>
                          📋 {quotations.length} quotation{quotations.length !== 1 ? 's' : ''} — see Quotations section below to edit / approve.
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Accept (if ASSIGNED) */}
                {['PENDING', 'CONFIRMED', 'ASSIGNED'].includes(status) && (
                  <ActionBtn icon="✅" label="Accept Booking" color="#166534" bg="#DCFCE7" border="#86EFAC"
                    hint="Mark as accepted — begins technician workflow"
                    onClick={() => transition('accept', 'Booking accepted')} loading={acting} />
                )}

                {/* En Route (if ACCEPTED) */}
                {status === 'ACCEPTED' && (
                  <ActionBtn icon="🚗" label="Mark On the Way" color="#0369A1" bg="#E0F2FE" border="#7DD3FC"
                    hint="Technician is travelling to customer location"
                    onClick={async () => {
                      setActing(true); setErr(''); setOk('')
                      try {
                        await (bookingsAPI as any).accept(booking.id)
                        setOk('Marked on the way')
                        await load(); onRefresh()
                      } catch (ex: any) { setErr(extractApiError(ex, 'Failed')) }
                      finally { setActing(false) }
                    }} loading={acting} />
                )}

                {/* Arrived */}
                {['ACCEPTED', 'EN_ROUTE'].includes(status) && (
                  <ActionBtn icon="📍" label="Mark Arrived" color="#0E7490" bg="#CFFAFE" border="#67E8F9"
                    hint={noTechnician ? 'Assign a technician first' : 'Technician reached customer address'}
                    onClick={() => transition('arrived', 'Technician arrived')} loading={acting} disabled={noTechnician} />
                )}

                {/* Start Inspection */}
                {['ARRIVED'].includes(status) && (
                  <ActionBtn icon="🔍" label="Start Inspection" color="#92400E" bg="#FEF3C7" border="#FCD34D"
                    hint={noTechnician ? 'Assign a technician first' : 'Begin appliance inspection and quotation creation'}
                    onClick={() => transition('startInspection', 'Inspection started')} loading={acting} disabled={noTechnician} />
                )}

                {/* ── QUOTATION_APPROVED: Technician starts repair ── */}
                {status === 'QUOTATION_APPROVED' && (
                  <>
                    <ActionBtn icon="🔧" label="Start Repair Work" color="#166534" bg="#DCFCE7" border="#86EFAC"
                      hint={noTechnician ? 'Assign a technician first' : 'Quotation approved — begin repair work'}
                      onClick={() => transition('startWork', 'Work started')} loading={acting} disabled={noTechnician} />
                    {hasAnyApproved && approvedQuotations.map((q: any) => (
                      <ActionBtn key={q.id} icon="📄" label={`Invoice: ${q.quotation_number}`} color="#7C3AED" bg="#F5F3FF" border="#DDD6FE"
                        hint={`${money(q.total_amount)} approved — generate invoice`}
                        onClick={() => openInvoiceForm(q)} loading={false} disabled={noTechnician} />
                    ))}
                  </>
                )}

                {/* Start Work — only after at least one approved quotation exists */}
                {status === 'INSPECTING' && (
                  <>
                    {hasAnyApproved ? (
                      <ActionBtn icon="🔧" label="Start Repair Work" color="#166534" bg="#DCFCE7" border="#86EFAC"
                        hint={noTechnician ? 'Assign a technician first' : `${approvedQuotations.length} quotation(s) approved — begin repair`}
                        onClick={() => transition('startWork', 'Work started')} loading={acting} disabled={noTechnician} />
                    ) : (
                      <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#92400E' }}>
                        ⚠ Work cannot start until at least one quotation is <b>approved</b>.<br />
                        Create or approve a quotation using the panel on the right.
                      </div>
                    )}
                  </>
                )}

                {/* Pause / Resume Work */}
                {status === 'IN_PROGRESS' && (
                  <ActionBtn icon="⏸" label="Pause Work" color="#92400E" bg="#FEF3C7" border="#FCD34D"
                    hint="Pause ongoing repair work"
                    onClick={() => transition('pauseWork', 'Work paused')} loading={acting} />
                )}
                {status === 'WORK_PAUSED' && (
                  <ActionBtn icon="▶" label="Resume Work" color="#166534" bg="#DCFCE7" border="#86EFAC"
                    hint="Continue paused repair"
                    onClick={() => transition('resumeWork', 'Work resumed')} loading={acting} />
                )}

                {/* Complete Work — only when all approved quotations have been invoiced or rejected */}
                {['IN_PROGRESS', 'WORK_PAUSED', 'QUOTATION_APPROVED'].includes(status) && (
                  <>
                    {repairsAllDone ? (
                      <ActionBtn icon="🏁" label="Complete Repair" color="#7C3AED" bg="#F5F3FF" border="#DDD6FE"
                        hint={noTechnician ? 'Assign a technician first' : 'All approved quotations invoiced or rejected — mark repair done'}
                        onClick={() => transition('completeWork', 'Work completed')} loading={acting} disabled={noTechnician} />
                    ) : (
                      <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#92400E' }}>
                        ⚠ <b>{approvedQuotations.length} approved quotation(s)</b> still pending invoice.<br />
                        Generate invoice for each approved quotation, or reject them, before completing.
                      </div>
                    )}
                  </>
                )}

                {/* Generate Invoice — one button per approved quotation */}
                {status === 'COMPLETED' && !repairsAllDone && approvedQuotations.map((q: any) => (
                  <ActionBtn key={q.id} icon="📄" label={`Generate Invoice — ${q.quotation_number}`} color="#7C3AED" bg="#F5F3FF" border="#DDD6FE"
                    hint={noTechnician ? 'Assign a technician first' : `Approved quotation ${money(q.total_amount)} — convert to invoice`}
                    onClick={() => openInvoiceForm(q)} loading={false} disabled={noTechnician} />
                ))}

                {/* Generate Invoice after work completed + at least one pending approved quotation */}
                {['IN_PROGRESS', 'WORK_PAUSED', 'QUOTATION_APPROVED'].includes(status) && hasAnyApproved && approvedQuotations.map((q: any) => (
                  <ActionBtn key={q.id} icon="📄" label={`Invoice: ${q.quotation_number}`} color="#7C3AED" bg="#F5F3FF" border="#DDD6FE"
                    hint={noTechnician ? 'Assign a technician first' : `${money(q.total_amount)} approved — generate invoice to proceed`}
                    onClick={() => openInvoiceForm(q)} loading={false} disabled={noTechnician} />
                ))}

                {/* No approved quotation + completed state */}
                {status === 'COMPLETED' && !hasInvoice && !hasAnyApproved && quotations.length === 0 && (
                  <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#92400E' }}>
                    ⚠ No approved quotation found. Please approve a quotation first, or create one.
                  </div>
                )}

                {/* Mark Paid — only when ALL invoices are fully paid */}
                {hasInvoice && totalOutstanding <= 0 && !['PAID','CLOSED', 'SETTLED'].includes(status) && (
                  <ActionBtn icon="✅" label="Mark as Fully Paid" color="#059669" bg="#F0FDF4" border="#86EFAC"
                    hint={`All ${invoices.length} invoice(s) collected (${money(totalPaid)}) — confirm PAID status`}
                    onClick={() => transition('markPaid', 'Marked as fully paid')} loading={acting} />
                )}
                {/* Collect Payment — one button per invoice that has outstanding balance */}
                {invoices.filter((inv: any) => balanceByInvoiceId[inv.id] > 0).map((inv: any) => (
                  <ActionBtn key={inv.id} icon="💳"
                    label={invoices.length > 1
                      ? `Collect — ${inv.invoice_number}: ${money(balanceByInvoiceId[inv.id])} due`
                      : `Collect Payment — ${money(balanceByInvoiceId[inv.id])} due`}
                    color="#059669" bg="#F0FDF4" border="#86EFAC"
                    hint={(paidByInvoiceId[inv.id] || 0) > 0
                      ? `Partially paid: ${money(paidByInvoiceId[inv.id] || 0)} collected`
                      : 'Full payment pending'}
                    onClick={() => {
                      const bal = balanceByInvoiceId[inv.id] || 0
                      setPayTargetInvoice(inv)
                      setPayAmount(bal > 0 ? String(Math.round(bal)) : '')
                      setPayMethod('CASH')
                      setPayRef('')
                      setPayNotes('')
                      setPayDue('')
                      setPayQR('')
                      setPayLink('')
                      setPayErr('')
                      setShowPayForm(true)
                    }} loading={false} />
                ))}

                {/* Settle & Close — available when all invoices paid or outstanding resolved */}
                {hasInvoice && totalOutstanding <= 0 && !['CLOSED', 'SETTLED'].includes(status) && (
                  <ActionBtn icon="🔒" label="Settle & Close Booking" color="#374151" bg="#F0FDF4" border="#86EFAC"
                    hint="Review commission breakdown and settle booking"
                    onClick={() => setShowSettleModal(true)} loading={false} />
                )}

                {/* ── VISITING CHARGE: Pending Verification ── */}
                {status === 'PENDING_VERIFICATION' && (
                  <div style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 8, padding: '12px 14px', marginBottom: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#7C3AED', marginBottom: 6 }}>
                      🔍 Visiting Charge — Pending Verification
                    </div>
                    <div style={{ fontSize: 12, color: '#64748B', marginBottom: 10 }}>
                      Technician collected a visiting charge. Verify cash collection below, then settle &amp; close.
                    </div>
                    {/* Show invoice + payment summary inline */}
                    {invoices.length > 0 && (
                      <div style={{ background: 'white', border: '1px solid #DDD6FE', borderRadius: 6, padding: '8px 10px', marginBottom: 8, fontSize: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Visiting Charge Invoice</span>
                          <b style={{ color: '#7C3AED' }}>{money(invoices[0]?.total_amount || 0)}</b>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                          <span style={{ color: '#64748B' }}>Collected by Technician</span>
                          <b style={{ color: totalPaid >= totalInvoiced ? '#059669' : '#DC2626' }}>
                            {money(totalPaid)}
                          </b>
                        </div>
                        {totalOutstanding > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                            <span style={{ color: '#DC2626' }}>Outstanding</span>
                            <b style={{ color: '#DC2626' }}>{money(totalOutstanding)}</b>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Collect if unpaid */}
                    {invoices.filter((inv: any) => balanceByInvoiceId[inv.id] > 0).map((inv: any) => (
                      <ActionBtn key={inv.id} icon="💳"
                        label={`Collect Visiting Charge — ${money(balanceByInvoiceId[inv.id])}`}
                        color="#059669" bg="#F0FDF4" border="#86EFAC"
                        hint="Record visiting charge payment from technician/customer"
                        onClick={() => {
                          const bal = balanceByInvoiceId[inv.id] || 0
                          setPayTargetInvoice(inv)
                          setPayAmount(bal > 0 ? String(Math.round(bal)) : '')
                          setPayMethod('CASH')
                          setPayRef(''); setPayNotes(''); setPayDue('')
                          setPayQR(''); setPayLink(''); setPayErr('')
                          setShowPayForm(true)
                        }} loading={false} />
                    ))}
                    {/* Settle & Close once paid */}
                    {totalOutstanding <= 0 && (
                      <ActionBtn icon="🔒" label="Verify &amp; Close Booking" color="#374151" bg="#F0FDF4" border="#86EFAC"
                        hint="Confirm visiting charge collected — settle commission and close booking"
                        onClick={() => setShowSettleModal(true)} loading={false} />
                    )}
                  </div>
                )}

                {/* ── CANCELLATION_REQUESTED: Admin must confirm or reject ── */}
                {status === 'CANCELLATION_REQUESTED' && (
                  <div style={{ background: '#FFF7ED', border: '2px solid #FCD34D', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#92400E', marginBottom: 6 }}>⚠️ Cancellation Requested</div>
                    <div style={{ fontSize: 12, color: '#92400E', marginBottom: 10 }}>
                      Technician has requested cancellation. Confirm to cancel the booking, or reject to restore it to the previous state.
                      {(booking as any).cancelled_reason && <><br /><b>Reason:</b> {(booking as any).cancelled_reason}</>}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        disabled={acting}
                        onClick={async () => {
                          setActing(true); setErr(''); setOk('');
                          try {
                            await bookingsAPI.confirmCancellation(booking.id, (booking as any).cancelled_reason || 'Confirmed by admin');
                            setOk('✅ Cancellation confirmed — booking cancelled');
                            await load(); onRefresh();
                          } catch (ex: any) { setErr(extractApiError(ex, 'Failed')) }
                          finally { setActing(false); }
                        }}
                        style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none', background: '#DC2626', color: 'white', fontSize: 12, fontWeight: 700, cursor: acting ? 'not-allowed' : 'pointer', opacity: acting ? 0.5 : 1 }}>
                        ✓ Confirm Cancel
                      </button>
                      <button
                        disabled={acting}
                        onClick={async () => {
                          setActing(true); setErr(''); setOk('');
                          try {
                            await bookingsAPI.rejectCancellation(booking.id, 'Rejected by admin — booking restored');
                            setOk('✅ Cancellation rejected — booking restored');
                            await load(); onRefresh();
                          } catch (ex: any) { setErr(extractApiError(ex, 'Failed')) }
                          finally { setActing(false); }
                        }}
                        style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', color: '#374151', fontSize: 12, fontWeight: 700, cursor: acting ? 'not-allowed' : 'pointer', opacity: acting ? 0.5 : 1 }}>
                        ✕ Reject (Restore)
                      </button>
                    </div>
                  </div>
                )}

                {/* ── VISITING CHARGE button — admin/CCO on behalf of technician ── */}
                {['ARRIVED', 'INSPECTING', 'IN_PROGRESS', 'QUOTATION_APPROVED'].includes(status) && (
                  <ActionBtn icon="🚶" label="Visiting Charge (Customer Declined)"
                    color="#B91C1C" bg="#FEF2F2" border="#FECACA"
                    hint="Technician arrived but customer won't proceed — initiate visiting charge invoice"
                    onClick={async () => {
                      const amt = prompt("Enter base visiting charge amount (₹):");
                      if (!amt || isNaN(parseFloat(amt)) || parseFloat(amt) <= 0) return;
                      const notes = prompt("Reason/notes (optional):") || "Customer declined repair — visiting charge";
                      setActing(true); setErr(""); setOk("");
                      try {
                        await bookingsAPI.visitingCharge(booking.id, parseFloat(amt), notes);
                        setOk(`✅ Visiting charge ₹${Math.round(parseFloat(amt)).toLocaleString('en-IN')} initiated`);
                        await load(); onRefresh();
                      } catch (ex: any) { setErr(extractApiError(ex, "Failed to initiate visiting charge")); }
                      finally { setActing(false); }
                    }} loading={acting} />
                )}

                {/* ── Cancel Booking (admin — immediate, no confirmation needed) ── */}
                {!['COMPLETED','CANCELLED','CLOSED','SETTLED','PAID','INVOICE_GENERATED','CANCELLATION_REQUESTED'].includes(status) && (
                  <div>
                    {!showCancelForm ? (
                      <button
                        onClick={() => setShowCancelForm(true)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #FECACA', background: '#FFF5F5', cursor: 'pointer', fontSize: 12, color: '#DC2626', fontWeight: 600, textAlign: 'left' }}>
                        ✕ Cancel Booking
                      </button>
                    ) : (
                      <div style={{ border: '1px solid #FECACA', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <textarea
                          rows={2}
                          placeholder="Reason for cancellation..."
                          value={cancelReason}
                          onChange={e => setCancelReason(e.target.value)}
                          style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 6, padding: '6px 10px', fontSize: 12, resize: 'vertical' }}
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => { setShowCancelForm(false); setCancelReason(''); }}
                            style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #E2E8F0', background: 'white', fontSize: 12, cursor: 'pointer' }}>Back</button>
                          <button
                            disabled={!cancelReason.trim() || cancelling}
                            onClick={async () => {
                              if (!cancelReason.trim()) return;
                              setCancelling(true); setErr(''); setOk('');
                              try {
                                await bookingsAPI.cancel(booking.id, cancelReason);
                                setOk('✅ Booking cancelled');
                                setShowCancelForm(false); setCancelReason('');
                                await load(); onRefresh();
                              } catch (ex: any) { setErr(extractApiError(ex, 'Failed to cancel')); }
                              finally { setCancelling(false); }
                            }}
                            style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: 'none', background: cancelling || !cancelReason.trim() ? '#CBD5E0' : '#DC2626', color: 'white', fontSize: 12, fontWeight: 700, cursor: cancelling || !cancelReason.trim() ? 'not-allowed' : 'pointer' }}>
                            {cancelling ? 'Cancelling...' : 'Confirm Cancel'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Loss Inspection */}
                <button
                  onClick={() => setShowLoss(!showLoss)}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px dashed #E2E8F0',
                    background: showLoss ? '#FFF7ED' : 'white', cursor: 'pointer',
                    fontSize: 12, color: '#92400E', fontWeight: 600, textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                  🔍 Platform Loss Inspection
                  {platformRisk > 0 && (
                    <span style={{ background: '#FEE2E2', color: '#DC2626', padding: '1px 8px', borderRadius: 20, fontSize: 11 }}>
                      {money(platformRisk)} at risk
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════
              RIGHT COLUMN — Quotations, Invoice, Payments, Timeline
          ═══════════════════════════════════════════════════════════ */}
          <div style={{ flex: '1 1 340px', minWidth: 300 }}>

            {/* ── Quotations panel ── */}
            <Section title="Quotations" icon="📋" count={quotations.length}>
              {quotations.length === 0 ? (
                <Empty msg="No quotations yet. Create one from the Quotations page." />
              ) : quotations.map((q: any) => {
                const isApproved  = q.status === 'APPROVED'
                const isConverted = q.status === 'CONVERTED_TO_INVOICE'
                const isRejected  = q.status === 'REJECTED'
                const linkedInvoice = invoiceByQuotationId[q.id]

                return (
                  <div key={q.id} style={{
                    background: isApproved ? '#F0FDF4' : isConverted ? '#EFF6FF' : isRejected ? '#FEF2F2' : '#F8FAFC',
                    border: `1px solid ${isApproved ? '#86EFAC' : isConverted ? '#BFDBFE' : isRejected ? '#FECACA' : '#E2E8F0'}`,
                    borderRadius: 8, padding: '10px 12px', marginBottom: 8,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 12, color: '#374151' }}>{q.quotation_number}</div>
                      <QuotationStatusBadge status={q.status} />
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 12 }}>
                      <span style={{ color: '#64748B' }}>Services: <b>{money(q.services_total)}</b></span>
                      <span style={{ color: '#64748B' }}>Parts: <b>{money(q.parts_total)}</b></span>
                      <span style={{ color: '#059669', fontWeight: 700 }}>Total: {money(q.total_amount)}</span>
                    </div>
                    {q.discount_amount > 0 && (
                      <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>
                        🏷 Discount: −{money(q.discount_amount)}
                      </div>
                    )}
                    {q.coupon_code && (
                      <div style={{ fontSize: 11, marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ background: '#FEF3C7', color: '#92400E', padding: '1px 8px', borderRadius: 20, fontWeight: 700, border: '1px solid #FDE68A', fontFamily: 'monospace' }}>
                          🏷️ {q.coupon_code}
                        </span>
                        <span style={{ color: '#DC2626', fontWeight: 700 }}>−{money(q.coupon_discount)}</span>
                      </div>
                    )}

                    {/* CONVERTED_TO_INVOICE — show linked invoice info */}
                    {isConverted && linkedInvoice && (
                      <div style={{ marginTop: 6, fontSize: 11, background: '#DBEAFE', color: '#1E40AF', padding: '4px 8px', borderRadius: 6 }}>
                        ✅ Invoice: <b>{linkedInvoice.invoice_number}</b> · {money(linkedInvoice.total_amount)}
                      </div>
                    )}

                    {/* REJECTED — show rejection reason */}
                    {isRejected && q.rejection_reason && (
                      <div style={{ marginTop: 6, fontSize: 11, background: '#FEE2E2', color: '#991B1B', padding: '4px 8px', borderRadius: 6 }}>
                        ✕ Rejected: {q.rejection_reason}
                      </div>
                    )}

                    {/* DRAFT — delete quotation for admin/CCO */}
                    {q.status === 'DRAFT' && ['ADMIN', 'SUPER_ADMIN', 'CCO'].includes(userRole) && (
                      <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 11, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
                          disabled={acting}
                          onClick={async () => {
                            if (!window.confirm(`Delete quotation ${q.quotation_number}? This cannot be undone.`)) return
                            setActing(true); setErr(''); setOk('')
                            try { await quotationsAPI.delete(q.id); setOk('🗑 Quotation deleted'); await load(); onRefresh() }
                            catch (ex: any) { setErr(extractApiError(ex, 'Delete failed')) }
                            finally { setActing(false) }
                          }}>
                          🗑 Delete Quotation
                        </button>
                      </div>
                    )}

                    {/* SUBMITTED — approve or reject for admin/CCO */}
                    {q.status === 'SUBMITTED' && ['ADMIN', 'SUPER_ADMIN', 'CCO'].includes(userRole) && (
                      <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 11, background: '#DCFCE7', color: '#166534', border: '1px solid #86EFAC' }}
                          onClick={async () => {
                            setActing(true); setErr(''); setOk('')
                            try { await quotationsAPI.approve(q.id); setOk('✅ Quotation approved'); await load(); onRefresh() }
                            catch (ex: any) { setErr(extractApiError(ex, 'Approval failed')) }
                            finally { setActing(false) }
                          }}>
                          ✅ Approve
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 11, background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA' }}
                          onClick={() => { setRejectingQuotation(q); setRejectReason(''); setRejectErr('') }}>
                          ✕ Reject
                        </button>
                      </div>
                    )}

                    {/* APPROVED — actions: generate invoice OR reject */}
                    {isApproved && ['ADMIN', 'SUPER_ADMIN', 'CCO'].includes(userRole) && (
                      <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {/* Generate Invoice inline action */}
                        {['IN_PROGRESS', 'WORK_PAUSED', 'COMPLETED'].includes(status) && (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 11, background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE' }}
                            onClick={() => openInvoiceForm(q)}>
                            📄 Generate Invoice
                          </button>
                        )}
                        {/* Reject approved quotation */}
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 11, background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA' }}
                          onClick={() => { setRejectingQuotation(q); setRejectReason(''); setRejectErr('') }}>
                          ✕ Reject Quotation
                        </button>
                      </div>
                    )}

                    {/* APPROVED — start repair action if booking is still in INSPECTING state */}
                    {isApproved && status === 'INSPECTING' && (
                      <div style={{ marginTop: 6, fontSize: 11, color: '#166534', background: '#DCFCE7', padding: '4px 8px', borderRadius: 6 }}>
                        ✅ Approved — use "Start Repair Work" in the left panel to begin
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Summary banner if multiple approved quotations exist */}
              {approvedQuotations.length > 1 && (
                <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#92400E', marginTop: 4 }}>
                  ⚠ <b>{approvedQuotations.length} approved quotations</b> pending invoice. Generate invoice for each, or reject unused ones, before completing the booking.
                </div>
              )}
            </Section>

            {/* ── Invoice panel ── */}
            <Section title="Invoice" icon="🧾" count={invoices.length}>
              {invoices.length === 0 ? (
                <Empty msg={
                  hasAnyApproved && ['IN_PROGRESS', 'WORK_PAUSED', 'COMPLETED'].includes(status)
                    ? 'Quotation approved and work in progress — click "Generate Invoice" to create.'
                    : 'Invoice will be available after work starts and quotation is approved.'
                } />
              ) : invoices.map((inv: any) => (
                <div key={inv.id} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 12 }}>{inv.invoice_number}</div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                      background: inv.status === 'PAID' ? '#DCFCE7' : inv.status === 'PARTIALLY_PAID' ? '#FEF3C7' : '#EFF6FF',
                      color: inv.status === 'PAID' ? '#166534' : inv.status === 'PARTIALLY_PAID' ? '#92400E' : '#1D4ED8',
                    }}>{inv.status}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 12, flexWrap: 'wrap' }}>
                    <span>Total: <b style={{ color: '#059669' }}>{money(inv.total_amount)}</b></span>
                    <span>Paid: <b style={{ color: '#10B981' }}>{money(paidByInvoiceId[inv.id] || 0)}</b></span>
                    {balanceByInvoiceId[inv.id] > 0 && <span>Balance: <b style={{ color: '#DC2626' }}>{money(balanceByInvoiceId[inv.id])}</b></span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>
                    {inv.invoice_type} · {fmtDT(inv.created_at)}
                  </div>
                </div>
              ))}
            </Section>

            {/* ── Payments panel ── */}
            <Section title="Payment Transactions" icon="💰" count={payments.length}>
              {payments.length === 0 ? (
                <Empty msg="No payments yet." />
              ) : (
                <>
                  {payments.map((p: any) => (
                    <div key={p.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 10px', borderBottom: '1px solid #F1F5F9', fontSize: 12,
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, color: '#0F172A' }}>
                          {p.method === 'CASH' && '💵'} {p.method === 'UPI' && '📱'} {p.method === 'BANK_TRANSFER' && '🏦'} {p.method === 'RAZORPAY' && '🔗'}
                          {' '}{p.method}
                          {p.reference_number === 'PAY_LATER' && <span style={{ background: '#FEF3C7', color: '#92400E', fontSize: 10, marginLeft: 4, padding: '1px 5px', borderRadius: 4 }}>PAY LATER</span>}
                        </div>
                        <div style={{ fontSize: 10, color: '#94A3B8' }}>{fmtDT(p.paid_at || p.created_at)}</div>
                        {p.reference_number && p.reference_number !== 'PAY_LATER' && (
                          <div style={{ fontSize: 10, color: '#64748B' }}>Ref: {p.reference_number}</div>
                        )}
                        {p.notes && <div style={{ fontSize: 10, color: '#94A3B8', fontStyle: 'italic' }}>{p.notes}</div>}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, color: p.status === 'SUCCESS' ? '#059669' : '#94A3B8' }}>
                          {money(p.amount)}
                        </div>
                        <div style={{
                          fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 10,
                          background: p.status === 'SUCCESS' ? '#DCFCE7' : '#F1F5F9',
                          color: p.status === 'SUCCESS' ? '#166534' : '#94A3B8',
                        }}>{p.status}</div>
                      </div>
                    </div>
                  ))}
                  <div style={{ padding: '8px 10px', background: '#F8FAFC', borderRadius: '0 0 8px 8px', fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Total Collected</span>
                    <b style={{ color: '#059669' }}>{money(totalPaid)}</b>
                  </div>
                  {invoices.length > 1 && totalOutstanding > 0 && (
                    <div style={{ padding: '6px 10px', background: '#FEF3C7', fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#92400E' }}>Total Outstanding</span>
                      <b style={{ color: '#DC2626' }}>{money(totalOutstanding)}</b>
                    </div>
                  )}
                </>
              )}
            </Section>

            {/* ── Timeline ── */}
            <Section title="Status Timeline" icon="📅" count={timeline.length}>
              {timeline.length === 0 ? (
                <Empty msg="No timeline events yet." />
              ) : (
                <div style={{ borderLeft: '2px solid #E2E8F0', paddingLeft: 14 }}>
                  {[...timeline].reverse().map((t: any, i: number) => (
                    <div key={i} style={{ position: 'relative', marginBottom: 12 }}>
                      <div style={{
                        position: 'absolute', left: -20, top: 4,
                        width: 8, height: 8, borderRadius: '50%',
                        background: STATUS_COLOR[t.status] || '#94A3B8',
                        border: '2px solid white', boxShadow: '0 0 0 1px #E2E8F0',
                      }} />
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>
                        {STATUS_LABEL[t.status] || t.status}
                      </div>
                      {t.notes && <div style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>{t.notes}</div>}
                      <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>{fmtDT(t.at || t.created_at)}</div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          LOSS INSPECTION PANEL
      ══════════════════════════════════════════════════════════════ */}
      {showLoss && (
        <div style={{
          marginTop: 20, background: '#FFFBEB', border: '2px solid #F59E0B',
          borderRadius: 10, padding: 16,
        }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#92400E', marginBottom: 12 }}>
            🔍 Platform Loss Inspection
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 12 }}>
            <LossCard
              label="Parts Cost (Invoiced)" value={money(totalMarketCost)} risk={totalMarketCost > 0}
              detail={totalMarketCost > 0 ? `${marketPartsCount} invoiced quotation(s) include parts. Verify bills uploaded.` : 'No parts cost on invoiced quotations'} icon="🛒" />
            <LossCard
              label="Total Discount Given" value={money(totalDiscount)} risk={totalDiscount > 500}
              detail={totalDiscount > 500 ? 'Discount exceeds CCO limit (₹500). Admin review required.' : totalDiscount > 0 ? 'Within acceptable discount range' : 'No discounts applied'} icon="🏷" />
            <LossCard
              label="Outstanding Balance" value={money(outstandingBalance)} risk={outstandingBalance > 0}
              detail={outstandingBalance > 0 ? `${money(outstandingBalance)} across ${invoices.filter((i: any) => balanceByInvoiceId[i.id] > 0).length} invoice(s). Follow up needed.` : 'All invoices fully collected'} icon="⏳" />
            <LossCard
              label="Commission Status" value={hasInvoice && totalOutstanding <= 0 ? 'Eligible' : 'Pending payment'} risk={false}
              detail={hasInvoice && totalOutstanding <= 0 ? 'All payments complete — commission can be released' : 'Commission held until all invoices are fully paid (BR-COMM-001)'} icon="💼" />
          </div>

          {platformRisk > 0 && (
            <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
              <b style={{ color: '#DC2626' }}>⚠ Total Platform Risk: {money(platformRisk)}</b>
              <div style={{ fontSize: 11, color: '#92400E', marginTop: 4 }}>
                Invoiced total: {money(totalInvoiced)} · Collected: {money(totalPaid)} · Outstanding: {money(totalOutstanding)}
              </div>
              <div style={{ fontSize: 12, color: '#92400E', marginTop: 4 }}>
                Review and resolve the flagged items above before settling this booking.
              </div>
            </div>
          )}
          {platformRisk === 0 && (
            <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#166534' }}>
              ✅ No platform risk detected. Invoiced: {money(totalInvoiced)} · Collected: {money(totalPaid)}. Safe to settle.
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          REJECT APPROVED QUOTATION MODAL
      ══════════════════════════════════════════════════════════════ */}
      {rejectingQuotation && (
        <Modal title={`Reject Quotation — ${rejectingQuotation.quotation_number}`} onClose={() => setRejectingQuotation(null)} size="sm">
          <div style={{ marginBottom: 12, background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#92400E' }}>
            ⚠ You are rejecting an <b>{rejectingQuotation.status}</b> quotation worth <b>{money(rejectingQuotation.total_amount)}</b>.<br />
            This action is logged with your name and reason for audit trail.
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Rejection Reason *</label>
            <textarea
              className="input" rows={3}
              placeholder="e.g. Customer declined the estimate, cost too high. Alternate quotation to be raised."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
            />
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>
              This reason is stored in the quotation audit log and visible to all admins.
            </div>
          </div>

          <Err msg={rejectErr} />

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary"
              style={{ background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA', flex: 1 }}
              onClick={rejectApprovedQuotation} disabled={rejecting}>
              {rejecting ? <Spinner size="sm" /> : '✕ Confirm Rejection'}
            </button>
            <button className="btn btn-secondary" onClick={() => { setRejectingQuotation(null); setRejectReason(''); setRejectErr('') }}>
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════════════
          INVOICE CREATE MODAL
      ══════════════════════════════════════════════════════════════ */}
      {showInvoiceForm && (
        <Modal title={`Generate Invoice${invTargetQuotation ? ` — ${invTargetQuotation.quotation_number}` : ''}`} onClose={() => { setShowInvoiceForm(false); setInvTargetQuotation(null) }} size="sm">

          {/* Show pre-selected quotation info */}
          {invTargetQuotation && (
            <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>
              <div style={{ fontWeight: 700, color: '#166534' }}>{invTargetQuotation.quotation_number}</div>
              <div style={{ color: '#374151', marginTop: 2 }}>
                Services: {money(invTargetQuotation.services_total)} · Parts: {money(invTargetQuotation.parts_total)} · <b>Total: {money(invTargetQuotation.total_amount)}</b>
              </div>
            </div>
          )}

          {/* ── Invoice type derived from quotation tax_mode — no selector needed ── */}
          {invTargetQuotation && (() => {
            const invType = deriveInvoiceType(invTargetQuotation)
            const isB2B   = invType === 'GST_B2B'
            const isNonGST = invType === 'NON_GST'
            return (
              <>
                {/* Tax / GST info badge */}
                {isNonGST ? (
                  <div style={{ marginBottom: 14, background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#475569' }}>
                    🚫 <b>Non-GST Invoice</b> — No tax was applied on this quotation. Invoice will be generated without GST.
                  </div>
                ) : (
                  <div style={{ marginBottom: 14, background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
                    <div style={{ fontWeight: 700, color: '#1E40AF', marginBottom: 4 }}>
                      {isB2B ? '🏢 GST B2B Invoice' : '🧾 GST B2C Invoice'}
                    </div>
                    <div style={{ color: '#374151' }}>
                      Tax Rate: <b>{invTargetQuotation.tax_percent ?? 18}%</b>
                      &nbsp;·&nbsp; Tax Amount: <b style={{ color: '#7C3AED' }}>{money(invTargetQuotation.tax_amount || 0)}</b>
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 3 }}>
                      {isB2B ? 'GST B2B — Customer GSTIN required below.' : 'GST B2C — Standard consumer invoice.'}
                    </div>
                  </div>
                )}

                {/* B2B fields */}
                {isB2B && (
                  <>
                    {invForm.gstin && invForm.business_name ? (
                      <div style={{ marginBottom: 10, fontSize: 11, color: '#059669', background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 6, padding: '6px 10px' }}>
                        ✓ GST details carried over from the quotation — edit below only if something needs correcting.
                      </div>
                    ) : custGst ? (
                      <div style={{ marginBottom: 10, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 12px' }}>
                        <div style={{ fontSize: 11, color: '#92400E', marginBottom: 4 }}>
                          Found saved GST details for this customer: <b>{custGst.gst_name}</b> ({custGst.gst_number})
                        </div>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={useSavedCustomerGst}>
                          Use saved GST details
                        </button>
                      </div>
                    ) : custGstLoading ? (
                      <div style={{ marginBottom: 10, fontSize: 11, color: '#64748B' }}>Checking customer's saved GST details…</div>
                    ) : null}
                    <div style={{ marginBottom: 10 }}>
                      <label style={lbl}>Customer GSTIN *</label>
                      <input className="input" placeholder="e.g. 21AABCP1234M1ZV"
                        value={invForm.gstin} onChange={e => setInvForm(f => ({ ...f, gstin: e.target.value }))} />
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <label style={lbl}>Business Name *</label>
                      <input className="input" placeholder="Registered business name"
                        value={invForm.business_name} onChange={e => setInvForm(f => ({ ...f, business_name: e.target.value }))} />
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <label style={lbl}>Business Address *</label>
                      <input className="input" placeholder="Registered address"
                        value={invForm.business_address} onChange={e => setInvForm(f => ({ ...f, business_address: e.target.value }))} />
                    </div>
                  </>
                )}
              </>
            )
          })()}

          {/* Fallback selector — only if no quotation pre-selected */}
          {!invTargetQuotation && (
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Quotation *</label>
              <select className="input" value={invForm.quotation_id}
                onChange={e => setInvForm(f => ({ ...f, quotation_id: e.target.value }))}>
                <option value="">— Select quotation —</option>
                {quotations.filter((q: any) => q.status === 'APPROVED').map((q: any) => (
                  <option key={q.id} value={q.id}>
                    {q.quotation_number} — {money(q.total_amount)} ({q.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Notes (optional)</label>
            <textarea className="input" rows={2} value={invForm.notes}
              onChange={e => setInvForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          <Err msg={invErr} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" onClick={createInvoice} disabled={invSaving}>
              {invSaving ? <Spinner size="sm" /> : '📄 Generate Invoice'}
            </button>
            <button className="btn btn-secondary" onClick={() => { setShowInvoiceForm(false); setInvTargetQuotation(null) }}>Cancel</button>
          </div>
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════════════
          PAYMENT COLLECTION MODAL
      ══════════════════════════════════════════════════════════════ */}
      {showPayForm && payTargetInvoice && (
        <Modal title={`Collect Payment — ${payTargetInvoice.invoice_number}`} onClose={() => { setShowPayForm(false); setPayQR(''); setPayLink(''); setPayTargetInvoice(null) }} size="sm">

          {/* Invoice summary */}
          <div style={{ background: '#EFF6FF', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
            <div style={{ fontWeight: 700 }}>{payTargetInvoice.invoice_number}</div>
            <div style={{ display: 'flex', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
              <span>Total: <b style={{ color: '#059669' }}>{money(payTargetInvoice.total_amount)}</b></span>
              <span>Paid: <b style={{ color: '#10B981' }}>{money(paidByInvoiceId[payTargetInvoice.id] || 0)}</b></span>
              <span>Balance: <b style={{ color: '#DC2626' }}>{money(balanceByInvoiceId[payTargetInvoice.id] || 0)}</b></span>
            </div>
            {payLaterByInvoiceId[payTargetInvoice.id] && (
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                <span style={{ background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                  ⏰ Pay Later Scheduled: {money(payLaterByInvoiceId[payTargetInvoice.id].amount)}
                  {payLaterByInvoiceId[payTargetInvoice.id].due
                    ? ` — due ${fmtDate(payLaterByInvoiceId[payTargetInvoice.id].due!)}`
                    : ''}
                </span>
                <span style={{ color: '#6B7280' }}>Select CASH/UPI below to collect now and clear this schedule.</span>
              </div>
            )}
          </div>

          {/* Payment method selector */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Payment Method</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {PAYMENT_METHODS.map(m => (
                <button key={m.value} onClick={() => { setPayMethod(m.value); setPayQR(''); setPayLink('') }}
                  style={{
                    padding: '7px 12px', borderRadius: 8, border: `2px solid ${payMethod === m.value ? '#3B82F6' : '#E2E8F0'}`,
                    background: payMethod === m.value ? '#EFF6FF' : 'white',
                    cursor: 'pointer', fontSize: 12, fontWeight: payMethod === m.value ? 700 : 400,
                    color: payMethod === m.value ? '#1D4ED8' : '#374151',
                  }}>
                  {m.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
              {PAYMENT_METHODS.find(m => m.value === payMethod)?.desc}
            </div>
          </div>

          {/* Amount — hidden for PAY_LATER (full balance is auto-recorded) */}
          {payMethod !== 'PAY_LATER' && (
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Amount (₹) *</label>
              <input className="input" type="number" min="0.01" step="0.01"
                value={payAmount} onChange={e => setPayAmount(e.target.value)}
                placeholder={`e.g. ${Math.round(balanceByInvoiceId[payTargetInvoice?.id] ?? balance)}`} />
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>
                Enter partial or full amount. Outstanding balance: <b style={{ color: '#DC2626' }}>{money(balanceByInvoiceId[payTargetInvoice?.id] ?? balance)}</b>
              </div>
            </div>
          )}
          {payMethod === 'PAY_LATER' && (
            <div style={{ marginBottom: 12, background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
              <div style={{ fontWeight: 700, color: '#92400E' }}>⏰ Scheduling future collection</div>
              <div style={{ color: '#92400E', marginTop: 3 }}>
                Outstanding: <b>{money(balanceByInvoiceId[payTargetInvoice?.id] ?? balance)}</b> will be recorded as due on the selected date.
              </div>
            </div>
          )}

          {/* Reference */}
          {['CASH', 'BANK_TRANSFER'].includes(payMethod) && (
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>{payMethod === 'BANK_TRANSFER' ? 'UTR / Reference No. *' : 'Receipt No. (optional)'}</label>
              <input className="input" placeholder={payMethod === 'BANK_TRANSFER' ? 'UTR number' : 'Optional receipt number'}
                value={payRef} onChange={e => setPayRef(e.target.value)} />
            </div>
          )}

          {/* Pay Later — schedule date */}
          {payMethod === 'PAY_LATER' && (
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Collection Date *</label>
              <input className="input" type="date" min={todayIST()}
                value={payDue} onChange={e => setPayDue(e.target.value)} />
              <div style={{ fontSize: 11, color: '#F59E0B', marginTop: 3 }}>
                ⚠ Pay Later schedules future collection. Outstanding balance tracked for platform P&L.
              </div>
            </div>
          )}

          {/* Notes */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Notes (optional)</label>
            <input className="input" placeholder="e.g. Customer paid by PhonePe, receipt given"
              value={payNotes} onChange={e => setPayNotes(e.target.value)} />
          </div>

          <Err msg={payErr} />

          {/* UPI QR display */}
          {payQR && (
            <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#166534', marginBottom: 6 }}>📱 UPI QR Generated</div>
              <div style={{ fontFamily: 'monospace', fontSize: 10, wordBreak: 'break-all', color: '#374151', background: '#DCFCE7', padding: 8, borderRadius: 6 }}>{payQR}</div>
              <div style={{ fontSize: 11, color: '#166534', marginTop: 6 }}>Show this QR string to customer. Once scanned and confirmed, record the receipt reference.</div>
            </div>
          )}

          {/* Payment Link display */}
          {payLink && (
            <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1D4ED8', marginBottom: 6 }}>🔗 Payment Link Generated</div>
              <div style={{ fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all', color: '#1E40AF' }}>{payLink}</div>
              <div style={{ fontSize: 11, color: '#3B82F6', marginTop: 6 }}>Send this link to the customer via WhatsApp or SMS.</div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" onClick={submitPayment} disabled={paySaving}>
              {paySaving ? <Spinner size="sm" /> : (
                payMethod === 'CASH' ? '💵 Record Cash' :
                payMethod === 'BANK_TRANSFER' ? '🏦 Record Transfer' :
                payMethod === 'UPI' ? '📱 Generate QR' :
                payMethod === 'RAZORPAY' ? '🔗 Generate Link' :
                '⏰ Schedule Pay Later'
              )}
            </button>
            <button className="btn btn-secondary" onClick={() => { setShowPayForm(false); setPayQR(''); setPayLink(''); setPayTargetInvoice(null) }}>
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {/* Shared Settle & Close Modal */}
      {showSettleModal && (
        <SettleModal
          booking={booking}
          onClose={() => setShowSettleModal(false)}
          onSettled={async () => {
            setShowSettleModal(false)
            setOk('✅ Booking settled — commission held, release it from Commissions page')
            await load(); onRefresh()
          }}
        />
      )}
    </Modal>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ActionBtn({ icon, label, hint, color, bg, border, onClick, loading, disabled }: {
  icon: string; label: string; hint: string; color: string; bg: string; border: string
  onClick: () => void; loading: boolean; disabled?: boolean
}) {
  const isDisabled = loading || disabled
  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      style={{
        width: '100%', padding: '10px 14px', borderRadius: 8, cursor: isDisabled ? 'default' : 'pointer',
        border: `1px solid ${border}`, background: bg, textAlign: 'left', opacity: isDisabled ? 0.5 : 1,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color, display: 'flex', alignItems: 'center', gap: 8 }}>
        {loading ? <Spinner size="sm" /> : icon} {label}
      </div>
      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{hint}</div>
    </button>
  )
}

function Section({ title, icon, count, children }: { title: string; icon: string; count: number; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16, border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ background: '#F8FAFC', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #E2E8F0' }}>
        <span>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{title}</span>
        {count > 0 && (
          <span style={{ background: '#E2E8F0', color: '#64748B', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10 }}>{count}</span>
        )}
      </div>
      <div style={{ padding: count > 0 ? '10px 12px' : 0 }}>{children}</div>
    </div>
  )
}

function Empty({ msg }: { msg: string }) {
  return <div style={{ padding: '12px', fontSize: 12, color: '#94A3B8', textAlign: 'center' }}>{msg}</div>
}

function QuotationStatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string }> = {
    DRAFT:               { bg: '#F1F5F9', color: '#475569' },
    SUBMITTED:           { bg: '#DBEAFE', color: '#1D4ED8' },
    APPROVED:            { bg: '#DCFCE7', color: '#166534' },
    REJECTED:            { bg: '#FEE2E2', color: '#DC2626' },
    CONVERTED_TO_INVOICE:{ bg: '#EDE9FE', color: '#6D28D9' },
    REVISED:             { bg: '#FEF3C7', color: '#92400E' },
  }
  const c = cfg[status] || cfg.DRAFT
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: c.bg, color: c.color }}>
      {status === 'CONVERTED_TO_INVOICE' ? '✅ INVOICED' : status}
    </span>
  )
}

function LossCard({ label, value, risk, detail, icon }: {
  label: string; value: string; risk: boolean; detail: string; icon: string
}) {
  return (
    <div style={{
      background: risk ? '#FEF2F2' : '#F0FDF4',
      border: `1px solid ${risk ? '#FECACA' : '#86EFAC'}`,
      borderRadius: 8, padding: '10px 12px',
    }}>
      <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 11, color: '#64748B', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 800, fontSize: 15, color: risk ? '#DC2626' : '#059669', marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: risk ? '#B91C1C' : '#166534' }}>{detail}</div>
    </div>
  )
}
