import { useEffect, useState, useCallback } from 'react'
import { techniciansAPI, servicesAPI, citiesAPI, commissionsAPI } from '@/services/api'
import Toast, { useToast } from '@/components/ui/Toast'
import CloudinaryImageUploader from '@/components/ui/CloudinaryImageUploader'
import PageHeader from '@/components/layout/PageHeader'
import StatusBadge from '@/components/ui/StatusBadge'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Technician {
  id: string
  name: string
  mobile: string
  email?: string
  technician_code?: string
  city?: string
  area?: string
  status: string
  experience_years: number
  rating: number
  total_jobs: number
  profile_image?: string
  address?: string
  alternate_mobile?: string
  dob?: string
  gender?: string
  pincode?: string
  identity_type?: string
  identity_number?: string
  id_proof?: string
  emergency_contact_name?: string
  emergency_contact_mobile?: string
  payout_upi_id?: string
  payout_bank_account?: string
  payout_bank_ifsc?: string
  payout_bank_name?: string
  payout_account_holder?: string
  payout_method_verified?: boolean
  has_payout_method?: boolean
}

interface Service { id: string; name: string; category_name?: string }
interface City    { id: string; name: string }
interface Area    { id: string; name: string }
interface Skill   { id: string; service_id: string; proficiency: string; service_name?: string }

// ─── Step definitions ─────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Personal Info',   icon: '👤' },
  { id: 2, label: 'Location',        icon: '📍' },
  { id: 3, label: 'Skills & Docs',   icon: '🔧' },
  { id: 4, label: 'Availability',    icon: '🗓️'  },
  { id: 5, label: 'Review & Submit', icon: '✅' },
]

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const PROFICIENCY = ['BEGINNER','INTERMEDIATE','EXPERT']
const IDENTITY_TYPES = ['Aadhaar Card','PAN Card','Driving License','Voter ID','Passport']

