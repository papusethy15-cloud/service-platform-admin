import { useEffect, useRef, useState } from 'react'
import { servicesAPI, citiesAPI } from '@/services/api'
import PageHeader from '@/components/layout/PageHeader'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'

const EMPTY_SVC = { name: '', category_id: '', description: '', base_price: 0, gst_percent: 18, duration_mins: 60, is_visible: true, sort_order: 0 }
const EMPTY_CAT = { name: '', description: '', icon: '', sort_order: 0 }

const badge = (txt: string, color: string) => (
  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 12, background: color + '22', color }}>{txt}</span>
)

/* ── Bulk import types ─────────────────────────────────────────── */
interface BulkPreview {
  new_cats:     { name: string; icon: string; description: string; sort_order: number }[]
  skip_cats:    string[]
  new_svcs:     { name: string; category_name: string; base_price: number; gst_percent: number; duration_mins: number; is_visible: boolean; sort_order: number; description: string; _cat_id?: string }[]
  skip_svcs:    string[]
  errors:       string[]
}
interface BulkResult {
  created_cats: string[]; skipped_cats: string[]
  created_svcs: string[]; skipped_svcs: string[]
  errors: string[]
}

export default function Services() {
  const [services, setServices]     = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [cities, setCities]         = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState<'services' | 'categories' | 'pending'>('services')
  const [search, setSearch]         = useState('')
  const [catFilter, setCatFilter]   = useState('')
  const [collapsed, setCollapsed]   = useState<Record<string, boolean>>({})

  // Pending
  const [pendingSvcs, setPendingSvcs]       = useState<any[]>([])
  const [pendingLoading, setPendingLoading] = useState(false)
  const [verifyModal, setVerifyModal]       = useState<any>(null)
  const [verifyForm, setVerifyForm]         = useState({ name: '', category_id: '', base_price: 0, gst_percent: 18, duration_mins: 60, is_visible: true, commission_type: 'PERCENTAGE', commission_value: 10, domain_id: '' })
  const [verifySaving, setVerifySaving]     = useState(false)
  const [verifyErr, setVerifyErr]           = useState('')

  // Service modal
  const [svcModal, setSvcModal]   = useState<any>(null)
  const [svcForm, setSvcForm]     = useState({ ...EMPTY_SVC })
  const [svcSaving, setSvcSaving] = useState(false)
  const [svcErr, setSvcErr]       = useState('')

  // Category modal
  const [catModal, setCatModal]   = useState<any>(null)
  const [catForm, setCatForm]     = useState({ ...EMPTY_CAT })
  const [catSaving, setCatSaving] = useState(false)

  // City pricing modal
  const [priceModal, setPriceModal]     = useState<any>(null)
  const [cityPrices, setCityPrices]     = useState<any[]>([])
  const [priceLoading, setPriceLoading] = useState(false)
  const [newPrice, setNewPrice]         = useState({ city_id: '', price: '' })

  // ── Bulk Import (3 states: 'upload' | 'preview' | 'result') ─────
  const [bulkModal, setBulkModal]       = useState(false)
  const [bulkStep, setBulkStep]         = useState<'upload' | 'preview' | 'result'>('upload')
  const [bulkJson, setBulkJson]         = useState('')
  const [bulkFile, setBulkFile]         = useState<File | null>(null)
  const [bulkParseErr, setBulkParseErr] = useState('')
  const [bulkPreview, setBulkPreview]   = useState<BulkPreview | null>(null)
  const [bulkLoading, setBulkLoading]   = useState(false)
  const [bulkResult, setBulkResult]     = useState<BulkResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  /* ─── data fetch ─────────────────────────────────────────────── */
  const fetchAll = async () => {
    setLoading(true)
    try {
      const [sRes, cRes, cityRes] = await Promise.all([
        servicesAPI.list({ visible_only: false, per_page: 2000 }),
        servicesAPI.categories(),
        citiesAPI.list(),
      ])
      const svcData = sRes.data.data
      setServices(Array.isArray(svcData) ? svcData : (svcData?.items || []))
      setCategories(cRes.data.data || [])
      const cityData = cityRes.data.data
      setCities(Array.isArray(cityData) ? cityData : (cityData?.items || []))
    } catch { setServices([]) } finally { setLoading(false) }
  }

  const fetchPending = async () => {
    setPendingLoading(true)
    try { const r = await servicesAPI.pending(); setPendingSvcs(r.data.data?.items || []) }
    catch { setPendingSvcs([]) } finally { setPendingLoading(false) }
  }

  useEffect(() => { fetchAll() }, [])
  useEffect(() => { if (tab === 'pending') fetchPending() }, [tab])

  /* ─── derived data ───────────────────────────────────────────── */
  const q = search.toLowerCase()
  const grouped = categories
    .map(c => ({
      ...c,
      services: services.filter(s => {
        const matchCat    = !catFilter || s.category_id === catFilter
        const matchSearch = !q || s.name.toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q)
        return s.category_id === c.id && matchCat && matchSearch
      }),
    }))
    .filter(g => !catFilter || g.id === catFilter)
    .filter(g => !q || g.services.length > 0 || g.name.toLowerCase().includes(q))

  const filteredCats = categories.filter(c =>
    !q || c.name.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q)
  )

  /* ─── modal helpers ──────────────────────────────────────────── */
  const openVerifyModal = (p: any) => {
    setVerifyModal(p)
    setVerifyForm({ name: p.name, category_id: '', base_price: p.base_price || p.unit_price || 0, gst_percent: p.gst_percent || 18, duration_mins: p.duration_mins || 60, is_visible: true, commission_type: 'PERCENTAGE', commission_value: 10, domain_id: '' })
    setVerifyErr('')
  }

  const saveVerify = async (e: any) => {
    e.preventDefault(); setVerifySaving(true); setVerifyErr('')
    try {
      if (!verifyModal?.quotation_id || !verifyModal?.quotation_item_id) throw new Error('Missing quotation context')
      await servicesAPI.verifyService(verifyModal.quotation_id, verifyModal.quotation_item_id, {
        ...verifyForm,
        commission_value: Number(verifyForm.commission_value),
        base_price: Number(verifyForm.base_price),
        gst_percent: Number(verifyForm.gst_percent),
        duration_mins: Number(verifyForm.duration_mins),
        domain_id: verifyForm.domain_id || undefined,
      })
      setVerifyModal(null); fetchPending()
    } catch (ex: any) { setVerifyErr(ex.response?.data?.detail || ex.message || 'Failed') } finally { setVerifySaving(false) }
  }

  const openSvcModal = (s?: any, prefillCatId?: string) => {
    if (s) {
      setSvcForm({ name: s.name, category_id: s.category_id, description: s.description || '', base_price: s.base_price, gst_percent: s.gst_percent, duration_mins: s.duration_mins, is_visible: s.is_visible, sort_order: s.sort_order || 0 })
      setSvcModal(s)
    } else {
      setSvcForm({ ...EMPTY_SVC, category_id: prefillCatId || '' }); setSvcModal('new')
    }
    setSvcErr('')
  }

  const openCatModal = (c?: any) => {
    if (c) { setCatForm({ name: c.name, description: c.description || '', icon: c.icon || '', sort_order: c.sort_order || 0 }); setCatModal(c) }
    else { setCatForm({ ...EMPTY_CAT }); setCatModal('new') }
  }

  const openPriceModal = async (s: any) => {
    setPriceModal(s); setPriceLoading(true); setCityPrices([])
    try {
      const r = await import('@/services/api').then(m => m.servicePricingAPI.cityPrices(s.id))
      setCityPrices(r.data.data || [])
    } catch { setCityPrices([]) } finally { setPriceLoading(false) }
  }

  const saveSvc = async (e: any) => {
    e.preventDefault(); setSvcSaving(true); setSvcErr('')
    try {
      if (svcModal === 'new') await servicesAPI.create(svcForm)
      else await servicesAPI.update(svcModal.id, svcForm)
      setSvcModal(null); fetchAll()
    } catch (ex: any) { setSvcErr(ex.response?.data?.detail || 'Failed') } finally { setSvcSaving(false) }
  }

  const saveCat = async (e: any) => {
    e.preventDefault(); setCatSaving(true)
    try {
      if (catModal === 'new') await servicesAPI.createCategory(catForm)
      else await servicesAPI.updateCategory?.(catModal.id, catForm)
      setCatModal(null); fetchAll()
    } catch {} finally { setCatSaving(false) }
  }

  const addCityPrice = async () => {
    if (!priceModal || !newPrice.city_id || !newPrice.price) return
    try {
      const { servicePricingAPI } = await import('@/services/api')
      await servicePricingAPI.setCityPrice(priceModal.id, newPrice)
      const r = await servicePricingAPI.cityPrices(priceModal.id)
      setCityPrices(r.data.data || [])
      setNewPrice({ city_id: '', price: '' })
    } catch {}
  }

  const toggleCollapse = (id: string) => setCollapsed(p => ({ ...p, [id]: !p[id] }))

  /* ═══════════════════════════════════════════════════════════════
     BULK IMPORT — Step 1: Parse JSON and build preview
     Uses existing single-create endpoints — no bulk backend needed
  ═══════════════════════════════════════════════════════════════ */
  const onBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setBulkFile(f); setBulkParseErr('')
    const reader = new FileReader()
    reader.onload = ev => setBulkJson(ev.target?.result as string || '')
    reader.readAsText(f)
  }

  const openBulkModal = () => {
    setBulkModal(true); setBulkStep('upload')
    setBulkJson(''); setBulkFile(null)
    setBulkParseErr(''); setBulkPreview(null); setBulkResult(null)
  }

  // Step 1 → Step 2: parse JSON, diff against existing data, show preview
  const buildPreview = async () => {
    setBulkParseErr('')
    let data: any
    try { data = JSON.parse(bulkJson) } catch { setBulkParseErr('Invalid JSON — please check the file format.'); return }

    const rawCats: any[] = data.categories || []
    const rawSvcs: any[] = data.services   || []
    const errors: string[] = []

    // Current categories (name → id)
    const catNameMap: Record<string, string> = {}
    categories.forEach(c => { catNameMap[c.name.toLowerCase()] = c.id })

    // Current services (name → true)
    const svcNameSet = new Set(services.map(s => s.name.toLowerCase()))

    const new_cats: BulkPreview['new_cats'] = []
    const skip_cats: string[] = []

    for (const cat of rawCats) {
      const key = (cat.name || '').toLowerCase().trim()
      if (!key) { errors.push(`Category missing name: ${JSON.stringify(cat)}`); continue }
      if (catNameMap[key]) { skip_cats.push(cat.name); continue }
      new_cats.push({ name: cat.name.trim(), icon: cat.icon || '', description: cat.description || '', sort_order: cat.sort_order ?? 0 })
    }

    // Build merged cat name map (existing + new from this batch)
    const mergedCatMap: Record<string, string | '_new_'> = { ...catNameMap }
    new_cats.forEach(c => { mergedCatMap[c.name.toLowerCase()] = '_new_' })

    const new_svcs: BulkPreview['new_svcs'] = []
    const skip_svcs: string[] = []

    for (const svc of rawSvcs) {
      const key = (svc.name || '').toLowerCase().trim()
      if (!key) { errors.push(`Service missing name: ${JSON.stringify(svc)}`); continue }
      if (svcNameSet.has(key)) { skip_svcs.push(svc.name); continue }

      // Resolve category
      let catId: string | undefined = svc.category_id
      let catName = svc.category_name || ''
      if (!catId && catName) {
        const found = mergedCatMap[catName.toLowerCase().trim()]
        catId = found === '_new_' ? undefined : found
      }
      if (!catId && !catName) {
        errors.push(`Service "${svc.name}": no category_id or category_name provided`)
        continue
      }
      if (catName && !mergedCatMap[catName.toLowerCase().trim()]) {
        errors.push(`Service "${svc.name}": category "${catName}" not found in DB or this JSON`)
        continue
      }

      new_svcs.push({
        name:         svc.name.trim(),
        category_name: catName || categories.find(c => c.id === catId)?.name || catId || '',
        base_price:   Number(svc.base_price) || 0,
        gst_percent:  Number(svc.gst_percent ?? 18),
        duration_mins:Number(svc.duration_mins ?? 60),
        is_visible:   svc.is_visible ?? true,
        sort_order:   svc.sort_order ?? 0,
        description:  svc.description || '',
        _cat_id:      catId,
      })
    }

    setBulkPreview({ new_cats, skip_cats, new_svcs, skip_svcs, errors })
    setBulkStep('preview')
  }

  // Step 2 → Step 3: actually call backend single-create endpoints
  const confirmImport = async () => {
    if (!bulkPreview) return
    setBulkLoading(true)

    const created_cats: string[] = []
    const created_svcs: string[] = []
    const errors: string[] = []

    // Re-fetch live category name→id map in case something changed
    const catRes = await servicesAPI.categories()
    const liveCats: any[] = catRes.data.data || []
    const catNameMap: Record<string, string> = {}
    liveCats.forEach((c: any) => { catNameMap[c.name.toLowerCase()] = c.id })

    // 1. Create categories
    for (const cat of bulkPreview.new_cats) {
      try {
        const r = await servicesAPI.createCategory({
          name: cat.name, description: cat.description, icon: cat.icon, sort_order: cat.sort_order,
        })
        const newId = r.data.data?.id
        if (newId) catNameMap[cat.name.toLowerCase()] = newId
        created_cats.push(cat.name)
      } catch (ex: any) {
        errors.push(`Category "${cat.name}": ${ex.response?.data?.detail || ex.message}`)
      }
    }

    // 2. Create services
    for (const svc of bulkPreview.new_svcs) {
      // Resolve category id — may have just been created above
      const catId = svc._cat_id || catNameMap[svc.category_name.toLowerCase().trim()] || ''
      if (!catId) { errors.push(`Service "${svc.name}": could not resolve category "${svc.category_name}"`); continue }
      try {
        await servicesAPI.create({
          name: svc.name, category_id: catId, description: svc.description,
          base_price: svc.base_price, gst_percent: svc.gst_percent,
          duration_mins: svc.duration_mins, is_visible: svc.is_visible, sort_order: svc.sort_order,
        })
        created_svcs.push(svc.name)
      } catch (ex: any) {
        errors.push(`Service "${svc.name}": ${ex.response?.data?.detail || ex.message}`)
      }
    }

    setBulkResult({
      created_cats, skipped_cats: bulkPreview.skip_cats,
      created_svcs, skipped_svcs: bulkPreview.skip_svcs,
      errors,
    })
    setBulkStep('result')
    setBulkLoading(false)
    fetchAll()
  }

  /* ─── tab button style ───────────────────────────────────────── */
  const tabBtn = (t: string) => ({
    padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
    background: tab === t ? '#1B4FD8' : '#F1F5F9', color: tab === t ? '#fff' : '#334155',
  })

  const totalVisible = services.filter(s => s.is_visible).length

  /* ─────────────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────────────── */
  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader
        title="Services"
        subtitle={`${services.length} services · ${categories.length} categories`}
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={tabBtn('categories')} onClick={() => setTab('categories')}>📂 Categories</button>
            <button style={tabBtn('services')}   onClick={() => setTab('services')}>🔧 Services</button>
            <button style={{ ...tabBtn('pending'), position: 'relative' }} onClick={() => setTab('pending')}>
              🕐 Pending
              {pendingSvcs.length > 0 && (
                <span style={{ position: 'absolute', top: -6, right: -6, background: '#EF4444', color: '#fff', borderRadius: '50%', width: 18, height: 18, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                  {pendingSvcs.length}
                </span>
              )}
            </button>
            <button
              style={{ padding: '7px 14px', borderRadius: 7, border: '1.5px dashed #1B4FD8', cursor: 'pointer', fontSize: 13, fontWeight: 500, background: '#EFF6FF', color: '#1B4FD8' }}
              onClick={openBulkModal}
            >
              📥 Bulk Import
            </button>
            {tab !== 'pending' && (
              <button className="btn btn-primary" onClick={() => tab === 'categories' ? openCatModal() : openSvcModal()}>
                {tab === 'categories' ? '+ Category' : '+ Service'}
              </button>
            )}
          </div>
        }
      />

      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, margin: '16px 0' }}>
        {[
          { label: 'Total Categories',      value: categories.length,  icon: '📂', color: '#6366F1' },
          { label: 'Total Services',         value: services.length,    icon: '🔧', color: '#0891B2' },
          { label: 'Visible to Customers',   value: totalVisible,       icon: '👁️', color: '#059669' },
          { label: 'Pending Review',         value: pendingSvcs.length, icon: '🕐', color: '#D97706' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 26 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div className="card" style={{ padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#94A3B8' }}>🔍</span>
          <input className="input" style={{ paddingLeft: 32, width: '100%' }} placeholder="Search services or categories…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input" style={{ width: 220 }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map((c: any) => <option key={c.id} value={c.id}>{c.icon ? c.icon + ' ' : ''}{c.name}</option>)}
        </select>
        {(search || catFilter) && <button className="btn btn-secondary btn-sm" onClick={() => { setSearch(''); setCatFilter('') }}>✕ Clear</button>}
        <span style={{ fontSize: 12, color: '#94A3B8' }}>
          {q || catFilter ? `${grouped.reduce((a, g) => a + g.services.length, 0)} results` : `${services.length} services · ${categories.length} categories`}
        </span>
      </div>

      {loading ? <div style={{ padding: 60, textAlign: 'center' }}><Spinner /></div> : (
        <>
          {/* ════ CATEGORIES TAB ════ */}
          {tab === 'categories' && (
            filteredCats.length === 0
              ? <div className="card" style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>No categories found</div>
              : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14 }}>
                  {filteredCats.map((c: any) => {
                    const count    = services.filter(s => s.category_id === c.id).length
                    const visCount = services.filter(s => s.category_id === c.id && s.is_visible).length
                    return (
                      <div key={c.id} className="card" style={{ padding: '16px 18px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                          <div style={{ fontSize: 28 }}>{c.icon || '⚙️'}</div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => openCatModal(c)}>Edit</button>
                            <button className="btn btn-secondary btn-sm" style={{ color: '#1B4FD8' }} onClick={() => { setTab('services'); setCatFilter(c.id) }}>View →</button>
                          </div>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#0F172A', marginBottom: 6 }}>{c.name}</div>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                          {badge(`${count} services`, '#6366F1')}
                          {badge(`${visCount} visible`, '#059669')}
                        </div>
                        {c.description && <div style={{ fontSize: 12, color: '#64748B', marginTop: 6, borderTop: '1px solid #F1F5F9', paddingTop: 6 }}>{c.description.substring(0, 80)}{c.description.length > 80 ? '…' : ''}</div>}
                        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #F1F5F9' }}>
                          <button className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={() => openSvcModal(undefined, c.id)}>+ Add Service Here</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
          )}

          {/* ════ SERVICES TAB ════ */}
          {tab === 'services' && (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => { const all: Record<string,boolean> = {}; categories.forEach(c => { all[c.id] = true }); setCollapsed(all) }}>⊟ Collapse All</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setCollapsed({})}>⊞ Expand All</button>
              </div>
              {grouped.length === 0 && <div className="card" style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>No results match your search</div>}
              {grouped.map(g => {
                const isCollapsed = !!collapsed[g.id]
                return (
                  <div key={g.id} className="card" style={{ marginBottom: 12, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 20px', background: '#F8FAFC', borderBottom: isCollapsed ? 'none' : '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleCollapse(g.id)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 16, display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform .2s' }}>▾</span>
                        <span style={{ fontSize: 20 }}>{g.icon || '⚙️'}</span>
                        <span style={{ fontWeight: 700, fontSize: 15, color: '#0F172A' }}>{g.name}</span>
                        {badge(`${g.services.length} services`, '#6366F1')}
                        {badge(`${g.services.filter((s: any) => s.is_visible).length} visible`, '#059669')}
                        {g.services.filter((s: any) => !s.is_visible).length > 0 && badge(`${g.services.filter((s: any) => !s.is_visible).length} hidden`, '#94A3B8')}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openCatModal(g)}>Edit Cat</button>
                        <button className="btn btn-primary btn-sm" onClick={() => openSvcModal(undefined, g.id)}>+ Service</button>
                      </div>
                    </div>
                    {!isCollapsed && (
                      g.services.length === 0
                        ? <div style={{ padding: 20, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>No services. <span style={{ color: '#1B4FD8', cursor: 'pointer', fontWeight: 600 }} onClick={() => openSvcModal(undefined, g.id)}>Add one →</span></div>
                        : <table className="data-table">
                            <thead><tr><th style={{ width: '35%' }}>Name</th><th>Base Price</th><th>GST</th><th>Duration</th><th>Sort</th><th>Status</th><th>Actions</th></tr></thead>
                            <tbody>
                              {g.services.map((s: any) => (
                                <tr key={s.id}>
                                  <td>
                                    <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                                    {s.description && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{s.description.substring(0, 70)}{s.description.length > 70 ? '…' : ''}</div>}
                                  </td>
                                  <td><span style={{ fontWeight: 700, color: '#059669', fontSize: 13 }}>₹{s.base_price?.toLocaleString('en-IN')}</span></td>
                                  <td style={{ fontSize: 13, color: '#64748B' }}>{s.gst_percent}%</td>
                                  <td style={{ fontSize: 13, color: '#64748B' }}>{s.duration_mins} min</td>
                                  <td style={{ fontSize: 13, color: '#64748B' }}>{s.sort_order ?? 0}</td>
                                  <td><span className={`badge ${s.is_visible ? 'status-ACTIVE' : 'status-INACTIVE'}`}>{s.is_visible ? 'Visible' : 'Hidden'}</span></td>
                                  <td>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                      <button className="btn btn-secondary btn-sm" onClick={() => openSvcModal(s)}>Edit</button>
                                      <button className="btn btn-secondary btn-sm" style={{ color: '#1B4FD8' }} onClick={() => openPriceModal(s)}>🏙️</button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                    )}
                  </div>
                )
              })}
            </>
          )}

          {/* ════ PENDING TAB ════ */}
          {tab === 'pending' && (
            pendingLoading ? <div style={{ padding: 60, textAlign: 'center' }}><Spinner /></div>
            : pendingSvcs.length === 0
              ? <div className="card" style={{ padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>✅ No pending services — all reviewed.</div>
              : <div className="card">
                  <div style={{ padding: '12px 20px', borderBottom: '1px solid #F1F5F9', fontWeight: 700, fontSize: 15 }}>🕐 Pending Admin Verification ({pendingSvcs.length})</div>
                  <table className="data-table">
                    <thead><tr><th>Service Name</th><th>Suggested By</th><th>Price (₹)</th><th>Appliance</th><th>Booking</th><th>Suggested At</th><th>Action</th></tr></thead>
                    <tbody>
                      {pendingSvcs.map((p: any) => (
                        <tr key={p.service_id}>
                          <td><div style={{ fontWeight: 600 }}>{p.name}</div>{p.description && <div style={{ fontSize: 11, color: '#94A3B8' }}>{p.description.substring(0, 60)}</div>}</td>
                          <td style={{ fontSize: 13 }}>{p.suggested_by_tech_name || '—'}</td>
                          <td style={{ fontWeight: 700, color: '#059669' }}>₹{Number(p.unit_price || p.base_price).toLocaleString('en-IN')}</td>
                          <td style={{ fontSize: 12, color: '#64748B' }}>{p.appliance_label || '—'}</td>
                          <td>{p.booking_id ? <a href={`/bookings/${p.booking_id}`} style={{ fontSize: 12, color: '#1B4FD8' }}>View</a> : '—'}</td>
                          <td style={{ fontSize: 12, color: '#94A3B8' }}>{p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—'}</td>
                          <td><button className="btn btn-primary btn-sm" onClick={() => openVerifyModal(p)} style={{ background: '#059669' }}>✓ Verify</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════
          BULK IMPORT MODAL — 3-step: Upload → Preview → Result
      ══════════════════════════════════════════════════════════ */}
      {bulkModal && (
        <Modal
          title={
            bulkStep === 'upload'  ? '📥 Bulk Import — Step 1: Upload JSON' :
            bulkStep === 'preview' ? '👁️ Bulk Import — Step 2: Review Before Import' :
                                     '✅ Bulk Import — Done'
          }
          onClose={() => setBulkModal(false)}
        >
          {/* ── Step progress indicator ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 20 }}>
            {(['upload', 'preview', 'result'] as const).map((s, i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < 2 ? 1 : 'none' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                  background: bulkStep === s ? '#1B4FD8' : (['upload','preview','result'].indexOf(bulkStep) > i ? '#059669' : '#E2E8F0'),
                  color: bulkStep === s || ['upload','preview','result'].indexOf(bulkStep) > i ? '#fff' : '#94A3B8',
                }}>
                  {['upload','preview','result'].indexOf(bulkStep) > i ? '✓' : i + 1}
                </div>
                <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 500, color: bulkStep === s ? '#1B4FD8' : '#94A3B8', whiteSpace: 'nowrap' }}>
                  {s === 'upload' ? 'Upload' : s === 'preview' ? 'Preview' : 'Done'}
                </span>
                {i < 2 && <div style={{ flex: 1, height: 2, background: ['upload','preview','result'].indexOf(bulkStep) > i ? '#059669' : '#E2E8F0', margin: '0 8px' }} />}
              </div>
            ))}
          </div>

          {/* ── STEP 1: Upload ── */}
          {bulkStep === 'upload' && (
            <>
              <div style={{ fontSize: 13, color: '#64748B', marginBottom: 14, lineHeight: 1.6 }}>
                Upload or paste your JSON file. A sample file is available at <code style={{ fontSize: 12, background: '#F1F5F9', padding: '1px 5px', borderRadius: 4 }}>admin_dashboard/bulk_services_sample.json</code>.
              </div>

              {/* Drop zone */}
              <div
                style={{ border: '2px dashed #CBD5E1', borderRadius: 10, padding: '24px', textAlign: 'center', marginBottom: 14, cursor: 'pointer', background: bulkFile ? '#F0FDF4' : '#F8FAFC' }}
                onClick={() => fileRef.current?.click()}
              >
                <div style={{ fontSize: 32, marginBottom: 6 }}>{bulkFile ? '✅' : '📂'}</div>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>{bulkFile ? bulkFile.name : 'Click to choose JSON file'}</div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>or paste JSON in the box below</div>
                <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={onBulkFileChange} />
              </div>

              <textarea
                className="input"
                rows={10}
                style={{ fontFamily: 'monospace', fontSize: 12, resize: 'vertical', width: '100%', marginBottom: 8 }}
                placeholder={'{\n  "categories": [\n    { "name": "AC Services", "icon": "❄️", "sort_order": 1 }\n  ],\n  "services": [\n    { "name": "AC Gas Refilling", "category_name": "AC Services", "base_price": 1200 }\n  ]\n}'}
                value={bulkJson}
                onChange={e => { setBulkJson(e.target.value); setBulkParseErr('') }}
              />

              {bulkParseErr && (
                <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 12 }}>❌ {bulkParseErr}</div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-primary" disabled={!bulkJson.trim()} onClick={buildPreview}>
                  Preview →
                </button>
                <button className="btn btn-secondary" onClick={() => setBulkModal(false)}>Cancel</button>
              </div>
            </>
          )}

          {/* ── STEP 2: Preview ── */}
          {bulkStep === 'preview' && bulkPreview && (
            <>
              {/* Summary row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'New Categories',  value: bulkPreview.new_cats.length,  color: '#059669', bg: '#F0FDF4' },
                  { label: 'Skip Categories', value: bulkPreview.skip_cats.length, color: '#D97706', bg: '#FFFBEB' },
                  { label: 'New Services',    value: bulkPreview.new_svcs.length,  color: '#1B4FD8', bg: '#EFF6FF' },
                  { label: 'Skip Services',   value: bulkPreview.skip_svcs.length, color: '#64748B', bg: '#F1F5F9' },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: s.color, fontWeight: 600 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* New categories to be created */}
              {bulkPreview.new_cats.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#059669', marginBottom: 8 }}>✅ Categories to Create ({bulkPreview.new_cats.length})</div>
                  <div style={{ background: '#F0FDF4', borderRadius: 8, padding: '10px 14px', maxHeight: 160, overflowY: 'auto' }}>
                    {bulkPreview.new_cats.map((c, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: i < bulkPreview.new_cats.length - 1 ? '1px solid #DCFCE7' : 'none' }}>
                        <span style={{ fontSize: 18 }}>{c.icon || '⚙️'}</span>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</span>
                        {c.description && <span style={{ fontSize: 11, color: '#64748B' }}>— {c.description.substring(0, 50)}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New services to be created */}
              {bulkPreview.new_svcs.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#1B4FD8', marginBottom: 8 }}>✅ Services to Create ({bulkPreview.new_svcs.length})</div>
                  <div style={{ background: '#EFF6FF', borderRadius: 8, maxHeight: 220, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#DBEAFE' }}>
                          <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Service</th>
                          <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Category</th>
                          <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700 }}>Price</th>
                          <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700 }}>GST</th>
                          <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700 }}>Visible</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkPreview.new_svcs.map((s, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #BFDBFE' }}>
                            <td style={{ padding: '5px 10px', fontWeight: 600 }}>{s.name}</td>
                            <td style={{ padding: '5px 10px', color: '#64748B' }}>{s.category_name}</td>
                            <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>₹{s.base_price.toLocaleString('en-IN')}</td>
                            <td style={{ padding: '5px 10px', textAlign: 'center', color: '#64748B' }}>{s.gst_percent}%</td>
                            <td style={{ padding: '5px 10px', textAlign: 'center' }}>{s.is_visible ? '✅' : '🚫'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Skipped */}
              {(bulkPreview.skip_cats.length > 0 || bulkPreview.skip_svcs.length > 0) && (
                <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12 }}>
                  <div style={{ fontWeight: 700, color: '#D97706', marginBottom: 6 }}>⏭️ Already Exist — Will Be Skipped</div>
                  {bulkPreview.skip_cats.length > 0 && <div style={{ color: '#92400E', marginBottom: 4 }}>Categories: {bulkPreview.skip_cats.join(', ')}</div>}
                  {bulkPreview.skip_svcs.length > 0 && <div style={{ color: '#92400E' }}>Services: {bulkPreview.skip_svcs.slice(0, 15).join(', ')}{bulkPreview.skip_svcs.length > 15 ? ` …+${bulkPreview.skip_svcs.length - 15} more` : ''}</div>}
                </div>
              )}

              {/* Parse errors */}
              {bulkPreview.errors.length > 0 && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12 }}>
                  <div style={{ fontWeight: 700, color: '#DC2626', marginBottom: 6 }}>❌ Errors — These Will Be Skipped</div>
                  {bulkPreview.errors.map((e, i) => <div key={i} style={{ color: '#7F1D1D', marginBottom: 2 }}>• {e}</div>)}
                </div>
              )}

              {/* Nothing to import */}
              {bulkPreview.new_cats.length === 0 && bulkPreview.new_svcs.length === 0 && (
                <div style={{ background: '#F1F5F9', borderRadius: 8, padding: '20px', textAlign: 'center', color: '#64748B', fontSize: 13, marginBottom: 14 }}>
                  ℹ️ Nothing new to import — all categories and services in this file already exist.
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-secondary" onClick={() => setBulkStep('upload')}>← Back</button>
                {(bulkPreview.new_cats.length > 0 || bulkPreview.new_svcs.length > 0) && (
                  <button className="btn btn-primary" disabled={bulkLoading} onClick={confirmImport} style={{ background: '#059669' }}>
                    {bulkLoading ? <><Spinner size="sm" /> Importing…</> : `🚀 Confirm & Import (${bulkPreview.new_cats.length + bulkPreview.new_svcs.length} items)`}
                  </button>
                )}
                <button className="btn btn-secondary" onClick={() => setBulkModal(false)}>Cancel</button>
              </div>
            </>
          )}

          {/* ── STEP 3: Result ── */}
          {bulkStep === 'result' && bulkResult && (
            <>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 40 }}>🎉</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#059669' }}>Import Complete!</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div style={{ background: '#F0FDF4', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontWeight: 700, color: '#059669', fontSize: 13, marginBottom: 6 }}>✅ Created Categories ({bulkResult.created_cats.length})</div>
                  {bulkResult.created_cats.length === 0
                    ? <div style={{ color: '#94A3B8', fontSize: 12 }}>None</div>
                    : bulkResult.created_cats.map(n => <div key={n} style={{ fontSize: 12, color: '#166534', marginBottom: 2 }}>• {n}</div>)}
                </div>
                <div style={{ background: '#EFF6FF', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontWeight: 700, color: '#1B4FD8', fontSize: 13, marginBottom: 6 }}>✅ Created Services ({bulkResult.created_svcs.length})</div>
                  {bulkResult.created_svcs.length === 0
                    ? <div style={{ color: '#94A3B8', fontSize: 12 }}>None</div>
                    : <div style={{ maxHeight: 120, overflowY: 'auto' }}>
                        {bulkResult.created_svcs.map(n => <div key={n} style={{ fontSize: 12, color: '#1e3a8a', marginBottom: 2 }}>• {n}</div>)}
                      </div>}
                </div>
              </div>

              {(bulkResult.skipped_cats.length > 0 || bulkResult.skipped_svcs.length > 0) && (
                <div style={{ background: '#FFFBEB', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: '#92400E' }}>
                  ⏭️ Skipped (already existed): {bulkResult.skipped_cats.length} categories, {bulkResult.skipped_svcs.length} services
                </div>
              )}

              {bulkResult.errors.length > 0 && (
                <div style={{ background: '#FEF2F2', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, color: '#DC2626', fontSize: 13, marginBottom: 6 }}>❌ Errors ({bulkResult.errors.length})</div>
                  {bulkResult.errors.map((e, i) => <div key={i} style={{ fontSize: 12, color: '#7F1D1D', marginBottom: 2 }}>• {e}</div>)}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-primary" onClick={() => setBulkModal(false)}>✓ Done</button>
                <button className="btn btn-secondary" onClick={openBulkModal}>Import Another File</button>
              </div>
            </>
          )}
        </Modal>
      )}

      {/* Verify modal */}
      {verifyModal && (
        <Modal title={`Verify Service: ${verifyModal.name}`} onClose={() => setVerifyModal(null)}>
          <p style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>Suggested by <strong>{verifyModal.suggested_by_tech_name || 'technician'}</strong> for appliance <strong>{verifyModal.appliance_label || '—'}</strong>.</p>
          <form onSubmit={saveVerify}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Category *</label>
              <select className="input" value={verifyForm.category_id} onChange={e => setVerifyForm(f => ({ ...f, category_id: e.target.value }))} required>
                <option value="">Select category</option>
                {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Service Name *</label>
              <input className="input" value={verifyForm.name} onChange={e => setVerifyForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              {[['Base Price (₹) *', 'base_price'], ['GST %', 'gst_percent'], ['Duration (min)', 'duration_mins']].map(([l, k]) => (
                <div key={k}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{l}</label>
                  <input className="input" type="number" min="0" value={(verifyForm as any)[k]} onChange={e => setVerifyForm(f => ({ ...f, [k]: +e.target.value }))} />
                </div>
              ))}
            </div>
            <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#166534', marginBottom: 8 }}>💰 Technician Commission</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Commission Type</label>
                  <select className="input" value={verifyForm.commission_type} onChange={e => setVerifyForm(f => ({ ...f, commission_type: e.target.value }))}>
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED">Fixed Amount (₹)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Value</label>
                  <input className="input" type="number" min="0" value={verifyForm.commission_value} onChange={e => setVerifyForm(f => ({ ...f, commission_value: +e.target.value }))} />
                </div>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={verifyForm.is_visible} onChange={e => setVerifyForm(f => ({ ...f, is_visible: e.target.checked }))} />
                Visible to customers
              </label>
            </div>
            {verifyErr && <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 12 }}>{verifyErr}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" type="submit" disabled={verifySaving} style={{ background: '#059669' }}>{verifySaving ? <Spinner size="sm" /> : '✓ Approve & Add to Catalogue'}</button>
              <button className="btn btn-secondary" type="button" onClick={() => setVerifyModal(null)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Service modal */}
      {svcModal && (
        <Modal title={svcModal === 'new' ? 'New Service' : `Edit: ${svcModal.name}`} onClose={() => setSvcModal(null)}>
          <form onSubmit={saveSvc}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Category *</label>
              <select className="input" value={svcForm.category_id} onChange={e => setSvcForm(f => ({ ...f, category_id: e.target.value }))} required>
                <option value="">Select category</option>
                {categories.map((c: any) => <option key={c.id} value={c.id}>{c.icon ? c.icon + ' ' : ''}{c.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Service Name *</label>
              <input className="input" value={svcForm.name} onChange={e => setSvcForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              {[['Base Price (₹) *', 'base_price', 'number'], ['GST % *', 'gst_percent', 'number'], ['Duration (min)', 'duration_mins', 'number']].map(([l, k, t]) => (
                <div key={k}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{l}</label>
                  <input className="input" type={t} min="0" value={(svcForm as any)[k]} onChange={e => setSvcForm(f => ({ ...f, [k]: +e.target.value }))} />
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Sort Order</label>
                <input className="input" type="number" min="0" value={svcForm.sort_order} onChange={e => setSvcForm(f => ({ ...f, sort_order: +e.target.value }))} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={svcForm.is_visible} onChange={e => setSvcForm(f => ({ ...f, is_visible: e.target.checked }))} />
                  Visible to customers
                </label>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Description</label>
              <textarea className="input" rows={2} style={{ resize: 'vertical' }} value={svcForm.description} onChange={e => setSvcForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            {svcErr && <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 12 }}>{svcErr}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" type="submit" disabled={svcSaving}>{svcSaving ? <Spinner size="sm" /> : svcModal === 'new' ? 'Create Service' : 'Save Changes'}</button>
              <button className="btn btn-secondary" type="button" onClick={() => setSvcModal(null)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Category modal */}
      {catModal && (
        <Modal title={catModal === 'new' ? 'New Category' : `Edit: ${catModal.name}`} onClose={() => setCatModal(null)}>
          <form onSubmit={saveCat}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Category Name *</label>
              <input className="input" value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Icon (emoji)</label>
                <input className="input" value={catForm.icon} onChange={e => setCatForm(f => ({ ...f, icon: e.target.value }))} placeholder="❄️ 🔧 🧹" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Sort Order</label>
                <input className="input" type="number" min="0" value={catForm.sort_order} onChange={e => setCatForm(f => ({ ...f, sort_order: +e.target.value }))} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Description</label>
              <input className="input" value={catForm.description} onChange={e => setCatForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" type="submit" disabled={catSaving}>{catSaving ? <Spinner size="sm" /> : catModal === 'new' ? 'Create' : 'Save'}</button>
              <button className="btn btn-secondary" type="button" onClick={() => setCatModal(null)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* City pricing modal */}
      {priceModal && (
        <Modal title={`City Pricing — ${priceModal.name}`} onClose={() => setPriceModal(null)}>
          <p style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>Base price: <strong>₹{priceModal.base_price?.toLocaleString('en-IN')}</strong> — Set city-specific overrides below.</p>
          {priceLoading ? <Spinner /> : (
            <>
              <table className="data-table" style={{ marginBottom: 16 }}>
                <thead><tr><th>City</th><th>City Price</th><th>Status</th></tr></thead>
                <tbody>
                  {cityPrices.length === 0
                    ? <tr><td colSpan={3} style={{ textAlign: 'center', color: '#94A3B8', padding: 20, fontSize: 13 }}>No city-wise prices set.</td></tr>
                    : cityPrices.map((p: any) => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 500 }}>{p.city_name || p.city_id}</td>
                        <td style={{ fontWeight: 700, color: '#1B4FD8' }}>₹{Number(p.price).toLocaleString('en-IN')}</td>
                        <td><span className={`badge ${p.is_available ? 'status-ACTIVE' : 'status-INACTIVE'}`}>{p.is_available ? 'Available' : 'Unavailable'}</span></td>
                      </tr>
                    ))}
                </tbody>
              </table>
              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Add / Override City Price</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <select className="input" value={newPrice.city_id} onChange={e => setNewPrice(p => ({ ...p, city_id: e.target.value }))} style={{ flex: 1 }}>
                    <option value="">Select city</option>
                    {cities.map((c: any) => <option key={c.id} value={c.id}>{c.name}, {c.state}</option>)}
                  </select>
                  <input className="input" type="number" min="0" placeholder="Price ₹" value={newPrice.price} onChange={e => setNewPrice(p => ({ ...p, price: e.target.value }))} style={{ width: 120 }} />
                  <button className="btn btn-primary" onClick={addCityPrice} disabled={!newPrice.city_id || !newPrice.price}>Set</button>
                </div>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  )
}
