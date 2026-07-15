import { useEffect, useState, useRef, useCallback } from 'react'
import { commissionsAPI, servicesAPI, techniciansAPI, domainsAPI, inventoryAPI } from '@/services/api'
import Toast, { useToast } from '@/components/ui/Toast'
import PageHeader from '@/components/layout/PageHeader'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'

interface Service  { id: string; name: string; category_name?: string; base_price?: number }
interface Domain   { id: string; name: string }
interface GroupRule { id?: string; service_id: string; service_name?: string; base_price?: number; domain_id: string|null; domain_name?: string; commission_type: string; rate: number }
interface Group {
  id: string; name: string; description?: string; is_active: boolean
  technician_count: number; rules: GroupRule[]
}
interface Technician { id: string; name: string; mobile: string; technician_code?: string }

interface CityPrice { city_id: string; city_name: string; city_state: string; price: number; in_domain: boolean }
interface PricePreview {
  service_id: string; service_name: string; base_price: number;
  gst_percent: number; city_prices: CityPrice[]; has_overrides: boolean
}

interface InventoryItem {
  id: string; name: string; sku?: string; cost_price: number; selling_price: number; mrp: number; unit: string; current_stock: number
}

const brand = '#1B4FD8'

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>{children}</label>
}

// ── Service search combobox ──────────────────────────────────────────────────
function ServiceSearchBox({
  value, onChange, placeholder, existingServiceIds = []
}: { value: Service|null; onChange: (s: Service|null) => void; placeholder?: string; existingServiceIds?: string[] }) {
  const [query, setQuery]       = useState(value?.name || '')
  const [results, setResults]   = useState<Service[]>([])
  const [open, setOpen]         = useState(false)
  const [loading, setLoading]   = useState(false)
  const timerRef = useRef<any>(null)
  const wrapRef  = useRef<HTMLDivElement>(null)

  // Sync external value
  useEffect(() => { setQuery(value?.name || '') }, [value?.name])

  const search = useCallback((q: string) => {
    if (q.length < 1) { setResults([]); setOpen(false); return }
    setLoading(true)
    servicesAPI.list({ search: q, per_page: 20, visible_only: false })
      .then(r => {
        const list: Service[] = r.data.data?.services || r.data.data?.items || r.data.data || []
        setResults(list); setOpen(true)
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false))
  }, [])

  const onInput = (v: string) => {
    setQuery(v)
    if (!v) { onChange(null); setOpen(false); setResults([]); return }
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(v), 280)
  }

  const select = (s: Service) => {
    onChange(s); setQuery(s.name); setOpen(false)
  }

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          className="input"
          value={query}
          onChange={e => onInput(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true) }}
          placeholder={placeholder || 'Search service name…'}
          style={{ paddingRight: 32 }}
        />
        {loading && (
          <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
            <Spinner size="sm" />
          </div>
        )}
        {value && !loading && (
          <button onClick={() => { onChange(null); setQuery(''); setResults([]); setOpen(false) }}
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 16, lineHeight: 1 }}>
            ×
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <div style={{ position: 'absolute', zIndex: 100, top: '100%', left: 0, right: 0, background: 'white',
          border: '1px solid #E2E8F0', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          maxHeight: 220, overflowY: 'auto', marginTop: 2 }}>
          {results.map(s => {
            const alreadyAdded = existingServiceIds.includes(s.id) && s.id !== value?.id
            return (
              <div key={s.id}
                onClick={() => { if (!alreadyAdded) select(s) }}
                style={{ padding: '9px 14px', cursor: alreadyAdded ? 'not-allowed' : 'pointer', fontSize: 13,
                  borderBottom: '1px solid #F8FAFC', display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', opacity: alreadyAdded ? 0.55 : 1,
                  background: alreadyAdded ? '#F9FAFB' : 'white' }}
                onMouseEnter={e => { if (!alreadyAdded) e.currentTarget.style.background = '#EFF6FF' }}
                onMouseLeave={e => { if (!alreadyAdded) e.currentTarget.style.background = 'white' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#0F172A', fontWeight: 500 }}>{s.name}</span>
                  {alreadyAdded && (
                    <span style={{ fontSize: 10, background: '#FEF3C7', color: '#92400E', fontWeight: 700,
                      padding: '1px 7px', borderRadius: 10, border: '1px solid #FCD34D', flexShrink: 0 }}>
                      ✓ In Group
                    </span>
                  )}
                </div>
                {s.base_price !== undefined && (
                  <span style={{ color: alreadyAdded ? '#94A3B8' : '#059669', fontSize: 12, fontWeight: 600, marginLeft: 8, flexShrink: 0 }}>
                    ₹{s.base_price}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
      {open && !loading && results.length === 0 && query.length >= 1 && (
        <div style={{ position: 'absolute', zIndex: 100, top: '100%', left: 0, right: 0, background: 'white',
          border: '1px solid #E2E8F0', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#94A3B8',
          marginTop: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          No services found for "{query}"
        </div>
      )}
    </div>
  )
}

// ── Price Structure Panel ────────────────────────────────────────────────────
function PricePreviewPanel({ serviceId, domainId, commissionType, rate }:
  { serviceId: string; domainId: string|null; commissionType: string; rate: number }) {
  const [preview, setPreview] = useState<PricePreview|null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!serviceId) { setPreview(null); return }
    setLoading(true)
    commissionsAPI.servicePricePreview(serviceId, domainId)
      .then(r => setPreview(r.data.data))
      .catch(() => setPreview(null))
      .finally(() => setLoading(false))
  }, [serviceId, domainId])

  if (!serviceId) return null
  if (loading) return <div style={{ padding: '8px 0', fontSize: 12, color: '#94A3B8' }}><Spinner size="sm" /> Loading price structure…</div>
  if (!preview) return null

  const calcComm = (price: number) =>
    commissionType === 'PERCENTAGE' ? (price * rate / 100) : rate

  const domainCities = preview.city_prices.filter(c => c.in_domain)
  const otherCities  = preview.city_prices.filter(c => !c.in_domain)

  return (
    <div style={{ marginTop: 10, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ fontWeight: 700, color: '#166534', marginBottom: 6, fontSize: 12 }}>
        📊 Price Structure — {preview.service_name}
      </div>

      {/* Base price */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '5px 8px', background: 'white', borderRadius: 6, marginBottom: 4,
        border: preview.has_overrides ? '1px solid #E2E8F0' : '2px solid #22C55E' }}>
        <div>
          <span style={{ color: '#374151', fontWeight: 600 }}>Base Price</span>
          {!preview.has_overrides && (
            <span style={{ background: '#DCFCE7', color: '#166534', fontSize: 10, fontWeight: 700,
              padding: '1px 6px', borderRadius: 10, marginLeft: 6 }}>Used for commission</span>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontWeight: 700, color: '#0F172A' }}>₹{preview.base_price}</span>
          {rate > 0 && <span style={{ color: '#059669', marginLeft: 8, fontWeight: 600 }}>→ ₹{Math.round(calcComm(preview.base_price)).toString()} comm.</span>}
        </div>
      </div>

      {/* Domain-linked city prices */}
      {domainCities.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 11, color: '#6D28D9', fontWeight: 700, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            🌐 Domain Cities ({domainCities.length})
            {domainId && <span style={{ color: '#94A3B8', fontWeight: 400, marginLeft: 4 }}>— commission uses these prices</span>}
          </div>
          {domainCities.map(c => (
            <div key={c.city_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '4px 8px', background: '#F5F3FF', borderRadius: 5, marginBottom: 3, border: '1px solid #DDD6FE' }}>
              <span style={{ color: '#374151' }}>📍 {c.city_name}, {c.city_state}</span>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontWeight: 700, color: '#7C3AED' }}>₹{c.price}</span>
                {rate > 0 && <span style={{ color: '#059669', marginLeft: 8, fontWeight: 600 }}>→ ₹{Math.round(calcComm(c.price)).toString()}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Other cities (visible only if no domain filter) */}
      {!domainId && otherCities.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            City Overrides ({otherCities.length})
          </div>
          {otherCities.map(c => (
            <div key={c.city_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '4px 8px', background: '#EFF6FF', borderRadius: 5, marginBottom: 3, border: '1px solid #BFDBFE' }}>
              <span style={{ color: '#374151' }}>📍 {c.city_name}, {c.city_state}</span>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontWeight: 700, color: brand }}>₹{c.price}</span>
                {rate > 0 && <span style={{ color: '#059669', marginLeft: 8, fontWeight: 600 }}>→ ₹{Math.round(calcComm(c.price)).toString()}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {!preview.has_overrides && (
        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 6, fontStyle: 'italic' }}>
          ℹ️ No city-specific overrides — base price applies in all cities
        </div>
      )}

      <div style={{ fontSize: 11, color: '#64748B', marginTop: 6, paddingTop: 5, borderTop: '1px solid #BBF7D0' }}>
        💡 Commission priority: Domain city price → City override → Base price
      </div>
    </div>
  )
}

// ── Inventory item search combobox ───────────────────────────────────────────
function InventorySearchBox({
  onSelect
}: { onSelect: (item: InventoryItem|null) => void }) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<InventoryItem[]>([])
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<InventoryItem|null>(null)
  const timerRef = useRef<any>(null)
  const wrapRef  = useRef<HTMLDivElement>(null)

  const search = (q: string) => {
    if (q.length < 1) { setResults([]); setOpen(false); return }
    setLoading(true)
    inventoryAPI.list({ search: q, per_page: 15 })
      .then((r: any) => { const list = r.data.data?.items || []; setResults(list); setOpen(true) })
      .catch(() => setResults([]))
      .finally(() => setLoading(false))
  }

  const onInput = (v: string) => {
    setQuery(v)
    if (!v) { setSelected(null); onSelect(null); setOpen(false); setResults([]); return }
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(v), 280)
  }

  const pick = (item: InventoryItem) => {
    setSelected(item); setQuery(item.name); setOpen(false); onSelect(item)
  }

  const clear = () => { setSelected(null); setQuery(''); setResults([]); setOpen(false); onSelect(null) }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={wrapRef}>
      <div style={{ position: 'relative' }}>
        <input className="input" value={query} onChange={e => onInput(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true) }}
          placeholder="Search spare part / inventory item…" style={{ paddingRight: 32 }} />
        {loading && <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}><Spinner size="sm" /></div>}
        {selected && !loading && (
          <button onClick={clear} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 16 }}>×</button>
        )}
      </div>
      {open && results.length > 0 && (
        <div style={{ position: 'absolute', zIndex: 100, background: 'white',
          border: '1px solid #E2E8F0', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          maxHeight: 220, overflowY: 'auto', marginTop: 2, minWidth: 300 }}>
          {results.map(item => (
            <div key={item.id} onClick={() => pick(item)}
              style={{ padding: '9px 14px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid #F8FAFC' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#EFF6FF')}
              onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
              <div style={{ fontWeight: 600, color: '#0F172A' }}>{item.name}</div>
              <div style={{ color: '#64748B', marginTop: 1 }}>
                Cost: ₹{item.cost_price} · Sale: ₹{item.selling_price} · MRP: ₹{item.mrp} · Stock: {item.current_stock} {item.unit}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Show selected item price details */}
      {selected && (
        <div style={{ marginTop: 8, background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
          <div style={{ fontWeight: 700, color: '#92400E', marginBottom: 5 }}>🔩 {selected.name}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            <div style={{ background: 'white', border: '1px solid #FDE68A', borderRadius: 5, padding: '5px 8px' }}>
              <div style={{ fontSize: 10, color: '#92400E', fontWeight: 700 }}>COST PRICE</div>
              <div style={{ fontWeight: 700, color: '#0F172A', fontSize: 14 }}>₹{selected.cost_price}</div>
            </div>
            <div style={{ background: 'white', border: '1px solid #FDE68A', borderRadius: 5, padding: '5px 8px' }}>
              <div style={{ fontSize: 10, color: '#92400E', fontWeight: 700 }}>SELLING PRICE</div>
              <div style={{ fontWeight: 700, color: '#0F172A', fontSize: 14 }}>₹{selected.selling_price}</div>
            </div>
            <div style={{ background: 'white', border: '1px solid #FDE68A', borderRadius: 5, padding: '5px 8px' }}>
              <div style={{ fontSize: 10, color: '#92400E', fontWeight: 700 }}>PROFIT</div>
              <div style={{ fontWeight: 700, color: '#059669', fontSize: 14 }}>
                ₹{Math.round(selected.selling_price - selected.cost_price).toLocaleString('en-IN')}
                {selected.selling_price > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 400, color: '#64748B', marginLeft: 4 }}>
                    ({((selected.selling_price - selected.cost_price) / selected.selling_price * 100).toFixed(1)}%)
                  </span>
                )}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 5, fontSize: 11, color: '#78716C' }}>
            ℹ️ Office Stock: commission is % of profit (selling − cost). Market Purchase: technician keeps their cost; commission is % of selling price.
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function CommissionGroups() {
  const [groups, setGroups]       = useState<Group[]>([])
  const [loading, setLoading]     = useState(true)
  const [allTechs, setAllTechs]   = useState<Technician[]>([])
  const [domains, setDomains]     = useState<Domain[]>([])

  // Group modal
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState<Group | null>(null)
  const [form, setForm]           = useState({ name: '', description: '' })
  const [rules, setRules]         = useState<GroupRule[]>([])
  // Per-rule selected service objects (for displaying price preview)
  const [ruleServices, setRuleServices] = useState<(Service|null)[]>([])
  const [saving, setSaving]       = useState(false)
  const [err, setErr]             = useState('')
  const [confirmDelete, setConfirmDelete] = useState<Group | null>(null)

  const { toasts, removeToast, toast } = useToast()

  // Detail drawer
  const [detail, setDetail]         = useState<any | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [assignSearch, setAssignSearch]   = useState('')
  const [assigning, setAssigning]         = useState(false)

  // Part commission rules
  const [partRules, setPartRules]         = useState<any[]>([])
  const [partRulesLoading, setPartRulesLoading] = useState(false)
  const [showPartRuleForm, setShowPartRuleForm] = useState(false)
  const [editingPartRule, setEditingPartRule] = useState<any | null>(null)
  const [partRuleForm, setPartRuleForm] = useState({
    part_name_match: '', part_source_filter: '', commission_type: 'PERCENTAGE', rate: 0
  })
  const [partRuleSaving, setPartRuleSaving] = useState(false)
  const [partRuleErr, setPartRuleErr]       = useState('')
  // Selected inventory item for part rule preview
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItem|null>(null)

  const fetchGroups = async () => {
    setLoading(true)
    try { const r = await commissionsAPI.listGroups(); setGroups(r.data.data || []) }
    catch { setGroups([]) } finally { setLoading(false) }
  }

  useEffect(() => {
    fetchGroups()
    techniciansAPI.list({ per_page: 200 })
      .then(r => { const d = r.data.data; setAllTechs(d.technicians || d.items || []) })
      .catch(() => {})
    domainsAPI.list({ per_page: 100 })
      .then(r => {
        const d = r.data.data
        setDomains(Array.isArray(d) ? d : (d?.items || d?.domains || d?.data || []))
      })
      .catch(() => setDomains([]))
  }, [])

  // ── Open create ──────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', description: '' })
    setRules([{ service_id: '', domain_id: null, commission_type: 'PERCENTAGE', rate: 0 }])
    setRuleServices([null])
    setErr(''); setShowModal(true)
  }

  // ── Open edit ────────────────────────────────────────────────────────────────
  const openEdit = async (g: Group) => {
    setEditing(g)
    setForm({ name: g.name, description: g.description || '' })
    const baseRules = g.rules.length
      ? g.rules.map(r => ({ ...r }))
      : [{ service_id: '', domain_id: null, commission_type: 'PERCENTAGE', rate: 0 }]
    setRules(baseRules)
    // Resolve service names for existing rules
    const svcObjs: (Service|null)[] = baseRules.map(() => null)
    setRuleServices(svcObjs)
    setErr(''); setShowModal(true)
  }

  // ── Save ─────────────────────────────────────────────────────────────────────
  const save = async () => {
    if (!form.name.trim()) { setErr('Group name is required'); return }
    const validRules = rules.filter(r => r.service_id)
    if (validRules.length === 0) { setErr('At least one service rule with a selected service is required'); return }
    // Duplicate service check
    const svcIds = validRules.map(r => r.service_id)
    const dupId = svcIds.find((id, i) => svcIds.indexOf(id) !== i)
    if (dupId) { setErr('Duplicate service detected — each service can only appear once per group'); return }
    const zeroRate = validRules.find(r => r.rate <= 0)
    if (zeroRate) { setErr('All rules must have a commission rate greater than 0'); return }
    if (validRules.filter(r => r.commission_type === 'PERCENTAGE').some(r => r.rate > 100)) {
      setErr('Percentage commission cannot exceed 100%'); return
    }
    setSaving(true); setErr('')
    try {
      const payload = { name: form.name, description: form.description, rules: validRules }
      if (editing) {
        await commissionsAPI.updateGroup(editing.id, payload)
      } else {
        await commissionsAPI.createGroup(payload)
      }
      setShowModal(false); fetchGroups()
      toast.success(editing ? 'Group Updated' : 'Group Created',
        editing ? 'Commission group saved successfully.' : 'New commission group created.')
    } catch (e: any) { setErr(e.response?.data?.detail || 'Save failed') }
    finally { setSaving(false) }
  }

  // ── Open detail ──────────────────────────────────────────────────────────────
  const openDetail = async (g: Group) => {
    setDetailLoading(true); setDetail({ ...g, technicians: [] }); setPartRules([])
    setShowPartRuleForm(false); setEditingPartRule(null); setSelectedInventoryItem(null)
    try {
      const [r, pr] = await Promise.all([
        commissionsAPI.getGroup(g.id),
        commissionsAPI.listPartRules(g.id),
      ])
      setDetail(r.data.data)
      setPartRules(pr.data.data || [])
    } catch {} finally { setDetailLoading(false) }
  }

  const reloadPartRules = async (groupId: string) => {
    const pr = await commissionsAPI.listPartRules(groupId)
    setPartRules(pr.data.data || [])
  }

  // ── Part rule validation ─────────────────────────────────────────────────────
  const validatePartRule = (): string => {
    if (partRuleForm.rate <= 0) return 'Commission rate must be greater than 0'
    if (partRuleForm.commission_type === 'PERCENTAGE' && partRuleForm.rate > 100) return 'Percentage cannot exceed 100%'
    // If office stock + percentage + we have a selected item preview — check commission doesn't exceed 100% of profit
    if (
      selectedInventoryItem &&
      partRuleForm.commission_type === 'PERCENTAGE' &&
      (partRuleForm.part_source_filter === '' || partRuleForm.part_source_filter === 'OFFICE_STOCK')
    ) {
      const profit = selectedInventoryItem.selling_price - selectedInventoryItem.cost_price
      if (profit <= 0) {
        return `⚠️ This item has no profit margin (cost ≥ selling price). Cannot set a profit-based commission.`
      }
      // For office stock, 100% rate means "all of the profit". Warn if rate would give more than profit.
      // Since base = profit, rate % of profit — 100% is the max meaningful value (already capped by input).
      // But if user entered FLAT and value > profit, warn too:
    }
    if (
      selectedInventoryItem &&
      partRuleForm.commission_type === 'FLAT' &&
      partRuleForm.part_source_filter === 'OFFICE_STOCK'
    ) {
      const profit = selectedInventoryItem.selling_price - selectedInventoryItem.cost_price
      if (partRuleForm.rate > profit && profit > 0) {
        return `⚠️ Flat commission ₹${partRuleForm.rate} exceeds profit ₹${profit.toFixed(2)} on this item. Reduce the flat amount.`
      }
    }
    return ''
  }

  const savePartRule = async () => {
    setPartRuleErr('')
    const validationError = validatePartRule()
    if (validationError) { setPartRuleErr(validationError); return }
    if (!detail) return
    setPartRuleSaving(true)
    try {
      const payload = {
        part_name_match: partRuleForm.part_name_match || null,
        part_source_filter: partRuleForm.part_source_filter || null,
        commission_type: partRuleForm.commission_type,
        rate: partRuleForm.rate,
      }
      if (editingPartRule) {
        await commissionsAPI.updatePartRule(detail.id, editingPartRule.id, payload)
        toast.success('Part Rule Updated', 'Spare part commission rule saved.')
      } else {
        await commissionsAPI.addPartRule(detail.id, payload)
        toast.success('Part Rule Added', 'Spare part commission rule created.')
      }
      setShowPartRuleForm(false); setEditingPartRule(null); setSelectedInventoryItem(null)
      await reloadPartRules(detail.id)
    } catch (e: any) {
      toast.error('Error', e.response?.data?.detail || 'Save failed')
    } finally { setPartRuleSaving(false) }
  }

  const deletePartRule = async (ruleId: string) => {
    if (!detail) return
    try {
      await commissionsAPI.deletePartRule(detail.id, ruleId)
      toast.success('Deleted', 'Part rule removed.')
      await reloadPartRules(detail.id)
    } catch (e: any) {
      toast.error('Error', e.response?.data?.detail || 'Delete failed')
    }
  }

  // ── Assign technician ────────────────────────────────────────────────────────
  const assignTech = async (techId: string) => {
    if (!detail) return
    setAssigning(true)
    try {
      await commissionsAPI.assignTechnician(detail.id, techId)
      const r = await commissionsAPI.getGroup(detail.id)
      setDetail(r.data.data); fetchGroups()
    } catch (e: any) { toast.error('Error', e.response?.data?.detail || 'Failed to assign technician') }
    finally { setAssigning(false) }
  }

  const removeTech = async (techId: string) => {
    if (!detail) return
    setAssigning(true)
    try {
      await commissionsAPI.removeAssignment(detail.id, techId)
      const r = await commissionsAPI.getGroup(detail.id)
      setDetail(r.data.data); fetchGroups()
    } catch {} finally { setAssigning(false) }
  }

  const deleteGroup = (g: Group) => setConfirmDelete(g)
  const confirmDeleteGroup = async () => {
    if (!confirmDelete) return
    try {
      await commissionsAPI.deleteGroup(confirmDelete.id)
      toast.success('Group Deactivated', `"${confirmDelete.name}" has been deactivated.`)
      fetchGroups()
    } catch (e: any) {
      toast.error('Error', e.response?.data?.detail || 'Failed to deactivate group')
    } finally { setConfirmDelete(null) }
  }

  // ── Rule helpers ─────────────────────────────────────────────────────────────
  const addRule = () => {
    setRules(r => [...r, { service_id: '', domain_id: null, commission_type: 'PERCENTAGE', rate: 0 }])
    setRuleServices(rs => [...rs, null])
  }
  const removeRule = (i: number) => {
    setRules(r => r.filter((_, idx) => idx !== i))
    setRuleServices(rs => rs.filter((_, idx) => idx !== i))
  }
  const updateRule = (i: number, k: keyof GroupRule, v: any) =>
    setRules(r => r.map((row, idx) => idx === i ? { ...row, [k]: v } : row))
  const setRuleService = (i: number, svc: Service|null) => {
    setRuleServices(rs => rs.map((s, idx) => idx === i ? svc : s))
    updateRule(i, 'service_id', svc?.id || '')
  }

  const assignedIds = detail?.technicians?.map((t: any) => t.id) || []
  const unassigned = allTechs.filter(t =>
    !assignedIds.includes(t.id) &&
    (assignSearch === '' || t.name.toLowerCase().includes(assignSearch.toLowerCase()) || t.mobile.includes(assignSearch))
  )

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader
        title="Commission Groups"
        subtitle="Define per-service and per-part commission rules and assign technicians"
        actions={<button className="btn btn-primary" onClick={openCreate}>+ New Group</button>}
      />
      <div style={{ height: 20 }} />

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spinner /></div>
      ) : groups.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: 'center', color: '#94A3B8' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>No commission groups yet</div>
          <div style={{ fontSize: 13, marginBottom: 20 }}>
            Create groups to define how much commission each technician earns per service and spare part.
          </div>
          <button className="btn btn-primary" onClick={openCreate}>+ Create First Group</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
          {groups.map(g => (
            <div key={g.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 18px', borderBottom: '1px solid #F1F5F9',
                background: 'linear-gradient(135deg,#EFF6FF,#F8FAFC)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: '#0F172A' }}>💼 {g.name}</div>
                  {g.description && <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{g.description}</div>}
                </div>
                <span style={{ fontSize: 11, background: '#DCFCE7', color: '#166534', padding: '2px 8px',
                  borderRadius: 20, fontWeight: 600, flexShrink: 0 }}>
                  👥 {g.technician_count} tech{g.technician_count !== 1 ? 's' : ''}
                </span>
              </div>

              <div style={{ padding: '12px 18px' }}>
                {g.rules.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#94A3B8' }}>No service rules defined</div>
                ) : g.rules.slice(0, 4).map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    fontSize: 13, padding: '5px 0', borderBottom: '1px solid #F8FAFC' }}>
                    <span style={{ color: '#374151', flex: 1 }}>🔧 {r.service_name || r.service_id || '—'}</span>
                    {r.domain_id && <span style={{ fontSize: 11, color: '#7C3AED', background: '#F5F3FF',
                      padding: '1px 6px', borderRadius: 10, marginRight: 6 }}>Domain</span>}
                    <span style={{ fontWeight: 700, color: '#059669', flexShrink: 0 }}>
                      {r.commission_type === 'PERCENTAGE' ? `${r.rate}%` : `₹${r.rate}`}
                    </span>
                  </div>
                ))}
                {g.rules.length > 4 && (
                  <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>+{g.rules.length - 4} more rules</div>
                )}
              </div>

              <div style={{ padding: '10px 18px', borderTop: '1px solid #F1F5F9',
                display: 'flex', gap: 8, background: '#FAFAFA' }}>
                <button className="btn btn-primary btn-sm" onClick={() => openDetail(g)}>👥 Manage</button>
                <button className="btn btn-secondary btn-sm" onClick={() => openEdit(g)}>✏️ Edit</button>
                <button className="btn btn-secondary btn-sm" onClick={() => deleteGroup(g)}
                  style={{ marginLeft: 'auto', color: '#EF4444', border: '1px solid #FECACA' }}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════
          CREATE / EDIT GROUP MODAL
      ═══════════════════════════════════════ */}
      {showModal && (
        <Modal title={editing ? `Edit — ${editing.name}` : 'Create Commission Group'}
          onClose={() => setShowModal(false)} size="xl">

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <Label>Group Name *</Label>
              <input className="input" placeholder="e.g. Standard Technicians, Senior Tier"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <Label>Description</Label>
              <input className="input" placeholder="Optional description"
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>

          {/* Service Rules */}
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', textTransform: 'uppercase',
            letterSpacing: '0.06em', marginBottom: 10, paddingBottom: 6, borderBottom: '2px solid #EFF6FF' }}>
            🔧 Commission Rules per Service
          </div>
          <div style={{ fontSize: 12, color: '#64748B', marginBottom: 14, background: '#F8FAFC', padding: '8px 12px', borderRadius: 6 }}>
            💡 Commission priority: Domain city price → City override → Base price<br/>
            Search and select a service to see its full price structure before setting the rate.
          </div>

          {rules.map((r, i) => (
            <div key={i} style={{ marginBottom: 14, background: '#F8FAFC', borderRadius: 10,
              padding: '14px 16px', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Rule #{i + 1}</span>
                <button onClick={() => removeRule(i)} disabled={rules.length === 1}
                  style={{ background: 'none', border: '1px solid #FECACA', color: '#EF4444', borderRadius: 6,
                    padding: '4px 8px', cursor: 'pointer', fontSize: 12, opacity: rules.length === 1 ? 0.4 : 1 }}>
                  ✕ Remove
                </button>
              </div>

              {/* Row 1: Service search + Domain */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <Label>Service * — Search to select</Label>
                  <ServiceSearchBox
                    value={ruleServices[i] || null}
                    onChange={svc => setRuleService(i, svc)}
                    placeholder="Type to search services…"
                    existingServiceIds={rules
                      .filter((_, idx) => idx !== i)
                      .map(r => r.service_id)
                      .filter(Boolean)}
                  />
                </div>
                <div>
                  <Label>Service Domain (optional)</Label>
                  <select className="input" value={r.domain_id || ''}
                    onChange={e => updateRule(i, 'domain_id', e.target.value || null)}>
                    <option value="">— All domains —</option>
                    {domains.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <div style={{ fontSize: 11, color: '#6D28D9', marginTop: 3 }}>
                    {r.domain_id ? '✅ Domain-scoped: city prices for this domain shown below' : 'ℹ️ No domain filter — all city overrides apply'}
                  </div>
                </div>
              </div>

              {/* Price structure panel */}
              {r.service_id && (
                <PricePreviewPanel
                  serviceId={r.service_id}
                  domainId={r.domain_id}
                  commissionType={r.commission_type}
                  rate={r.rate}
                />
              )}

              {/* Row 2: Type + Rate */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                <div>
                  <Label>Commission Type</Label>
                  <select className="input" value={r.commission_type}
                    onChange={e => updateRule(i, 'commission_type', e.target.value)}>
                    <option value="PERCENTAGE">% Percentage of service price</option>
                    <option value="FLAT">₹ Flat Amount</option>
                  </select>
                </div>
                <div>
                  <Label>{r.commission_type === 'PERCENTAGE' ? 'Rate (%) — must be > 0' : 'Amount (₹) — must be > 0'}</Label>
                  <input className="input" type="number" min={0}
                    max={r.commission_type === 'PERCENTAGE' ? 100 : undefined}
                    step={r.commission_type === 'PERCENTAGE' ? 0.5 : 1}
                    value={r.rate}
                    onChange={e => {
                      let v = parseFloat(e.target.value) || 0
                      if (r.commission_type === 'PERCENTAGE' && v > 100) v = 100
                      updateRule(i, 'rate', v)
                    }} />
                  {r.commission_type === 'PERCENTAGE' && r.rate > 100 && (
                    <div style={{ fontSize: 11, color: '#DC2626', marginTop: 2 }}>⚠️ Cannot exceed 100%</div>
                  )}
                </div>
              </div>
            </div>
          ))}

          <button className="btn btn-secondary btn-sm" onClick={addRule} style={{ marginBottom: 20 }}>
            + Add Another Service Rule
          </button>

          {err && <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '10px 14px',
            borderRadius: 8, fontSize: 13, marginBottom: 16 }}>⚠️ {err}</div>}

          <div style={{ display: 'flex', gap: 10, paddingTop: 16, borderTop: '1px solid #E2E8F0' }}>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? <Spinner size="sm" /> : editing ? '💾 Save Changes' : '✅ Create Group'}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          </div>
        </Modal>
      )}

      {/* ═══════════════════════════════════════
          DETAIL / TECHNICIANS / PART RULES
      ═══════════════════════════════════════ */}
      {detail && (
        <Modal title={`${detail.name} — Manage`} onClose={() => setDetail(null)} size="xl">
          {detailLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><Spinner /></div>
          ) : (
            <>
              {/* Technician assignment grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {/* Assigned technicians */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 10,
                    textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Assigned ({detail.technicians?.length || 0})
                  </div>
                  {(detail.technicians || []).length === 0 ? (
                    <div style={{ color: '#94A3B8', fontSize: 13, padding: 16, textAlign: 'center',
                      background: '#F8FAFC', borderRadius: 8, border: '2px dashed #E2E8F0' }}>
                      No technicians assigned yet
                    </div>
                  ) : (detail.technicians || []).map((t: any) => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                      background: '#F8FAFC', borderRadius: 8, marginBottom: 8, border: '1px solid #E2E8F0' }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#EFF6FF',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, color: brand, fontSize: 14, flexShrink: 0 }}>
                        {t.name.charAt(0)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#0F172A' }}>{t.name}</div>
                        <div style={{ fontSize: 11, color: '#64748B' }}>{t.mobile} · {t.technician_code || '—'}</div>
                      </div>
                      <button onClick={() => removeTech(t.id)} disabled={assigning}
                        style={{ background: 'none', border: '1px solid #FECACA', color: '#EF4444',
                          borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add technicians */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 10,
                    textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Add Technician
                  </div>
                  <input className="input" placeholder="Search by name or mobile…"
                    value={assignSearch} onChange={e => setAssignSearch(e.target.value)}
                    style={{ marginBottom: 10 }} />
                  <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {unassigned.slice(0, 20).map(t => (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                        background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#EFF6FF',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, color: brand, fontSize: 13 }}>
                          {t.name.charAt(0)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</div>
                          <div style={{ fontSize: 11, color: '#64748B' }}>{t.mobile}</div>
                        </div>
                        <button className="btn btn-primary btn-sm" onClick={() => assignTech(t.id)} disabled={assigning}>
                          {assigning ? '…' : '+ Assign'}
                        </button>
                      </div>
                    ))}
                    {unassigned.length === 0 && (
                      <div style={{ color: '#94A3B8', fontSize: 12, textAlign: 'center', padding: 20 }}>
                        {assignSearch ? 'No matching technicians' : 'All technicians already assigned'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Service commission rules summary */}
              <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 8 }}>
                  🔧 Service Commission Rules
                </div>
                {(detail.rules || []).length === 0 ? (
                  <div style={{ fontSize: 12, color: '#94A3B8' }}>No service rules — edit the group to add.</div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {(detail.rules || []).map((r: any, i: number) => (
                      <div key={i} style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8,
                        padding: '8px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ color: '#374151', fontWeight: 600 }}>🔧 {r.service_name || r.service_id || '—'}</span>
                        {r.base_price !== undefined && (
                          <span style={{ fontSize: 11, color: '#64748B' }}>Base ₹{r.base_price}</span>
                        )}
                        {r.domain_id && (
                          <span style={{ fontSize: 11, background: '#F5F3FF', color: '#7C3AED',
                            padding: '1px 7px', borderRadius: 10, border: '1px solid #DDD6FE', fontWeight: 600 }}>
                            🌐 {r.domain_name || 'Domain-specific'}
                          </span>
                        )}
                        <span style={{ fontWeight: 700, color: '#059669', marginLeft: 'auto' }}>
                          {r.commission_type === 'PERCENTAGE' ? `${r.rate}%` : `₹${r.rate} flat`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Spare Part Commission Rules ─────────────────────────────── */}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>
                      🔩 Spare Part Commission Rules
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                      Office Stock: technician gets commission from profit. Market Purchase: technician paid full cost, gets commission from selling price.
                    </div>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={() => {
                    setEditingPartRule(null)
                    setPartRuleForm({ part_name_match: '', part_source_filter: '', commission_type: 'PERCENTAGE', rate: 0 })
                    setSelectedInventoryItem(null)
                    setPartRuleErr('')
                    setShowPartRuleForm(true)
                  }}>+ Add Part Rule</button>
                </div>

                {partRulesLoading ? (
                  <Spinner />
                ) : partRules.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#94A3B8', padding: '12px', background: '#F8FAFC', borderRadius: 8, border: '2px dashed #E2E8F0', textAlign: 'center' }}>
                    No spare part commission rules yet. Add rules to auto-calculate commission on parts.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {partRules.map((r: any) => (
                      <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: '#0F172A' }}>
                            🔩 {r.part_name_match ? `Parts matching "${r.part_name_match}"` : 'All spare parts'}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                            Source: {r.part_source_filter
                              ? (r.part_source_filter === 'OFFICE_STOCK' ? '🏢 Office Stock only' : '🛒 Market Purchase only')
                              : '🔁 Both (Office + Market)'}
                            &nbsp;·&nbsp; Commission: <b style={{ color: '#059669' }}>
                              {r.commission_type === 'PERCENTAGE' ? `${r.rate}%` : `₹${r.rate} flat`}
                            </b>
                          </div>
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={() => {
                          setEditingPartRule(r)
                          setPartRuleForm({
                            part_name_match: r.part_name_match || '',
                            part_source_filter: r.part_source_filter || '',
                            commission_type: r.commission_type,
                            rate: r.rate,
                          })
                          setSelectedInventoryItem(null)
                          setPartRuleErr('')
                          setShowPartRuleForm(true)
                        }}>✏️</button>
                        <button onClick={() => deletePartRule(r.id)}
                          style={{ background: 'none', border: '1px solid #FECACA', color: '#EF4444', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>🗑️</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Part rule form */}
                {showPartRuleForm && (
                  <div style={{ marginTop: 14, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '16px 18px' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#374151', marginBottom: 12 }}>
                      {editingPartRule ? '✏️ Edit Part Rule' : '➕ New Part Commission Rule'}
                    </div>

                    {/* Inventory item search to preview prices */}
                    <div style={{ marginBottom: 14 }}>
                      <Label>🔍 Preview Part Prices (optional — search to see cost/profit before setting commission)</Label>
                      <InventorySearchBox onSelect={item => setSelectedInventoryItem(item)} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                      <div>
                        <Label>Part Name Filter (keyword match, optional)</Label>
                        <input className="input" placeholder="e.g. Compressor, Capacitor (blank = all parts)"
                          value={partRuleForm.part_name_match}
                          onChange={e => setPartRuleForm(f => ({ ...f, part_name_match: e.target.value }))} />
                        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Leave blank to match ALL spare parts in this group</div>
                      </div>
                      <div>
                        <Label>Part Source</Label>
                        <select className="input" value={partRuleForm.part_source_filter}
                          onChange={e => setPartRuleForm(f => ({ ...f, part_source_filter: e.target.value }))}>
                          <option value="">🔁 Both (Office Stock + Market Purchase)</option>
                          <option value="OFFICE_STOCK">🏢 Office Stock only — commission from profit</option>
                          <option value="MARKET_PURCHASE">🛒 Market Purchase only — tech buys, commission from selling price</option>
                        </select>
                        <div style={{ fontSize: 11, color: '#64748B', marginTop: 3 }}>
                          {partRuleForm.part_source_filter === 'OFFICE_STOCK'
                            ? '🏢 Office provides the part. Commission should be ≤ profit margin.'
                            : partRuleForm.part_source_filter === 'MARKET_PURCHASE'
                            ? '🛒 Tech purchases the part at market rate. They keep their purchase cost; commission is from selling price.'
                            : 'Applies to both office-issued and market-purchased parts.'}
                        </div>
                      </div>
                      <div>
                        <Label>Commission Type</Label>
                        <select className="input" value={partRuleForm.commission_type}
                          onChange={e => setPartRuleForm(f => ({ ...f, commission_type: e.target.value }))}>
                          <option value="PERCENTAGE">
                            {partRuleForm.part_source_filter === 'OFFICE_STOCK'
                              ? '% Percentage of profit (selling − cost)'
                              : partRuleForm.part_source_filter === 'MARKET_PURCHASE'
                              ? '% Percentage of selling price (tech keeps cost)'
                              : '% Percentage (of profit for office stock / selling price for market)'}
                          </option>
                          <option value="FLAT">₹ Flat amount per unit</option>
                        </select>
                        <div style={{ fontSize: 11, color: '#64748B', marginTop: 3 }}>
                          {partRuleForm.commission_type === 'PERCENTAGE' && partRuleForm.part_source_filter === 'OFFICE_STOCK' &&
                            '🏢 Office stock: commission is % of profit (selling price − cost price). Never exceeds profit.'}
                          {partRuleForm.commission_type === 'PERCENTAGE' && partRuleForm.part_source_filter === 'MARKET_PURCHASE' &&
                            '🛒 Market purchase: technician keeps their cost; commission is % of selling price.'}
                          {partRuleForm.commission_type === 'PERCENTAGE' && !partRuleForm.part_source_filter &&
                            '📋 Both sources: for office stock, base = profit; for market purchase, base = selling price.'}
                          {partRuleForm.commission_type === 'FLAT' &&
                            '₹ Fixed amount per unit, regardless of source or price.'}
                        </div>
                      </div>
                      <div>
                        <Label>{partRuleForm.commission_type === 'PERCENTAGE' ? 'Rate (%)' : 'Amount (₹) per unit'}</Label>
                        <input className="input" type="number" min={0}
                          max={partRuleForm.commission_type === 'PERCENTAGE' ? 100 : undefined}
                          step={0.5}
                          value={partRuleForm.rate}
                          onChange={e => {
                            let v = parseFloat(e.target.value) || 0
                            if (partRuleForm.commission_type === 'PERCENTAGE' && v > 100) v = 100
                            setPartRuleForm(f => ({ ...f, rate: v }))
                          }} />
                        {/* Live commission preview if item selected */}
                        {selectedInventoryItem && partRuleForm.rate > 0 && (() => {
                          const profit = selectedInventoryItem.selling_price - selectedInventoryItem.cost_price
                          let previewAmt = 0
                          let previewBase = ''
                          if (partRuleForm.commission_type === 'FLAT') {
                            previewAmt = partRuleForm.rate
                            previewBase = 'flat per unit'
                          } else if (partRuleForm.part_source_filter === 'OFFICE_STOCK') {
                            previewAmt = profit * partRuleForm.rate / 100
                            previewBase = `${partRuleForm.rate}% of profit ₹${profit.toFixed(2)}`
                          } else if (partRuleForm.part_source_filter === 'MARKET_PURCHASE') {
                            previewAmt = selectedInventoryItem.selling_price * partRuleForm.rate / 100
                            previewBase = `${partRuleForm.rate}% of selling ₹${selectedInventoryItem.selling_price}`
                          } else {
                            // Both — show both
                            const officeComm = profit * partRuleForm.rate / 100
                            const marketComm = selectedInventoryItem.selling_price * partRuleForm.rate / 100
                            return (
                              <div style={{ fontSize: 11, color: '#059669', marginTop: 3 }}>
                                Preview: Office Stock → <b>₹{officeComm.toFixed(2)}</b> ({partRuleForm.rate}% of profit) &nbsp;|&nbsp;
                                Market → <b>₹{marketComm.toFixed(2)}</b> ({partRuleForm.rate}% of selling price)
                              </div>
                            )
                          }
                          return (
                            <div style={{ fontSize: 11, color: '#059669', marginTop: 3, fontWeight: 600 }}>
                              Preview: ₹{Math.round(previewAmt).toLocaleString('en-IN')} per unit ({previewBase})
                            </div>
                          )
                        })()}
                      </div>
                    </div>

                    {partRuleErr && (
                      <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '10px 14px',
                        borderRadius: 8, fontSize: 12, marginBottom: 12 }}>
                        ⚠️ {partRuleErr}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary btn-sm" onClick={savePartRule} disabled={partRuleSaving}>
                        {partRuleSaving ? <Spinner size="sm" /> : editingPartRule ? '💾 Update Rule' : '✅ Add Rule'}
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => {
                        setShowPartRuleForm(false); setEditingPartRule(null)
                        setSelectedInventoryItem(null); setPartRuleErr('')
                      }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </Modal>
      )}

      <Toast toasts={toasts} onRemove={removeToast} />

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 28, maxWidth: 400, width: '100%',
            boxShadow: '0 20px 64px rgba(0,0,0,0.22)', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontWeight: 700, fontSize: 17, color: '#0F172A', marginBottom: 8 }}>Deactivate Group?</div>
            <div style={{ fontSize: 13, color: '#64748B', marginBottom: 24 }}>
              Are you sure you want to deactivate <strong>"{confirmDelete.name}"</strong>?
              This will remove it from technician commission calculations.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmDeleteGroup}
                style={{ background: '#DC2626', border: 'none' }}>🗑️ Yes, Deactivate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
