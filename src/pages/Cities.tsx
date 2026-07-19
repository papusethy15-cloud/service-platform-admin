import { useEffect, useRef, useState } from 'react'
import { citiesAPI } from '@/services/api'
import PageHeader from '@/components/layout/PageHeader'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'

type CityTab = 'areas' | 'zones' | 'pricing' | 'settings'

const CITY_FORM = { name: '', state: '', country: 'India', base_travel_charge: 0, latitude: '', longitude: '' }
const AREA_FORM = { name: '', pincode: '', surge_multiplier: 1.0 }
const ZONE_FORM = { name: '', description: '' }

export default function Cities() {
  const [cities, setCities]         = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState<any>(null)
  const [tab, setTab]               = useState<CityTab>('areas')
  const [areas, setAreas]           = useState<any[]>([])
  const [zones, setZones]           = useState<any[]>([])
  const [pricing, setPricing]       = useState<any>(null)
  const [citySettings, setCitySettings] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Zone accordion collapse state
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set())

  // City modal
  const [cityModal, setCityModal]   = useState(false)
  const [cityForm, setCityForm]     = useState({ ...CITY_FORM })
  const [citySaving, setCitySaving] = useState(false)
  const [cityErr, setCityErr]       = useState('')

  // Area modal
  const [areaModal, setAreaModal]   = useState(false)
  const [areaForm, setAreaForm]     = useState({ ...AREA_FORM })
  const [zonePick, setZonePick]     = useState('')

  // Zone modal
  const [zoneModal, setZoneModal]   = useState(false)
  const [zoneForm, setZoneForm]     = useState({ ...ZONE_FORM })

  // Pricing edit
  const [pricingEdit, setPricingEdit] = useState<any>(null)

  // Edit Area modal
  const [editAreaModal, setEditAreaModal]   = useState(false)
  const [editAreaTarget, setEditAreaTarget] = useState<any>(null)
  const [editAreaForm, setEditAreaForm]     = useState({ ...AREA_FORM })
  const [editAreaZone, setEditAreaZone]     = useState('')
  const [editAreaSaving, setEditAreaSaving] = useState(false)

  // Bulk JSON import
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importModal, setImportModal]   = useState(false)
  const [importData, setImportData]     = useState<any[]>([])
  const [importFileName, setImportFileName] = useState('')
  const [importLoading, setImportLoading]   = useState(false)
  const [importResult, setImportResult]     = useState<any>(null)
  const [importErr, setImportErr]           = useState('')

  const fetchCities = async () => {
    setLoading(true)
    try { const r = await citiesAPI.list(); setCities(r.data.data || []) }
    catch { setCities([]) } finally { setLoading(false) }
  }

  useEffect(() => { fetchCities() }, [])

  const openCity = async (city: any) => {
    setSelected(city); setTab('areas'); setDetailLoading(true)
    setExpandedZones(new Set())
    try {
      const [aRes, zRes, pRes] = await Promise.all([
        citiesAPI.areas(city.id).catch(() => ({ data: { data: [] } })),
        citiesAPI.zones(city.id).catch(() => ({ data: { data: [] } })),
        citiesAPI.pricing(city.id).catch(() => ({ data: { data: null } })),
      ])
      setAreas(aRes.data.data || [])
      setZones(zRes.data.data || [])
      setPricing(pRes.data.data)
      setPricingEdit(null)
    } catch {} finally { setDetailLoading(false) }
    citiesAPI.settings(city.id).then(r => setCitySettings(r.data.data)).catch(() => setCitySettings(null))
  }

  const toggleZoneExpand = (zoneId: string) => {
    setExpandedZones(prev => {
      const next = new Set(prev)
      if (next.has(zoneId)) next.delete(zoneId); else next.add(zoneId)
      return next
    })
  }

  const expandAllZones = () => setExpandedZones(new Set(zones.map((z: any) => z.id)))
  const collapseAllZones = () => setExpandedZones(new Set())

  const createCity = async (e: any) => {
    e.preventDefault(); setCitySaving(true); setCityErr('')
    try {
      await citiesAPI.create({ ...cityForm, latitude: cityForm.latitude ? +cityForm.latitude : undefined, longitude: cityForm.longitude ? +cityForm.longitude : undefined })
      setCityModal(false); setCityForm({ ...CITY_FORM }); fetchCities()
    } catch (ex: any) { setCityErr(ex.response?.data?.detail || 'Failed') } finally { setCitySaving(false) }
  }

  const createArea = async (e: any) => {
    e.preventDefault()
    if (!selected) return
    try {
      await citiesAPI.createArea(selected.id, { ...areaForm, zone_id: zonePick || undefined })
      setAreaModal(false); setAreaForm({ ...AREA_FORM }); setZonePick('')
      const r = await citiesAPI.areas(selected.id); setAreas(r.data.data || [])
    } catch {}
  }

  const createZone = async (e: any) => {
    e.preventDefault()
    if (!selected) return
    try {
      await citiesAPI.createZone(selected.id, zoneForm)
      setZoneModal(false); setZoneForm({ ...ZONE_FORM })
      const r = await citiesAPI.zones(selected.id); setZones(r.data.data || [])
    } catch {}
  }

  const savePricing = async () => {
    if (!selected || !pricingEdit) return
    try {
      await citiesAPI.updatePricing(selected.id, pricingEdit)
      const r = await citiesAPI.pricing(selected.id); setPricing(r.data.data); setPricingEdit(null)
    } catch {}
  }

  const deleteArea = async (areaId: string) => {
    if (!selected) return
    try {
      await citiesAPI.deleteArea(selected.id, areaId)
      const r = await citiesAPI.areas(selected.id); setAreas(r.data.data || [])
    } catch {}
  }

  const openEditArea = (area: any) => {
    setEditAreaTarget(area)
    setEditAreaForm({ name: area.name, pincode: area.pincode || '', surge_multiplier: area.surge_multiplier || 1.0 })
    setEditAreaZone(area.zone_id || '')
    setEditAreaSaving(false)
    setEditAreaModal(true)
  }

  const saveEditArea = async (e: any) => {
    e.preventDefault()
    if (!selected || !editAreaTarget) return
    setEditAreaSaving(true)
    try {
      await citiesAPI.updateArea(selected.id, editAreaTarget.id, { ...editAreaForm, zone_id: editAreaZone || undefined })
      setEditAreaModal(false)
      const r = await citiesAPI.areas(selected.id); setAreas(r.data.data || [])
    } catch {} finally { setEditAreaSaving(false) }
  }

  // ── JSON Import ─────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportFileName(file.name)
    setImportErr('')
    setImportResult(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string)
        const arr = Array.isArray(parsed) ? parsed : [parsed]
        setImportData(arr)
        setImportModal(true)
      } catch {
        setImportErr('Invalid JSON file. Please check the format.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const runImport = async () => {
    setImportLoading(true); setImportErr(''); setImportResult(null)
    try {
      const r = await citiesAPI.bulkImport({ cities: importData })
      setImportResult(r.data.data?.import_summary || [])
      await fetchCities()
      if (selected) {
        const [aRes, zRes] = await Promise.all([
          citiesAPI.areas(selected.id).catch(() => ({ data: { data: [] } })),
          citiesAPI.zones(selected.id).catch(() => ({ data: { data: [] } })),
        ])
        setAreas(aRes.data.data || [])
        setZones(zRes.data.data || [])
      }
    } catch (ex: any) {
      setImportErr(ex.response?.data?.detail || 'Import failed. Please check the JSON format.')
    } finally { setImportLoading(false) }
  }

  const tabBtn = (t: CityTab) => ({
    padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
    background: tab === t ? '#1B4FD8' : '#F1F5F9', color: tab === t ? '#fff' : '#334155',
  })

  // Count areas per zone
  const areasByZone = (zoneId: string) => areas.filter((a: any) => a.zone_id === zoneId)
  const unzonedAreas = areas.filter((a: any) => !a.zone_id)

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader title="Cities & Areas"
        subtitle={`${cities.length} cities configured — services are available city-wise`}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8, border: '1.5px solid #1B4FD8',
              color: '#1B4FD8', fontWeight: 600, fontSize: 13, cursor: 'pointer',
              background: '#EFF6FF', whiteSpace: 'nowrap',
            }}>
              📁 Upload JSON
              <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileSelect} />
            </label>
            <button className="btn btn-primary" onClick={() => { setCityModal(true); setCityErr('') }}>+ Add City</button>
          </div>
        }
      />
      <div style={{ height: 20 }} />

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>

        {/* City list */}
        <div>
          {loading ? <div className="card" style={{ padding: 40, textAlign: 'center' }}><Spinner /></div> : (
            cities.length === 0
              ? <div className="card" style={{ padding: 32, textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>🏙️</div>
                  No cities yet. Add your first service city.
                </div>
              : cities.map((c: any) => (
                <div key={c.id} onClick={() => openCity(c)} className="card" style={{
                  padding: '12px 14px', marginBottom: 8, cursor: 'pointer',
                  border: selected?.id === c.id ? '1.5px solid #1B4FD8' : '1px solid #E2E8F0',
                  background: selected?.id === c.id ? '#EFF6FF' : '#fff',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#0F172A' }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{c.state}, {c.country}</div>
                    </div>
                    <span className={`badge ${c.is_active && c.is_serviceable !== false ? 'status-ACTIVE' : 'status-INACTIVE'}`} style={{ fontSize: 10 }}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: '#94A3B8' }}>
                    <span>🏘️ {c.area_count || 0} areas</span>
                    <span>🚗 ₹{c.base_travel_charge || 0} travel</span>
                  </div>
                </div>
              ))
          )}
        </div>

        {/* City detail */}
        <div>
          {!selected ? (
            <div className="card" style={{ padding: 60, textAlign: 'center', color: '#94A3B8' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🏙️</div>
              <div style={{ fontSize: 15, fontWeight: 500 }}>Select a city to manage it</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>Configure areas, zones, pricing and service settings</div>
            </div>
          ) : (
            <div className="card">
              {/* City header */}
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{selected.name}</h2>
                  <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{selected.state}, {selected.country}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['areas', 'zones', 'pricing', 'settings'] as CityTab[]).map(t => (
                    <button key={t} style={tabBtn(t)} onClick={() => setTab(t)}>
                      {t === 'zones'
                        ? `Zones (${zones.length})`
                        : t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {detailLoading ? (
                <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
              ) : (
                <>
                  {/* ── AREAS TAB — Zone-wise grouped ── */}
                  {tab === 'areas' && (
                    <div style={{ padding: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>
                          Areas / Localities ({areas.length})
                        </span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #CBD5E1', background: '#F8FAFC', color: '#475569', cursor: 'pointer' }} onClick={expandAllZones}>Expand All</button>
                          <button style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #CBD5E1', background: '#F8FAFC', color: '#475569', cursor: 'pointer' }} onClick={collapseAllZones}>Collapse All</button>
                          <button className="btn btn-primary btn-sm" onClick={() => setAreaModal(true)}>+ Add Area</button>
                        </div>
                      </div>

                      {areas.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#94A3B8', padding: 24, fontSize: 13 }}>
                          No areas configured for {selected.name}
                        </div>
                      ) : (
                        <div>
                          {/* Zone-wise groups */}
                          {zones.map((zone: any) => {
                            const zoneAreas = areasByZone(zone.id)
                            const isOpen = expandedZones.has(zone.id)
                            return (
                              <div key={zone.id} style={{ marginBottom: 10, border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
                                {/* Zone header — clickable */}
                                <div
                                  onClick={() => toggleZoneExpand(zone.id)}
                                  style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '10px 14px', cursor: 'pointer',
                                    background: isOpen ? '#EFF6FF' : '#F8FAFC',
                                    borderBottom: isOpen ? '1px solid #DBEAFE' : 'none',
                                    userSelect: 'none',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ fontSize: 14, transition: 'transform 0.2s', display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                                    <span style={{ fontWeight: 600, fontSize: 13, color: '#0F172A' }}>🗺️ {zone.name}</span>
                                    {zone.description && (
                                      <span style={{ fontSize: 11, color: '#94A3B8' }}>— {zone.description}</span>
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{
                                      background: '#DBEAFE', color: '#1D4ED8', fontSize: 11, fontWeight: 700,
                                      padding: '2px 10px', borderRadius: 20,
                                    }}>
                                      {zoneAreas.length} {zoneAreas.length === 1 ? 'area' : 'areas'}
                                    </span>
                                  </div>
                                </div>

                                {/* Zone areas table */}
                                {isOpen && (
                                  <div>
                                    {zoneAreas.length === 0 ? (
                                      <div style={{ padding: '12px 16px', fontSize: 13, color: '#94A3B8' }}>No areas in this zone yet.</div>
                                    ) : (
                                      <table className="data-table" style={{ margin: 0 }}>
                                        <thead>
                                          <tr>
                                            <th>Area Name</th>
                                            <th>Pincode</th>
                                            <th>Surge</th>
                                            <th>Status</th>
                                            <th></th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {zoneAreas.map((a: any) => (
                                            <tr key={a.id}>
                                              <td style={{ fontWeight: 500 }}>{a.name}</td>
                                              <td style={{ fontSize: 12, color: '#64748B', fontFamily: 'monospace' }}>{a.pincode || '—'}</td>
                                              <td style={{ fontSize: 12 }}>{a.surge_multiplier || 1.0}×</td>
                                              <td><span className={`badge ${a.is_active ? 'status-ACTIVE' : 'status-INACTIVE'}`}>{a.is_active ? 'Active' : 'Off'}</span></td>
                                              <td style={{ display: 'flex', gap: 6 }}>
                                                <button className="btn btn-secondary btn-sm" onClick={() => openEditArea(a)}>Edit</button>
                                                <button className="btn btn-danger btn-sm" onClick={() => deleteArea(a.id)}>Remove</button>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}

                          {/* Unzoned areas (no zone assigned) */}
                          {unzonedAreas.length > 0 && (
                            <div style={{ marginBottom: 10, border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
                              <div
                                onClick={() => toggleZoneExpand('__unzoned__')}
                                style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  padding: '10px 14px', cursor: 'pointer',
                                  background: expandedZones.has('__unzoned__') ? '#FFF7ED' : '#F8FAFC',
                                  borderBottom: expandedZones.has('__unzoned__') ? '1px solid #FED7AA' : 'none',
                                  userSelect: 'none',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <span style={{ fontSize: 14, transition: 'transform 0.2s', display: 'inline-block', transform: expandedZones.has('__unzoned__') ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                                  <span style={{ fontWeight: 600, fontSize: 13, color: '#92400E' }}>📌 Unassigned Zone</span>
                                </div>
                                <span style={{ background: '#FED7AA', color: '#92400E', fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20 }}>
                                  {unzonedAreas.length} {unzonedAreas.length === 1 ? 'area' : 'areas'}
                                </span>
                              </div>
                              {expandedZones.has('__unzoned__') && (
                                <table className="data-table" style={{ margin: 0 }}>
                                  <thead><tr><th>Area Name</th><th>Pincode</th><th>Surge</th><th>Status</th><th></th></tr></thead>
                                  <tbody>
                                    {unzonedAreas.map((a: any) => (
                                      <tr key={a.id}>
                                        <td style={{ fontWeight: 500 }}>{a.name}</td>
                                        <td style={{ fontSize: 12, color: '#64748B', fontFamily: 'monospace' }}>{a.pincode || '—'}</td>
                                        <td style={{ fontSize: 12 }}>{a.surge_multiplier || 1.0}×</td>
                                        <td><span className={`badge ${a.is_active ? 'status-ACTIVE' : 'status-INACTIVE'}`}>{a.is_active ? 'Active' : 'Off'}</span></td>
                                        <td style={{ display: 'flex', gap: 6 }}>
                                          <button className="btn btn-secondary btn-sm" onClick={() => openEditArea(a)}>Edit</button>
                                          <button className="btn btn-danger btn-sm" onClick={() => deleteArea(a.id)}>Remove</button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── ZONES TAB ── */}
                  {tab === 'zones' && (
                    <div style={{ padding: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>Zones ({zones.length})</span>
                        <button className="btn btn-primary btn-sm" onClick={() => setZoneModal(true)}>+ Add Zone</button>
                      </div>
                      {zones.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#94A3B8', padding: 24, fontSize: 13 }}>
                          No zones configured. Zones help group areas (e.g. North, South).
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                          {zones.map((z: any) => {
                            const count = areasByZone(z.id).length
                            return (
                              <div key={z.id} style={{
                                background: '#F8FAFC', border: '1px solid #E2E8F0',
                                borderRadius: 10, padding: '12px 14px',
                                position: 'relative', overflow: 'hidden',
                              }}>
                                <div style={{
                                  position: 'absolute', top: 10, right: 10,
                                  background: '#DBEAFE', color: '#1D4ED8',
                                  fontSize: 11, fontWeight: 700,
                                  padding: '2px 9px', borderRadius: 20,
                                }}>
                                  {count} {count === 1 ? 'area' : 'areas'}
                                </div>
                                <div style={{ fontWeight: 600, fontSize: 14, color: '#0F172A', marginBottom: 4, paddingRight: 60 }}>{z.name}</div>
                                {z.description && <div style={{ fontSize: 12, color: '#64748B' }}>{z.description}</div>}
                                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>
                                  🗺️ Zone in {selected.name}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── PRICING TAB ── */}
                  {tab === 'pricing' && (
                    <div style={{ padding: 16, maxWidth: 480 }}>
                      <p style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>
                        Base travel charge is added to every booking in this city. Surge multiplier applies during peak demand.
                      </p>
                      {pricing ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                          <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Base Travel Charge (₹)</label>
                            <input className="input" type="number" min="0" step="10"
                              value={pricingEdit ? pricingEdit.base_travel_charge : (pricing.base_travel_charge ?? 0)}
                              onChange={e => setPricingEdit((p: any) => ({ ...(p || pricing), base_travel_charge: +e.target.value }))} />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Surge Multiplier</label>
                            <input className="input" type="number" min="1" step="0.1"
                              value={pricingEdit ? pricingEdit.surge_multiplier : (pricing.surge_multiplier ?? 1)}
                              onChange={e => setPricingEdit((p: any) => ({ ...(p || pricing), surge_multiplier: +e.target.value }))} />
                          </div>
                        </div>
                      ) : (
                        <div style={{ color: '#94A3B8', fontSize: 13 }}>Loading pricing data...</div>
                      )}
                      {pricingEdit && (
                        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                          <button className="btn btn-primary" onClick={savePricing}>Save Pricing</button>
                          <button className="btn btn-secondary" onClick={() => setPricingEdit(null)}>Cancel</button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── SETTINGS TAB ── */}
                  {tab === 'settings' && (
                    <div style={{ padding: 16, maxWidth: 480 }}>
                      {!citySettings ? (
                        <div style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', padding: 24 }}>No settings found for this city.</div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                          {[
                            ['Min Booking (₹)', 'min_booking_amount', 'number'],
                            ['Max Booking (₹)', 'max_booking_amount', 'number'],
                            ['Advance Booking (days)', 'booking_advance_days', 'number'],
                            ['Cancel Window (hrs)', 'cancellation_window_hrs', 'number'],
                          ].map(([l, k, t]) => (
                            <div key={k}>
                              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{l}</label>
                              <input className="input" type={t as string} value={citySettings[k] ?? ''}
                                onChange={e => setCitySettings((s: any) => ({ ...s, [k]: e.target.value }))} />
                            </div>
                          ))}
                          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input type="checkbox" id="auto-assign" checked={citySettings.auto_assign_enabled}
                              onChange={e => setCitySettings((s: any) => ({ ...s, auto_assign_enabled: e.target.checked }))} />
                            <label htmlFor="auto-assign" style={{ fontSize: 13, cursor: 'pointer' }}>Auto-assign technicians enabled</label>
                          </div>
                        </div>
                      )}
                      {citySettings && (
                        <div style={{ marginTop: 16 }}>
                          <button className="btn btn-primary" onClick={async () => {
                            try { await citiesAPI.updateSettings(selected.id, citySettings) } catch {}
                          }}>Save Settings</button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Create City Modal ── */}
      {cityModal && (
        <Modal title="Add City" onClose={() => setCityModal(false)}>
          <p style={{ fontSize: 13, color: '#64748B', marginBottom: 14 }}>
            Define a city where Palei Solutions operates. Services can have city-specific price overrides.
          </p>
          <form onSubmit={createCity}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              {[['City Name *', 'name', 'text'], ['State *', 'state', 'text'], ['Country', 'country', 'text'],
                ['Base Travel Charge (₹)', 'base_travel_charge', 'number']].map(([l, k, t]) => (
                <div key={k}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{l}</label>
                  <input className="input" type={t as string} min="0"
                    value={(cityForm as any)[k]} required={l.includes('*')}
                    onChange={e => setCityForm(f => ({ ...f, [k]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Latitude (optional)</label>
                <input className="input" type="number" step="any" value={cityForm.latitude}
                  onChange={e => setCityForm(f => ({ ...f, latitude: e.target.value }))} placeholder="20.2961" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Longitude (optional)</label>
                <input className="input" type="number" step="any" value={cityForm.longitude}
                  onChange={e => setCityForm(f => ({ ...f, longitude: e.target.value }))} placeholder="85.8245" />
              </div>
            </div>
            {cityErr && <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 12 }}>{cityErr}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" type="submit" disabled={citySaving}>{citySaving ? <Spinner size="sm" /> : 'Add City'}</button>
              <button className="btn btn-secondary" type="button" onClick={() => setCityModal(false)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Add Area Modal ── */}
      {areaModal && selected && (
        <Modal title={`Add Area to ${selected.name}`} onClose={() => setAreaModal(false)}>
          <form onSubmit={createArea}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Area Name *</label>
                <input className="input" value={areaForm.name} required onChange={e => setAreaForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Pincode</label>
                <input className="input" value={areaForm.pincode} onChange={e => setAreaForm(f => ({ ...f, pincode: e.target.value }))} placeholder="751001" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Zone (optional)</label>
                <select className="input" value={zonePick} onChange={e => setZonePick(e.target.value)}>
                  <option value="">No zone</option>
                  {zones.map((z: any) => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Surge Multiplier</label>
                <input className="input" type="number" min="1" step="0.1" value={areaForm.surge_multiplier}
                  onChange={e => setAreaForm(f => ({ ...f, surge_multiplier: +e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" type="submit">Add Area</button>
              <button className="btn btn-secondary" type="button" onClick={() => setAreaModal(false)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Edit Area Modal ── */}
      {editAreaModal && editAreaTarget && selected && (
        <Modal title={`Edit Area — ${editAreaTarget.name}`} onClose={() => setEditAreaModal(false)}>
          <form onSubmit={saveEditArea}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Area Name *</label>
                <input className="input" value={editAreaForm.name} required
                  onChange={e => setEditAreaForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Pincode</label>
                <input className="input" value={editAreaForm.pincode}
                  onChange={e => setEditAreaForm(f => ({ ...f, pincode: e.target.value }))} placeholder="751001" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Zone (optional)</label>
                <select className="input" value={editAreaZone} onChange={e => setEditAreaZone(e.target.value)}>
                  <option value="">No zone</option>
                  {zones.map((z: any) => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Surge Multiplier</label>
                <input className="input" type="number" min="1" step="0.1" value={editAreaForm.surge_multiplier}
                  onChange={e => setEditAreaForm(f => ({ ...f, surge_multiplier: +e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" type="submit" disabled={editAreaSaving}>
                {editAreaSaving ? <Spinner size="sm" /> : 'Save Changes'}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => setEditAreaModal(false)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Add Zone Modal ── */}
      {zoneModal && selected && (
        <Modal title={`Add Zone to ${selected.name}`} onClose={() => setZoneModal(false)}>
          <form onSubmit={createZone}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Zone Name *</label>
              <input className="input" value={zoneForm.name} required onChange={e => setZoneForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. North Bhubaneswar" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Description</label>
              <input className="input" value={zoneForm.description} onChange={e => setZoneForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" type="submit">Create Zone</button>
              <button className="btn btn-secondary" type="button" onClick={() => setZoneModal(false)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Bulk JSON Import Modal ── */}
      {importModal && (
        <Modal title="📁 Bulk JSON Import" onClose={() => { setImportModal(false); setImportResult(null); setImportData([]) }}>
          <div style={{ fontSize: 13, color: '#64748B', marginBottom: 14 }}>
            <strong style={{ color: '#0F172A' }}>{importFileName}</strong> — {importData.length} {importData.length === 1 ? 'city' : 'cities'} detected.
            <br />Existing cities, zones, and areas (matched by name) will be <strong>skipped</strong> — no duplicates.
          </div>

          {/* Preview */}
          {!importResult && (
            <div style={{ maxHeight: 280, overflowY: 'auto', marginBottom: 16, borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC' }}>
              {importData.map((city: any, ci: number) => (
                <div key={ci} style={{ padding: '10px 14px', borderBottom: ci < importData.length - 1 ? '1px solid #E2E8F0' : 'none' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A', marginBottom: 4 }}>
                    🏙️ {city.name} <span style={{ fontSize: 11, color: '#64748B', fontWeight: 400 }}>— {city.state}, {city.country}</span>
                  </div>
                  {(city.zones || []).map((zone: any, zi: number) => (
                    <div key={zi} style={{ marginLeft: 14, marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1D4ED8' }}>🗺️ {zone.name}</span>
                      <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 8 }}>({(zone.areas || []).length} areas)</span>
                      <div style={{ marginLeft: 16, fontSize: 11, color: '#64748B' }}>
                        {(zone.areas || []).map((a: any) => a.name).join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Import result */}
          {importResult && (
            <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 16, borderRadius: 8, border: '1px solid #D1FAE5', background: '#F0FDF4', padding: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#065F46', marginBottom: 10 }}>✅ Import Complete</div>
              {importResult.map((cityRes: any, ci: number) => (
                <div key={ci} style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    🏙️ {cityRes.city}
                    <span style={{ fontSize: 11, marginLeft: 8, color: cityRes.city_status === 'created' ? '#059669' : '#D97706', fontWeight: 400 }}>
                      ({cityRes.city_status})
                    </span>
                  </div>
                  {(cityRes.zones || []).map((zRes: any, zi: number) => (
                    <div key={zi} style={{ marginLeft: 12, fontSize: 12 }}>
                      <span style={{ color: '#1D4ED8', fontWeight: 600 }}>→ {zRes.zone}</span>
                      <span style={{ fontSize: 11, color: zRes.zone_status === 'created' ? '#059669' : '#D97706', marginLeft: 6 }}>({zRes.zone_status})</span>
                      <div style={{ marginLeft: 14, fontSize: 11, color: '#64748B' }}>
                        {(zRes.areas || []).map((aRes: any) => (
                          <span key={aRes.name} style={{ marginRight: 10 }}>
                            {aRes.name} <span style={{ color: aRes.status === 'created' ? '#059669' : '#D97706' }}>({aRes.status})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {importErr && (
            <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 12 }}>
              ⚠️ {importErr}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            {!importResult ? (
              <button className="btn btn-primary" onClick={runImport} disabled={importLoading}>
                {importLoading ? <><Spinner size="sm" /> &nbsp;Importing...</> : '▶ Run Import'}
              </button>
            ) : (
              <button className="btn btn-secondary" onClick={() => { setImportModal(false); setImportResult(null); setImportData([]) }}>
                Close
              </button>
            )}
            {!importResult && (
              <button className="btn btn-secondary" onClick={() => { setImportModal(false); setImportData([]) }}>Cancel</button>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