// ─── Availability default ─────────────────────────────────────────────────────
const defaultAvailability = () =>
  DAYS.map((day, i) => ({ day, day_of_week: i, is_available: i < 5, start_time: '09:00', end_time: '18:00' }))

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Technicians() {
  // List state
  const [techs, setTechs]               = useState<Technician[]>([])
  const [loading, setLoading]           = useState(true)
  const [page, setPage]                 = useState(1)
  const [pages, setPages]               = useState(1)
  const [total, setTotal]               = useState(0)
  const [statusFilter, setStatusFilter] = useState('')
  const [cityFilter, setCityFilter]     = useState('')
  const [searchQ, setSearchQ]           = useState('')

  // Detail
  const [selected, setSelected]     = useState<Technician | null>(null)
  const [detailTab, setDetailTab]   = useState<'overview'|'skills'|'performance'|'availability'|'documents'>('overview')
  const [performance, setPerformance] = useState<any>(null)
  const [skills, setSkills]           = useState<Skill[]>([])
  const [availability, setAvailability] = useState<any[]>([])

  // Skills mgmt in detail
  const [allServices, setAllServices] = useState<Service[]>([])
  const [addSkillMode, setAddSkillMode] = useState(false)
  const [newSkill, setNewSkill]       = useState({ service_id: '', proficiency: 'INTERMEDIATE' })
  const [savingSkill, setSavingSkill] = useState(false)

  // Cities
  const [cities, setCities]   = useState<City[]>([])
  const [areas, setAreas]     = useState<Area[]>([])

  // Create wizard
  const [showCreate, setShowCreate] = useState(false)
  const [step, setStep]             = useState(1)
  const [saving, setSaving]         = useState(false)
  const [err, setErr]               = useState('')

  // Wizard form
  const [form, setForm] = useState({
    // Step 1 – Personal
    name: '', mobile: '', email: '', alternate_mobile: '',
    dob: '', gender: '',
    emergency_contact_name: '', emergency_contact_mobile: '',
    experience_years: 0,
    identity_type: '', identity_number: '',
    // Step 2 – Location
    city: '', city_id: '', area: '', area_id: '', address: '', pincode: '',
    // Profile image (Step 1)
    profile_image: '',
    // ID proof doc URL
    id_proof: '',
    // Payout method (optional at create time)
    payout_method: 'upi',
    payout_upi_id: '',
    payout_bank_account: '',
    payout_bank_ifsc: '',
    payout_bank_name: '',
    payout_account_holder: '',
  })
  const [wizardSkills, setWizardSkills] = useState<Array<{ service_id: string; proficiency: string }>>([])
  const [wizardAvail, setWizardAvail]   = useState(defaultAvailability())

  // Edit modal state
  const [showEdit, setShowEdit]         = useState(false)
  const [editForm, setEditForm]         = useState<any>({})
  const [editTab, setEditTab]           = useState<'info'|'location'|'documents'|'availability'|'commissions'|'payout'>('info')
  const [editSaving, setEditSaving]     = useState(false)
  const [editErr, setEditErr]           = useState('')
  const [editAreas, setEditAreas]       = useState<Area[]>([])
  const [techGroups, setTechGroups]     = useState<any[]>([])
  const [allGroups, setAllGroups]       = useState<any[]>([])
  const [editTechId, setEditTechId]     = useState<string>('')
  const [groupSaving, setGroupSaving]   = useState(false)
  const { toasts, removeToast, toast }  = useToast()

  // ── Fetch helpers ────────────────────────────────────────────────────────────
  const fetchTechs = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { page, per_page: 20 }
      if (statusFilter) params.status = statusFilter
      if (cityFilter)   params.city   = cityFilter
      if (searchQ)      params.search = searchQ
      const res = await techniciansAPI.list(params)
      const d = res.data.data
      setTechs(d.technicians || d.items || [])
      setPages(d.pages || Math.ceil((d.total || 0) / 20))
      setTotal(d.total || 0)
    } catch { setTechs([]) } finally { setLoading(false) }
  }, [page, statusFilter, cityFilter, searchQ])

  useEffect(() => { fetchTechs() }, [fetchTechs])

  useEffect(() => {
    citiesAPI.list({ per_page: 100 }).then(r => {
      const d = r.data.data
      setCities(Array.isArray(d) ? d : (d?.cities || d?.items || []))
    }).catch(() => {})
    servicesAPI.list({ per_page: 200, visible_only: false }).then(r => setAllServices(r.data.data?.services || r.data.data?.items || [])).catch(() => {})
  }, [])

  const loadAreas = async (cityId: string) => {
    if (!cityId) { setAreas([]); return }
    try {
      const r = await citiesAPI.areas(cityId)
      const d = r.data.data
      setAreas(Array.isArray(d) ? d : (d?.areas || d?.items || []))
    }
    catch { setAreas([]) }
  }

  // ── Detail open ───────────────────────────────────────────────────────────────
  const openDetail = async (t: Technician) => {
    setSelected(t); setDetailTab('overview'); setPerformance(null)
    setSkills([]); setAvailability([])
    // Fetch full technician data (includes dob, gender, identity, emergency contact, etc.)
    try { const r = await techniciansAPI.get(t.id); setSelected(r.data.data) } catch {}
    try { const r = await techniciansAPI.performance(t.id); setPerformance(r.data.data) } catch {}
    try { const r = await techniciansAPI.skills(t.id); setSkills(r.data.data || []) } catch {}
    try { const r = await techniciansAPI.availability(t.id); setAvailability(r.data.data || []) } catch {}
  }

  // ── Add skill in detail ───────────────────────────────────────────────────────
  const handleAddSkill = async () => {
    if (!selected || !newSkill.service_id) return
    setSavingSkill(true)
    try {
      await techniciansAPI.addSkill(selected.id, newSkill)
      const r = await techniciansAPI.skills(selected.id)
      setSkills(r.data.data || [])
      setAddSkillMode(false); setNewSkill({ service_id: '', proficiency: 'INTERMEDIATE' })
    } catch {} finally { setSavingSkill(false) }
  }

  // ── Wizard: step validation ───────────────────────────────────────────────────
  const validateStep = () => {
    if (step === 1) {
      if (!form.name.trim())   { setErr('Full name is required'); return false }
      if (!form.mobile.trim()) { setErr('Mobile number is required'); return false }
      if (form.mobile.length < 10 || !/^[6-9]\d{9}$/.test(form.mobile)) { setErr('Enter a valid 10-digit Indian mobile number (starts with 6–9)'); return false }
    }
    if (step === 2) {
      if (!form.city.trim())    { setErr('City is required'); return false }
      if (!form.address.trim()) { setErr('Address is required'); return false }
    }
    setErr(''); return true
  }

  const nextStep = () => { if (validateStep()) setStep(s => s + 1) }
  const prevStep = () => { setErr(''); setStep(s => s - 1) }

  // ── Wizard: submit ─────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!validateStep()) return
    setSaving(true); setErr('')
    try {
      const payload: any = {
        name: form.name, mobile: form.mobile, email: form.email || undefined,
        city: form.city, area: form.area || undefined, address: form.address,
        experience_years: form.experience_years,
        // Extended fields — backend should accept these (see upgrade notes)
        alternate_mobile: form.alternate_mobile || undefined,
        dob: form.dob || undefined,
        gender: form.gender || undefined,
        emergency_contact_name: form.emergency_contact_name || undefined,
        emergency_contact_mobile: form.emergency_contact_mobile || undefined,
        identity_type: form.identity_type || undefined,
        identity_number: form.identity_number || undefined,
        pincode: form.pincode || undefined,
        profile_image: form.profile_image || undefined,
        // Payout method (optional)
        ...(form.payout_method === 'upi' && form.payout_upi_id ? {
          payout_upi_id: form.payout_upi_id || undefined,
        } : {}),
        ...(form.payout_method === 'bank' && form.payout_bank_account ? {
          payout_bank_account: form.payout_bank_account || undefined,
          payout_bank_ifsc: form.payout_bank_ifsc || undefined,
          payout_bank_name: form.payout_bank_name || undefined,
          payout_account_holder: form.payout_account_holder || undefined,
        } : {}),
      }
      const res = await techniciansAPI.create(payload)
      const techId = res.data.data?.id
      // Add skills in parallel if any
      if (techId && wizardSkills.length) {
        await Promise.allSettled(wizardSkills.map(s => techniciansAPI.addSkill(techId, s)))
      }
      setShowCreate(false)
      resetWizard()
      fetchTechs()
    } catch (ex: any) {
      setErr(ex.response?.data?.detail || 'Failed to create technician')
    } finally { setSaving(false) }
  }

  const resetWizard = () => {
    setStep(1); setErr('')
    setForm({ name:'', mobile:'', email:'', alternate_mobile:'', dob:'', gender:'',
      emergency_contact_name:'', emergency_contact_mobile:'', experience_years:0,
      identity_type:'', identity_number:'', city:'', city_id:'', area:'', area_id:'',
      address:'', pincode:'', profile_image:'', id_proof:'',
      payout_method:'upi', payout_upi_id:'', payout_bank_account:'',
      payout_bank_ifsc:'', payout_bank_name:'', payout_account_holder:'' })
    setWizardSkills([]); setWizardAvail(defaultAvailability()); setAreas([])
  }

  // ── Wizard skill add / remove ──────────────────────────────────────────────
  const addWizardSkill = () => setWizardSkills(s => [...s, { service_id: '', proficiency: 'INTERMEDIATE' }])
  const removeWizardSkill = (i: number) => setWizardSkills(s => s.filter((_, idx) => idx !== i))
  const updateWizardSkill = (i: number, field: string, val: string) =>
    setWizardSkills(s => s.map((sk, idx) => idx === i ? { ...sk, [field]: val } : sk))

  // ── Status change ──────────────────────────────────────────────────────────
  const changeStatus = async (t: Technician, status: string) => {
    try {
      await techniciansAPI.update(t.id, { status })
      fetchTechs()
      if (selected?.id === t.id) setSelected({ ...t, status })
    } catch {}
  }

  const statusOptions = ['', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'ON_LEAVE']

  // ── Edit technician ────────────────────────────────────────────────────────
  const openEdit = async (t: Technician) => {
    // Fetch full details
    try {
      const r = await techniciansAPI.get(t.id)
      const d = r.data.data
      setEditForm({
        name: d.name || '', mobile: d.mobile || '', email: d.email || '',
        alternate_mobile: d.alternate_mobile || '', dob: d.dob || '', gender: d.gender || '',
        experience_years: d.experience_years || 0,
        emergency_contact_name: d.emergency_contact_name || '',
        emergency_contact_mobile: d.emergency_contact_mobile || '',
        identity_type: d.identity_type || '', identity_number: d.identity_number || '',
        city: d.city || '', city_id: '', area: d.area || '', area_id: '',
        address: d.address || '', pincode: d.pincode || '',
        profile_image: d.profile_image || '',
        id_proof: d.id_proof || '',
        status: d.status,
        auto_assign_eligible: d.auto_assign_eligible !== undefined ? d.auto_assign_eligible : true,
        payout_upi_id: d.payout_upi_id || '',
        payout_bank_account: d.payout_bank_account || '',
        payout_bank_ifsc: d.payout_bank_ifsc || '',
        payout_bank_name: d.payout_bank_name || '',
        payout_account_holder: d.payout_account_holder || '',
        payout_method_verified: d.payout_method_verified || false,
      })
    } catch { setEditForm({ ...t }) }
    // Store the editing tech ID
    setEditTechId(t.id)
    // Load this technician's current group assignments
    try {
      const g = await commissionsAPI.groupsForTech(t.id)
      setTechGroups(g.data.data || [])
    } catch { setTechGroups([]) }
    // Load all available groups
    try {
      const ag = await commissionsAPI.listGroups()
      setAllGroups(ag.data.data || [])
    } catch { setAllGroups([]) }
    setEditErr(''); setEditTab('info')
    setShowEdit(true)
  }

  const saveEdit = async () => {
    if (!editTechId) return
    setEditSaving(true); setEditErr('')
    try {
      await techniciansAPI.update(editTechId, {
        name: editForm.name, email: editForm.email || undefined,
        alternate_mobile: editForm.alternate_mobile || undefined,
        dob: editForm.dob || undefined, gender: editForm.gender || undefined,
        experience_years: editForm.experience_years,
        emergency_contact_name: editForm.emergency_contact_name || undefined,
        emergency_contact_mobile: editForm.emergency_contact_mobile || undefined,
        city: editForm.city || undefined, area: editForm.area || undefined,
        address: editForm.address || undefined, pincode: editForm.pincode || undefined,
        identity_type: editForm.identity_type || undefined,
        identity_number: editForm.identity_number || undefined,
        status: editForm.status,
        auto_assign_eligible: editForm.auto_assign_eligible !== undefined ? editForm.auto_assign_eligible : true,
      })
      if (editForm.profile_image) {
        await techniciansAPI.updateProfileImage(editTechId, editForm.profile_image)
      }
      setShowEdit(false)
      fetchTechs()
      toast.success('Technician Updated', 'Profile changes saved successfully.')
      // Refresh selected if it matches
      if (selected?.id === editTechId) {
        try { const r = await techniciansAPI.get(editTechId); setSelected(r.data.data) } catch {}
      }
    } catch (e: any) {
      setEditErr(e.response?.data?.detail || 'Save failed')
    } finally { setEditSaving(false) }
  }

  const saveDocuments = async () => {
    if (!editTechId) return
    setEditSaving(true); setEditErr('')
    try {
      await techniciansAPI.updateDocuments(editTechId, {
        id_proof: editForm.id_proof || null,
        identity_type: editForm.identity_type || null,
        identity_number: editForm.identity_number || null,
      })
      setEditErr('')
      toast.success('Documents Saved', 'ID proof and identity details updated successfully.')
    } catch (e: any) {
      setEditErr(e.response?.data?.detail || 'Save failed')
    } finally { setEditSaving(false) }
  }

  const saveAvailabilityEdit = async () => {
    if (!editTechId) return
    setEditSaving(true)
    try {
      await techniciansAPI.setAvailability(editTechId, availability)
      toast.success('Availability Saved', 'Weekly schedule updated successfully.')
    } catch { setEditErr('Save failed') }
    finally { setEditSaving(false) }
  }

  // ── Commission group assign / remove from edit modal ─────────────────────────
  const assignGroupToTech = async (groupId: string) => {
    if (!editTechId) return
    setGroupSaving(true)
    try {
      // First remove from any existing group (only one group allowed)
      for (const g of techGroups) {
        await commissionsAPI.removeAssignment(g.id, editTechId).catch(() => {})
      }
      await commissionsAPI.assignTechnician(groupId, editTechId)
      const g = await commissionsAPI.groupsForTech(editTechId)
      setTechGroups(g.data.data || [])
      toast.success('Group Assigned', 'Commission group has been assigned to this technician.')
    } catch (e: any) {
      setEditErr(e.response?.data?.detail || 'Failed to assign group')
      toast.error('Assignment Failed', e.response?.data?.detail || 'Could not assign commission group.')
    } finally { setGroupSaving(false) }
  }

  const removeGroupFromTech = async (groupId: string) => {
    if (!editTechId) return
    setGroupSaving(true)
    try {
      await commissionsAPI.removeAssignment(groupId, editTechId)
      const g = await commissionsAPI.groupsForTech(editTechId)
      setTechGroups(g.data.data || [])
      toast.success('Group Removed', 'Commission group assignment has been removed.')
    } catch (e: any) {
      setEditErr(e.response?.data?.detail || 'Failed to remove group')
      toast.error('Remove Failed', e.response?.data?.detail || 'Could not remove commission group.')
    } finally { setGroupSaving(false) }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 28px' }}>
      {/* ── Page Header ── */}
      <PageHeader
        title="Technicians"
        subtitle={`${total} registered technicians`}
        actions={
          <button className="btn btn-primary" onClick={() => { resetWizard(); setShowCreate(true) }}>
            + Register Technician
          </button>
        }
      />

      <div style={{ height: 20 }} />

      {/* ── Filter Bar ── */}
      <div className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="input" style={{ width: 220 }} placeholder="🔍  Search name or mobile…"
          value={searchQ} onChange={e => { setSearchQ(e.target.value); setPage(1) }} />
        <select className="input" style={{ width: 180 }} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
          {statusOptions.map(s => <option key={s} value={s}>{s || 'All Status'}</option>)}
        </select>
        <select className="input" style={{ width: 180 }} value={cityFilter} onChange={e => { setCityFilter(e.target.value); setPage(1) }}>
          <option value="">All Cities</option>
          {cities.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        {(statusFilter || cityFilter || searchQ) && (
          <button className="btn btn-secondary btn-sm" onClick={() => { setStatusFilter(''); setCityFilter(''); setSearchQ(''); setPage(1) }}>
            Clear Filters
          </button>
        )}
        <div style={{ marginLeft: 'auto', fontSize: 13, color: '#64748B' }}>{total} technicians</div>
      </div>

      {/* ── Table ── */}
      <div className="card">
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center' }}><Spinner /></div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Technician</th>
                  <th>Contact</th>
                  <th>City / Area</th>
                  <th>Experience</th>
                  <th>Rating</th>
                  <th>Jobs</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {techs.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', color: '#94A3B8', padding: 40 }}>No technicians found</td></tr>
                ) : techs.map(t => (
                  <tr key={t.id}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, background: '#F1F5F9', padding: '2px 7px', borderRadius: 4, color: '#475569' }}>
                        {t.technician_code || '—'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#EFF6FF',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, color: '#1B4FD8', fontSize: 14, flexShrink: 0,
                          overflow: 'hidden' }}>
                          {t.profile_image
                            ? <img src={t.profile_image} alt="" style={{ width: 36, height: 36, objectFit: 'cover' }} />
                            : t.name.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600, color: '#1B4FD8', cursor: 'pointer' }} onClick={() => openDetail(t)}>
                          {t.name}
                        </span>
                      </div>
                    </td>
                    <td style={{ fontSize: 13 }}>
                      <div>{t.mobile}</div>
                      {t.email && <div style={{ color: '#94A3B8', fontSize: 12 }}>{t.email}</div>}
                    </td>
                    <td style={{ fontSize: 13 }}>{t.city || '—'}{t.area ? ` / ${t.area}` : ''}</td>
                    <td style={{ fontSize: 13 }}>{t.experience_years || 0} yr{t.experience_years !== 1 ? 's' : ''}</td>
                    <td>
                      {t.rating > 0
                        ? <span style={{ fontWeight: 600, color: '#D97706' }}>⭐ {t.rating.toFixed(1)}</span>
                        : <span style={{ color: '#94A3B8', fontSize: 12 }}>No ratings</span>}
                    </td>
                    <td style={{ fontWeight: 600 }}>{t.total_jobs || 0}</td>
                    <td><StatusBadge status={t.status} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openDetail(t)}>View</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => { setSelected(t); openEdit(t) }}
                          style={{ background: '#EFF6FF', color: '#1B4FD8', border: '1px solid #BFDBFE' }}>✏️ Edit</button>
                        <select className="input btn-sm" style={{ width: 110, padding: '4px 6px', fontSize: 12 }}
                          value={t.status}
                          onChange={e => changeStatus(t, e.target.value)}>
                          <option value="ACTIVE">Active</option>
                          <option value="INACTIVE">Inactive</option>
                          <option value="SUSPENDED">Suspended</option>
                          <option value="ON_LEAVE">On Leave</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} pages={pages} onPage={setPage} />
          </>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          TECHNICIAN DETAIL MODAL
      ════════════════════════════════════════════════════════════════════════ */}
      {selected && (
        <Modal title={`${selected.name}  ·  ${selected.technician_code || ''}`} onClose={() => setSelected(null)} size="xl">
          {/* Avatar + quick info header */}
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 20,
            background: 'linear-gradient(135deg,#EFF6FF,#F8FAFC)', borderRadius: 12, padding: 20 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#1B4FD8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, fontWeight: 700, color: 'white', flexShrink: 0,
              overflow: 'hidden' }}>
              {selected.profile_image
                ? <img src={selected.profile_image} alt="" style={{ width: 64, height: 64, objectFit: 'cover' }} />
                : selected.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 18, color: '#0F172A' }}>{selected.name}</div>
              <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                📱 {selected.mobile}
                {selected.email && <span style={{ marginLeft: 16 }}>✉️ {selected.email}</span>}
              </div>
              <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                📍 {selected.city || '—'}{selected.area ? ` › ${selected.area}` : ''}
                <span style={{ marginLeft: 16 }}>🔧 {selected.experience_years || 0} yrs experience</span>
              </div>
            </div>
            <div>
              <StatusBadge status={selected.status} />
              <select className="input" style={{ width: 130, marginTop: 8, fontSize: 12 }}
                value={selected.status}
                onChange={e => changeStatus(selected, e.target.value)}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="ON_LEAVE">On Leave</option>
              </select>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #E2E8F0', paddingBottom: 0 }}>
            {(['overview','skills','performance','availability','documents'] as const).map(tab => (
              <button key={tab} onClick={() => setDetailTab(tab)}
                style={{ padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  background: 'none', borderBottom: detailTab === tab ? '2px solid #1B4FD8' : '2px solid transparent',
                  color: detailTab === tab ? '#1B4FD8' : '#64748B', borderRadius: '6px 6px 0 0',
                  textTransform: 'capitalize', transition: 'all 0.15s' }}>
                {tab}
              </button>
            ))}
          </div>

          {/* Tab: Overview */}
          {detailTab === 'overview' && (() => {
            const InfoCard = ({ label, value, icon }: { label: string; value: string; icon?: string }) => (
              <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 14px', border: '1px solid #F1F5F9' }}>
                <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>
                  {icon && <span style={{ marginRight: 4 }}>{icon}</span>}{label}
                </div>
                <div style={{ fontWeight: 600, color: value === '—' ? '#CBD5E1' : '#0F172A', fontSize: 14 }}>{value}</div>
              </div>
            )
            const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day:'2-digit', month:'short', year:'numeric' }) : '—'
            return (
              <div>
                {/* Section: Basic */}
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Basic Info</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
                  <InfoCard label="Status"       value={selected.status}                          icon="🔵" />
                  <InfoCard label="Tech Code"    value={selected.technician_code || '—'}          icon="🪪" />
                  <InfoCard label="Experience"   value={`${selected.experience_years || 0} yrs`}  icon="⏳" />
                  <InfoCard label="Gender"       value={selected.gender || '—'}                   icon="👤" />
                  <InfoCard label="Date of Birth" value={fmtDate(selected.dob)}                   icon="🎂" />
                  <InfoCard label="Alternate Mobile" value={selected.alternate_mobile || '—'}     icon="📞" />
                </div>

                {/* Section: Location */}
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Location</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
                  <InfoCard label="City"    value={selected.city    || '—'} icon="🏙️" />
                  <InfoCard label="Area"    value={selected.area    || '—'} icon="📍" />
                  <InfoCard label="Pincode" value={selected.pincode || '—'} icon="📮" />
                  <div style={{ gridColumn: '1/-1', background: '#F8FAFC', borderRadius: 8, padding: '10px 14px', border: '1px solid #F1F5F9' }}>
                    <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>📍 Full Address</div>
                    <div style={{ fontWeight: 600, color: selected.address ? '#0F172A' : '#CBD5E1', fontSize: 13 }}>{selected.address || '—'}</div>
                  </div>
                </div>

                {/* Section: Performance */}
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Performance</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                  <InfoCard label="Rating"     value={selected.rating > 0 ? `⭐ ${selected.rating.toFixed(1)} / 5.0` : 'No ratings yet'} icon="⭐" />
                  <InfoCard label="Total Jobs" value={String(selected.total_jobs || 0)}                                                   icon="🔧" />
                </div>

                {/* Section: Identity */}
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Identity Verification</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                  <InfoCard label="ID Type"   value={selected.identity_type   || '—'} icon="🪪" />
                  <InfoCard label="ID Number" value={selected.identity_number  || '—'} icon="🔢" />
                </div>

                {/* Section: Emergency Contact */}
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Emergency Contact</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <InfoCard label="Contact Name"   value={selected.emergency_contact_name   || '—'} icon="👨‍👩‍👧" />
                  <InfoCard label="Contact Mobile" value={selected.emergency_contact_mobile || '—'} icon="📱" />
                </div>

                {/* Section: Payout Method */}
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, marginTop: 16 }}>Payout Method</div>
                {(() => {
                  const s = selected as any
                  const hasUpi  = !!s.payout_upi_id
                  const hasBank = !!s.payout_bank_account
                  const verified = !!s.payout_method_verified
                  if (!hasUpi && !hasBank) return (
                    <div style={{ background: '#FEF9C3', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#92400E', marginBottom: 8 }}>
                      ⚠️ No payout method saved. Technician cannot withdraw until one is added.{' '}
                      <button style={{ color: '#1B4FD8', fontSize: 13, border: 'none', background: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                        onClick={() => openEdit(selected)}>Add now →</button>
                    </div>
                  )
                  return (
                    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '14px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                          {hasUpi ? '📱 UPI Payment' : '🏦 Bank Transfer'}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                          background: verified ? '#DCFCE7' : '#FEF9C3',
                          color: verified ? '#166534' : '#92400E' }}>
                          {verified ? '✅ Verified' : '⚠️ Unverified'}
                        </span>
                      </div>
                      {hasUpi && <div style={{ fontSize: 13, color: '#374151' }}><span style={{ fontWeight: 600 }}>UPI ID: </span>{s.payout_upi_id}</div>}
                      {hasBank && (<>
                        <div style={{ fontSize: 13, color: '#374151', marginBottom: 2 }}><span style={{ fontWeight: 600 }}>Account: </span>{s.payout_bank_account}</div>
                        <div style={{ fontSize: 13, color: '#374151', marginBottom: 2 }}><span style={{ fontWeight: 600 }}>IFSC: </span>{s.payout_bank_ifsc || '—'}</div>
                        {s.payout_bank_name && <div style={{ fontSize: 13, color: '#374151', marginBottom: 2 }}><span style={{ fontWeight: 600 }}>Bank: </span>{s.payout_bank_name}</div>}
                        {s.payout_account_holder && <div style={{ fontSize: 13, color: '#374151' }}><span style={{ fontWeight: 600 }}>Holder: </span>{s.payout_account_holder}</div>}
                      </>)}
                      <div style={{ marginTop: 12 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(selected)}>✏️ Edit Payout Details</button>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )
          })()}

          {/* Tab: Skills */}
          {detailTab === 'skills' && (
            <div>
              {skills.length === 0 ? (
                <div style={{ color: '#94A3B8', textAlign: 'center', padding: 24, fontSize: 14 }}>No skills assigned yet</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  {skills.map(sk => {
                    const svc = allServices.find(s => s.id === sk.service_id)
                    const profColor = sk.proficiency === 'EXPERT' ? '#059669' : sk.proficiency === 'INTERMEDIATE' ? '#1B4FD8' : '#D97706'
                    return (
                      <div key={sk.id} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8,
                        padding: '8px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{svc?.name || sk.service_id}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: profColor, background: profColor + '15',
                          padding: '2px 7px', borderRadius: 20 }}>{sk.proficiency}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {!addSkillMode ? (
                <button className="btn btn-secondary btn-sm" onClick={() => setAddSkillMode(true)}>+ Add Skill</button>
              ) : (
                <div style={{ background: '#F8FAFC', borderRadius: 10, padding: 16, marginTop: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: '#0F172A' }}>Add New Skill</div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Service</label>
                      <select className="input" value={newSkill.service_id} onChange={e => setNewSkill(s => ({ ...s, service_id: e.target.value }))}>
                        <option value="">Select service…</option>
                        {allServices.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div style={{ width: 160 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Proficiency</label>
                      <select className="input" value={newSkill.proficiency} onChange={e => setNewSkill(s => ({ ...s, proficiency: e.target.value }))}>
                        {PROFICIENCY.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary btn-sm" onClick={handleAddSkill} disabled={savingSkill}>
                        {savingSkill ? <Spinner size="sm" /> : 'Save'}
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setAddSkillMode(false)}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab: Performance */}
          {detailTab === 'performance' && (
            <div>
              {!performance ? (
                <div style={{ textAlign: 'center', padding: 24 }}><Spinner /></div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
                  {[
                    ['Total Assigned', performance.total_assigned, '#1B4FD8'],
                    ['Completed', performance.completed, '#059669'],
                    ['Completion Rate', `${performance.completion_rate}%`, performance.completion_rate >= 80 ? '#059669' : '#D97706'],
                  ].map(([label, val, color]) => (
                    <div key={label as string} style={{ background: '#F8FAFC', borderRadius: 12, padding: '20px 16px', textAlign: 'center', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: 28, fontWeight: 800, color: color as string }}>{val}</div>
                      <div style={{ fontSize: 12, color: '#64748B', marginTop: 4, fontWeight: 600 }}>{label}</div>
                    </div>
                  ))}
                  <div style={{ gridColumn: '1/-1', background: '#F0FDF4', borderRadius: 12, padding: 16, border: '1px solid #BBF7D0' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#166534', marginBottom: 4 }}>⭐ Customer Rating</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#166534' }}>
                      {selected.rating > 0 ? selected.rating.toFixed(2) : '—'}
                      <span style={{ fontSize: 14, fontWeight: 500, color: '#4B7A55', marginLeft: 8 }}>/ 5.00</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#4B7A55', marginTop: 4 }}>Based on {selected.total_jobs} completed jobs</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab: Availability */}
          {detailTab === 'availability' && (
            <div>
              <div style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>
                Weekly availability schedule. Edit via backend API.
              </div>
              {DAYS.map((day, i) => {
                const slot = availability.find((a: any) => a.day_of_week === i) || { is_available: i < 5, start_time: '09:00:00', end_time: '18:00:00' }
                return (
                  <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 14px',
                    borderRadius: 8, marginBottom: 6, background: slot.is_available ? '#F0FDF4' : '#F8FAFC',
                    border: `1px solid ${slot.is_available ? '#BBF7D0' : '#E2E8F0'}` }}>
                    <div style={{ width: 100, fontWeight: 600, fontSize: 13, color: '#0F172A' }}>{day}</div>
                    <div style={{ width: 80 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                        background: slot.is_available ? '#DCFCE7' : '#F1F5F9',
                        color: slot.is_available ? '#166534' : '#64748B' }}>
                        {slot.is_available ? 'Available' : 'Off'}
                      </span>
                    </div>
                    {slot.is_available && (
                      <div style={{ fontSize: 13, color: '#475569' }}>
                        {slot.start_time?.slice(0,5)} — {slot.end_time?.slice(0,5)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Tab: Documents */}
          {detailTab === 'documents' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase',
                  marginBottom: 12, letterSpacing: '0.04em' }}>Profile Photo</div>
                <div style={{ width: 120, height: 120, borderRadius: '50%', background: '#EFF6FF',
                  overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 12px', border: '3px solid #BFDBFE' }}>
                  {selected.profile_image
                    ? <img src={selected.profile_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 40, fontWeight: 700, color: '#1B4FD8' }}>{selected.name.charAt(0)}</span>}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase',
                  marginBottom: 12, letterSpacing: '0.04em' }}>ID Proof</div>
                {selected.id_proof
                  ? <a href={selected.id_proof} target="_blank" rel="noreferrer"
                      style={{ display: 'block', background: '#F0FDF4', border: '1px solid #BBF7D0',
                        borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#166534',
                        textDecoration: 'none', wordBreak: 'break-all' }}>
                      📄 View ID Proof Document
                    </a>
                  : <div style={{ color: '#94A3B8', fontSize: 13 }}>No ID proof uploaded yet</div>}
                <div style={{ marginTop: 16, padding: '10px 14px', background: '#F8FAFC', borderRadius: 8,
                  fontSize: 13, color: '#374151' }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Identity Details</div>
                  <div style={{ color: '#64748B' }}>Type: {selected.identity_type || '—'}</div>
                  <div style={{ color: '#64748B' }}>Number: {selected.identity_number || '—'}</div>
                </div>
              </div>
              <div style={{ gridColumn: '1/-1', borderTop: '1px solid #E2E8F0', paddingTop: 16, marginTop: 4 }}>
                <button className="btn btn-primary btn-sm" onClick={() => openEdit(selected)}
                  style={{ background: '#1B4FD8' }}>
                  ✏️ Edit Profile / Upload Documents
                </button>
              </div>
            </div>
          )}

        </Modal>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          EDIT TECHNICIAN MODAL
      ════════════════════════════════════════════════════════════════════════ */}
      {showEdit && selected && (
        <Modal title={`Edit — ${selected.name}`} onClose={() => setShowEdit(false)} size="xl">
          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #E2E8F0', marginBottom: 20 }}>
            {(['info','location','documents','availability','commissions','payout'] as const).map(t => (
              <button key={t} onClick={() => setEditTab(t)}
                style={{ padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 13,
                  fontWeight: 600, background: 'none', textTransform: 'capitalize',
                  borderBottom: editTab === t ? '2px solid #1B4FD8' : '2px solid transparent',
                  color: editTab === t ? '#1B4FD8' : '#64748B', marginBottom: -2 }}>
                {t === 'info' ? '👤 Info' : t === 'location' ? '📍 Location'
                  : t === 'documents' ? '📄 Documents' : t === 'availability' ? '🗓️ Availability'
                  : t === 'payout' ? '💳 Payout' : '💰 Commissions'}
              </button>
            ))}
          </div>

          {/* ── Info tab ── */}
          {editTab === 'info' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[['Full Name *','name','text'],['Mobile','mobile','tel'],['Email','email','email'],
                ['Alternate Mobile','alternate_mobile','tel'],['Date of Birth','dob','date'],
                ['Experience (Years)','experience_years','number'],
                ['Emergency Contact Name','emergency_contact_name','text'],
                ['Emergency Contact Mobile','emergency_contact_mobile','tel'],
              ].map(([label, key, type]) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>{label}</label>
                  <input className="input" type={type} value={editForm[key] ?? ''}
                    maxLength={type === 'tel' ? 10 : undefined}
                    onChange={e => setEditForm((f: any) => ({...f,
                      [key]: type === 'number' ? +e.target.value
                           : type === 'tel' ? e.target.value.replace(/\D/g,'').slice(0,10)
                           : e.target.value
                    }))} />
                  {type === 'tel' && editForm[key] && editForm[key].length > 0 && !/^[6-9]\d{9}$/.test(editForm[key]) && (
                    <span style={{fontSize:11,color:'#DC2626',marginTop:2,display:'block'}}>Must be a valid 10-digit Indian mobile</span>
                  )}
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Gender</label>
                <select className="input" value={editForm.gender || ''}
                  onChange={e => setEditForm((f: any) => ({ ...f, gender: e.target.value }))}>
                  <option value="">Select…</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Status</label>
                <select className="input" value={editForm.status || 'ACTIVE'}
                  onChange={e => setEditForm((f: any) => ({ ...f, status: e.target.value }))}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="ON_LEAVE">On Leave</option>
                </select>
              </div>
              {/* ── Auto-assign eligible toggle ── */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                  🤖 Auto-Assign Eligibility
                </label>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: editForm.auto_assign_eligible !== false ? '#F0FDF4' : '#FEF2F2',
                  border: `1px solid ${editForm.auto_assign_eligible !== false ? '#86EFAC' : '#FECACA'}`,
                  borderRadius: 8, padding: '10px 14px',
                }}>
                  <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={editForm.auto_assign_eligible !== false}
                      onChange={e => setEditForm((f: any) => ({ ...f, auto_assign_eligible: e.target.checked }))}
                      style={{ width: 36, height: 20, cursor: 'pointer', accentColor: '#22C55E' }}
                    />
                  </label>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: editForm.auto_assign_eligible !== false ? '#15803D' : '#DC2626' }}>
                      {editForm.auto_assign_eligible !== false ? '✅ Eligible for Auto-Assign' : '🚫 Excluded from Auto-Assign'}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                      {editForm.auto_assign_eligible !== false
                        ? 'This technician will receive bookings via the auto-dispatch system.'
                        : 'Admin/CCO must manually assign bookings to this technician.'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Location tab ── */}
          {editTab === 'location' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>City</label>
                <select className="input" value={editForm.city_id || ''}
                  onChange={async e => {
                    const c = cities.find(c => c.id === e.target.value)
                    setEditForm((f: any) => ({ ...f, city_id: e.target.value, city: c?.name || editForm.city, area_id: '', area: '' }))
                    if (e.target.value) {
                      try { const r = await citiesAPI.areas(e.target.value); const d = r.data.data; setEditAreas(Array.isArray(d) ? d : []) } catch { setEditAreas([]) }
                    }
                  }}>
                  <option value="">Select city…</option>
                  {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>Current: {editForm.city || '—'}</div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Area / Zone</label>
                <select className="input" value={editForm.area_id || ''} disabled={!editForm.city_id}
                  onChange={e => {
                    const a = editAreas.find(a => a.id === e.target.value)
                    setEditForm((f: any) => ({ ...f, area_id: e.target.value, area: a?.name || '' }))
                  }}>
                  <option value="">Select area…</option>
                  {editAreas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>Current: {editForm.area || '—'}</div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Pincode</label>
                <input className="input" placeholder="6-digit pincode" value={editForm.pincode || ''}
                  onChange={e => setEditForm((f: any) => ({ ...f, pincode: e.target.value }))} maxLength={6} />
              </div>
              <div />
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Full Address</label>
                <textarea className="input" rows={3} value={editForm.address || ''}
                  onChange={e => setEditForm((f: any) => ({ ...f, address: e.target.value }))}
                  style={{ resize: 'vertical' }} />
              </div>
            </div>
          )}

          {/* ── Documents tab ── */}
          {editTab === 'documents' && (
            <div>
              <CloudinaryImageUploader
                label="Profile Photo"
                fieldKey={`tech_profile_${selected.id}`}
                aspectRatio={1}
                recommendedSize="400×400px"
                hint="Square photo — shown in admin dashboard and technician app"
                currentUrl={editForm.profile_image || ''}
                onChange={async url => {
                  setEditForm((f: any) => ({ ...f, profile_image: url }))
                  try { await techniciansAPI.updateProfileImage(selected.id, url) } catch {}
                }}
              />
              <CloudinaryImageUploader
                label="ID Proof Document (scan/photo)"
                fieldKey={`tech_idproof_${selected.id}`}
                recommendedSize="Any clear scan"
                hint="Aadhaar, PAN, Driving License, Passport, or Voter ID scan"
                currentUrl={editForm.id_proof || ''}
                onChange={url => setEditForm((f: any) => ({ ...f, id_proof: url }))}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 8 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>ID Type</label>
                  <select className="input" value={editForm.identity_type || ''}
                    onChange={e => setEditForm((f: any) => ({ ...f, identity_type: e.target.value }))}>
                    <option value="">Select…</option>
                    {['Aadhaar Card','PAN Card','Driving License','Voter ID','Passport'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>ID Number</label>
                  <input className="input" placeholder="Enter ID number" value={editForm.identity_number || ''}
                    onChange={e => setEditForm((f: any) => ({ ...f, identity_number: e.target.value }))} />
                </div>
              </div>
              <div style={{ marginTop: 16 }}>
                <button className="btn btn-primary" onClick={saveDocuments} disabled={editSaving}>
                  {editSaving ? <Spinner size="sm" /> : '💾 Save Documents'}
                </button>
              </div>
            </div>
          )}

          {/* ── Availability tab ── */}
          {editTab === 'availability' && (
            <div>
              <div style={{ fontSize: 12, color: '#64748B', marginBottom: 16 }}>Edit weekly availability schedule.</div>
              {DAYS.map((day, i) => {
                const slot = availability.find((a: any) => a.day_of_week === i) || { is_available: i < 5, start_time: '09:00', end_time: '18:00', day_of_week: i }
                const idx = availability.findIndex((a: any) => a.day_of_week === i)
                const updateSlot = (key: string, val: any) => {
                  if (idx >= 0) {
                    const next = [...availability]; next[idx] = { ...next[idx], [key]: val }; setAvailability(next)
                  } else {
                    setAvailability([...availability, { ...slot, [key]: val }])
                  }
                }
                return (
                  <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px',
                    borderRadius: 8, marginBottom: 6, background: slot.is_available ? '#F0FDF4' : '#F8FAFC',
                    border: `1px solid ${slot.is_available ? '#BBF7D0' : '#E2E8F0'}` }}>
                    <div style={{ width: 100, fontWeight: 600, fontSize: 13 }}>{day}</div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input type="checkbox" checked={slot.is_available}
                        onChange={e => updateSlot('is_available', e.target.checked)} style={{ width: 16, height: 16 }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: slot.is_available ? '#166534' : '#94A3B8' }}>
                        {slot.is_available ? 'Available' : 'Off'}
                      </span>
                    </label>
                    {slot.is_available && (
                      <>
                        <label style={{ fontSize: 12, color: '#64748B' }}>From</label>
                        <input type="time" className="input" style={{ width: 110 }}
                          value={slot.start_time?.slice(0,5) || '09:00'}
                          onChange={e => updateSlot('start_time', e.target.value)} />
                        <label style={{ fontSize: 12, color: '#64748B' }}>To</label>
                        <input type="time" className="input" style={{ width: 110 }}
                          value={slot.end_time?.slice(0,5) || '18:00'}
                          onChange={e => updateSlot('end_time', e.target.value)} />
                      </>
                    )}
                  </div>
                )
              })}
              <div style={{ marginTop: 14 }}>
                <button className="btn btn-primary" onClick={saveAvailabilityEdit} disabled={editSaving}>
                  {editSaving ? <Spinner size="sm" /> : '💾 Save Availability'}
                </button>
              </div>
            </div>
          )}

          {/* ── Commissions tab ── */}
          {editTab === 'commissions' && (() => {
            const assignedGroupId = techGroups[0]?.id || null
            return (
            <div>
              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8,
                padding: '10px 14px', fontSize: 13, color: '#1E40AF', marginBottom: 18 }}>
                💡 Only <strong>one commission group</strong> can be assigned per technician. Assigning a new group
                will automatically remove the current one.
              </div>

              {/* Currently assigned group */}
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase',
                letterSpacing: '0.05em', marginBottom: 10 }}>
                Currently Assigned Group
              </div>
              {techGroups.length === 0 ? (
                <div style={{ background: '#F8FAFC', border: '2px dashed #E2E8F0', borderRadius: 10,
                  padding: 24, textAlign: 'center', color: '#94A3B8', marginBottom: 20 }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>💰</div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>No commission group assigned</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Select a group below to assign it.</div>
                </div>
              ) : (
                <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 10,
                  padding: '12px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#166534', marginBottom: 6 }}>
                      ✅ {techGroups[0].name}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {techGroups[0].rules?.slice(0, 5).map((r: any, i: number) => {
                        const svc = allServices.find(s => s.id === r.service_id)
                        return (
                          <span key={i} style={{ background: '#DCFCE7', border: '1px solid #BBF7D0',
                            borderRadius: 20, padding: '2px 10px', fontSize: 12, color: '#166534' }}>
                            🔧 {svc?.name || '—'} — {r.commission_type === 'PERCENTAGE' ? `${r.rate}%` : `₹${r.rate}`}
                          </span>
                        )
                      })}
                      {(techGroups[0].rules?.length || 0) > 5 && (
                        <span style={{ fontSize: 12, color: '#94A3B8' }}>+{techGroups[0].rules.length - 5} more</span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => removeGroupFromTech(techGroups[0].id)} disabled={groupSaving}
                    style={{ background: 'none', border: '1px solid #FCA5A5', color: '#DC2626', borderRadius: 6,
                      padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, flexShrink: 0, marginLeft: 12 }}>
                    {groupSaving ? '…' : '✕ Remove'}
                  </button>
                </div>
              )}

              {/* All available groups to assign */}
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase',
                letterSpacing: '0.05em', marginBottom: 10 }}>
                Available Groups {allGroups.length > 0 ? `(${allGroups.length})` : ''}
              </div>
              {allGroups.length === 0 ? (
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8,
                  padding: 16, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                  No commission groups created yet. Create one from the Commission Groups page.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {allGroups.map((g: any) => {
                    const isAssigned = g.id === assignedGroupId
                    return (
                      <div key={g.id} style={{ background: isAssigned ? '#F0FDF4' : '#F8FAFC',
                        border: `1px solid ${isAssigned ? '#86EFAC' : '#E2E8F0'}`,
                        borderRadius: 10, padding: '12px 16px',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A', marginBottom: 4 }}>
                            💼 {g.name}
                            {isAssigned && <span style={{ marginLeft: 8, fontSize: 11, background: '#DCFCE7',
                              color: '#166534', padding: '1px 8px', borderRadius: 20, fontWeight: 600 }}>Assigned</span>}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {g.rules?.slice(0, 3).map((r: any, i: number) => {
                              const svc = allServices.find(s => s.id === r.service_id)
                              return (
                                <span key={i} style={{ fontSize: 11, color: '#64748B', background: '#F1F5F9',
                                  padding: '1px 7px', borderRadius: 12 }}>
                                  {svc?.name || '—'} · {r.commission_type === 'PERCENTAGE' ? `${r.rate}%` : `₹${r.rate}`}
                                </span>
                              )
                            })}
                            {(g.rules?.length || 0) > 3 && (
                              <span style={{ fontSize: 11, color: '#94A3B8' }}>+{g.rules.length - 3} more</span>
                            )}
                          </div>
                          {g.description && (
                            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>{g.description}</div>
                          )}
                        </div>
                        <div style={{ flexShrink: 0, marginLeft: 14 }}>
                          {isAssigned ? (
                            <button onClick={() => removeGroupFromTech(g.id)} disabled={groupSaving}
                              style={{ background: 'none', border: '1px solid #FCA5A5', color: '#DC2626',
                                borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                              {groupSaving ? '…' : '✕ Remove'}
                            </button>
                          ) : (
                            <button onClick={() => assignGroupToTech(g.id)} disabled={groupSaving}
                              style={{ background: '#1B4FD8', color: 'white', border: 'none',
                                borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                              {groupSaving ? '…' : '+ Assign'}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            )
          })()}

          {editErr && (
            <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '10px 14px',
              borderRadius: 8, fontSize: 13, marginTop: 16 }}>⚠️ {editErr}</div>
          )}

          {/* Footer — only show Save for info/location tabs */}
          {(editTab === 'info' || editTab === 'location') && (
            <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid #E2E8F0' }}>
              <button className="btn btn-primary" onClick={saveEdit} disabled={editSaving}>
                {editSaving ? <Spinner size="sm" /> : '💾 Save Changes'}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowEdit(false)}>Cancel</button>
            </div>
          )}
          {/* ── Payout tab ── */}
          {editTab === 'payout' && (() => {
            const hasUpi  = !!(editForm.payout_upi_id)
            const hasBank = !!(editForm.payout_bank_account)
            return (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
                  background: editForm.payout_method_verified ? '#F0FDF4' : '#FEF9C3',
                  border: `1px solid ${editForm.payout_method_verified ? '#86EFAC' : '#FDE68A'}`,
                  borderRadius: 10, padding: '12px 16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1 }}>
                    <input type="checkbox"
                      checked={!!editForm.payout_method_verified}
                      onChange={e => setEditForm((f: any) => ({ ...f, payout_method_verified: e.target.checked }))}
                      style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#22C55E' }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: editForm.payout_method_verified ? '#15803D' : '#92400E' }}>
                        {editForm.payout_method_verified ? '✅ Payout Method Verified' : '⚠️ Not Yet Verified'}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>
                        Tick after manually verifying the technician's payment details.
                      </div>
                    </div>
                  </label>
                </div>

                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>UPI Payment</div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>UPI ID</label>
                  <input className="input" placeholder="e.g. name@upi" value={editForm.payout_upi_id || ''}
                    onChange={e => setEditForm((f: any) => ({ ...f, payout_upi_id: e.target.value }))} />
                  {hasUpi && <div style={{ fontSize: 11, color: '#059669', marginTop: 3 }}>📱 UPI saved</div>}
                </div>

                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Bank Transfer</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ gridColumn: '1/-1' }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Account Number</label>
                      <input className="input" placeholder="Bank account number" value={editForm.payout_bank_account || ''}
                        onChange={e => setEditForm((f: any) => ({ ...f, payout_bank_account: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>IFSC Code</label>
                      <input className="input" placeholder="e.g. SBIN0001234" value={editForm.payout_bank_ifsc || ''}
                        onChange={e => setEditForm((f: any) => ({ ...f, payout_bank_ifsc: e.target.value.toUpperCase() }))} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Bank Name</label>
                      <input className="input" placeholder="e.g. State Bank of India" value={editForm.payout_bank_name || ''}
                        onChange={e => setEditForm((f: any) => ({ ...f, payout_bank_name: e.target.value }))} />
                    </div>
                    <div style={{ gridColumn: '1/-1' }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Account Holder Name</label>
                      <input className="input" placeholder="Name as on bank account" value={editForm.payout_account_holder || ''}
                        onChange={e => setEditForm((f: any) => ({ ...f, payout_account_holder: e.target.value }))} />
                    </div>
                  </div>
                  {hasBank && <div style={{ fontSize: 11, color: '#059669', marginTop: 6 }}>🏦 Bank details saved</div>}
                </div>

                {!hasUpi && !hasBank && (
                  <div style={{ background: '#FEF9C3', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 14px',
                    fontSize: 13, color: '#92400E', marginBottom: 16 }}>
                    ⚠️ No payout method on record. Technician cannot withdraw until one is added.
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid #E2E8F0' }}>
                  <button className="btn btn-primary" onClick={async () => {
                    setEditSaving(true); setEditErr('')
                    try {
                      await techniciansAPI.update(editTechId, {
                        payout_upi_id: editForm.payout_upi_id || null,
                        payout_bank_account: editForm.payout_bank_account || null,
                        payout_bank_ifsc: editForm.payout_bank_ifsc || null,
                        payout_bank_name: editForm.payout_bank_name || null,
                        payout_account_holder: editForm.payout_account_holder || null,
                        payout_method_verified: editForm.payout_method_verified,
                      })
                      toast.success('Payout Updated', 'Payment details saved successfully.')
                      setShowEdit(false); fetchTechs()
                      if (selected?.id === editTechId) {
                        try { const r = await techniciansAPI.get(editTechId); setSelected(r.data.data) } catch {}
                      }
                    } catch (e: any) { setEditErr(e.response?.data?.detail || 'Save failed') }
                    finally { setEditSaving(false) }
                  }} disabled={editSaving}>
                    {editSaving ? <Spinner size="sm" /> : '💾 Save Payout Details'}
                  </button>
                  <button className="btn btn-secondary" onClick={() => setShowEdit(false)}>Cancel</button>
                </div>
              </div>
            )
          })()}
        </Modal>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          CREATE TECHNICIAN — MULTI-STEP WIZARD
      ════════════════════════════════════════════════════════════════════════ */}
      {showCreate && (
        <Modal title="Register New Technician" onClose={() => { setShowCreate(false); resetWizard() }} size="xl">
          {/* Step progress */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28, gap: 0 }}>
            {STEPS.map((s, i) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : undefined }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: step > s.id ? 16 : 14, fontWeight: 700,
                    background: step > s.id ? '#059669' : step === s.id ? '#1B4FD8' : '#F1F5F9',
                    color: step >= s.id ? 'white' : '#94A3B8',
                    border: step === s.id ? '2px solid #1B4FD8' : 'none',
                    transition: 'all 0.2s', cursor: step > s.id ? 'pointer' : 'default',
                    boxShadow: step === s.id ? '0 0 0 4px rgba(27,79,216,0.12)' : 'none',
                  }} onClick={() => step > s.id && setStep(s.id)}>
                    {step > s.id ? '✓' : s.icon}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: step >= s.id ? '#0F172A' : '#94A3B8',
                    marginTop: 4, textAlign: 'center', whiteSpace: 'nowrap' }}>{s.label}</div>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ flex: 1, height: 2, background: step > s.id ? '#059669' : '#E2E8F0',
                    margin: '-14px 4px 0', transition: 'background 0.3s' }} />
                )}
              </div>
            ))}
          </div>

          {/* ── Step 1: Personal Info ── */}
          {step === 1 && (
            <div>
              <SectionTitle>Personal Information</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Full Name *">
                  <input className="input" placeholder="e.g. Ramesh Kumar" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </Field>
                <Field label="Mobile Number *">
                  <input className="input" type="tel" placeholder="9XXXXXXXXX" value={form.mobile}
                    onChange={e => setForm(f => ({ ...f, mobile: e.target.value.replace(/\D/g,'').slice(0,10) }))} maxLength={10} />
                </Field>
                <Field label="Email Address">
                  <input className="input" type="email" placeholder="email@example.com" value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </Field>
                <Field label="Alternate Mobile">
                  <input className="input" type="tel" placeholder="Optional" value={form.alternate_mobile}
                    onChange={e => setForm(f => ({ ...f, alternate_mobile: e.target.value.replace(/\D/g,'').slice(0,10) }))} maxLength={10} />
                </Field>
                <Field label="Date of Birth">
                  <input className="input" type="date" value={form.dob}
                    onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} />
                </Field>
                <Field label="Gender">
                  <select className="input" value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                    <option value="">Select…</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </Field>
                <Field label="Experience (Years)">
                  <input className="input" type="number" min={0} max={50} value={form.experience_years}
                    onChange={e => setForm(f => ({ ...f, experience_years: +e.target.value }))} />
                </Field>
                <div />
              </div>

              <SectionTitle style={{ marginTop: 22 }}>Emergency Contact</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Contact Name">
                  <input className="input" placeholder="e.g. Wife / Father" value={form.emergency_contact_name}
                    onChange={e => setForm(f => ({ ...f, emergency_contact_name: e.target.value }))} />
                </Field>
                <Field label="Contact Mobile">
                  <input className="input" type="tel" placeholder="9XXXXXXXXX" value={form.emergency_contact_mobile}
                    onChange={e => setForm(f => ({ ...f, emergency_contact_mobile: e.target.value.replace(/\D/g,'').slice(0,10) }))} maxLength={10} />
                </Field>
              </div>

              <SectionTitle style={{ marginTop: 22 }}>Identity Verification</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="ID Type">
                  <select className="input" value={form.identity_type}
                    onChange={e => setForm(f => ({ ...f, identity_type: e.target.value }))}>
                    <option value="">Select ID type…</option>
                    {IDENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="ID Number">
                  <input className="input" placeholder="Enter ID number" value={form.identity_number}
                    onChange={e => setForm(f => ({ ...f, identity_number: e.target.value }))} />
                </Field>
              </div>

              <SectionTitle style={{ marginTop: 22 }}>Profile Photo</SectionTitle>
              <div style={{ maxWidth: 360 }}>
                <CloudinaryImageUploader
                  label="Profile Photo"
                  fieldKey={`wizard_tech_photo_${Date.now()}`}
                  aspectRatio={1}
                  recommendedSize="400×400px"
                  hint="Optional — can be added later from the edit profile page"
                  currentUrl={form.profile_image}
                  onChange={url => setForm(f => ({ ...f, profile_image: url }))}
                />
              </div>
            </div>
          )}

          {/* ── Step 2: Location ── */}
          {step === 2 && (
            <div>
              <SectionTitle>Location Details</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="City *">
                  <select className="input" value={form.city_id}
                    onChange={e => {
                      const c = cities.find(c => c.id === e.target.value)
                      setForm(f => ({ ...f, city_id: e.target.value, city: c?.name || '', area: '', area_id: '' }))
                      loadAreas(e.target.value)
                    }}>
                    <option value="">Select city…</option>
                    {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label="Area / Zone">
                  <select className="input" value={form.area_id}
                    onChange={e => {
                      const a = areas.find(a => a.id === e.target.value)
                      setForm(f => ({ ...f, area_id: e.target.value, area: a?.name || '' }))
                    }} disabled={!form.city_id}>
                    <option value="">Select area…</option>
                    {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </Field>
                <Field label="Pincode">
                  <input className="input" placeholder="6-digit pincode" value={form.pincode}
                    onChange={e => setForm(f => ({ ...f, pincode: e.target.value }))} maxLength={6} />
                </Field>
                <div />
                <Field label="Full Address *" style={{ gridColumn: '1/-1' }}>
                  <textarea className="input" rows={3} placeholder="House No, Street, Landmark…"
                    value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                    style={{ resize: 'vertical' }} />
                </Field>
              </div>

              {/* Service coverage info box */}
              <div style={{ marginTop: 16, background: '#EFF6FF', borderRadius: 10, padding: '12px 16px',
                border: '1px solid #BFDBFE', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 18 }}>ℹ️</span>
                <div style={{ fontSize: 13, color: '#1E40AF' }}>
                  <strong>Why location matters:</strong> The AI Assignment Engine uses city, area, and pincode
                  to automatically assign this technician to nearby bookings. Accurate location improves
                  assignment speed and customer satisfaction.
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Skills & Docs ── */}
          {step === 3 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <SectionTitle style={{ margin: 0 }}>Service Skills</SectionTitle>
                <button className="btn btn-secondary btn-sm" onClick={addWizardSkill}>+ Add Skill</button>
              </div>
              <div style={{ fontSize: 12, color: '#64748B', marginBottom: 14 }}>
                Skills are used by the AI Assignment Engine to match technicians to service bookings.
                Higher proficiency increases assignment priority.
              </div>

              {wizardSkills.length === 0 ? (
                <div style={{ background: '#F8FAFC', border: '2px dashed #E2E8F0', borderRadius: 10,
                  padding: 32, textAlign: 'center', color: '#94A3B8', marginBottom: 16 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🔧</div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>No skills added yet</div>
                  <div style={{ fontSize: 12 }}>Adding skills allows the system to auto-assign this technician to relevant jobs</div>
                  <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={addWizardSkill}>
                    Add First Skill
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                  {wizardSkills.map((sk, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', background: '#F8FAFC',
                      borderRadius: 8, padding: '10px 14px', border: '1px solid #E2E8F0' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Service</label>
                        <select className="input" value={sk.service_id}
                          onChange={e => updateWizardSkill(i, 'service_id', e.target.value)}>
                          <option value="">Select service…</option>
                          {allServices.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                      <div style={{ width: 160 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Proficiency</label>
                        <select className="input" value={sk.proficiency}
                          onChange={e => updateWizardSkill(i, 'proficiency', e.target.value)}>
                          {PROFICIENCY.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <button className="btn btn-danger btn-sm" onClick={() => removeWizardSkill(i)}
                        style={{ marginBottom: 0, flexShrink: 0 }}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              <SectionTitle style={{ marginTop: 20 }}>Document Upload</SectionTitle>
              <div style={{ background: '#FEF9C3', border: '1px solid #FDE68A', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#92400E' }}>
                ⚠️ Document upload (ID proof, photo, certificates) will be available after the technician profile is created.
                You can upload documents from the technician's profile page.
              </div>
            </div>
          )}

          {/* ── Step 4: Availability ── */}
          {step === 4 && (
            <div>
              <SectionTitle>Weekly Availability Schedule</SectionTitle>
              <div style={{ fontSize: 12, color: '#64748B', marginBottom: 16 }}>
                Set the technician's working hours. The system only assigns bookings during available slots.
              </div>
              {wizardAvail.map((slot, i) => (
                <div key={slot.day} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px',
                  borderRadius: 8, marginBottom: 6, background: slot.is_available ? '#F0FDF4' : '#F8FAFC',
                  border: `1px solid ${slot.is_available ? '#BBF7D0' : '#E2E8F0'}`, transition: 'all 0.15s' }}>
                  <div style={{ width: 100, fontWeight: 600, fontSize: 13, color: '#0F172A' }}>{slot.day}</div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={slot.is_available} style={{ width: 16, height: 16, cursor: 'pointer' }}
                      onChange={e => setWizardAvail(a => a.map((s, idx) => idx === i ? { ...s, is_available: e.target.checked } : s))} />
                    <span style={{ fontSize: 13, color: slot.is_available ? '#166534' : '#94A3B8', fontWeight: 600 }}>
                      {slot.is_available ? 'Available' : 'Off'}
                    </span>
                  </label>
                  {slot.is_available && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <label style={{ fontSize: 12, color: '#64748B' }}>From</label>
                        <input type="time" className="input" style={{ width: 110 }} value={slot.start_time}
                          onChange={e => setWizardAvail(a => a.map((s, idx) => idx === i ? { ...s, start_time: e.target.value } : s))} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <label style={{ fontSize: 12, color: '#64748B' }}>To</label>
                        <input type="time" className="input" style={{ width: 110 }} value={slot.end_time}
                          onChange={e => setWizardAvail(a => a.map((s, idx) => idx === i ? { ...s, end_time: e.target.value } : s))} />
                      </div>
                    </>
                  )}
                </div>
              ))}
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() =>
                  setWizardAvail(a => a.map(s => ({ ...s, is_available: true, start_time: '09:00', end_time: '18:00' })))}>
                  Set All Available
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() =>
                  setWizardAvail(a => a.map((s, i) => ({ ...s, is_available: i < 5 })))}>
                  Weekdays Only
                </button>
              </div>
            </div>
          )}

          {/* ── Step 5: Review & Submit ── */}
          {step === 5 && (
            <div>
              <SectionTitle>Review & Confirm</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <ReviewSection title="Personal Info" items={[
                  ['Name', form.name],
                  ['Mobile', form.mobile],
                  ['Email', form.email || '—'],
                  ['Alt Mobile', form.alternate_mobile || '—'],
                  ['DOB', form.dob || '—'],
                  ['Gender', form.gender || '—'],
                  ['Experience', `${form.experience_years} years`],
                  ['ID Type', form.identity_type || '—'],
                  ['ID Number', form.identity_number || '—'],
                ]} />
                <ReviewSection title="Location" items={[
                  ['City', form.city || '—'],
                  ['Area', form.area || '—'],
                  ['Pincode', form.pincode || '—'],
                  ['Address', form.address || '—'],
                ]} />
                <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '12px 16px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 10 }}>
                    Skills ({wizardSkills.filter(s => s.service_id).length})
                  </div>
                  {wizardSkills.filter(s => s.service_id).length === 0
                    ? <div style={{ fontSize: 13, color: '#94A3B8' }}>No skills added</div>
                    : wizardSkills.filter(s => s.service_id).map((sk, i) => {
                        const svc = allServices.find(s => s.id === sk.service_id)
                        return (
                          <div key={i} style={{ fontSize: 13, color: '#0F172A', marginBottom: 4 }}>
                            🔧 {svc?.name || sk.service_id} — <span style={{ color: '#1B4FD8' }}>{sk.proficiency}</span>
                          </div>
                        )
                      })
                  }
                </div>
                <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '12px 16px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 10 }}>
                    Availability
                  </div>
                  {wizardAvail.filter(s => s.is_available).map(s => (
                    <div key={s.day} style={{ fontSize: 13, color: '#0F172A', marginBottom: 3 }}>
                      📅 {s.day}: {s.start_time} — {s.end_time}
                    </div>
                  ))}
                  {wizardAvail.filter(s => !s.is_available).length > 0 && (
                    <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>
                      Off: {wizardAvail.filter(s => !s.is_available).map(s => s.day).join(', ')}
                    </div>
                  )}
                </div>
              </div>

              {/* Payout review */}
              {(form.payout_upi_id || form.payout_bank_account) && (
                <ReviewSection title="💳 Payout Method" items={
                  form.payout_method === 'upi'
                    ? [['Method', 'UPI'], ['UPI ID', form.payout_upi_id || '—']]
                    : [
                        ['Method', 'Bank Transfer'],
                        ['Account Holder', form.payout_account_holder || '—'],
                        ['Account No.', form.payout_bank_account || '—'],
                        ['IFSC', form.payout_bank_ifsc || '—'],
                        ['Bank', form.payout_bank_name || '—'],
                      ]
                } />
              )}

              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '12px 16px',
                fontSize: 13, color: '#166534', marginBottom: 4 }}>
                ✅ A user account will be created automatically. Default login password will be the mobile number.
                The technician will be assigned code <strong>TECH#####</strong> automatically.
              </div>
            </div>
          )}

          {/* Error message */}
          {err && (
            <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '10px 14px',
              borderRadius: 8, fontSize: 13, marginTop: 16, fontWeight: 500 }}>
              ⚠️ {err}
            </div>
          )}

          {/* Footer nav */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24,
            paddingTop: 16, borderTop: '1px solid #E2E8F0' }}>
            <div>
              {step > 1 && (
                <button className="btn btn-secondary" onClick={prevStep}>← Back</button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#94A3B8' }}>Step {step} of {STEPS.length}</span>
              {step < STEPS.length ? (
                <button className="btn btn-primary" onClick={nextStep}>Continue →</button>
              ) : (
                <button className="btn btn-primary" onClick={handleCreate} disabled={saving}
                  style={{ minWidth: 160, background: '#059669' }}>
                  {saving ? <Spinner size="sm" /> : '🚀 Register Technician'}
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  )
}

// ─── Small helper components ──────────────────────────────────────────────────
function SectionTitle({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 10,
      paddingBottom: 6, borderBottom: '2px solid #EFF6FF', textTransform: 'uppercase',
      letterSpacing: '0.06em', ...style }}>
      {children}
    </div>
  )
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={style}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function ReviewSection({ title, items }: { title: string; items: [string, string][] }) {
  return (
    <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '12px 16px', border: '1px solid #E2E8F0' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 10 }}>
        {title}
      </div>
      {items.map(([label, val]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13,
          marginBottom: 6, paddingBottom: 5, borderBottom: '1px solid #F1F5F9' }}>
          <span style={{ color: '#64748B' }}>{label}</span>
          <span style={{ fontWeight: 600, color: '#0F172A', maxWidth: 200, textAlign: 'right', wordBreak: 'break-word' }}>{val}</span>
        </div>
      ))}
    </div>
  )
}
