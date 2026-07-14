// src/components/ui/SettleModal.tsx
// Shared "Settle & Close" modal used by BookingWorkflow (Manage modal) and Settlements page.
// On settle: commissions are saved as PENDING (held). Wallet is NOT credited yet.
// Wallet is credited only when admin clicks "Pay" on the Commissions page.
//
// Part commission logic:
//   OFFICE_STOCK  → commission only (rate% of profit)
//   MARKET_PURCHASE → purchase reimbursement + commission on profit
// If no line items exist → manual commission input box shown.

import { useCallback, useEffect, useMemo, useState } from 'react'
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

  const [overrides, setOverrides]         = useState<Record<string, string>>({})
  const [manualCommission, setManualComm] = useState('')   // used when no line items
  const [notes, setNotes]                 = useState('')
  const [saving, setSaving]               = useState(false)
  const [saveErr, setSaveErr]             = useState('')

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

  const hasLineItems = (preview?.line_items || []).length > 0

  const handleSettle = async () => {
    setSaving(true); setSaveErr('')
    try {
      let overrideList: any[] = []

      if (!hasLineItems) {
        // Manual mode: no line items — send a single manual override as index 0
        const manualAmt = parseFloat(manualCommission) || 0
        if (manualAmt > 0) {
          overrideList = [{ item_index: 0, commission_amount: manualAmt }]
        }
      } else {
        overrideList = (preview?.line_items || [])
          .map((item: any, idx: number) => {
            const ov = overrides[String(idx)]
            if (ov === undefined || ov === '') return null
            return { item_index: idx, commission_amount: parseFloat(ov) || 0 }
          })
          .filter(Boolean)
      }

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

  // effectiveAmount: returns override if typed, else auto commission_amount (commission only, not reimb)
  const effectiveAmount = useCallback((item: any, idx: number): number => {
    const ov = overrides[String(idx)]
    if (ov !== undefined && ov !== '') return parseFloat(ov) || 0
    return item.commission_amount || 0
  }, [overrides])

  // Total commission across all items (respects overrides)
  const totalCommission = useMemo(
    () => preview
      ? (preview.line_items || []).reduce(
          (sum: number, item: any, idx: number) => sum + effectiveAmount(item, idx),
          0
        )
      : 0,
    [preview, overrides, effectiveAmount]
  )

  // Total reimbursement (MARKET_PURCHASE purchase cost — not overridable)
  const totalReimbursement = useMemo(
    () => preview
      ? (preview.line_items || []).reduce(
          (sum: number, item: any) => sum + (item.purchase_reimbursement || 0),
          0
        )
      : 0,
    [preview]
  )

  // Grand total technician payout = commission + reimbursement
  const grandTotal = useMemo(
    () => totalCommission + totalReimbursement,
    [totalCommission, totalReimbursement]
  )

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

      {/* ── MANUAL MODE: no services/parts found ── */}
      {preview && !previewLoading && !hasLineItems && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ background: '#FFF7ED', border: '1px solid #FCD34D', borderRadius: 8, padding: '12px 14px', marginBottom: 14, fontSize: 13, color: '#92400E' }}>
            ⚠ No services or parts found in this booking's invoiced quotations. Enter the commission manually below.
          </div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
            Manual Commission Amount (₹)
          </label>
          <input
            type="number" min="0" step="0.01"
            placeholder="Enter commission amount"
            value={manualCommission}
            onChange={e => setManualComm(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px',
              border: '1px solid #CBD5E1', borderRadius: 6,
              fontSize: 14, outline: 'none',
            }}
          />
          {manualCommission && parseFloat(manualCommission) > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#059669', fontWeight: 600 }}>
              Total to hold: {money(parseFloat(manualCommission) || 0)}
            </div>
          )}
        </div>
      )}

      {/* ── NORMAL MODE: commission breakdown table ── */}
      {preview && !previewLoading && hasLineItems && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Commission Breakdown</div>
          <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
            {/* Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 50px 90px 70px 130px 110px',
              background: '#F8FAFC', padding: '8px 12px',
              borderBottom: '1px solid #E2E8F0',
              fontSize: 11, fontWeight: 700, color: '#64748B',
            }}>
              <span>Item</span>
              <span style={{ textAlign: 'right' }}>Qty</span>
              <span style={{ textAlign: 'right' }}>Sell Price</span>
              <span style={{ textAlign: 'right' }}>Rate</span>
              <span style={{ textAlign: 'right' }}>Payout Breakdown</span>
              <span style={{ textAlign: 'right' }}>Override</span>
            </div>

            {(preview.line_items || []).map((item: any, idx: number) => {
              const isUnmatched  = item.match_status === 'unmatched'
              const isMarket     = item.part_source === 'MARKET_PURCHASE'
              const reimb        = item.purchase_reimbursement || 0
              const commAmt      = effectiveAmount(item, idx)
              const overridden   = overrides[String(idx)] !== undefined && overrides[String(idx)] !== ''

              return (
                <div
                  key={idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 50px 90px 70px 130px 110px',
                    padding: '8px 12px',
                    borderBottom: '1px solid #F1F5F9',
                    background: isUnmatched ? '#FFFBEB' : 'white',
                    alignItems: 'center',
                  }}
                >
                  {/* Item name + badges */}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#0F172A' }}>
                      {item.type === 'PART' ? '🔩' : '🔧'} {item.name}
                    </div>
                    <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
                      {item.quotation_number}
                      {item.type === 'PART' && item.part_source && (
                        <span style={{
                          marginLeft: 6, fontSize: 9, padding: '1px 5px', borderRadius: 4,
                          background: item.part_source === 'OFFICE_STOCK' ? '#DBEAFE' : '#FEF3C7',
                          color: item.part_source === 'OFFICE_STOCK' ? '#1D4ED8' : '#92400E',
                          fontWeight: 700,
                        }}>
                          {item.part_source === 'OFFICE_STOCK' ? '🏢 Office Stock' : '🛒 Market'}
                        </span>
                      )}
                      {isUnmatched && (
                        <span style={{ marginLeft: 6, background: '#FEE2E2', color: '#DC2626', padding: '1px 5px', borderRadius: 4, fontSize: 9 }}>
                          ⚠ Not in group
                        </span>
                      )}
                    </div>
                    {/* Market part: show purchase price sub-detail */}
                    {isMarket && item.purchase_price != null && (
                      <div style={{ fontSize: 10, color: '#92400E', marginTop: 2 }}>
                        Purchase cost: ₹{item.purchase_price} × {item.quantity} = {money(reimb)}
                      </div>
                    )}
                  </div>

                  {/* Qty */}
                  <div style={{ textAlign: 'right', fontSize: 12, color: '#374151' }}>{item.quantity}</div>

                  {/* Selling price */}
                  <div style={{ textAlign: 'right', fontSize: 12, color: '#374151' }}>{money(item.total_price)}</div>

                  {/* Rate */}
                  <div style={{ textAlign: 'right', fontSize: 11, color: '#64748B' }}>
                    {item.rate != null
                      ? (item.commission_type === 'PERCENTAGE' ? `${item.rate}%` : `₹${item.rate}`)
                      : '—'}
                  </div>

                  {/* Payout breakdown column */}
                  <div style={{ textAlign: 'right' }}>
                    {isMarket ? (
                      // MARKET part: show purchase reimb + commission separately
                      <div style={{ fontSize: 11, lineHeight: 1.7 }}>
                        {reimb > 0 && (
                          <div style={{ color: '#B45309', fontWeight: 600 }}>
                            🛒 {money(reimb)}
                            <span style={{ fontSize: 9, color: '#78716C', fontWeight: 400, marginLeft: 2 }}>(cost back)</span>
                          </div>
                        )}
                        <div style={{
                          color: overridden ? '#7C3AED' : (item.commission_amount != null ? '#059669' : '#F59E0B'),
                          fontWeight: 700,
                        }}>
                          💰 {overridden
                            ? money(commAmt)
                            : (item.commission_amount != null ? money(item.commission_amount) : 'No rule')}
                          <span style={{ fontSize: 9, color: '#78716C', fontWeight: 400, marginLeft: 2 }}>(profit %)</span>
                        </div>
                        <div style={{ borderTop: '1px dashed #CBD5E1', marginTop: 2, paddingTop: 2, fontWeight: 800, fontSize: 12, color: '#0F172A' }}>
                          = {money(reimb + commAmt)}
                        </div>
                        {overridden && (
                          <div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 400 }}>
                            was {item.commission_amount != null ? money(item.commission_amount) : '—'} (profit)
                          </div>
                        )}
                      </div>
                    ) : (
                      // OFFICE_STOCK or SERVICE: single commission value
                      <div style={{
                        fontSize: 12, fontWeight: 700,
                        color: overridden ? '#7C3AED' : (item.commission_amount != null ? '#059669' : '#F59E0B'),
                      }}>
                        {overridden
                          ? money(commAmt)
                          : (item.commission_amount != null ? money(item.commission_amount) : 'No rule')}
                        {overridden && (
                          <div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 400 }}>
                            was {item.commission_amount != null ? money(item.commission_amount) : '—'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Override input — only for commission part, not reimbursement */}
                  <div style={{ textAlign: 'right' }}>
                    <input
                      type="number" min="0" step="0.01"
                      placeholder={item.commission_amount != null ? String(item.commission_amount) : '0'}
                      value={overrides[String(idx)] ?? ''}
                      onChange={e => setOverrides(prev => ({ ...prev, [String(idx)]: e.target.value }))}
                      style={{
                        width: 88, padding: '4px 6px',
                        border: `1px solid ${
                          overrides[String(idx)] !== undefined && overrides[String(idx)] !== '' ? '#7C3AED'
                          : isUnmatched ? '#FCD34D' : '#E2E8F0'
                        }`,
                        borderRadius: 5, fontSize: 12, textAlign: 'right',
                        background: overrides[String(idx)] !== undefined && overrides[String(idx)] !== '' ? '#F5F3FF'
                                    : isUnmatched ? '#FFFBEB' : '#fff',
                      }}
                    />
                    {isMarket && (
                      <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 2 }}>profit only</div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Totals footer */}
            <div style={{
              background: '#F0FDF4',
              borderTop: '2px solid #86EFAC',
              padding: '10px 12px',
            }}>
              {/* Reimbursement sub-row — only shown if any market parts */}
              {totalReimbursement > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: '#92400E' }}>
                  <span>🛒 Market Part Purchase Reimbursement</span>
                  <span style={{ fontWeight: 700 }}>{money(totalReimbursement)}</span>
                </div>
              )}
              {/* Commission sub-row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: totalReimbursement > 0 ? 4 : 0, fontSize: 12, color: '#059669' }}>
                <span>💰 Profit Commission</span>
                <span style={{ fontWeight: 700 }}>{money(totalCommission)}</span>
              </div>
              {/* Grand total */}
              {totalReimbursement > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #86EFAC', paddingTop: 6, marginTop: 6, fontSize: 14, color: '#166534', fontWeight: 800 }}>
                  <span>🎯 Total Payout to Technician</span>
                  <span>{money(grandTotal)}</span>
                </div>
              )}
              {totalReimbursement === 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #86EFAC', paddingTop: 6, marginTop: 6, fontSize: 14, color: '#166534', fontWeight: 800 }}>
                  <span>Total Commission (held — released on Commissions page)</span>
                  <span>{money(totalCommission)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Unmatched warning */}
          {hasUnmatched && (
            <div style={{ background: '#FFF7ED', border: '1px solid #FCD34D', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400E', marginBottom: 12 }}>
              ⚠ Some items are not matched to a commission rule. Enter override amounts (profit commission) in the highlighted fields, or leave blank to use ₹0.
            </div>
          )}
        </>
      )}

      {/* Notes */}
      {preview && !previewLoading && (
        <>
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

          {/* How settlement works info box */}
          <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#1E40AF' }}>
            <b>ℹ️ How settlement works:</b>
            <ul style={{ margin: '6px 0 0 0', paddingLeft: 18, lineHeight: 1.8 }}>
              <li>Booking will be marked <b>CLOSED</b></li>
              {hasLineItems ? (
                <>
                  {totalReimbursement > 0 && (
                    <li>
                      🛒 Market part purchase reimbursement of <b>{money(totalReimbursement)}</b> will be held as <b>PENDING</b> — this is the technician's own money paid for parts
                    </li>
                  )}
                  <li>
                    💰 Profit commission of <b>{money(totalCommission)}</b> will be saved as <b>PENDING</b> (on hold — NOT yet in wallet)
                  </li>
                  {totalReimbursement > 0 && (
                    <li>🎯 Total payout held: <b>{money(grandTotal)}</b></li>
                  )}
                </>
              ) : (
                <li>
                  Manual commission of <b>{money(parseFloat(manualCommission) || 0)}</b> will be saved as <b>PENDING</b>
                </li>
              )}
              <li>To release to the technician's wallet, go to <b>Commissions page → Pay</b></li>
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
