import { useEffect, useState, useCallback } from 'react'
import { walletAPI } from '@/services/api'
import PageHeader from '@/components/layout/PageHeader'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'
import StatusBadge from '@/components/ui/StatusBadge'

/* ─── helpers ─────────────────────────────────────────────── */
const fmt = (n: number) =>
  `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtDate = (iso: string) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

const txnColor: Record<string, string> = {
  CREDIT: '#059669',
  DEBIT:  '#DC2626',
  WITHDRAWAL: '#D97706',
  REFUND: '#1B4FD8',
}

/* ─── StatCard ────────────────────────────────────────────── */
function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '18px 22px',
      border: '1px solid #E2E8F0', flex: 1, minWidth: 160,
    }}>
      <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || '#0F172A' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

/* ─── TransactionBadge ───────────────────────────────────── */
function TxnBadge({ type }: { type: string }) {
  const c = txnColor[type] || '#64748B'
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
      background: c + '18', color: c, letterSpacing: 0.4,
    }}>{type}</span>
  )
}

/* ═══════════════════════════════════════════════════════════ */
export default function Wallet() {
  /* list state */
  const [wallets, setWallets]       = useState<any[]>([])
  const [summary, setSummary]       = useState<any>({})
  const [loading, setLoading]       = useState(true)
  const [page, setPage]             = useState(1)
  const [pages, setPages]           = useState(1)
  const [total, setTotal]           = useState(0)
  const [search, setSearch]         = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [sortBy, setSortBy]         = useState('balance')
  const [sortDir, setSortDir]       = useState<'asc'|'desc'>('desc')

  /* detail drawer state */
  const [drawer, setDrawer]         = useState<any>(null)   // wallet object
  const [txns, setTxns]             = useState<any[]>([])
  const [txnPage, setTxnPage]       = useState(1)
  const [txnPages, setTxnPages]     = useState(1)
  const [txnTotal, setTxnTotal]     = useState(0)
  const [txnFilter, setTxnFilter]   = useState('')
  const [txnLoading, setTxnLoading] = useState(false)

  /* modals */
  const [creditModal, setCreditModal] = useState(false)
  const [debitModal,  setDebitModal]  = useState<any>(null) // wallet object
  const [form,  setForm]  = useState({ user_id: '', technician_id: '', amount: 0, description: '', reference_id: '' })
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')

  /* ── fetch list ── */
  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const r = await walletAPI.all({ page, per_page: 15, search: search || undefined, sort_by: sortBy, sort_dir: sortDir })
      const d = r.data.data
      setWallets(d.items || [])
      setPages(d.pages || 1)
      setTotal(d.total || 0)
      setSummary(d.summary || {})
    } catch { setWallets([]) } finally { setLoading(false) }
  }, [page, search, sortBy, sortDir])

  useEffect(() => { fetchAll() }, [fetchAll])

  /* ── fetch transactions for drawer ── */
  const fetchTxns = useCallback(async (w: any, pg = 1, filter = '') => {
    if (!w) return
    setTxnLoading(true)
    try {
      const r = await walletAPI.transactions(w.id, { page: pg, per_page: 15, txn_type: filter || undefined })
      const d = r.data.data
      setTxns(d.items || [])
      setTxnPages(d.pages || 1)
      setTxnTotal(d.total || 0)
    } catch { setTxns([]) } finally { setTxnLoading(false) }
  }, [])

  const openDrawer = (w: any) => {
    setDrawer(w); setTxnPage(1); setTxnFilter(''); fetchTxns(w, 1, '')
  }

  useEffect(() => {
    if (drawer) fetchTxns(drawer, txnPage, txnFilter)
  }, [txnPage, txnFilter])

  /* ── credit submit ── */
  const handleCredit = async (e: any) => {
    e.preventDefault(); setSaving(true); setErr('')
    try {
      await walletAPI.credit({
        user_id: form.user_id || undefined,
        technician_id: form.technician_id || undefined,
        amount: form.amount,
        description: form.description || undefined,
        reference_id: form.reference_id || undefined,
      })
      setCreditModal(false)
      setForm({ user_id: '', technician_id: '', amount: 0, description: '', reference_id: '' })
      fetchAll()
    } catch (ex: any) { setErr(ex.response?.data?.detail || 'Failed to credit') } finally { setSaving(false) }
  }

  /* ── debit submit ── */
  const handleDebit = async (e: any) => {
    e.preventDefault(); setSaving(true); setErr('')
    try {
      await walletAPI.debit({ wallet_id: debitModal.id, amount: Number(form.amount), description: form.description || undefined })
      setDebitModal(null)
      setForm({ user_id: '', technician_id: '', amount: 0, description: '', reference_id: '' })
      fetchAll()
      if (drawer?.id === debitModal.id) fetchTxns(drawer, txnPage, txnFilter)
    } catch (ex: any) { setErr(ex.response?.data?.detail || 'Failed to debit') } finally { setSaving(false) }
  }

  /* ── sort helper ── */
  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortBy(col); setSortDir('desc') }
  }
  const SortIcon = ({ col }: { col: string }) => (
    <span style={{ marginLeft: 4, opacity: sortBy === col ? 1 : 0.3, fontSize: 10 }}>
      {sortBy === col ? (sortDir === 'desc' ? '▼' : '▲') : '⇅'}
    </span>
  )

  /* ══════════════ RENDER ══════════════ */
  return (
    <div style={{ padding: '24px 28px', position: 'relative' }}>

      {/* ── Header ── */}
      <PageHeader
        title="Wallet Management"
        subtitle={`${total} wallet accounts`}
        actions={
          <button className="btn btn-primary" onClick={() => { setErr(''); setForm({ user_id: '', technician_id: '', amount: 0, description: '', reference_id: '' }); setCreditModal(true) }}>
            + Credit Wallet
          </button>
        }
      />

      {/* ── Summary Cards ── */}
      <div style={{ display: 'flex', gap: 14, marginTop: 20, flexWrap: 'wrap' }}>
        <StatCard label="Total Wallets"     value={String(summary.wallet_count || 0)} />
        <StatCard label="Total Balance"     value={fmt(summary.total_balance)}    color="#1B4FD8" />
        <StatCard label="Total Credited"    value={fmt(summary.total_earned)}     color="#059669" />
        <StatCard label="Total Withdrawn"   value={fmt(summary.total_withdrawn)}  color="#DC2626" />
      </div>

      {/* ── Search + Sort toolbar ── */}
      <div style={{ display: 'flex', gap: 10, marginTop: 18, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: 14 }}>🔍</span>
          <input
            className="input"
            style={{ paddingLeft: 32, width: '100%' }}
            placeholder="Search by name, code…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1) } }}
          />
        </div>
        {searchInput && (
          <button className="btn btn-secondary" onClick={() => { setSearch(''); setSearchInput(''); setPage(1) }}>Clear</button>
        )}
        <select
          className="input"
          style={{ width: 'auto', minWidth: 160 }}
          value={`${sortBy}:${sortDir}`}
          onChange={e => { const [col, dir] = e.target.value.split(':'); setSortBy(col); setSortDir(dir as any); setPage(1) }}
        >
          <option value="balance:desc">Balance (High → Low)</option>
          <option value="balance:asc">Balance (Low → High)</option>
          <option value="total_earned:desc">Most Credited</option>
          <option value="total_withdrawn:desc">Most Withdrawn</option>
          <option value="updated_at:desc">Recently Updated</option>
        </select>
      </div>

      {/* ── Main Table ── */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading
          ? <div style={{ padding: 60, textAlign: 'center' }}><Spinner /></div>
          : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Owner</th>
                  <th onClick={() => toggleSort('balance')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Balance ₹<SortIcon col="balance" />
                  </th>
                  <th onClick={() => toggleSort('total_earned')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Credited ₹<SortIcon col="total_earned" />
                  </th>
                  <th onClick={() => toggleSort('total_withdrawn')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Withdrawn ₹<SortIcon col="total_withdrawn" />
                  </th>
                  <th onClick={() => toggleSort('updated_at')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Last Updated<SortIcon col="updated_at" />
                  </th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {wallets.length === 0
                  ? <tr><td colSpan={6} style={{ textAlign: 'center', color: '#94A3B8', padding: 40 }}>No wallet records found</td></tr>
                  : wallets.map((w: any) => (
                    <tr key={w.id} style={{ cursor: 'pointer' }} onClick={() => openDrawer(w)}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0F172A', fontSize: 13 }}>
                          {w.technician_name || w.user_name || <span style={{ color: '#94A3B8' }}>Unknown</span>}
                        </div>
                        {w.technician_code && (
                          <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                            #{w.technician_code} · {w.technician_mobile || ''}
                          </div>
                        )}
                        {!w.technician_code && (w.user_id || w.technician_id) && (
                          <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#94A3B8', marginTop: 2 }}>
                            {(w.technician_id || w.user_id)?.slice(0, 16)}…
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{ fontWeight: 800, fontSize: 14, color: (w.balance || 0) >= 0 ? '#059669' : '#DC2626' }}>
                          {fmt(w.balance)}
                        </span>
                      </td>
                      <td style={{ color: '#059669', fontWeight: 600 }}>{fmt(w.total_earned)}</td>
                      <td style={{ color: '#DC2626', fontWeight: 600 }}>{fmt(w.total_withdrawn)}</td>
                      <td style={{ fontSize: 12, color: '#94A3B8' }}>{fmtDate(w.updated_at)}</td>
                      <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            title="View Transactions"
                            onClick={() => openDrawer(w)}
                          >Txns</button>
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Debit wallet"
                            onClick={() => { setErr(''); setForm({ user_id: '', technician_id: '', amount: 0, description: '', reference_id: '' }); setDebitModal(w) }}
                          >Debit</button>
                        </div>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
            <Pagination page={page} pages={pages} onPage={p => { setPage(p) }} />
          </>
        )}
      </div>

      {/* ══════════ SIDE DRAWER: Wallet Detail ══════════ */}
      {drawer && (
        <>
          {/* overlay */}
          <div
            onClick={() => setDrawer(null)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)',
              zIndex: 200, backdropFilter: 'blur(2px)',
            }}
          />
          {/* panel */}
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 520,
            background: '#fff', zIndex: 201, display: 'flex', flexDirection: 'column',
            boxShadow: '-8px 0 40px rgba(0,0,0,0.15)',
          }}>
            {/* drawer header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#0F172A' }}>
                  {drawer.technician_name || drawer.user_name || 'Wallet'}
                </div>
                {drawer.technician_code && (
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 3 }}>
                    Code: #{drawer.technician_code}
                    {drawer.technician_mobile ? ` · ${drawer.technician_mobile}` : ''}
                  </div>
                )}
                <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#94A3B8', marginTop: 2 }}>{drawer.id}</div>
              </div>
              <button
                onClick={() => setDrawer(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#64748B', padding: 4, lineHeight: 1 }}
              >✕</button>
            </div>

            {/* balance strip */}
            <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0' }}>
              {[
                { label: 'Balance',   value: fmt(drawer.balance),        color: '#1B4FD8' },
                { label: 'Credited',  value: fmt(drawer.total_earned),   color: '#059669' },
                { label: 'Withdrawn', value: fmt(drawer.total_withdrawn), color: '#DC2626' },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, padding: '14px 12px', borderRight: '1px solid #E2E8F0', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* quick action in drawer */}
            <div style={{ padding: '12px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', gap: 8 }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => { setErr(''); setForm({ user_id: drawer.user_id || '', technician_id: drawer.technician_id || '', amount: 0, description: '', reference_id: '' }); setCreditModal(true) }}
              >+ Credit</button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { setErr(''); setForm({ user_id: '', technician_id: '', amount: 0, description: '', reference_id: '' }); setDebitModal(drawer) }}
              >− Debit</button>
            </div>

            {/* txn filter */}
            <div style={{ padding: '12px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['', 'CREDIT', 'DEBIT', 'WITHDRAWAL', 'REFUND'].map(t => (
                <button
                  key={t}
                  onClick={() => { setTxnFilter(t); setTxnPage(1) }}
                  style={{
                    padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                    fontSize: 11, fontWeight: 600,
                    background: txnFilter === t ? '#1B4FD8' : '#F1F5F9',
                    color: txnFilter === t ? '#fff' : '#475569',
                  }}
                >{t || 'All'}</button>
              ))}
              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94A3B8', alignSelf: 'center' }}>{txnTotal} transactions</span>
            </div>

            {/* txn list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 12px' }}>
              {txnLoading
                ? <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
                : txns.length === 0
                  ? <div style={{ textAlign: 'center', color: '#94A3B8', padding: 40, fontSize: 13 }}>No transactions found</div>
                  : txns.map((t: any) => (
                    <div key={t.id} style={{
                      padding: '14px 24px', borderBottom: '1px solid #F1F5F9',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <TxnBadge type={t.type} />
                          {t.status && t.status !== 'SUCCESS' && <StatusBadge status={t.status} />}
                        </div>
                        <div style={{ fontSize: 12, color: '#475569', marginBottom: 2 }}>{t.description || '—'}</div>
                        {t.reference_id && (
                          <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>Ref: {t.reference_id}</div>
                        )}
                        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>{fmtDate(t.created_at)}</div>
                      </div>
                      <div style={{ textAlign: 'right', minWidth: 110 }}>
                        <div style={{
                          fontWeight: 800, fontSize: 14,
                          color: t.type === 'CREDIT' || t.type === 'REFUND' ? '#059669' : '#DC2626',
                        }}>
                          {t.type === 'CREDIT' || t.type === 'REFUND' ? '+' : '−'}{fmt(t.amount)}
                        </div>
                        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>After: {fmt(t.balance_after)}</div>
                      </div>
                    </div>
                  ))
              }
            </div>

            {/* txn pagination */}
            {txnPages > 1 && (
              <div style={{ borderTop: '1px solid #E2E8F0', padding: '8px 12px' }}>
                <Pagination page={txnPage} pages={txnPages} onPage={p => setTxnPage(p)} />
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════ CREDIT MODAL ══════════ */}
      {creditModal && (
        <Modal title="Credit Wallet" onClose={() => setCreditModal(false)}>
          <form onSubmit={handleCredit}>
            <p style={{ fontSize: 12, color: '#64748B', marginBottom: 14 }}>
              Provide either a <b>User ID</b> or a <b>Technician ID</b>. A new wallet will be created automatically if none exists.
            </p>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Technician ID (UUID)</label>
              <input className="input" value={form.technician_id}
                onChange={e => setForm(f => ({ ...f, technician_id: e.target.value }))}
                placeholder="Leave blank if crediting a user" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>User ID (UUID)</label>
              <input className="input" value={form.user_id}
                onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))}
                placeholder="Leave blank if crediting a technician" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Amount ₹ *</label>
              <input className="input" type="number" min={0.01} step={0.01} value={form.amount || ''}
                onChange={e => setForm(f => ({ ...f, amount: +e.target.value }))} required />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Description</label>
              <input className="input" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Reason for credit" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Reference ID</label>
              <input className="input" value={form.reference_id}
                onChange={e => setForm(f => ({ ...f, reference_id: e.target.value }))}
                placeholder="Booking ID, invoice no, etc." />
            </div>
            {err && <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 12 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? <Spinner size="sm" /> : 'Credit'}</button>
              <button className="btn btn-secondary" type="button" onClick={() => setCreditModal(false)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ══════════ DEBIT MODAL ══════════ */}
      {debitModal && (
        <Modal title={`Debit Wallet — ${debitModal.technician_name || debitModal.user_name || 'Unknown'}`} onClose={() => setDebitModal(null)}>
          <form onSubmit={handleDebit}>
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Current Balance</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#DC2626' }}>{fmt(debitModal.balance)}</div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Amount to Debit ₹ *</label>
              <input className="input" type="number" min={0.01} max={debitModal.balance} step={0.01} value={form.amount || ''}
                onChange={e => setForm(f => ({ ...f, amount: +e.target.value }))} required />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Reason *</label>
              <input className="input" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Reason for debit" required />
            </div>
            {err && <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 12 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" type="submit" disabled={saving}
                style={{ background: '#DC2626', color: '#fff', borderRadius: 8, padding: '8px 20px', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                {saving ? <Spinner size="sm" /> : 'Debit'}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => setDebitModal(null)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
