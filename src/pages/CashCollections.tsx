import { todayIST, fmtDateIST, fmtDateTimeIST, fmtTimeIST } from "../lib/tz";
import { useEffect, useState, useCallback } from 'react'
import { cashCollectionsAPI, techniciansAPI } from '@/services/api'
import PageHeader from '@/components/layout/PageHeader'

// ─── Types ───────────────────────────────────────────────────────
interface TechSummary {
  technician_id: string
  technician_name: string
  technician_code: string
  technician_mobile: string
  record_count: number
  total_amount: number
}

interface CollectionRecord {
  id: string
  booking_number: string
  invoice_number: string
  customer_name: string
  customer_mobile: string
  amount: number
  status: 'PENDING' | 'COLLECTED'
  collected_at: string | null
  collected_by_name: string | null
  created_at: string
  notes: string | null
}

interface TechDetail {
  technician: { id: string; name: string; mobile: string; technician_code: string }
  total_pending: number
  total_collected: number
  items: CollectionRecord[]
}

// ─── Helpers ─────────────────────────────────────────────────────
const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

// ─── Status pill ─────────────────────────────────────────────────
function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    PENDING:   { bg: '#FEF3C7', color: '#D97706', label: 'Pending Collection' },
    COLLECTED: { bg: '#DCFCE7', color: '#16A34A', label: 'Collected' },
  }
  const s = map[status] ?? { bg: '#F1F5F9', color: '#64748B', label: status }
  return (
    <span style={{ padding: '2px 10px', borderRadius: 20, background: s.bg, color: s.color, fontSize: 11, fontWeight: 700 }}>
      {s.label}
    </span>
  )
}

