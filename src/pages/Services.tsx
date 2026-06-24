import { useEffect, useState } from 'react'
import { servicesAPI, citiesAPI } from '@/services/api'
import PageHeader from '@/components/layout/PageHeader'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'

const EMPTY_SVC = { name: '', category_id: '', description: '', base_price: 0, gst_percent: 18, duration_mins: 60, is_visible: true, sort_order: 0 }
const EMPTY_CAT = { name: '', description: '', icon: '', sort_order: 0 }

export default function Services() {
  const [services, setServices]     = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [cities, setCities]         = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [catFilter, setCatFilter]   = useState('')
  const [tab, setTab]               = useState<'services'|'categories'>('services')

  // Service modal
  const [svcModal, setSvcModal]     = useState<any>(null)
  const [svcForm, setSvcForm]       = useState({ ...EMPTY_SVC })
  const [svcSaving, setSvcSaving]   = useState(false)
  const [svcErr, setSvcErr]         = useState('')

  // Category modal
  const [catModal, setCatModal]     = useState<any>(null)
  const [catForm, setCatForm]       = useState({ ...EMPTY_CAT })
  const [catSaving, setCatSaving]   = useState(false)

  // City pricing modal
  const [priceModal, setPriceModal] = useState<any>(null)
  const [cityPrices, setCityPrices] = useState<any[]>([])
  const [priceLoading, setPriceLoading] = useState(false)
  const [newPrice, setNewPrice]     = useState({ city_id: '', price: '' })

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [sRes, cRes, cityRes] = await Promise.all([
        servicesAPI.list({ category_id: catFilter || undefined, visible_only: false }),
        servicesAPI.categories(),
        citiesAPI.list(),
      ])
      // Backend /services returns { items: [...], total: N } — not a plain array
      const svcData = sRes.data.data
      setServices(Array.isArray(svcData) ? svcData : (svcData?.items || []))
      setCategories(cRes.data.data || [])
      // Backend /cities returns a plain array
      const cityData = cityRes.data.data
      setCities(Array.isArray(cityData) ? cityData : (cityData?.items || []))
    } catch { setServices([]) } finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [catFilter])

  const openSvcModal = (s?: any) => {
    if (s) {
      setSvcForm({ name: s.name, category_id: s.category_id, description: s.description || '', base_price: s.base_price, gst_percent: s.gst_percent, duration_mins: s.duration_mins, is_visible: s.is_visible, sort_order: s.sort_order || 0 })
      setSvcModal(s)
    } else {
      setSvcForm({ ...EMPTY_SVC }); setSvcModal('new')
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
      // Try to get city prices — API may not exist yet, show empty state gracefully
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

  const tabBtn = (t: string) => ({
    padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
    background: tab === t ? '#1B4FD8' : '#F1F5F9', color: tab === t ? '#fff' : '#334155'
  })

  const grouped = categories.map(c => ({ ...c, services: services.filter(s => s.category_id === c.id) }))
  const filtered = grouped.filter(g => !catFilter || g.id === catFilter)

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader title="Services" subtitle={`${services.length} services · ${categories.length} categories`}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" style={tabBtn('categories')} onClick={() => setTab('categories')}>Categories</button>
            <button className="btn btn-secondary" style={tabBtn('services')} onClick={() => setTab('services')}>Services</button>
            <button className="btn btn-primary" onClick={() => tab === 'categories' ? openCatModal() : openSvcModal()}>
              {tab === 'categories' ? '+ Category' : '+ Service'}
            </button>
          </div>
        } />
      <div style={{ height: 16 }} />

      {/* Filter bar */}
      <div className="card" style={{ padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <select className="input" style={{ width: 220 }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span style={{ fontSize: 13, color: '#94A3B8' }}>{services.length} services across {categories.length} categories</span>
      </div>

      {loading ? <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div> : (
        <>
          {/* CATEGORIES TAB */}
          {tab === 'categories' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
              {categories.map((c: any) => {
                const count = services.filter(s => s.category_id === c.id).length
                return (
                  <div key={c.id} className="card" style={{ padding: '16px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ fontSize: 24 }}>{c.icon || '⚙️'}</div>
                      <button className="btn btn-secondary btn-sm" onClick={() => openCatModal(c)}>Edit</button>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#0F172A', marginBottom: 4 }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: '#94A3B8' }}>{count} services</div>
                    {c.description && <div style={{ fontSize: 12, color: '#64748B', marginTop: 6, borderTop: '1px solid #F1F5F9', paddingTop: 6 }}>{c.description}</div>}
                  </div>
                )
              })}
            </div>
          )}

          {/* SERVICES TAB — grouped by category */}
          {tab === 'services' && filtered.map(g => (
            <div key={g.id} className="card" style={{ marginBottom: 16 }}>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{g.icon || '⚙️'}</span>
                  <span style={{ fontWeight: 700, fontSize: 15, color: '#0F172A' }}>{g.name}</span>
                  <span style={{ fontSize: 12, color: '#94A3B8', background: '#F1F5F9', padding: '2px 8px', borderRadius: 20 }}>{g.services.length} services</span>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => { setCatFilter(g.id); setSvcModal('new'); setSvcForm(f => ({ ...f, category_id: g.id })) }}>
                  + Service here
                </button>
              </div>
              <table className="data-table">
                <thead><tr><th>Name</th><th>Base Price</th><th>GST</th><th>Duration</th><th>Sort</th><th>Visible</th><th>Actions</th></tr></thead>
                <tbody>
                  {g.services.length === 0
                    ? <tr><td colSpan={7} style={{ textAlign: 'center', color: '#94A3B8', padding: 20, fontSize: 13 }}>No services in this category</td></tr>
                    : g.services.map((s: any) => (
                      <tr key={s.id}>
                        <td>
                          <div style={{ fontWeight: 500 }}>{s.name}</div>
                          {s.description && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{s.description.substring(0, 60)}{s.description.length > 60 ? '…' : ''}</div>}
                        </td>
                        <td style={{ fontWeight: 700, color: '#059669' }}>₹{s.base_price?.toLocaleString('en-IN')}</td>
                        <td style={{ fontSize: 13 }}>{s.gst_percent}%</td>
                        <td style={{ fontSize: 13 }}>{s.duration_mins} min</td>
                        <td style={{ fontSize: 13 }}>{s.sort_order ?? 0}</td>
                        <td>
                          <span className={`badge ${s.is_visible ? 'status-ACTIVE' : 'status-INACTIVE'}`}>{s.is_visible ? 'Visible' : 'Hidden'}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => openSvcModal(s)}>Edit</button>
                            <button className="btn btn-secondary btn-sm" style={{ color: '#1B4FD8' }} onClick={() => openPriceModal(s)}>🏙️ Prices</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}

      {/* Service modal */}
      {svcModal && (
        <Modal title={svcModal === 'new' ? 'New Service' : `Edit: ${svcModal.name}`} onClose={() => setSvcModal(null)}>
          <form onSubmit={saveSvc}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Category *</label>
              <select className="input" value={svcForm.category_id} onChange={e => setSvcForm(f => ({ ...f, category_id: e.target.value }))} required>
                <option value="">Select category</option>
                {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
          <p style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>
            Base price: <strong>₹{priceModal.base_price?.toLocaleString('en-IN')}</strong> — Set city-specific overrides below.
          </p>
          {priceLoading ? <Spinner /> : (
            <>
              <table className="data-table" style={{ marginBottom: 16 }}>
                <thead><tr><th>City</th><th>City Price</th><th>Status</th></tr></thead>
                <tbody>
                  {cityPrices.length === 0
                    ? <tr><td colSpan={3} style={{ textAlign: 'center', color: '#94A3B8', padding: 20, fontSize: 13 }}>No city-wise prices set. Base price applies everywhere.</td></tr>
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
