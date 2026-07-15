import { useEffect, useState, useRef, useCallback } from 'react'
import { couponsAPI, domainsAPI, customersAPI, servicesAPI } from '@/services/api'
import PageHeader from '@/components/layout/PageHeader'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'

// ─── Types ────────────────────────────────────────────────────────────────────
interface SelectedCustomer { id: string; name: string; mobile: string }
interface SelectedService  { id: string; name: string; category?: string }
interface SelectedCategory { id: string; name: string }

// ─── Coupon-type badge config ─────────────────────────────────────────────────
function getCouponTypeBadge(c: any) {
  const hasCustomers = c.customer_mobile_numbers?.length > 0
  const hasServices  = c.service_ids?.length > 0
  const hasCategories= c.category_ids?.length > 0

  if (hasCustomers && !hasServices && !hasCategories)
    return { label: '👤 Personal',    bg: '#FEF3C7', color: '#B45309', title: 'Only for specific customers' }
  if (hasServices && !hasCustomers)
    return { label: '⚙ Service',     bg: '#EDE9FE', color: '#6D28D9', title: 'Restricted to specific services' }
  if (hasCategories && !hasCustomers)
    return { label: '🏷 Category',   bg: '#DCFCE7', color: '#15803D', title: 'Restricted to specific categories' }
  if (hasCustomers && (hasServices || hasCategories))
    return { label: '🎯 Targeted',   bg: '#FEE2E2', color: '#B91C1C', title: 'Customer + service/category targeted' }
  if (!hasCustomers && !hasServices && !hasCategories)
    return { label: '🌍 Public',     bg: '#F0F9FF', color: '#0369A1', title: 'Available to all customers' }
  return   { label: '🔀 Mixed',      bg: '#F1F5F9', color: '#475569', title: 'Mixed targeting' }
}