// ─── Main Page ───────────────────────────────────────────────────
export default function CashCollections() {
  const [summaries, setSummaries]         = useState<TechSummary[]>([])
  const [selectedTech, setSelectedTech]   = useState<TechSummary | null>(null)
  const [techDetail, setTechDetail]       = useState<TechDetail | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [collectingId, setCollectingId]   = useState<string | null>(null)
  const [collectingAll, setCollectingAll] = useState(false)
  const [showHistory, setShowHistory]     = useState(false)
  const [toast, setToast]                 = useState<{ msg: string; ok: boolean } | null>(null)
  const [notesModal, setNotesModal]       = useState<{ type: 'single' | 'all'; id?: string } | null>(null)
  const [notesInput, setNotesInput]       = useState('')

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Load tech summary (pending only, unless showing history) ──
  const loadSummary = useCallback(async () => {
    setLoadingSummary(true)
    try {
      const statusParam = showHistory ? 'COLLECTED' : 'PENDING'
      const r = await cashCollectionsAPI.summary(statusParam)
      setSummaries(r.data?.data || [])
      // Reset selected tech if switching view
      setSelectedTech(null)
      setTechDetail(null)
    } catch {
      showToast('Failed to load summary', false)
    } finally {
      setLoadingSummary(false)
    }
  }, [showHistory])

  useEffect(() => { loadSummary() }, [loadSummary])

  // ── Load detail for selected technician ──
  const loadDetail = useCallback(async (tech: TechSummary) => {
    setSelectedTech(tech)
    setLoadingDetail(true)
    try {
      const statusParam = showHistory ? 'COLLECTED' : 'PENDING'
      const r = await cashCollectionsAPI.forTechnician(tech.technician_id, statusParam)
      setTechDetail(r.data?.data)
    } catch {
      showToast('Failed to load records', false)
    } finally {
      setLoadingDetail(false)
    }
  }, [showHistory])

  // ── Mark single as collected ──
  const handleCollectOne = async (id: string, notes: string) => {
    setCollectingId(id)
    try {
      await cashCollectionsAPI.markCollected(id, { notes })
      showToast('Cash collected ✓')
      // refresh detail
      if (selectedTech) await loadDetail(selectedTech)
      await loadSummary()
    } catch (e: any) {
      showToast(e?.response?.data?.detail || 'Failed', false)
    } finally {
      setCollectingId(null)
    }
  }

  // ── Mark ALL as collected ──
  const handleCollectAll = async (notes: string) => {
    if (!selectedTech) return
    setCollectingAll(true)
    try {
      const r = await cashCollectionsAPI.collectAll(selectedTech.technician_id, { notes })
      showToast(`Collected ₹${r.data?.data?.total_amount_collected?.toFixed(2)} from ${selectedTech.technician_name} ✓`)
      await loadSummary()
      setSelectedTech(null)
      setTechDetail(null)
    } catch (e: any) {
      showToast(e?.response?.data?.detail || 'Failed', false)
    } finally {
      setCollectingAll(false)
    }
  }

  const pendingItems = techDetail?.items.filter(i => i.status === 'PENDING') || []
  const collectedItems = techDetail?.items.filter(i => i.status === 'COLLECTED') || []

  return (
    <div style={{ padding: '24px 28px', minHeight: '100vh', background: '#F8FAFC' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 24, zIndex: 9999,
          background: toast.ok ? '#059669' : '#DC2626', color: '#fff',
          padding: '10px 20px', borderRadius: 10, fontWeight: 600, fontSize: 14,
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        }}>{toast.msg}</div>
      )}

      <PageHeader
        title="Cash Collections"
        subtitle="Track cash collected by technicians — ensure all cash is handed to admin before settling bookings"
      />

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          onClick={() => setShowHistory(false)}
          style={{
            padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: !showHistory ? '#1B4FD8' : '#E2E8F0',
            color: !showHistory ? '#fff' : '#475569',
          }}
        >💰 Pending Collection</button>
        <button
          onClick={() => setShowHistory(true)}
          style={{
            padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: showHistory ? '#1B4FD8' : '#E2E8F0',
            color: showHistory ? '#fff' : '#475569',
          }}
        >✅ Collection History</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>

        {/* ── LEFT: Technician list ── */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1E293B' }}>
              {showHistory ? '✅ Technicians (History)' : '⚠️ Technicians with Pending Cash'}
            </div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
              {loadingSummary ? 'Loading...' : `${summaries.length} technician${summaries.length !== 1 ? 's' : ''}`}
            </div>
          </div>

          {loadingSummary ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>Loading...</div>
          ) : summaries.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{showHistory ? '📋' : '🎉'}</div>
              <div style={{ fontSize: 14, color: '#64748B', fontWeight: 600 }}>
                {showHistory ? 'No collected records found' : 'No pending collections!'}
              </div>
              <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>
                {showHistory ? '' : 'All cash has been collected from technicians.'}
              </div>
            </div>
          ) : (
            summaries.map(tech => {
              const isActive = selectedTech?.technician_id === tech.technician_id
              return (
                <div
                  key={tech.technician_id}
                  onClick={() => loadDetail(tech)}
                  style={{
                    padding: '14px 18px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9',
                    background: isActive ? '#EFF6FF' : '#fff',
                    borderLeft: isActive ? '3px solid #1B4FD8' : '3px solid transparent',
                    transition: 'all 0.12s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#1E293B' }}>{tech.technician_name}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                        {tech.technician_code} · {tech.technician_mobile}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                        {tech.record_count} record{tech.record_count !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontWeight: 800, fontSize: 16,
                        color: showHistory ? '#16A34A' : '#DC2626',
                      }}>{fmt(tech.total_amount)}</div>
                      <div style={{
                        fontSize: 10, fontWeight: 700, marginTop: 2,
                        color: showHistory ? '#16A34A' : '#F59E0B',
                      }}>{showHistory ? 'COLLECTED' : 'PENDING'}</div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* ── RIGHT: Records detail ── */}
        <div>
          {!selectedTech ? (
            <div style={{
              background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0',
              padding: 60, textAlign: 'center',
            }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>👈</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#1E293B' }}>Select a Technician</div>
              <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 6 }}>
                Click a technician on the left to view their cash collection records.
              </div>
            </div>
          ) : loadingDetail ? (
            <div style={{
              background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0',
              padding: 60, textAlign: 'center', color: '#94A3B8',
            }}>Loading records...</div>
          ) : techDetail ? (
            <div>
              {/* Technician header card */}
              <div style={{
                background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0',
                padding: '18px 22px', marginBottom: 16,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 18, color: '#1E293B' }}>
                      🔧 {techDetail.technician.name}
                    </div>
                    <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
                      {techDetail.technician.technician_code} · {techDetail.technician.mobile}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                    {techDetail.total_pending > 0 && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 800, fontSize: 20, color: '#DC2626' }}>{fmt(techDetail.total_pending)}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>PENDING</div>
                      </div>
                    )}
                    {techDetail.total_collected > 0 && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 800, fontSize: 20, color: '#16A34A' }}>{fmt(techDetail.total_collected)}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>COLLECTED</div>
                      </div>
                    )}
                    {pendingItems.length > 0 && (
                      <button
                        onClick={() => { setNotesInput(''); setNotesModal({ type: 'all' }) }}
                        disabled={collectingAll}
                        style={{
                          padding: '10px 20px', background: '#059669', color: '#fff',
                          border: 'none', borderRadius: 9, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                          opacity: collectingAll ? 0.6 : 1,
                        }}
                      >
                        {collectingAll ? 'Processing...' : `✅ Collect All (${fmt(techDetail.total_pending)})`}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Pending records */}
              {pendingItems.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#D97706', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    ⏳ Pending — {pendingItems.length} Record{pendingItems.length !== 1 ? 's' : ''}
                  </div>
                  {pendingItems.map(rec => (
                    <RecordRow
                      key={rec.id}
                      rec={rec}
                      onCollect={() => { setNotesInput(''); setNotesModal({ type: 'single', id: rec.id }) }}
                      isCollecting={collectingId === rec.id}
                      showButton
                    />
                  ))}
                </div>
              )}

              {/* Collected records (show only if there's any) */}
              {collectedItems.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#16A34A', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    ✅ Already Collected — {collectedItems.length} Record{collectedItems.length !== 1 ? 's' : ''}
                  </div>
                  {collectedItems.map(rec => (
                    <RecordRow key={rec.id} rec={rec} showButton={false} />
                  ))}
                </div>
              )}

              {techDetail.items.length === 0 && (
                <div style={{
                  background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0',
                  padding: 40, textAlign: 'center',
                }}>
                  <div style={{ fontSize: 14, color: '#64748B' }}>No records found for this technician.</div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Notes Modal */}
      {notesModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000,
        }}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: 28, width: 420,
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#1E293B', marginBottom: 6 }}>
              {notesModal.type === 'all' ? '✅ Collect All Cash' : '✅ Mark as Collected'}
            </div>
            <div style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>
              {notesModal.type === 'all'
                ? `You are collecting all pending cash (${fmt(techDetail?.total_pending || 0)}) from ${techDetail?.technician.name}.`
                : 'Confirm you have received this cash from the technician.'}
            </div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Notes (optional)</label>
            <textarea
              value={notesInput}
              onChange={e => setNotesInput(e.target.value)}
              placeholder="e.g. Collected at office, 19 Jun 2026"
              rows={3}
              style={{
                width: '100%', marginTop: 6, padding: '8px 12px', borderRadius: 8,
                border: '1px solid #D1D5DB', fontSize: 13, resize: 'vertical', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setNotesModal(null)}
                style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer', fontSize: 13 }}
              >Cancel</button>
              <button
                onClick={async () => {
                  const notes = notesInput.trim()
                  setNotesModal(null)
                  if (notesModal.type === 'all') {
                    await handleCollectAll(notes)
                  } else if (notesModal.id) {
                    await handleCollectOne(notesModal.id, notes)
                  }
                }}
                style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
              >Confirm Collection</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Record Row Component ─────────────────────────────────────────
function RecordRow({
  rec, onCollect, isCollecting, showButton,
}: {
  rec: CollectionRecord
  onCollect?: () => void
  isCollecting?: boolean
  showButton: boolean
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0',
      padding: '14px 18px', marginBottom: 10,
      borderLeft: rec.status === 'PENDING' ? '4px solid #F59E0B' : '4px solid #22C55E',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#1E293B' }}>{rec.customer_name}</span>
            <StatusPill status={rec.status} />
          </div>
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
            📋 {rec.booking_number} &nbsp;·&nbsp; 🧾 {rec.invoice_number}
          </div>
          {rec.customer_mobile && (
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>📱 {rec.customer_mobile}</div>
          )}
          <div style={{ fontSize: 11, color: '#CBD5E1', marginTop: 4 }}>
            Collected on {new Date(rec.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
          {rec.status === 'COLLECTED' && rec.collected_at && (
            <div style={{ fontSize: 11, color: '#16A34A', marginTop: 2, fontWeight: 600 }}>
              ✓ Admin collected on {new Date(rec.collected_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              {rec.collected_by_name && ` · ${rec.collected_by_name}`}
            </div>
          )}
          {rec.notes && (
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 4, fontStyle: 'italic' }}>"{rec.notes}"</div>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: '#1E293B' }}>{`₹${rec.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}</div>
          {showButton && (
            <button
              onClick={onCollect}
              disabled={isCollecting}
              style={{
                marginTop: 8, padding: '6px 16px', background: '#059669', color: '#fff',
                border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                opacity: isCollecting ? 0.6 : 1,
              }}
            >
              {isCollecting ? '...' : '✅ Collect'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
