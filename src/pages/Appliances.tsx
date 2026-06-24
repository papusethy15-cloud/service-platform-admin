/**
 * Appliances — Admin Page
 * Tabs: Appliances | Brands | Types | Categories
 *
 * Key fix: filter bar is now in a proper grid row (no wrapping).
 * Brands now carry category_ids[] so the Brand modal has a multi-select
 * category picker (LG → AC, Refrigerator, Washing Machine…).
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { appliancesAPI, customersAPI } from '@/services/api'
import PageHeader from '@/components/layout/PageHeader'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'

// ─── Types ────────────────────────────────────────────────────────────────
type AppCat  = { id: string; name: string; icon?: string; description?: string }
type Brand   = {
  id: string; name: string; logo_url?: string; is_active: boolean
  category_ids: string[]; category_names: string[]
}
type AppType = {
  id: string; name: string; appliance_category_id?: string; category_name?: string
  brand_id?: string; brand_name?: string; is_active: boolean
}
type Appliance = {
  id: string; customer_id: string; customer_name?: string; customer_mobile?: string
  brand_id?: string; brand_name?: string
  type_id?: string; type_name?: string; appliance_category_id?: string; category_name?: string
  category?: string; model?: string; serial_number?: string
  purchase_date?: string; installation_date?: string; warranty_expiry?: string
  status: string; is_under_warranty: boolean; notes?: string; image_url?: string
  is_active: boolean; created_at: string
}

const STATUSES   = ['ACTIVE', 'UNDER_REPAIR', 'SCRAPPED', 'SOLD', 'INACTIVE']
const STATUS_CLR: Record<string, { bg: string; color: string }> = {
  ACTIVE:       { bg: '#DCFCE7', color: '#166534' },
  UNDER_REPAIR: { bg: '#FEF3C7', color: '#92400E' },
  SCRAPPED:     { bg: '#FEE2E2', color: '#991B1B' },
  SOLD:         { bg: '#EDE9FE', color: '#5B21B6' },
  INACTIVE:     { bg: '#F1F5F9', color: '#64748B' },
}

// ── Inline customer search ────────────────────────────────────────────────
function CustomerPicker({ onChange }: { onChange: (id: string, label: string) => void }) {
  const [q, setQ]         = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen]   = useState(false)
  const [picked, setPicked] = useState('')
  const timer = useRef<any>(null)
  const wrap  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const search = async (val: string) => {
    if (val.length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const r = await customersAPI.list({ search: val, per_page: 20 })
      const d = r.data.data
      setResults(Array.isArray(d) ? d : (d?.items || []))
    } catch { setResults([]) } finally { setLoading(false) }
  }

  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQ(e.target.value); setOpen(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => search(e.target.value), 300)
  }

  const pick = (c: any) => {
    const lbl = `${c.name} — ${c.mobile || c.phone || ''}`
    setPicked(lbl); setQ(''); setOpen(false); setResults([])
    onChange(c.id, lbl)
  }

  if (picked) return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
      border: '1.5px solid #1B4FD8', borderRadius: 8, background: '#EFF6FF'
    }}>
      <span>👤</span>
      <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#1B4FD8' }}>{picked}</span>
      <button type="button" onClick={() => { setPicked(''); onChange('', '') }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 18 }}>✕</button>
    </div>
  )

  return (
    <div ref={wrap} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}>🔍</span>
        <input className="input" style={{ paddingLeft: 32 }} value={q} onChange={onInput}
          onFocus={() => q.length >= 2 && setOpen(true)}
          placeholder="Type customer name or mobile…" autoComplete="off" />
        {loading && (
          <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
            <Spinner size="sm" />
          </span>
        )}
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: '110%', left: 0, right: 0, zIndex: 1000,
          background: 'white', borderRadius: 10, border: '1px solid #E2E8F0',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 200, overflowY: 'auto'
        }}>
          {q.length < 2
            ? <div style={{ padding: '12px 14px', fontSize: 13, color: '#94A3B8' }}>Type at least 2 chars…</div>
            : results.length === 0 && !loading
              ? <div style={{ padding: '12px 14px', fontSize: 13, color: '#94A3B8' }}>No customers found</div>
              : results.map(c => (
                <div key={c.id} onClick={() => pick(c)} style={{
                  padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9',
                  display: 'flex', gap: 10, alignItems: 'center'
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, background: '#EFF6FF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700, color: '#1B4FD8', flexShrink: 0
                  }}>{c.name?.[0]?.toUpperCase()}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: '#64748B' }}>{c.mobile || c.phone}{c.email ? ` · ${c.email}` : ''}</div>
                  </div>
                </div>
              ))}
        </div>
      )}
    </div>
  )
}

// ── Category multi-select chip picker ─────────────────────────────────────
function CategoryChipPicker({
  categories, selected, onChange
}: {
  categories: AppCat[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  }
  return (
    <div>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 12px',
        border: '1px solid #E2E8F0', borderRadius: 8, minHeight: 46, background: '#FAFAFA'
      }}>
        {categories.length === 0
          ? <span style={{ fontSize: 12, color: '#94A3B8', alignSelf: 'center' }}>No categories found</span>
          : categories.map(c => {
            const active = selected.includes(c.id)
            return (
              <button key={c.id} type="button" onClick={() => toggle(c.id)} style={{
                padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${active ? '#1B4FD8' : '#E2E8F0'}`,
                background: active ? '#1B4FD8' : 'white', color: active ? 'white' : '#374151',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                transition: 'all 0.15s'
              }}>
                {c.icon && <span>{c.icon}</span>}
                {c.name}
                {active && <span style={{ opacity: 0.8 }}>✓</span>}
              </button>
            )
          })}
      </div>
      {selected.length > 0 && (
        <div style={{ fontSize: 11, color: '#059669', marginTop: 4 }}>
          ✓ {selected.length} categor{selected.length === 1 ? 'y' : 'ies'} selected
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────
type TabName = 'Appliances' | 'Brands' | 'Types' | 'Categories'

export default function Appliances() {
  const [tab, setTab] = useState<TabName>('Appliances')

  const [categories, setCategories] = useState<AppCat[]>([])
  const [brands, setBrands]         = useState<Brand[]>([])
  const [types, setTypes]           = useState<AppType[]>([])

  const [appliances, setAppliances] = useState<Appliance[]>([])
  const [loading, setLoading]       = useState(true)
  const [page, setPage]             = useState(1)
  const [pages, setPages]           = useState(1)
  const [total, setTotal]           = useState(0)
  const [search, setSearch]         = useState('')
  const [catFilter, setCatFilter]   = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [brandFilter, setBrandFilter]   = useState('')

  // Detail panel
  const [selected, setSelected]     = useState<Appliance | null>(null)
  const [history, setHistory]       = useState<any[]>([])
  const [warranty, setWarranty]     = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailTab, setDetailTab]   = useState<'info' | 'history' | 'warranty'>('info')

  // Appliance modal
  const [appModal, setAppModal]     = useState<Appliance | 'new' | null>(null)
  const [appForm, setAppForm]       = useState<any>({})
  const [appCustId, setAppCustId]   = useState('')
  const [appErr, setAppErr]         = useState('')
  const [appSaving, setAppSaving]   = useState(false)
  const filteredTypes = appForm.appliance_category_id
    ? types.filter(t => t.appliance_category_id === appForm.appliance_category_id)
    : types

  // Brand modal
  const [brandModal, setBrandModal]   = useState<Brand | 'new' | null>(null)
  const [brandForm, setBrandForm]     = useState({ name: '', logo_url: '', category_ids: [] as string[] })
  const [brandErr, setBrandErr]       = useState('')
  const [brandSaving, setBrandSaving] = useState(false)

  // Type modal
  const [typeModal, setTypeModal]     = useState<AppType | 'new' | null>(null)
  const [typeForm, setTypeForm]       = useState({ name: '', appliance_category_id: '', brand_id: '' })
  const [typeErr, setTypeErr]         = useState('')
  const [typeSaving, setTypeSaving]   = useState(false)

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const loadCatalogue = useCallback(async () => {
    try {
      const [cRes, bRes, tRes] = await Promise.all([
        appliancesAPI.categories(),
        appliancesAPI.brands(),
        appliancesAPI.types(),
      ])
      setCategories(cRes.data.data || [])
      setBrands(bRes.data.data || [])
      setTypes(tRes.data.data || [])
    } catch {}
  }, [])

  const loadAppliances = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const r = await appliancesAPI.list({
        page: p, per_page: 20,
        search:                search || undefined,
        appliance_category_id: catFilter || undefined,
        brand_id:              brandFilter || undefined,
        status:                statusFilter || undefined,
      })
      const d = r.data.data
      setAppliances(Array.isArray(d) ? d : (d?.items || []))
      setTotal(d?.total || 0)
      setPages(d?.pages || 1)
    } catch { setAppliances([]) } finally { setLoading(false) }
  }, [search, catFilter, brandFilter, statusFilter])

  useEffect(() => { loadCatalogue() }, [])
  useEffect(() => { loadAppliances(1); setPage(1) }, [search, catFilter, brandFilter, statusFilter])

  // ── Detail panel ──────────────────────────────────────────────────────────
  const openDetail = async (a: Appliance) => {
    setSelected(a); setDetailTab('info')
    setDetailLoading(true)
    try {
      const [hRes, wRes] = await Promise.all([
        appliancesAPI.history(a.id).catch(() => ({ data: { data: { items: [] } } })),
        appliancesAPI.warranty(a.id).catch(() => ({ data: { data: null } })),
      ])
      setHistory(hRes.data.data?.items || [])
      setWarranty(wRes.data.data)
    } catch {} finally { setDetailLoading(false) }
  }

  // ── Appliance save ────────────────────────────────────────────────────────
  const saveAppliance = async (e: any) => {
    e.preventDefault(); setAppSaving(true); setAppErr('')
    const custId = appModal === 'new' ? appCustId : (appModal as Appliance).customer_id
    if (appModal === 'new' && !custId) {
      setAppErr('Please select a customer first.'); setAppSaving(false); return
    }
    const payload: any = { ...appForm, customer_id: custId }
    Object.keys(payload).forEach(k => { if (payload[k] === '') delete payload[k] })
    try {
      if (appModal === 'new') await appliancesAPI.add(payload)
      else {
        const { customer_id: _, ...upd } = payload
        await appliancesAPI.update((appModal as Appliance).id, upd)
      }
      setAppModal(null); loadAppliances(page)
    } catch (ex: any) {
      setAppErr(ex.response?.data?.detail || 'Save failed')
    } finally { setAppSaving(false) }
  }

  const updateStatus = async (a: Appliance, status: string) => {
    try {
      await appliancesAPI.update(a.id, { status })
      loadAppliances(page)
      if (selected?.id === a.id) setSelected({ ...a, status })
    } catch {}
  }

  // ── Brand save ────────────────────────────────────────────────────────────
  const saveBrand = async (e: any) => {
    e.preventDefault()
    if (!brandForm.name.trim()) { setBrandErr('Brand name is required'); return }
    setBrandSaving(true); setBrandErr('')
    try {
      const payload = {
        name:         brandForm.name.trim(),
        logo_url:     brandForm.logo_url || undefined,
        category_ids: brandForm.category_ids,
      }
      if (brandModal === 'new') await appliancesAPI.createBrand(payload)
      else await appliancesAPI.updateBrand((brandModal as Brand).id, payload)
      setBrandModal(null); loadCatalogue()
    } catch (ex: any) {
      setBrandErr(ex.response?.data?.detail || 'Failed to save brand')
    } finally { setBrandSaving(false) }
  }

  // ── Type save ─────────────────────────────────────────────────────────────
  const saveType = async (e: any) => {
    e.preventDefault()
    if (!typeForm.name.trim()) { setTypeErr('Type name is required'); return }
    setTypeSaving(true); setTypeErr('')
    try {
      const payload = {
        name:                  typeForm.name.trim(),
        appliance_category_id: typeForm.appliance_category_id || undefined,
        brand_id:              typeForm.brand_id || undefined,
      }
      if (typeModal === 'new') await appliancesAPI.createType(payload)
      else await appliancesAPI.updateType((typeModal as AppType).id, payload)
      setTypeModal(null); loadCatalogue()
    } catch (ex: any) {
      setTypeErr(ex.response?.data?.detail || 'Failed to save type')
    } finally { setTypeSaving(false) }
  }

  // ── Style helpers ─────────────────────────────────────────────────────────
  const tabBtn = (t: TabName) => ({
    padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: 600,
    background: tab === t ? '#1B4FD8' : '#F1F5F9',
    color: tab === t ? '#fff' : '#334155',
    transition: 'all 0.15s',
  })

  const catIcon = (id?: string) => categories.find(c => c.id === id)?.icon || '🔧'
  const catName = (id?: string) => categories.find(c => c.id === id)?.name || ''

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader
        title="Appliances"
        subtitle={`${total} registered customer appliances`}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setTab('Brands')}>🏷️ Brands</button>
            <button className="btn btn-secondary" onClick={() => setTab('Types')}>📋 Types</button>
            <button className="btn btn-primary" onClick={() => {
              setAppForm({ appliance_category_id: '', brand_id: '', type_id: '', model: '', serial_number: '', purchase_date: '', installation_date: '', warranty_expiry: '', notes: '', image_url: '' })
              setAppCustId(''); setAppErr(''); setAppModal('new')
            }}>+ Register Appliance</button>
          </div>
        }
      />

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
        {(['Appliances', 'Brands', 'Types', 'Categories'] as TabName[]).map(t =>
          <button key={t} style={tabBtn(t)} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      {/* ══════════════ APPLIANCES TAB ══════════════ */}
      {tab === 'Appliances' && (
        <>
          {/* Filter bar — fixed single row grid */}
          <div className="card" style={{
            padding: '12px 16px', marginBottom: 14,
            display: 'grid',
            gridTemplateColumns: '1fr 180px 170px 160px auto',
            gap: 10, alignItems: 'center'
          }}>
            <input className="input" placeholder="🔍 Search model, serial…"
              value={search} onChange={e => setSearch(e.target.value)} />
            <select className="input" value={catFilter} onChange={e => { setCatFilter(e.target.value); setPage(1) }}>
              <option value="">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
            <select className="input" value={brandFilter} onChange={e => { setBrandFilter(e.target.value); setPage(1) }}>
              <option value="">All Brands</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
            <span style={{ fontSize: 12, color: '#94A3B8', whiteSpace: 'nowrap' }}>{total} records</span>
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            {/* Table */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {loading ? <div style={{ padding: 48, textAlign: 'center' }}><Spinner /></div> : (
                <div className="card">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: 44, textAlign: 'center' }}>#</th>
                        <th>Customer</th>
                        <th>Appliance</th>
                        <th>Serial No.</th>
                        <th>Category</th>
                        <th>Warranty</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {appliances.length === 0
                        ? <tr><td colSpan={8} style={{ textAlign: 'center', color: '#94A3B8', padding: 48 }}>No appliances found</td></tr>
                        : appliances.map(a => {
                          const sc = STATUS_CLR[a.status] || STATUS_CLR.INACTIVE
                          return (
                            <tr key={a.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(a)}>
                              <td style={{ textAlign: 'center', color: '#94A3B8', fontSize: 12 }}>
                                {(page - 1) * 20 + appliances.indexOf(a) + 1}
                              </td>
                              <td onClick={e => e.stopPropagation()}>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{a.customer_name || '—'}</div>
                                <div style={{ fontSize: 11, color: '#64748B' }}>{a.customer_mobile || ''}</div>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                  <span style={{ fontSize: 22 }}>{catIcon(a.appliance_category_id)}</span>
                                  <div>
                                    <div style={{ fontWeight: 600, fontSize: 14 }}>{a.brand_name || '—'} {a.model || ''}</div>
                                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{a.type_name || a.category || '—'}</div>
                                  </div>
                                </div>
                              </td>
                              <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748B' }}>{a.serial_number || '—'}</td>
                              <td>
                                {a.category_name
                                  ? <span style={{ fontSize: 11, background: '#EFF6FF', color: '#1B4FD8', padding: '2px 8px', borderRadius: 20 }}>{a.category_name}</span>
                                  : <span style={{ color: '#CBD5E1', fontSize: 12 }}>—</span>}
                              </td>
                              <td>
                                {a.warranty_expiry
                                  ? <span style={{
                                    fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600,
                                    background: a.is_under_warranty ? '#DCFCE7' : '#FEE2E2',
                                    color: a.is_under_warranty ? '#166534' : '#991B1B'
                                  }}>{a.is_under_warranty ? '✓ Valid' : '✗ Expired'}</span>
                                  : <span style={{ fontSize: 11, color: '#94A3B8' }}>Not set</span>}
                              </td>
                              <td>
                                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: sc.bg, color: sc.color }}>
                                  {a.status.replace('_', ' ')}
                                </span>
                              </td>
                              <td onClick={e => e.stopPropagation()}>
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button className="btn btn-secondary btn-sm" onClick={() => {
                                    setAppForm({
                                      appliance_category_id: a.appliance_category_id || '',
                                      brand_id:              a.brand_id || '',
                                      type_id:               a.type_id  || '',
                                      model:                 a.model || '',
                                      serial_number:         a.serial_number || '',
                                      purchase_date:         a.purchase_date?.split('T')[0] || '',
                                      installation_date:     a.installation_date?.split('T')[0] || '',
                                      warranty_expiry:       a.warranty_expiry?.split('T')[0] || '',
                                      notes:                 a.notes || '',
                                      image_url:             a.image_url || '',
                                    })
                                    setAppCustId(a.customer_id); setAppErr(''); setAppModal(a)
                                  }}>Edit</button>
                                  <select className="input" style={{ fontSize: 11, padding: '3px 6px', width: 112 }}
                                    value={a.status} onChange={e => updateStatus(a, e.target.value)}>
                                    {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                                  </select>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                  <Pagination page={page} pages={pages} onPage={p => { setPage(p); loadAppliances(p) }} />
                </div>
              )}
            </div>

            {/* Detail panel */}
            {selected && (
              <div className="card" style={{ width: 340, flexShrink: 0 }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #F1F5F9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontSize: 30 }}>{catIcon(selected.appliance_category_id)}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{selected.brand_name} {selected.model}</div>
                        <div style={{ fontSize: 12, color: '#94A3B8' }}>{selected.category_name || selected.category}</div>
                      </div>
                    </div>
                    <button onClick={() => setSelected(null)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 20, lineHeight: 1 }}>✕</button>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(['info', 'history', 'warranty'] as const).map(t => (
                      <button key={t} onClick={() => setDetailTab(t)} style={{
                        padding: '6px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        borderBottom: `2px solid ${detailTab === t ? '#1B4FD8' : 'transparent'}`,
                        color: detailTab === t ? '#1B4FD8' : '#64748B'
                      }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
                    ))}
                  </div>
                </div>
                <div style={{ padding: 14, maxHeight: 420, overflowY: 'auto' }}>
                  {detailLoading ? <div style={{ textAlign: 'center', padding: 24 }}><Spinner /></div> : (
                    <>
                      {detailTab === 'info' && [
                        ['Category',     selected.category_name || selected.category],
                        ['Brand',        selected.brand_name],
                        ['Type',         selected.type_name],
                        ['Model',        selected.model],
                        ['Serial #',     selected.serial_number],
                        ['Purchased',    selected.purchase_date?.split('T')[0]],
                        ['Installed',    selected.installation_date?.split('T')[0]],
                        ['Warranty Exp', selected.warranty_expiry?.split('T')[0]],
                        ['Status',       selected.status?.replace('_', ' ')],
                      ].map(([l, v]) => v ? (
                        <div key={l as string} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid #F8FAFC' }}>
                          <div style={{ width: 100, fontSize: 12, fontWeight: 600, color: '#64748B', flexShrink: 0 }}>{l}</div>
                          <div style={{ fontSize: 13, color: '#0F172A' }}>{v}</div>
                        </div>
                      ) : null)}
                      {selected.notes && (
                        <div style={{ marginTop: 10, padding: '8px 10px', background: '#F8FAFC', borderRadius: 8, fontSize: 12, color: '#64748B' }}>
                          {selected.notes}
                        </div>
                      )}

                      {detailTab === 'history' && (
                        history.length === 0
                          ? <div style={{ textAlign: 'center', color: '#94A3B8', padding: 24, fontSize: 13 }}>No service history yet</div>
                          : history.map((h: any) => (
                            <div key={h.id} style={{ padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                              <div style={{ fontSize: 11, color: '#94A3B8' }}>{h.service_date?.split('T')[0]}</div>
                              {h.issue_reported && <div style={{ fontSize: 13, marginTop: 2 }}><b>Issue:</b> {h.issue_reported}</div>}
                              {h.work_done && <div style={{ fontSize: 13, color: '#059669', marginTop: 2 }}><b>Done:</b> {h.work_done}</div>}
                            </div>
                          ))
                      )}

                      {detailTab === 'warranty' && (
                        warranty
                          ? <div style={{ textAlign: 'center', padding: 24 }}>
                            <div style={{ fontSize: 48 }}>{warranty.is_valid ? '🛡️' : '⚠️'}</div>
                            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 8, color: warranty.is_valid ? '#059669' : '#DC2626' }}>
                              {warranty.status}
                            </div>
                            {warranty.warranty_expiry && (
                              <div style={{ fontSize: 13, color: '#64748B', marginTop: 6 }}>
                                Expires: {warranty.warranty_expiry.split('T')[0]}
                              </div>
                            )}
                            {warranty.days_remaining !== undefined && (
                              <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 4 }}>
                                {warranty.is_valid ? `${warranty.days_remaining} days remaining` : 'Expired'}
                              </div>
                            )}
                          </div>
                          : <div style={{ textAlign: 'center', color: '#94A3B8', padding: 24, fontSize: 13 }}>No warranty data</div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════════ BRANDS TAB ══════════════ */}
      {tab === 'Brands' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 14, color: '#64748B' }}>{brands.length} brands</span>
            <button className="btn btn-primary" onClick={() => {
              setBrandForm({ name: '', logo_url: '', category_ids: [] }); setBrandErr(''); setBrandModal('new')
            }}>+ New Brand</button>
          </div>

          {brands.length === 0
            ? <div className="card" style={{ padding: 48, textAlign: 'center', color: '#94A3B8' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🏷️</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>No brands yet</div>
              <div style={{ fontSize: 13, marginBottom: 16, maxWidth: 360, margin: '0 auto 16px' }}>
                Add brands like Samsung, LG, Daikin and link them to the appliance categories they cover.
              </div>
              <button className="btn btn-primary" onClick={() => {
                setBrandForm({ name: '', logo_url: '', category_ids: [] }); setBrandErr(''); setBrandModal('new')
              }}>+ Add First Brand</button>
            </div>
            : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
              {brands.map(b => (
                <div key={b.id} className="card" style={{ padding: 18 }}>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12, background: '#F1F5F9',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22, fontWeight: 700, color: '#1B4FD8', overflow: 'hidden'
                    }}>
                      {b.logo_url
                        ? <img src={b.logo_url} style={{ width: 36, height: 36, objectFit: 'contain' }} alt=""
                          onError={e => ((e.target as HTMLImageElement).style.display = 'none')} />
                        : b.name[0]?.toUpperCase()}
                    </div>
                    <span style={{
                      fontSize: 10, padding: '3px 9px', borderRadius: 20, fontWeight: 700,
                      background: b.is_active ? '#DCFCE7' : '#FEE2E2',
                      color: b.is_active ? '#166534' : '#991B1B'
                    }}>{b.is_active ? 'Active' : 'Inactive'}</span>
                  </div>

                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{b.name}</div>

                  {/* Category chips */}
                  <div style={{ marginBottom: 12, minHeight: 26 }}>
                    {b.category_ids.length === 0
                      ? <span style={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic' }}>No categories linked</span>
                      : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {b.category_names.map((name, i) => (
                          <span key={b.category_ids[i]} style={{
                            fontSize: 11, padding: '3px 9px', borderRadius: 20, fontWeight: 600,
                            background: '#EFF6FF', color: '#1B4FD8', display: 'flex', alignItems: 'center', gap: 3
                          }}>
                            {catIcon(b.category_ids[i])} {name}
                          </span>
                        ))}
                      </div>}
                  </div>

                  {/* Type count */}
                  <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 12 }}>
                    {types.filter(t => t.brand_id === b.id).length} types defined
                  </div>

                  <button className="btn btn-secondary btn-sm" onClick={() => {
                    setBrandForm({ name: b.name, logo_url: b.logo_url || '', category_ids: [...b.category_ids] })
                    setBrandErr(''); setBrandModal(b)
                  }}>✏️ Edit Brand</button>
                </div>
              ))}
            </div>}
        </>
      )}

      {/* ══════════════ TYPES TAB ══════════════ */}
      {tab === 'Types' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 14, color: '#64748B' }}>{types.length} types defined</span>
            <button className="btn btn-primary" onClick={() => {
              setTypeForm({ name: '', appliance_category_id: '', brand_id: '' }); setTypeErr(''); setTypeModal('new')
            }}>+ New Type</button>
          </div>
          <div className="card">
            <table className="data-table">
              <thead><tr><th>Type / Variant</th><th>Category</th><th>Brand</th><th>Actions</th></tr></thead>
              <tbody>
                {types.length === 0
                  ? <tr><td colSpan={4} style={{ textAlign: 'center', color: '#94A3B8', padding: 40 }}>No types yet — add types to link brands to categories</td></tr>
                  : types.map(t => (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 600 }}>{t.name}</td>
                      <td>
                        {t.appliance_category_id
                          ? <span style={{ fontSize: 12, background: '#EFF6FF', color: '#1B4FD8', padding: '2px 8px', borderRadius: 20 }}>
                            {catIcon(t.appliance_category_id)} {t.category_name || catName(t.appliance_category_id)}
                          </span>
                          : <span style={{ fontSize: 12, color: '#94A3B8' }}>—</span>}
                      </td>
                      <td style={{ fontSize: 13, color: '#64748B' }}>{t.brand_name || <span style={{ color: '#94A3B8' }}>Any brand</span>}</td>
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={() => {
                          setTypeForm({
                            name: t.name,
                            appliance_category_id: t.appliance_category_id || '',
                            brand_id: t.brand_id || '',
                          }); setTypeErr(''); setTypeModal(t)
                        }}>Edit</button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ══════════════ CATEGORIES TAB ══════════════ */}
      {tab === 'Categories' && (
        <>
          <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#92400E' }}>
            <b>ℹ️ Appliance Categories = Service Categories.</b> Manage them under <b>Services → Categories</b>.
            Here you can see how brands and types are distributed across categories.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {categories.length === 0
              ? <div className="card" style={{ padding: 32, textAlign: 'center', color: '#94A3B8', gridColumn: '1 / -1' }}>
                No categories. Add service categories first.
              </div>
              : categories.map(c => {
                const typeCount  = types.filter(t => t.appliance_category_id === c.id).length
                const brandCount = new Set(types.filter(t => t.appliance_category_id === c.id && t.brand_id).map(t => t.brand_id)).size
                const directBrandCount = brands.filter(b => b.category_ids.includes(c.id)).length
                return (
                  <div key={c.id} className="card" style={{ padding: 16 }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>{c.icon || '📦'}</div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{c.name}</div>
                    {c.description && <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 8 }}>{c.description}</div>}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      <span style={{ fontSize: 11, background: '#EFF6FF', color: '#1B4FD8', padding: '2px 8px', borderRadius: 20 }}>{directBrandCount} brands</span>
                      <span style={{ fontSize: 11, background: '#F0FDF4', color: '#166534', padding: '2px 8px', borderRadius: 20 }}>{typeCount} types</span>
                    </div>
                  </div>
                )
              })}
          </div>
        </>
      )}

      {/* ══════════════════ MODALS ══════════════════ */}

      {/* Register / Edit Appliance */}
      {appModal && (
        <Modal title={appModal === 'new' ? '📱 Register Appliance' : '✏️ Edit Appliance'} onClose={() => setAppModal(null)} size="lg">
          <form onSubmit={saveAppliance}>
            {appModal === 'new' && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                  Customer <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <CustomerPicker onChange={id => setAppCustId(id)} />
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Category</label>
                <select className="input" value={appForm.appliance_category_id}
                  onChange={e => setAppForm((f: any) => ({ ...f, appliance_category_id: e.target.value, type_id: '' }))}>
                  <option value="">Select category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Brand</label>
                <select className="input" value={appForm.brand_id}
                  onChange={e => setAppForm((f: any) => ({ ...f, brand_id: e.target.value, type_id: '' }))}>
                  <option value="">Select brand</option>
                  {(appForm.appliance_category_id
                    ? brands.filter(b => b.category_ids.includes(appForm.appliance_category_id))
                    : brands
                  ).filter(b => b.is_active).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                {appForm.appliance_category_id && brands.filter(b => b.category_ids.includes(appForm.appliance_category_id) && b.is_active).length === 0 && (
                  <div style={{ fontSize: 11, color: '#F59E0B', marginTop: 3 }}>
                    ⚠️ No brands linked to this category —{' '}
                    <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1B4FD8', fontSize: 11, padding: 0 }}
                      onClick={() => { setAppModal(null); setTab('Brands') }}>manage brands</button>
                  </div>
                )}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Type / Variant</label>
                <select className="input" value={appForm.type_id}
                  onChange={e => setAppForm((f: any) => ({ ...f, type_id: e.target.value }))}>
                  <option value="">Select type</option>
                  {filteredTypes.map(t => <option key={t.id} value={t.id}>{t.name}{t.brand_name ? ` (${t.brand_name})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Model Name</label>
                <input className="input" value={appForm.model}
                  onChange={e => setAppForm((f: any) => ({ ...f, model: e.target.value }))} placeholder="e.g. 1.5 Ton 5 Star" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Serial Number</label>
                <input className="input" value={appForm.serial_number}
                  onChange={e => setAppForm((f: any) => ({ ...f, serial_number: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Purchase Date</label>
                <input className="input" type="date" value={appForm.purchase_date}
                  onChange={e => setAppForm((f: any) => ({ ...f, purchase_date: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Installation Date</label>
                <input className="input" type="date" value={appForm.installation_date}
                  onChange={e => setAppForm((f: any) => ({ ...f, installation_date: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Warranty Expiry</label>
                <input className="input" type="date" value={appForm.warranty_expiry}
                  onChange={e => setAppForm((f: any) => ({ ...f, warranty_expiry: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Notes</label>
              <textarea className="input" rows={2} value={appForm.notes} style={{ resize: 'vertical' }}
                onChange={e => setAppForm((f: any) => ({ ...f, notes: e.target.value }))} />
            </div>
            {appErr && <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{appErr}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" type="submit" disabled={appSaving}>
                {appSaving ? <Spinner size="sm" /> : appModal === 'new' ? '✓ Register' : '✓ Save Changes'}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => setAppModal(null)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Brand Modal */}
      {brandModal && (
        <Modal title={brandModal === 'new' ? '🏷️ Add New Brand' : `✏️ Edit: ${(brandModal as Brand).name}`} onClose={() => setBrandModal(null)}>
          <form onSubmit={saveBrand}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                Brand Name <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input className="input" value={brandForm.name}
                onChange={e => setBrandForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Samsung, LG, Daikin, Voltas" autoFocus required />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Logo URL <span style={{ fontWeight: 400, color: '#94A3B8' }}>(optional)</span>
              </label>
              <input className="input" value={brandForm.logo_url}
                onChange={e => setBrandForm(f => ({ ...f, logo_url: e.target.value }))}
                placeholder="https://example.com/logo.png" />
            </div>

            {/* Live preview */}
            {brandForm.name && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0', marginBottom: 16
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, background: '#EFF6FF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, fontWeight: 700, color: '#1B4FD8', overflow: 'hidden'
                }}>
                  {brandForm.logo_url
                    ? <img src={brandForm.logo_url} style={{ width: 34, height: 34, objectFit: 'contain' }} alt=""
                      onError={e => ((e.target as HTMLImageElement).style.display = 'none')} />
                    : brandForm.name[0]?.toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{brandForm.name}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>Preview</div>
                </div>
              </div>
            )}

            {/* Category multi-select */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                Appliance Categories this brand covers
                <span style={{ fontWeight: 400, color: '#94A3B8', marginLeft: 6 }}>(select all that apply)</span>
              </label>
              <CategoryChipPicker
                categories={categories}
                selected={brandForm.category_ids}
                onChange={ids => setBrandForm(f => ({ ...f, category_ids: ids }))}
              />
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 6 }}>
                Example: <b>LG</b> covers <b>AC</b>, <b>Refrigerator</b>, <b>Washing Machine</b>. This drives the brand filter when a customer books a specific appliance type.
              </div>
            </div>

            {brandErr && (
              <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 10 }}>
                {brandErr}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" type="submit" disabled={brandSaving}>
                {brandSaving ? <Spinner size="sm" /> : brandModal === 'new' ? '+ Create Brand' : '✓ Save Changes'}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => setBrandModal(null)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Type Modal */}
      {typeModal && (
        <Modal title={typeModal === 'new' ? '📋 New Appliance Type' : '✏️ Edit Type'} onClose={() => setTypeModal(null)}>
          <form onSubmit={saveType}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                Type / Variant Name <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input className="input" value={typeForm.name}
                onChange={e => setTypeForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. 1.5 Ton Split AC, Double Door Fridge, Front Load 7kg" autoFocus required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Category</label>
                <select className="input" value={typeForm.appliance_category_id}
                  onChange={e => setTypeForm(f => ({ ...f, appliance_category_id: e.target.value }))}>
                  <option value="">All categories</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Brand</label>
                <select className="input" value={typeForm.brand_id}
                  onChange={e => setTypeForm(f => ({ ...f, brand_id: e.target.value }))}>
                  <option value="">Any brand</option>
                  {(typeForm.appliance_category_id
                    ? brands.filter(b => b.category_ids.includes(typeForm.appliance_category_id) && b.is_active)
                    : brands.filter(b => b.is_active)
                  ).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </div>
            {typeForm.appliance_category_id && (
              <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#166534' }}>
                <b>Filter chain:</b> Domain → <b>{catName(typeForm.appliance_category_id)}</b>
                {typeForm.brand_id ? ` → ${brands.find(b => b.id === typeForm.brand_id)?.name}` : ''} → <b>{typeForm.name || 'this type'}</b>
              </div>
            )}
            {typeErr && <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 10 }}>{typeErr}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" type="submit" disabled={typeSaving}>
                {typeSaving ? <Spinner size="sm" /> : typeModal === 'new' ? '+ Create Type' : '✓ Save'}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => setTypeModal(null)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