// ─── Smart search component ───────────────────────────────────────────────────
function CustomerSearchBox({
  selected, onAdd, onRemove
}: {
  selected: SelectedCustomer[]
  onAdd: (c: SelectedCustomer) => void
  onRemove: (mobile: string) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<any>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const doSearch = useCallback(async (q: string) => {
    if (!q || q.length < 3) { setResults([]); setOpen(false); return }
    setSearching(true)
    try {
      const res = await customersAPI.list({ search: q, per_page: 10 })
      const items = res.data?.data?.items || []
      setResults(items)
      setOpen(items.length > 0)
    } catch { setResults([]) } finally { setSearching(false) }
  }, [])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(query), 350)
    return () => clearTimeout(debounceRef.current)
  }, [query, doSearch])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const alreadySelected = (mobile: string) => selected.some(s => s.mobile === mobile)

  return (
    <div>
      {/* Selected customer tags */}
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {selected.map(c => (
            <span key={c.mobile} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A',
              borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600
            }}>
              👤 {c.name} · {c.mobile}
              <button
                type="button"
                onClick={() => onRemove(c.mobile)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B45309', fontSize: 14, lineHeight: 1, padding: 0, marginLeft: 2 }}
              >×</button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div ref={wrapRef} style={{ position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          <input
            className="input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by mobile number or name…"
            style={{ paddingRight: 32 }}
            onFocus={() => results.length > 0 && setOpen(true)}
          />
          {searching && (
            <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
              <Spinner size="sm" />
            </span>
          )}
        </div>

        {/* Dropdown */}
        {open && results.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
            background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8,
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)', maxHeight: 220, overflowY: 'auto', marginTop: 2
          }}>
            {results.map((c: any) => {
              const already = alreadySelected(c.mobile)
              return (
                <div
                  key={c.id}
                  onClick={() => {
                    if (!already) {
                      onAdd({ id: c.id, name: c.name, mobile: c.mobile })
                      setQuery('')
                      setOpen(false)
                    }
                  }}
                  style={{
                    padding: '10px 14px', cursor: already ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: already ? '#F8FAFC' : undefined,
                    opacity: already ? 0.6 : 1,
                    borderBottom: '1px solid #F1F5F9',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => { if (!already) (e.currentTarget as HTMLElement).style.background = '#F0F9FF' }}
                  onMouseLeave={e => { if (!already) (e.currentTarget as HTMLElement).style.background = '' }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1E293B' }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>📱 {c.mobile}{c.email ? ` · ${c.email}` : ''}</div>
                  </div>
                  {already
                    ? <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>Added</span>
                    : <span style={{ fontSize: 11, background: '#EFF6FF', color: '#1D4ED8', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>+ Add</span>
                  }
                </div>
              )
            })}
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
        Type at least 3 characters · Leave empty = available to all customers
      </div>
    </div>
  )
}

function ServiceSearchBox({
  selected, onAdd, onRemove
}: {
  selected: SelectedService[]
  onAdd: (s: SelectedService) => void
  onRemove: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<any>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const doSearch = useCallback(async (q: string) => {
    if (!q || q.length < 2) { setResults([]); setOpen(false); return }
    setSearching(true)
    try {
      const res = await servicesAPI.search(q, { per_page: 15 })
      const items = res.data?.data?.items || []
      setResults(items)
      setOpen(items.length > 0)
    } catch { setResults([]) } finally { setSearching(false) }
  }, [])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(query), 350)
    return () => clearTimeout(debounceRef.current)
  }, [query, doSearch])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const alreadySelected = (id: string) => selected.some(s => s.id === id)

  return (
    <div>
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {selected.map(s => (
            <span key={s.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: '#EDE9FE', color: '#5B21B6', border: '1px solid #C4B5FD',
              borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600
            }}>
              ⚙ {s.name}
              <button
                type="button"
                onClick={() => onRemove(s.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6D28D9', fontSize: 14, lineHeight: 1, padding: 0, marginLeft: 2 }}
              >×</button>
            </span>
          ))}
        </div>
      )}

      <div ref={wrapRef} style={{ position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          <input
            className="input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search service name…"
            style={{ paddingRight: 32 }}
            onFocus={() => results.length > 0 && setOpen(true)}
          />
          {searching && (
            <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
              <Spinner size="sm" />
            </span>
          )}
        </div>

        {open && results.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
            background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8,
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)', maxHeight: 220, overflowY: 'auto', marginTop: 2
          }}>
            {results.map((s: any) => {
              const already = alreadySelected(s.id)
              return (
                <div
                  key={s.id}
                  onClick={() => {
                    if (!already) {
                      onAdd({ id: s.id, name: s.name, category: s.category_name })
                      setQuery('')
                      setOpen(false)
                    }
                  }}
                  style={{
                    padding: '10px 14px', cursor: already ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: already ? '#F8FAFC' : undefined, opacity: already ? 0.6 : 1,
                    borderBottom: '1px solid #F1F5F9', transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => { if (!already) (e.currentTarget as HTMLElement).style.background = '#F5F3FF' }}
                  onMouseLeave={e => { if (!already) (e.currentTarget as HTMLElement).style.background = '' }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1E293B' }}>{s.name}</div>
                    {s.category_name && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>📂 {s.category_name}</div>}
                  </div>
                  {already
                    ? <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>Added</span>
                    : <span style={{ fontSize: 11, background: '#F3E8FF', color: '#7C3AED', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>+ Add</span>
                  }
                </div>
              )
            })}
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
        Type to search services · Leave empty = all services
      </div>
    </div>
  )
}

function CategorySearchBox({
  selected, onAdd, onRemove, allCategories
}: {
  selected: SelectedCategory[]
  onAdd: (c: SelectedCategory) => void
  onRemove: (id: string) => void
  allCategories: any[]
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = allCategories.filter(c =>
    c.name?.toLowerCase().includes(query.toLowerCase()) &&
    !selected.some(s => s.id === c.id)
  )

  return (
    <div>
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {selected.map(c => (
            <span key={c.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: '#DCFCE7', color: '#14532D', border: '1px solid #86EFAC',
              borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600
            }}>
              🏷 {c.name}
              <button
                type="button"
                onClick={() => onRemove(c.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#15803D', fontSize: 14, lineHeight: 1, padding: 0, marginLeft: 2 }}
              >×</button>
            </span>
          ))}
        </div>
      )}

      <div ref={wrapRef} style={{ position: 'relative' }}>
        <input
          className="input"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          placeholder="Search category name…"
          onFocus={() => setOpen(true)}
        />
        {open && filtered.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
            background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8,
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)', maxHeight: 200, overflowY: 'auto', marginTop: 2
          }}>
            {filtered.map((c: any) => (
              <div
                key={c.id}
                onClick={() => { onAdd({ id: c.id, name: c.name }); setQuery(''); setOpen(false) }}
                style={{
                  padding: '10px 14px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  borderBottom: '1px solid #F1F5F9', transition: 'background 0.15s'
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F0FDF4'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
              >
                <div style={{ fontWeight: 700, fontSize: 13, color: '#1E293B' }}>🏷 {c.name}</div>
                <span style={{ fontSize: 11, background: '#DCFCE7', color: '#15803D', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>+ Add</span>
              </div>
            ))}
          </div>
        )}
        {open && filtered.length === 0 && query.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
            background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8,
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)', padding: '12px 14px', marginTop: 2
          }}>
            <div style={{ fontSize: 12, color: '#94A3B8' }}>No matching categories found</div>
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
        Select from existing categories · Leave empty = all categories
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Coupons() {
  const [coupons, setCoupons]     = useState<any[]>([])
  const [domains, setDomains]     = useState<any[]>([])
  const [allCategories, setAllCategories] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [page, setPage]           = useState(1)
  const [pages, setPages]         = useState(1)
  const [total, setTotal]         = useState(0)
  const [filterDomain, setFilterDomain] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [err, setErr]             = useState('')

  // Form scalar fields
  const [form, setForm] = useState({
    code: '', discount_type: 'PERCENTAGE', discount_value: 10,
    min_order_amount: 0, max_discount_amount: '', valid_from: '',
    valid_until: '', max_uses: '', description: '',
    domain_id: '', per_customer_limit: '',
  })

  // Smart-search selections
  const [selCustomers,  setSelCustomers]  = useState<SelectedCustomer[]>([])
  const [selServices,   setSelServices]   = useState<SelectedService[]>([])
  const [selCategories, setSelCategories] = useState<SelectedCategory[]>([])

  const fetchDomains = async () => {
    try { const r = await domainsAPI.list(); setDomains(r.data.data?.items || []) } catch { setDomains([]) }
  }

  const fetchCategories = async () => {
    try { const r = await servicesAPI.categories(); setAllCategories(r.data.data || r.data?.items || []) } catch { setAllCategories([]) }
  }

  const fetchCoupons = async () => {
    setLoading(true)
    try {
      const params: any = { page, per_page: 20 }
      if (filterDomain) params.domain_id = filterDomain
      const res = await couponsAPI.list(params)
      const d = res.data.data
      setCoupons(d.items || [])
      setPages(d.pages || Math.ceil((d.total || 0) / 20))
      setTotal(d.total || 0)
    } catch { setCoupons([]) } finally { setLoading(false) }
  }

  useEffect(() => { fetchDomains(); fetchCategories() }, [])
  useEffect(() => { fetchCoupons() }, [page, filterDomain])

  const resetForm = () => {
    setForm({
      code: '', discount_type: 'PERCENTAGE', discount_value: 10,
      min_order_amount: 0, max_discount_amount: '', valid_from: '',
      valid_until: '', max_uses: '', description: '', domain_id: '', per_customer_limit: '',
    })
    setSelCustomers([])
    setSelServices([])
    setSelCategories([])
    setErr('')
  }

  const handleCreate = async (e: any) => {
    e.preventDefault(); setSaving(true); setErr('')
    try {
      // Build payload explicitly — never send empty strings for optional numeric/date fields
      // because FastAPI/Pydantic will reject "" as "unable to parse string as a number"
      const payload: any = {
        code:              form.code,
        discount_type:     form.discount_type,
        discount_value:    +form.discount_value,
        min_order_amount:  +form.min_order_amount,
        description:       form.description || undefined,
        ...(form.domain_id          ? { domain_id:           form.domain_id }                : {}),
        ...(form.valid_from         ? { valid_from:          form.valid_from }               : {}),
        ...(form.valid_until        ? { valid_until:         form.valid_until }              : {}),
        ...(form.max_discount_amount ? { max_discount_amount: +form.max_discount_amount }    : {}),
        ...(form.max_uses           ? { max_uses:            +form.max_uses }               : {}),
        ...(form.per_customer_limit ? { per_customer_limit:  +form.per_customer_limit }     : {}),
      }

      // Smart selections → API arrays
      if (selCustomers.length > 0)
        payload.customer_mobile_numbers = selCustomers.map(c => c.mobile)
      if (selServices.length > 0)
        payload.service_ids = selServices.map(s => s.id)
      if (selCategories.length > 0)
        payload.category_ids = selCategories.map(c => c.id)

      await couponsAPI.create(payload)
      setShowCreate(false)
      resetForm()
      fetchCoupons()
    } catch (ex: any) {
      const detail = ex.response?.data?.detail
      // FastAPI 422 returns detail as an array of {type,loc,msg,input} objects
      // FastAPI 400/404 returns detail as a plain string
      // We must never render an object into JSX — always coerce to string
      let errMsg = 'Failed to create coupon'
      if (typeof detail === 'string') {
        errMsg = detail
      } else if (Array.isArray(detail) && detail.length > 0) {
        // Extract the human-readable msg from each Pydantic validation error
        errMsg = detail.map((d: any) => {
          const field = Array.isArray(d.loc) ? d.loc.filter((l: any) => l !== 'body').join(' → ') : ''
          return field ? `${field}: ${d.msg}` : (d.msg || 'Validation error')
        }).join('; ')
      }
      setErr(errMsg)
    } finally { setSaving(false) }
  }

  const isExpired = (d: string) => d && new Date(d) < new Date()

  // ── Derive coupon-type label for table ──────────────────────────────────────
  const discountBadge = (c: any) => c.discount_type === 'PERCENTAGE'
    ? { label: `${c.discount_value}% OFF`,  bg: '#EFF6FF', color: '#1D4ED8' }
    : { label: `₹${c.discount_value} OFF`,  bg: '#F0FDF4', color: '#15803D' }

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader
        title="Coupons & Discounts"
        subtitle={`${total} coupons`}
        actions={<button className="btn btn-primary" onClick={() => { resetForm(); setShowCreate(true) }}>+ New Coupon</button>}
      />
      <div style={{ height: 20 }} />

      {/* Domain filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>Filter by Domain:</label>
        <select className="input" style={{ maxWidth: 260 }} value={filterDomain}
          onChange={e => { setFilterDomain(e.target.value); setPage(1) }}>
          <option value="">All Domains (incl. Global)</option>
          {domains.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        {filterDomain && (
          <button className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }}
            onClick={() => { setFilterDomain(''); setPage(1) }}>× Clear</button>
        )}
      </div>

      {/* Table */}
      <div className="card">
        {loading ? <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div> : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead><tr>
                  <th>Code</th>
                  <th>Domain</th>
                  <th>Coupon Type</th>
                  <th>Discount</th>
                  <th>Min Order</th>
                  <th>Max Uses</th>
                  <th>Used</th>
                  <th>Targeting</th>
                  <th>Valid Until</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr></thead>
                <tbody>
                  {coupons.length === 0
                    ? <tr><td colSpan={11} style={{ textAlign: 'center', color: '#94A3B8', padding: 32 }}>No coupons found</td></tr>
                    : coupons.map((c: any) => {
                      const expired   = isExpired(c.valid_until)
                      const exhausted = c.usage_limit && c.used_count >= c.usage_limit
                      const status    = !c.is_active ? 'INACTIVE' : expired ? 'EXPIRED' : exhausted ? 'EXHAUSTED' : 'ACTIVE'
                      const typeBadge = getCouponTypeBadge(c)
                      const dBadge    = discountBadge(c)

                      return (
                        <tr key={c.id}>
                          {/* Code */}
                          <td>
                            <code style={{ background: '#F1F5F9', padding: '3px 8px', borderRadius: 4, fontWeight: 700, color: '#1B4FD8', fontSize: 13 }}>
                              {c.code}
                            </code>
                          </td>

                          {/* Domain */}
                          <td>
                            {c.domain_id
                              ? <span style={{ fontSize: 11, background: '#EFF6FF', color: '#1B4FD8', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>{c.domain_name || c.domain_id.slice(0, 8)}</span>
                              : <span style={{ fontSize: 11, background: '#F0FDF4', color: '#15803D', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>🌐 Global</span>
                            }
                          </td>

                          {/* Coupon Type badge */}
                          <td>
                            <span title={typeBadge.title} style={{
                              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                              background: typeBadge.bg, color: typeBadge.color,
                              display: 'inline-block', whiteSpace: 'nowrap', cursor: 'default'
                            }}>
                              {typeBadge.label}
                            </span>
                          </td>

                          {/* Discount */}
                          <td>
                            <span style={{
                              fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                              background: dBadge.bg, color: dBadge.color, display: 'inline-block'
                            }}>
                              {dBadge.label}
                            </span>
                            {c.max_discount_amount && (
                              <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
                                max ₹{c.max_discount_amount}
                              </div>
                            )}
                          </td>

                          <td style={{ fontSize: 13 }}>₹{c.min_order_amount || 0}</td>
                          <td style={{ fontSize: 13 }}>{c.usage_limit || '∞'}</td>
                          <td style={{ fontSize: 13 }}>{c.used_count || 0}</td>

                          {/* Targeting breakdown */}
                          <td style={{ fontSize: 11 }}>
                            {c.customer_mobile_numbers?.length > 0 && (
                              <span title={c.customer_mobile_numbers.join(', ')} style={{
                                display: 'inline-block', background: '#FEF3C7', color: '#D97706',
                                padding: '2px 7px', borderRadius: 6, marginBottom: 3, marginRight: 3, cursor: 'help'
                              }}>👤 {c.customer_mobile_numbers.length} customers</span>
                            )}
                            {c.service_ids?.length > 0 && (
                              <span style={{
                                display: 'inline-block', background: '#EDE9FE', color: '#7C3AED',
                                padding: '2px 7px', borderRadius: 6, marginBottom: 3, marginRight: 3
                              }}>⚙ {c.service_ids.length} services</span>
                            )}
                            {c.category_ids?.length > 0 && (
                              <span style={{
                                display: 'inline-block', background: '#DCFCE7', color: '#059669',
                                padding: '2px 7px', borderRadius: 6, marginBottom: 3
                              }}>🏷 {c.category_ids.length} cats</span>
                            )}
                            {!c.customer_mobile_numbers?.length && !c.service_ids?.length && !c.category_ids?.length && (
                              <span style={{ color: '#CBD5E1', fontSize: 12 }}>Everyone</span>
                            )}
                          </td>

                          {/* Valid Until */}
                          <td style={{ fontSize: 12, color: expired ? '#DC2626' : '#64748B', whiteSpace: 'nowrap' }}>
                            {c.valid_until
                              ? new Date(c.valid_until).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' })
                              : <span style={{ color: '#CBD5E1' }}>No expiry</span>}
                          </td>

                          {/* Status */}
                          <td>
                            <span style={{
                              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, display: 'inline-block',
                              background: status === 'ACTIVE' ? '#DCFCE7' : status === 'EXPIRED' ? '#FEE2E2' : status === 'EXHAUSTED' ? '#FEF3C7' : '#F1F5F9',
                              color:      status === 'ACTIVE' ? '#15803D' : status === 'EXPIRED' ? '#DC2626' : status === 'EXHAUSTED' ? '#D97706' : '#64748B',
                            }}>
                              {status === 'ACTIVE' ? '✅ Active' : status === 'EXPIRED' ? '⌛ Expired' : status === 'EXHAUSTED' ? '🔴 Exhausted' : '⛔ Inactive'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td>
                            {c.is_active && (
                              <button
                                onClick={async () => {
                                  if (window.confirm('Deactivate this coupon?')) {
                                    await couponsAPI.delete(c.id)
                                    fetchCoupons()
                                  }
                                }}
                                style={{ fontSize: 11, color: '#DC2626', background: '#FEE2E2', border: 'none', padding: '3px 8px', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
                              >Deactivate</button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pages={pages} onPage={setPage} />
          </>
        )}
      </div>

      {/* ── Create Coupon Modal ───────────────────────────────────────────── */}
      {showCreate && (
        <Modal title="Create New Coupon" onClose={() => { setShowCreate(false); resetForm() }}>
          <form onSubmit={handleCreate}>

            {/* Domain Scope */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Domain Scope</label>
              <select className="input" value={form.domain_id}
                onChange={e => setForm(f => ({ ...f, domain_id: e.target.value }))}>
                <option value="">🌐 Global — valid on ALL domains</option>
                {domains.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>
                {form.domain_id ? 'This coupon will ONLY work on the selected domain.' : 'Global coupons work across all domain websites.'}
              </div>
            </div>

            {/* Core fields grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Coupon Code *</label>
                <input className="input" value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g. SUMMER20" required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Discount Type</label>
                <select className="input" value={form.discount_type}
                  onChange={e => setForm(f => ({ ...f, discount_type: e.target.value }))}>
                  <option value="PERCENTAGE">Percentage %</option>
                  <option value="FLAT">Fixed Amount ₹</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  Discount Value * {form.discount_type === 'PERCENTAGE' ? '(%)' : '(₹)'}
                </label>
                <input className="input" type="number" value={form.discount_value}
                  onChange={e => setForm(f => ({ ...f, discount_value: +e.target.value }))} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Min Order Amount ₹</label>
                <input className="input" type="number" value={form.min_order_amount}
                  onChange={e => setForm(f => ({ ...f, min_order_amount: +e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Max Discount ₹ (optional)</label>
                <input className="input" type="number" value={form.max_discount_amount}
                  onChange={e => setForm(f => ({ ...f, max_discount_amount: e.target.value }))} placeholder="No limit" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Max Total Uses (optional)</label>
                <input className="input" type="number" value={form.max_uses}
                  onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))} placeholder="Unlimited" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Valid From</label>
                <input className="input" type="date" value={form.valid_from}
                  onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Valid Until</label>
                <input className="input" type="date" value={form.valid_until}
                  onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))} />
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Description (internal note)</label>
              <input className="input" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Festival offer for premium customers" />
            </div>

            {/* ── Advanced Targeting ─────────────────────────────────────────── */}
            <div style={{ marginTop: 18, borderTop: '1px solid #E2E8F0', paddingTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  🎯 Advanced Targeting
                </div>
                <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 400 }}>(all optional — leave blank for public coupon)</span>
              </div>

              {/* Live coupon type preview */}
              {(selCustomers.length > 0 || selServices.length > 0 || selCategories.length > 0) && (() => {
                const preview = getCouponTypeBadge({
                  customer_mobile_numbers: selCustomers.map(c => c.mobile),
                  service_ids: selServices.map(s => s.id),
                  category_ids: selCategories.map(c => c.id),
                })
                return (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
                    background: preview.bg, border: `1px solid ${preview.color}30`,
                    borderRadius: 8, padding: '8px 14px'
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: preview.color }}>{preview.label}</span>
                    <span style={{ fontSize: 12, color: preview.color, opacity: 0.8 }}>— {preview.title}</span>
                  </div>
                )
              })()}

              {/* Customer search */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                  👤 Customer-Specific
                  {selCustomers.length > 0 && (
                    <span style={{ marginLeft: 8, fontSize: 11, background: '#FEF3C7', color: '#B45309', padding: '1px 7px', borderRadius: 10 }}>
                      {selCustomers.length} selected
                    </span>
                  )}
                </label>
                <CustomerSearchBox
                  selected={selCustomers}
                  onAdd={c => setSelCustomers(prev => [...prev, c])}
                  onRemove={mobile => setSelCustomers(prev => prev.filter(c => c.mobile !== mobile))}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Service search */}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                    ⚙ Specific Services
                    {selServices.length > 0 && (
                      <span style={{ marginLeft: 8, fontSize: 11, background: '#EDE9FE', color: '#6D28D9', padding: '1px 7px', borderRadius: 10 }}>
                        {selServices.length} selected
                      </span>
                    )}
                  </label>
                  <ServiceSearchBox
                    selected={selServices}
                    onAdd={s => setSelServices(prev => [...prev, s])}
                    onRemove={id => setSelServices(prev => prev.filter(s => s.id !== id))}
                  />
                </div>

                {/* Category search */}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                    🏷 Specific Categories
                    {selCategories.length > 0 && (
                      <span style={{ marginLeft: 8, fontSize: 11, background: '#DCFCE7', color: '#15803D', padding: '1px 7px', borderRadius: 10 }}>
                        {selCategories.length} selected
                      </span>
                    )}
                  </label>
                  <CategorySearchBox
                    selected={selCategories}
                    onAdd={c => setSelCategories(prev => [...prev, c])}
                    onRemove={id => setSelCategories(prev => prev.filter(c => c.id !== id))}
                    allCategories={allCategories}
                  />
                </div>
              </div>

              {/* Per-customer limit */}
              <div style={{ marginTop: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Per-Customer Use Limit</label>
                <input className="input" type="number" value={form.per_customer_limit}
                  onChange={e => setForm(f => ({ ...f, per_customer_limit: e.target.value }))}
                  placeholder="e.g. 1  (leave blank = unlimited per customer)" style={{ maxWidth: 260 }} />
              </div>
            </div>

            {err && (
              <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginTop: 14 }}>
                {typeof err === 'string' ? err : JSON.stringify(err)}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? <Spinner size="sm" /> : 'Create Coupon'}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => { setShowCreate(false); resetForm() }}>
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
