import { useEffect, useState, useCallback, useRef } from 'react'
import { commissionsAPI } from '@/services/api'
import PageHeader from '@/components/layout/PageHeader'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'
import Toast, { useToast } from '@/components/ui/Toast'

/* ─── helpers ──────────────────────────────────────────────────── */
const fmt = (n: number) =>
  `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata',
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '—'

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  PENDING:  { bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' },
  APPROVED: { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
  PAID:     { bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0' },
}

const TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  SERVICE: { bg: '#EFF6FF', color: '#1D4ED8' },
  PART:    { bg: '#F5F3FF', color: '#7C3AED' },
}

/* ─── sub-components ───────────────────────────────────────────── */
function SummaryCard({
  label, amount, count, color, active, onClick,
}: {
  label: string; amount: number; count: number
  color: string; active: boolean; onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1, minWidth: 150, padding: '16px 18px', borderRadius: 12, cursor: 'pointer',
        border: `1.5px solid ${active ? color : '#E2E8F0'}`,
        background: active ? color : '#fff',
        transition: 'all 0.14s',
        userSelect: 'none',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6, color: active ? 'rgba(255,255,255,0.75)' : '#64748B' }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: active ? '#fff' : '#0F172A' }}>{fmt(amount)}</div>
      <div style={{ fontSize: 11, marginTop: 3, color: active ? 'rgba(255,255,255,0.65)' : '#94A3B8' }}>{count} entries</div>
    </div>
  )
}

function Pill({ type }: { type?: string }) {
  if (!type) return <span style={{ color: '#94A3B8', fontSize: 11 }}>—</span>
  const s = TYPE_STYLE[type] || { bg: '#F1F5F9', color: '#475569' }
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: s.bg, color: s.color }}>
      {type}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] || { bg: '#F1F5F9', color: '#475569', border: '#E2E8F0' }
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {status}
    </span>
  )
}

/* ════════════════════════════════════════════════════════════════ */
export default function Commissions() {
  /* list */
  const [items,   setItems]   = useState<any[]>([])
  const [summary, setSummary] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [page,    setPage]    = useState(1)
  const [pages,   setPages]   = useState(1)
  const [total,   setTotal]   = useState(0)

  /* filters */
  const [statusFilter,   setStatusFilter]   = useState('')
  const [itemTypeFilter, setItemTypeFilter] = useState('')
  const [search,         setSearch]         = useState('')
  const [searchInput,    setSearchInput]    = useState('')
  const searchTimer = useRef<any>(null)

  /* selection */
  const [selected, setSelected] = useState<Set<string>>(new Set())

  /* modals */
  const [approveModal, setApproveModal] = useState<any>(null)
  const [payModal,     setPayModal]     = useState<any>(null)
  const [bulkAction,   setBulkAction]   = useState<'approve' | 'pay' | null>(null)
  const [approveNotes, setApproveNotes] = useState('')
  const [saving,       setSaving]       = useState(false)

  /* detail drawer */
  const [drawer, setDrawer] = useState<any>(null)

  const { toasts, removeToast, toast } = useToast()

  /* ── fetch ── */
  const fetchData = useCallback(async () => {
    setLoading(true)
    setSelected(new Set())
    try {
      const r = await commissionsAPI.list({
        page,
        per_page:  15,
        status:    statusFilter   || undefined,
        item_type: itemTypeFilter || undefined,
        search:    search         || undefined,
      })
      const d = r.data.data
      setItems(d.items || [])
      setPages(d.pages || 1)
      setTotal(d.total || 0)
      setSummary(d.summary || {})
    } catch { setItems([]) } finally { setLoading(false) }
  }, [page, statusFilter, itemTypeFilter, search])

  useEffect(() => { fetchData() }, [fetchData])

  /* debounced search */
  const handleSearchChange = (val: string) => {
    setSearchInput(val)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => { setSearch(val); setPage(1) }, 500)
  }
  const clearSearch = () => { setSearchInput(''); setSearch(''); setPage(1) }

  /* ── actions ── */
  const doApprove = async () => {
    if (!approveModal) return
    setSaving(true)
    try {
      await commissionsAPI.approve(approveModal.id, approveNotes || undefined)
      setApproveModal(null); setApproveNotes('')
      toast.success('Commission approved'); fetchData()
    } catch (ex: any) { toast.error(ex.response?.data?.detail || 'Approve failed') }
    finally { setSaving(false) }
  }

  const doPay = async () => {
    if (!payModal) return
    setSaving(true)
    try {
      // If still PENDING, auto-approve first (backend requires APPROVED before PAID)
      if (payModal.status === 'PENDING') {
        await commissionsAPI.approve(payModal.id, 'Auto-approved on payment')
      }
      await commissionsAPI.pay(payModal.id)
      setPayModal(null)
      toast.success('Commission paid — wallet credited'); fetchData()
    } catch (ex: any) { toast.error(ex.response?.data?.detail || 'Failed') }
    finally { setSaving(false) }
  }

  const doBulk = async () => {
    if (!bulkAction || selected.size === 0) return
    setSaving(true)
    try {
      const ids = Array.from(selected)
      // Auto-approve PENDING ones first, then bulk pay all
      const pendingIds = items.filter(i => ids.includes(i.id) && i.status === 'PENDING').map(i => i.id)
      if (pendingIds.length > 0) await commissionsAPI.bulkApprove(pendingIds)
      const r = await commissionsAPI.bulkPay(ids)
      toast.success(r.data.message || 'Done')
      setBulkAction(null); fetchData()
    } catch (ex: any) { toast.error(ex.response?.data?.detail || 'Bulk action failed') }
    finally { setSaving(false) }
  }

  /* ── selection ── */
  const toggleAll = () =>
    setSelected(selected.size === items.length && items.length > 0 ? new Set() : new Set(items.map(i => i.id)))

  const toggleOne = (id: string) => {
    const s = new Set(selected)
    s.has(id) ? s.delete(id) : s.add(id)
    setSelected(s)
  }

  const pendingSelected  = items.filter(i => selected.has(i.id) && i.status === 'PENDING').length
  const approvedSelected = items.filter(i => selected.has(i.id) && i.status === 'APPROVED').length

  /* ─── filter helpers ─── */
  const setStatus = (s: string) => { setStatusFilter(s); setPage(1) }
  const setType   = (t: string) => { setItemTypeFilter(t); setPage(1) }

  /* ════════════ RENDER ════════════ */
  return (
    <div style={{ padding: '24px 28px', position: 'relative' }}>
      <Toast toasts={toasts} onRemove={removeToast} />

      {/* ── Header ── */}
      <PageHeader
        title="Commissions"
        subtitle="Technician commission ledger — approve entries and mark payouts"
      />

      {/* ── Summary cards (also act as status filters) ── */}
      <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
        <SummaryCard
          label="All Commissions"
          amount={summary.total_amount || 0}
          count={summary.total_count || 0}
          color="#0F172A"
          active={statusFilter === ''}
          onClick={() => setStatus('')}
        />
        <SummaryCard
          label="Pending"
          amount={summary.pending_amount || 0}
          count={summary.pending_count || 0}
          color="#D97706"
          active={statusFilter === 'PENDING'}
          onClick={() => setStatus('PENDING')}
        />
        <SummaryCard
          label="Approved"
          amount={summary.approved_amount || 0}
          count={summary.approved_count || 0}
          color="#1D4ED8"
          active={statusFilter === 'APPROVED'}
          onClick={() => setStatus('APPROVED')}
        />
        <SummaryCard
          label="Paid Out"
          amount={summary.paid_amount || 0}
          count={summary.paid_count || 0}
          color="#15803D"
          active={statusFilter === 'PAID'}
          onClick={() => setStatus('PAID')}
        />
      </div>

      {/* ── Info banner: what "Mark Paid" means ── */}
      <div style={{
        marginTop: 16, padding: '10px 16px', borderRadius: 8,
        background: '#F0FDF4', border: '1px solid #BBF7D0',
        display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        <span style={{ fontSize: 16, lineHeight: 1.4 }}>ℹ️</span>
        <div style={{ fontSize: 12, color: '#166534', lineHeight: 1.6 }}>
          <b>How commissions work:</b> When admin settles a booking, commissions are saved as <b>PENDING</b> (on hold — NOT in wallet yet).
          Click <b>"Pay"</b> to release the amount into the technician's wallet. Only after <b>Pay</b> does the wallet balance increase and the technician can withdraw.
        </div>
      </div>

      {/* ── Search + Type filter toolbar ── */}
      <div style={{ display: 'flex', gap: 10, marginTop: 14, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 340 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: 14 }}>🔍</span>
          <input
            className="input"
            style={{ paddingLeft: 32, paddingRight: searchInput ? 32 : 12, width: '100%' }}
            placeholder="Search technician name or code…"
            value={searchInput}
            onChange={e => handleSearchChange(e.target.value)}
          />
          {searchInput && (
            <button
              onClick={clearSearch}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 16, lineHeight: 1 }}
            >✕</button>
          )}
        </div>

        {/* Item-type pills */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['', 'SERVICE', 'PART'] as const).map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              style={{
                padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${itemTypeFilter === t ? '#0F172A' : '#E2E8F0'}`,
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: itemTypeFilter === t ? '#0F172A' : '#fff',
                color: itemTypeFilter === t ? '#fff' : '#475569',
              }}
            >{t || 'All Types'}</button>
          ))}
        </div>

        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94A3B8' }}>
          {total} records{search ? ` for "${search}"` : ''}
        </span>
      </div>

      {/* ── Bulk action bar (appears when rows selected) ── */}
      {selected.size > 0 && (
        <div style={{
          display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12,
          padding: '10px 16px', background: '#EFF6FF', border: '1px solid #BFDBFE',
          borderRadius: 8,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1D4ED8' }}>
            {selected.size} selected
          </span>
          <span style={{ color: '#93C5FD', fontSize: 16 }}>|</span>
          {(pendingSelected > 0 || approvedSelected > 0) && (
            <button
              onClick={() => setBulkAction('pay')}
              style={{ padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: '#15803D', color: '#fff' }}
            >₹ Pay {pendingSelected + approvedSelected} Commissions</button>
          )}
          {pendingSelected === 0 && approvedSelected === 0 && (
            <span style={{ fontSize: 12, color: '#64748B' }}>Selected items have no available bulk action</span>
          )}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setSelected(new Set())}
            style={{ marginLeft: 'auto' }}
          >Clear selection</button>
        </div>
      )}

      {/* ── Main table ── */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading
          ? <div style={{ padding: 60, textAlign: 'center' }}><Spinner /></div>
          : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      checked={selected.size === items.length && items.length > 0}
                      onChange={toggleAll}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th>Technician</th>
                  <th>Type</th>
                  <th>Item</th>
                  <th>Base ₹</th>
                  <th>Commission ₹</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0
                  ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: 48 }}>
                        <div style={{ color: '#94A3B8', fontSize: 14, marginBottom: 8 }}>No commission records found</div>
                        {(search || statusFilter || itemTypeFilter) && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => { clearSearch(); setStatus(''); setType('') }}
                          >Clear all filters</button>
                        )}
                      </td>
                    </tr>
                  )
                  : items.map((c: any) => (
                    <tr key={c.id} onClick={() => setDrawer(c)} style={{ cursor: 'pointer' }}>
                      <td onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleOne(c.id)} style={{ cursor: 'pointer' }} />
                      </td>

                      {/* technician */}
                      <td>
                        <div style={{ fontWeight: 600, color: '#0F172A', fontSize: 13 }}>
                          {c.technician_name || <span style={{ color: '#94A3B8', fontWeight: 400 }}>Unknown</span>}
                        </div>
                        {c.technician_code && (
                          <div style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>#{c.technician_code}</div>
                        )}
                      </td>

                      {/* type */}
                      <td><Pill type={c.item_type} /></td>

                      {/* item */}
                      <td>
                        <div style={{ fontSize: 12, color: '#374151', maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.item_name}>
                          {c.item_name || '—'}
                        </div>
                        {c.item_quantity > 1 && <div style={{ fontSize: 11, color: '#94A3B8' }}>Qty: {c.item_quantity}</div>}
                        {c.part_source && (
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED', marginTop: 1 }}>
                            {c.part_source.replace('_', ' ')}
                          </div>
                        )}
                      </td>

                      {/* base */}
                      <td style={{ color: '#475569', fontWeight: 500 }}>{fmt(c.base_amount)}</td>

                      {/* commission */}
                      <td>
                        <span style={{ fontWeight: 800, fontSize: 14, color: '#059669' }}>{fmt(c.commission_amount)}</span>
                      </td>

                      {/* status */}
                      <td><StatusBadge status={c.status} /></td>

                      {/* date */}
                      <td style={{ fontSize: 11, color: '#94A3B8', whiteSpace: 'nowrap' }}>{fmtDate(c.created_at)}</td>

                      {/* actions */}
                      <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 5, justifyContent: 'center', flexWrap: 'nowrap' }}>
                          {(c.status === 'PENDING' || c.status === 'APPROVED') && (
                            <button
                              onClick={() => setPayModal(c)}
                              style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, background: '#15803D', color: '#fff' }}
                            >₹ Pay</button>
                          )}
                          {c.status === 'PAID' && (
                            <span style={{ fontSize: 11, color: '#15803D', fontWeight: 600 }}>✓ Paid{c.payout_date ? ` ${fmtDate(c.payout_date).split(',')[0]}` : ''}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
            <Pagination page={page} pages={pages} onPage={p => setPage(p)} />
          </>
        )}
      </div>

      {/* ══════════ DETAIL DRAWER ══════════ */}
      {drawer && (
        <>
          <div
            onClick={() => setDrawer(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.3)', zIndex: 200, backdropFilter: 'blur(2px)' }}
          />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 440,
            background: '#fff', zIndex: 201, display: 'flex', flexDirection: 'column',
            boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
          }}>
            {/* header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#0F172A' }}>Commission Detail</div>
                <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#94A3B8', marginTop: 3 }}>{drawer.id}</div>
              </div>
              <button onClick={() => setDrawer(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#64748B', lineHeight: 1, padding: 4 }}>✕</button>
            </div>

            {/* amounts strip */}
            <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0' }}>
              {[
                { label: 'Base Amount', value: fmt(drawer.base_amount), color: '#475569' },
                { label: 'Commission', value: fmt(drawer.commission_amount), color: '#059669' },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, padding: '14px 12px', borderRight: '1px solid #E2E8F0', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</div>
                </div>
              ))}
              <div style={{ flex: 1, padding: '14px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Status</div>
                <StatusBadge status={drawer.status} />
              </div>
            </div>

            {/* wallet note */}
            <div style={{ padding: '10px 18px', background: '#F0FDF4', borderBottom: '1px solid #BBF7D0' }}>
              <div style={{ fontSize: 11, color: '#166534', lineHeight: 1.5 }}>
                {drawer.status === 'PAID'
                  ? `✅ Payment confirmed on ${fmtDate(drawer.payout_date)}. Wallet was credited at this point.`
                  : drawer.status === 'APPROVED'
                  ? '💼 Approved — wallet will be credited when admin clicks "Confirm Payment".'
                  : '⏳ Pending admin review. Wallet is NOT credited yet — approve first, then confirm payment.'}
              </div>
            </div>

            {/* detail rows */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
              {[
                { label: 'Technician', value: `${drawer.technician_name || '—'}${drawer.technician_code ? ` (#${drawer.technician_code})` : ''}` },
                { label: 'Item Type', value: drawer.item_type || '—' },
                { label: 'Item Name', value: drawer.item_name || '—' },
                { label: 'Quantity', value: String(drawer.item_quantity || 1) },
                { label: 'Part Source', value: drawer.part_source?.replace('_', ' ') || '—' },
                { label: 'Booking ID', value: drawer.booking_id || '—', mono: true },
                { label: 'Payout Date', value: fmtDate(drawer.payout_date) },
                { label: 'Created', value: fmtDate(drawer.created_at) },
                { label: 'Notes', value: drawer.notes || '—' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid #F8FAFC', gap: 12 }}>
                  <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600, whiteSpace: 'nowrap' }}>{row.label}</span>
                  <span style={{
                    fontSize: 12, color: '#0F172A', fontWeight: 500, textAlign: 'right',
                    fontFamily: (row as any).mono ? 'monospace' : 'inherit', wordBreak: 'break-all',
                  }}>{row.value}</span>
                </div>
              ))}
            </div>

            {/* drawer footer actions */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: 10 }}>
              {(drawer.status === 'PENDING' || drawer.status === 'APPROVED') && (
                <button
                  onClick={() => { setPayModal(drawer); setDrawer(null) }}
                  style={{ padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, background: '#15803D', color: '#fff' }}
                >₹ Pay</button>
              )}
              <button className="btn btn-secondary" onClick={() => setDrawer(null)}>Close</button>
            </div>
          </div>
        </>
      )}

      {/* ══════════ APPROVE MODAL ══════════ */}
      {approveModal && (
        <Modal title="Approve Commission" onClose={() => setApproveModal(null)}>
          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: '#64748B', marginBottom: 4 }}>Commission Amount</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#15803D' }}>{fmt(approveModal.commission_amount)}</div>
            <div style={{ fontSize: 12, color: '#475569', marginTop: 5 }}>
              {approveModal.technician_name || 'Unknown technician'}
              {approveModal.technician_code ? ` · #${approveModal.technician_code}` : ''}
            </div>
            <div style={{ fontSize: 12, color: '#475569' }}>
              {approveModal.item_type} · {approveModal.item_name || '—'}
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Notes (optional)</label>
            <input
              className="input"
              value={approveNotes}
              onChange={e => setApproveNotes(e.target.value)}
              placeholder="Add approval notes…"
            />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" onClick={doApprove} disabled={saving}>
              {saving ? <Spinner size="sm" /> : 'Confirm Approve'}
            </button>
            <button className="btn btn-secondary" onClick={() => setApproveModal(null)}>Cancel</button>
          </div>
        </Modal>
      )}

      {/* ══════════ MARK PAID MODAL ══════════ */}
      {payModal && (
        <Modal title="Pay Commission" onClose={() => setPayModal(null)}>
          <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '12px 16px', marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: '#64748B', marginBottom: 4 }}>Commission</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#1D4ED8' }}>{fmt(payModal.commission_amount)}</div>
            <div style={{ fontSize: 12, color: '#475569', marginTop: 5 }}>
              {payModal.technician_name || 'Unknown'}{payModal.technician_code ? ` · #${payModal.technician_code}` : ''} · {payModal.item_type} · {payModal.item_name || '—'}
            </div>
          </div>

          {/* wallet context explanation */}
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#B45309', marginBottom: 4 }}>ℹ️ What happens when you click confirm:</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#78350F', lineHeight: 1.8 }}>
              <li>Commission status changes from <b>APPROVED → PAID</b></li>
              <li>Payout date is recorded as <b>now</b></li>
              <li><b>Technician wallet is credited NOW</b> — this is when the money enters the wallet</li>
              <li>Technician can request a withdrawal after this step</li>
            </ul>
          </div>

          <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 16 }}>
            This is the step that releases commission into the technician's wallet. After this, they can see the updated balance and request a withdrawal.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={doPay}
              disabled={saving}
              style={{ padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, background: '#15803D', color: '#fff', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? <Spinner size="sm" /> : 'Confirm — Mark Paid'}
            </button>
            <button className="btn btn-secondary" onClick={() => setPayModal(null)}>Cancel</button>
          </div>
        </Modal>
      )}

      {/* ══════════ BULK ACTION MODAL ══════════ */}
      {bulkAction && (
        <Modal
          title={`Pay ${pendingSelected + approvedSelected} Commissions`}
          onClose={() => setBulkAction(null)}
        >
          <div style={{
            background: '#F0FDF4',
            border: '1px solid #BBF7D0',
            borderRadius: 8, padding: '12px 16px', marginBottom: 14,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>
              {pendingSelected + approvedSelected} commission{(pendingSelected + approvedSelected) !== 1 ? 's' : ''} will be paid out
            </div>
            <div style={{ fontSize: 12, color: '#64748B' }}>
              {selected.size} rows selected · {pendingSelected} PENDING (auto-approved) + {approvedSelected} APPROVED
            </div>
          </div>

          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: '#78350F', lineHeight: 1.7 }}>
              <b>This will credit the wallet</b> for each selected commission. PENDING ones are auto-approved first. Technicians will see their balance update and can request withdrawal.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button className="btn btn-primary" onClick={doBulk} disabled={saving}>
              {saving ? <Spinner size="sm" /> : 'Confirm'}
            </button>
            <button className="btn btn-secondary" onClick={() => setBulkAction(null)}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
