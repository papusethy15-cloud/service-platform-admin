// src/components/ui/SettleModal.tsx
// Shared "Settle & Close" modal used by BookingWorkflow (Manage modal) and Settlements page.
// On settle: commissions are saved as PENDING (held). Wallet is NOT credited yet.
// Wallet is credited only when admin clicks "Pay" on the Commissions page.

import { useEffect, useState } from 'react'
import Modal from './Modal'
import Spinner from './Spinner'
import { bookingsAPI } from '@/services/api'

const money = (n: number) =>
  `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

interface SettleModalProps {
  /** The booking to settle. Needs: id, booking_number, booking_id (either field accepted) */
  booking: any
  onClose: () => void
  onSettled: () => void
}

export default function SettleModal({ booking, onClose, onSettled }: SettleModalProps) {
  const bookingId = booking.id || booking.booking_id
  const bookingNumber = booking.booking_number

  const [preview, setPreview]       = useState<any>(null)
  const [previewLoading, setPL]     = useState(true)
  const [previewErr, setPreviewErr] = useState('')

  const [overrides, setOverrides] = useState<Record<number, string>>({})
  const [notes, setNotes]         = useState('')
  const [saving, setSaving]       = useState(false)
  const [saveErr, setSaveErr]     = useState('')

  // Load commission preview on mount
  useEffect(() => {
    let cancelled = false
    setPL(true); setPreviewErr(''); setPreview(null)
    bookingsAPI.commissionPreview(bookingId)
      .then(r => { if (!cancelled) setPreview(r.data.data) })
      .catch((ex: any) => { if (!cancelled) setPreviewErr(ex.response?.data?.detail || 'Failed to load commission preview') })
      .finally(() => { if (!cancelled) setPL(false) })
    return () => { cancelled = true }
  }, [bookingId])

  const handleSettle = async () => {
    setSaving(true); setSaveErr('')
    try {
      // Send override for every row where admin typed a value (matched or unmatched).
      // Empty override = backend uses its own calculated amount.
      const overrideList = (preview?.line_items || [])
        .map((item: any, idx: number) => {
          const ov = overrides[idx]
          if (ov === undefined || ov === '') return null  // no override typed → let backend calculate
          return { item_index: idx, commission_amount: parseFloat(ov) || 0 }
        })
        .filter(Boolean)
      await bookingsAPI.settleBooking(bookingId, {
        overrides: overrideList,
        notes: notes || undefined,
      })
      onSettled()
    } catch (ex: any) {
      setSaveErr(ex.response?.data?.detail || 'Settlement failed')
    } finally {
      setSaving(false)
    }
  }

  // If admin typed an override for a row, that value wins — whether matched or unmatched.
  // Empty override = keep auto-calculated commission_amount.
  const effectiveAmount = (item: any, idx: number): number => {
    const ov = overrides[idx]
    if (ov !== undefined && ov !== '') return parseFloat(ov) || 0
    return item.commission_amount || 0
  }

  const totalCommission = preview
    ? (preview.line_items || []).reduce(
        (sum: number, item: any, idx: number) => sum + effectiveAmount(item, idx),
        0
      )
    : 0

  const hasUnmatched = preview?.line_items?.some((i: any) => i.match_status === 'unmatched')

  return (
    <Modal
      title={`Settle & Close — ${bookingNumber}`}
      onClose={onClose}
      size="xl"
    >
      {/* Technician + Commission Group info strip */}
      {preview && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontSize: 11, color: '#64748B', marginBottom: 2 }}>👷 Technician</div>
            <div style={{ fontWeight: 700, color: '#1E40AF' }}>
              {preview.technician?.name || booking.technician_name || '—'}
            </div>
          </div>
          <div style={{
            flex: 1,
            background: preview.commission_group ? '#F0FDF4' : '#FFF7ED',
            border: `1px solid ${preview.commission_group ? '#86EFAC' : '#FCD34D'}`,
            borderRadius: 8, padding: '10px 14px',
          }}>
            <div style={{ fontSize: 11, color: '#64748B', marginBottom: 2 }}>💼 Commission Group</div>
            <div style={{ fontWeight: 700, color: preview.commission_group ? '#166534' : '#92400E' }}>
              {preview.commission_group?.name || '⚠ No group assigned — manual entry required'}
            </div>
          </div>
        </div>
      )}

      {/* Preview loading / error */}
      {previewLoading && <div style={{ textAlign: 'center', padding: 40 }}><Spinner /></div>}
      {previewErr && !preview && (
        <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
          {previewErr}
        </div>
      )}

      {/* Commission breakdown table */}
      {preview && !previewLoading && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Commission Breakdown</div>
          <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
            {/* Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 60px 90px 80px 100px 110px',
              background: '#F8FAFC', padding: '8px 12px',
              borderBottom: '1px solid #E2E8F0',
              fontSize: 11, fontWeight: 700, color: '#64748B',
            }}>
              <span>Item</span>
              <span style={{ textAlign: 'right' }}>Qty</span>
              <span style={{ textAlign: 'right' }}>Amount</span>
              <span style={{ textAlign: 'right' }}>Rate</span>
              <span style={{ textAlign: 'right' }}>Commission</span>
              <span style={{ textAlign: 'right' }}>Override</span>
            </div>

            {(preview.line_items || []).length === 0 ? (
              <div style={{ padding: '20px 14px', color: '#94A3B8', fontSize: 13, textAlign: 'center' }}>
                No commission line items found.
              </div>
            ) : (preview.line_items || []).map((item: any, idx: number) => {
              const isUnmatched = item.match_status === 'unmatched'
              return (
                <div
                  key={idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 60px 90px 80px 100px 110px',
                    padding: '8px 12px',
                    borderBottom: '1px solid #F1F5F9',
                    background: isUnmatched ? '#FFFBEB' : 'white',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#0F172A' }}>
                      {item.type === 'PART' ? '🔩' : '🔧'} {item.name}
                    </div>
                    <div style={{ fontSize: 10, color: '#94A3B8' }}>
                      {item.quotation_number}
                      {item.type === 'PART' && item.part_source && (
                        <span style={{
                          marginLeft: 6, fontSize: 9, padding: '1px 5px', borderRadius: 4,
                          background: item.part_source === 'OFFICE_STOCK' ? '#DBEAFE' : '#FEF3C7',
                          color: item.part_source === 'OFFICE_STOCK' ? '#1D4ED8' : '#92400E',
                        }}>
                          {item.part_source === 'OFFICE_STOCK' ? '🏢 Office Stock' : '🛒 Market'}
                        </span>
                      )}
                      {isUnmatched && (
                        <span style={{ marginLeft: 6, background: '#FEF3C7', color: '#92400E', padding: '1px 5px', borderRadius: 4, fontSize: 9 }}>
                          ⚠ Not in group
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 12, color: '#374151' }}>{item.quantity}</div>
                  <div style={{ textAlign: 'right', fontSize: 12, color: '#374151' }}>{money(item.total_price)}</div>
                  <div style={{ textAlign: 'right', fontSize: 11, color: '#64748B' }}>
                    {item.rate != null
                      ? (item.commission_type === 'PERCENTAGE' ? `${item.rate}%` : `₹${item.rate}`)
                      : '—'}
                  </div>
                  {/* Commission column: show effective value (override if typed, else auto) */}
                  <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 700,
                    color: overrides[idx] !== undefined && overrides[idx] !== '' ? '#7C3AED'
                          : item.commission_amount != null ? '#059669' : '#F59E0B' }}>
                    {overrides[idx] !== undefined && overrides[idx] !== ''
                      ? money(parseFloat(overrides[idx]) || 0)
                      : item.commission_amount != null ? money(item.commission_amount) : 'No rule'}
                    {overrides[idx] !== undefined && overrides[idx] !== '' && (
                      <div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 400 }}>
                        was {item.commission_amount != null ? money(item.commission_amount) : '—'}
                      </div>
                    )}
                  </div>
                  {/* Override input — clears to reset to auto */}
                  <div style={{ textAlign: 'right' }}>
                    <input
                      type="number" min="0" step="0.01"
                      placeholder={item.commission_amount != null ? String(item.commission_amount) : '0'}
                      value={overrides[idx] ?? ''}
                      onChange={e => setOverrides(prev => ({ ...prev, [idx]: e.target.value }))}
                      style={{
                        width: 88, padding: '4px 6px',
                        border: `1px solid ${
                          overrides[idx] !== undefined && overrides[idx] !== '' ? '#7C3AED'
                          : isUnmatched ? '#FCD34D' : '#E2E8F0'
                        }`,
                        borderRadius: 5, fontSize: 12, textAlign: 'right',
                        background: overrides[idx] !== undefined && overrides[idx] !== '' ? '#F5F3FF'
                                    : isUnmatched ? '#FFFBEB' : '#fff',
                      }}
                    />
                  </div>
                </div>
              )
            })}

            {/* Total row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 60px 90px 80px 100px 110px',
              padding: '10px 12px',
              background: '#F0FDF4',
              borderTop: '2px solid #86EFAC',
            }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#166534', gridColumn: '1 / 6' }}>
                Total Commission (held — released on Commissions page)
              </div>
              <div style={{ textAlign: 'right', fontWeight: 800, fontSize: 14, color: '#059669' }}>
                {money(totalCommission)}
              </div>
            </div>
          </div>

          {/* Unmatched warning */}
          {hasUnmatched && (
            <div style={{ background: '#FFF7ED', border: '1px solid #FCD34D', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400E', marginBottom: 12 }}>
              ⚠ Some items are not matched to a commission rule. Enter override amounts in the highlighted fields, or leave blank to use 0.
            </div>
          )}

          {/* Notes */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>
              Settlement Notes (optional)
            </label>
            <textarea
              className="input" rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. All payments confirmed, extra part verified"
              style={{ resize: 'vertical', width: '100%' }}
            />
          </div>

          {/* IMPORTANT: clarify wallet hold vs credit */}
          <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#1E40AF' }}>
            <b>ℹ️ How settlement works:</b>
            <ul style={{ margin: '6px 0 0 0', paddingLeft: 18, lineHeight: 1.8 }}>
              <li>Booking will be marked <b>CLOSED</b></li>
              <li>Commission of <b>{money(totalCommission)}</b> will be saved as <b>PENDING</b> (on hold — NOT yet in wallet)</li>
              <li>To release it to the technician's wallet, go to <b>Commissions page → Pay</b></li>
            </ul>
          </div>

          {saveErr && (
            <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 12 }}>
              {saveErr}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn btn-primary"
              disabled={saving || previewLoading}
              onClick={handleSettle}
              style={{ background: '#059669', borderColor: '#059669' }}
            >
              {saving ? <Spinner size="sm" /> : '🔒 Confirm Settlement & Close'}
            </button>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </>
      )}
    </Modal>
  )
}
