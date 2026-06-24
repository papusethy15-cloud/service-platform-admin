import { useEffect, useState } from 'react'
import { commissionsAPI, servicesAPI, techniciansAPI, domainsAPI } from '@/services/api'
import Toast, { useToast } from '@/components/ui/Toast'
import PageHeader from '@/components/layout/PageHeader'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'
import StatusBadge from '@/components/ui/StatusBadge'

interface Service  { id: string; name: string; category_name?: string }
interface Domain   { id: string; name: string }
interface GroupRule { id?: string; service_id: string; domain_id: string|null; commission_type: string; rate: number }
interface Group {
  id: string; name: string; description?: string; is_active: boolean
  technician_count: number; rules: GroupRule[]
}
interface Technician { id: string; name: string; mobile: string; technician_code?: string }

const brand = '#1B4FD8'

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>{children}</label>
}

export default function CommissionGroups() {
  const [groups, setGroups]       = useState<Group[]>([])
  const [loading, setLoading]     = useState(true)
  const [services, setServices]   = useState<Service[]>([])
  const [allTechs, setAllTechs]   = useState<Technician[]>([])
  const [domains, setDomains]     = useState<Domain[]>([])

  // Group modal
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState<Group | null>(null)
  const [form, setForm]           = useState({ name: '', description: '' })
  const [rules, setRules]         = useState<GroupRule[]>([])
  const [saving, setSaving]       = useState(false)
  const [err, setErr]             = useState('')
  const [confirmDelete, setConfirmDelete] = useState<Group | null>(null)

  const { toasts, removeToast, toast } = useToast()

  // Detail drawer
  const [detail, setDetail]         = useState<any | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [assignSearch, setAssignSearch]   = useState('')
  const [assigning, setAssigning]         = useState(false)

  // Part commission rules (per group detail)
  const [partRules, setPartRules]         = useState<any[]>([])
  const [partRulesLoading, setPartRulesLoading] = useState(false)
  const [showPartRuleForm, setShowPartRuleForm] = useState(false)
  const [editingPartRule, setEditingPartRule] = useState<any | null>(null)
  const [partRuleForm, setPartRuleForm] = useState({
    part_name_match: '', part_source_filter: '', commission_type: 'PERCENTAGE', rate: 0
  })
  const [partRuleSaving, setPartRuleSaving] = useState(false)

  // Load
  const fetchGroups = async () => {
    setLoading(true)
    try { const r = await commissionsAPI.listGroups(); setGroups(r.data.data || []) }
    catch { setGroups([]) } finally { setLoading(false) }
  }

  useEffect(() => {
    fetchGroups()
    servicesAPI.list({ per_page: 200, visible_only: false })
      .then(r => setServices(r.data.data?.services || r.data.data?.items || []))
      .catch(() => {})
    techniciansAPI.list({ per_page: 200 })
      .then(r => { const d = r.data.data; setAllTechs(d.technicians || d.items || []) })
      .catch(() => {})
    domainsAPI.list({ per_page: 100 })
      .then(r => {
        const d = r.data.data
        const list = Array.isArray(d) ? d : (d?.items || d?.domains || d?.data || [])
        setDomains(list)
      })
      .catch(() => { setDomains([]) })
  }, [])

  // ── Open create ──────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', description: '' })
    setRules([{ service_id: '', domain_id: null, commission_type: 'PERCENTAGE', rate: 0 }])
    setErr(''); setShowModal(true)
  }

  // ── Open edit ────────────────────────────────────────────────────────────────
  const openEdit = (g: Group) => {
    setEditing(g)
    setForm({ name: g.name, description: g.description || '' })
    setRules(g.rules.length ? g.rules.map(r => ({ ...r }))
      : [{ service_id: '', domain_id: null, commission_type: 'PERCENTAGE', rate: 0 }])
    setErr(''); setShowModal(true)
  }

  // ── Save ─────────────────────────────────────────────────────────────────────
  const save = async () => {
    if (!form.name.trim()) { setErr('Group name is required'); return }
    const validRules = rules.filter(r => r.service_id && r.rate > 0)
    setSaving(true); setErr('')
    try {
      const payload = { name: form.name, description: form.description, rules: validRules }
      if (editing) {
        await commissionsAPI.updateGroup(editing.id, payload)
      } else {
        await commissionsAPI.createGroup(payload)
      }
      setShowModal(false); fetchGroups()
      toast.success(editing ? 'Group Updated' : 'Group Created', editing ? 'Commission group saved successfully.' : 'New commission group created.')
    } catch (e: any) { setErr(e.response?.data?.detail || 'Save failed') }
    finally { setSaving(false) }
  }

  // ── Open detail ──────────────────────────────────────────────────────────────
  const openDetail = async (g: Group) => {
    setDetailLoading(true); setDetail({ ...g, technicians: [] }); setPartRules([])
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

  const savePartRule = async () => {
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
      setShowPartRuleForm(false); setEditingPartRule(null)
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

  const deleteGroup = async (g: Group) => {
    setConfirmDelete(g)
  }
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
  const addRule    = () => setRules(r => [...r, { service_id: '', domain_id: null, commission_type: 'PERCENTAGE', rate: 0 }])
  const removeRule = (i: number) => setRules(r => r.filter((_, idx) => idx !== i))
  const updateRule = (i: number, k: keyof GroupRule, v: any) => setRules(r => r.map((row, idx) => idx === i ? { ...row, [k]: v } : row))

  // Techs not yet in this group
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
        subtitle="Define per-service commission rules and assign technicians"
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
            Create groups to define how much commission each technician earns per service.
          </div>
          <button className="btn btn-primary" onClick={openCreate}>+ Create First Group</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
          {groups.map(g => (
            <div key={g.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ padding: '16px 18px', borderBottom: '1px solid #F1F5F9',
                background: 'linear-gradient(135deg,#EFF6FF,#F8FAFC)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: '#0F172A' }}>💼 {g.name}</div>
                  {g.description && <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{g.description}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span style={{ fontSize: 11, background: '#DCFCE7', color: '#166534', padding: '2px 8px',
                    borderRadius: 20, fontWeight: 600 }}>
                    👥 {g.technician_count} tech{g.technician_count !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Rules summary */}
              <div style={{ padding: '12px 18px' }}>
                {g.rules.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#94A3B8' }}>No rules defined</div>
                ) : g.rules.slice(0, 4).map((r, i) => {
                  const svc = services.find(s => s.id === r.service_id)
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      fontSize: 13, padding: '5px 0', borderBottom: '1px solid #F8FAFC' }}>
                      <span style={{ color: '#374151', flex: 1 }}>🔧 {svc?.name || '—'}</span>
                      {r.domain_id && <span style={{ fontSize: 11, color: '#7C3AED', background: '#F5F3FF',
                        padding: '1px 6px', borderRadius: 10, marginRight: 6 }}>Domain</span>}
                      <span style={{ fontWeight: 700, color: '#059669', flexShrink: 0 }}>
                        {r.commission_type === 'PERCENTAGE' ? `${r.rate}%` : `₹${r.rate}`}
                      </span>
                    </div>
                  )
                })}
                {g.rules.length > 4 && (
                  <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>
                    +{g.rules.length - 4} more rules
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ padding: '10px 18px', borderTop: '1px solid #F1F5F9',
                display: 'flex', gap: 8, background: '#FAFAFA' }}>
                <button className="btn btn-primary btn-sm" onClick={() => openDetail(g)}>
                  👥 Manage Technicians
                </button>
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

          {/* Rules */}
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', textTransform: 'uppercase',
            letterSpacing: '0.06em', marginBottom: 10, paddingBottom: 6, borderBottom: '2px solid #EFF6FF' }}>
            Commission Rules per Service
          </div>
          <div style={{ fontSize: 12, color: '#64748B', marginBottom: 14 }}>
            💡 Price used for commission: Domain city price → City price → Service base price (in priority order)
          </div>

          {rules.map((r, i) => (
            <div key={i} style={{ marginBottom: 10, background: '#F8FAFC', borderRadius: 8,
              padding: '12px 14px', border: '1px solid #E2E8F0' }}>
              {/* Row 1: Service + Domain */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <Label>Service *</Label>
                  <select className="input" value={r.service_id}
                    onChange={e => updateRule(i, 'service_id', e.target.value)}>
                    <option value="">Select service…</option>
                    {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Service Domain (optional)</Label>
                  <select className="input" value={r.domain_id || ''}
                    onChange={e => updateRule(i, 'domain_id', e.target.value || null)}>
                    <option value="">— All domains —</option>
                    {domains.length === 0
                      ? <option disabled value="">Loading domains…</option>
                      : domains.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)
                    }
                  </select>
                  {domains.length === 0 && (
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>
                      ℹ️ No domains loaded — leave as All domains
                    </div>
                  )}
                </div>
              </div>
              {/* Row 2: Type + Rate + Remove */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <Label>Commission Type</Label>
                  <select className="input" value={r.commission_type}
                    onChange={e => updateRule(i, 'commission_type', e.target.value)}>
                    <option value="PERCENTAGE">% Percentage</option>
                    <option value="FLAT">₹ Flat Amount</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <Label>{r.commission_type === 'PERCENTAGE' ? 'Rate (%)' : 'Amount (₹)'}</Label>
                  <input className="input" type="number" min={0} step={r.commission_type === 'PERCENTAGE' ? 0.5 : 1}
                    value={r.rate} onChange={e => updateRule(i, 'rate', parseFloat(e.target.value) || 0)} />
                </div>
                <button onClick={() => removeRule(i)} disabled={rules.length === 1}
                  style={{ background: 'none', border: '1px solid #FECACA', color: '#EF4444', borderRadius: 6,
                    padding: '7px 10px', cursor: 'pointer', flexShrink: 0 }}>✕ Remove</button>
              </div>
            </div>
          ))}
          <button className="btn btn-secondary btn-sm" onClick={addRule} style={{ marginBottom: 20 }}>
            + Add Service Rule
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
          DETAIL / ASSIGN TECHNICIANS DRAWER
      ═══════════════════════════════════════ */}
      {detail && (
        <Modal title={`${detail.name} — Technicians`} onClose={() => setDetail(null)} size="xl">
          {detailLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><Spinner /></div>
          ) : (
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
                <div style={{ maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
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
          )}

          {/* Service commission rules */}
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 8 }}>
              🔧 Service Commission Rules
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(detail.rules || []).map((r: any, i: number) => {
                const svc = services.find(s => s.id === r.service_id)
                return (
                  <div key={i} style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8,
                    padding: '6px 12px', fontSize: 13 }}>
                    <span style={{ color: '#374151' }}>🔧 {svc?.name || '—'}</span>
                    {r.domain_id && <span style={{ color: '#7C3AED', marginLeft: 6, fontSize: 11 }}>Domain-specific</span>}
                    <span style={{ fontWeight: 700, color: '#059669', marginLeft: 8 }}>
                      {r.commission_type === 'PERCENTAGE' ? `${r.rate}%` : `₹${r.rate}`}
                    </span>
                    <span style={{ fontSize: 11, color: '#64748B', marginLeft: 6 }}>
                      of {r.commission_type === 'PERCENTAGE' ? 'service price' : 'flat'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Spare part commission rules */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>
                🔩 Spare Part Commission Rules
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => {
                setEditingPartRule(null)
                setPartRuleForm({ part_name_match: '', part_source_filter: '', commission_type: 'PERCENTAGE', rate: 0 })
                setShowPartRuleForm(true)
              }}>+ Add Part Rule</button>
            </div>

            {partRulesLoading ? (
              <Spinner />
            ) : partRules.length === 0 ? (
              <div style={{ fontSize: 12, color: '#94A3B8', padding: '12px', background: '#F8FAFC', borderRadius: 8, border: '2px dashed #E2E8F0', textAlign: 'center' }}>
                No spare part commission rules yet. Add rules to auto-calculate commission on parts during settlement.
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
              <div style={{ marginTop: 12, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '14px 16px' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#374151', marginBottom: 12 }}>
                  {editingPartRule ? '✏️ Edit Part Rule' : '➕ Add Part Rule'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <Label>Part Name Filter (optional)</Label>
                    <input className="input" placeholder="e.g. Compressor, Capacitor (blank = all parts)"
                      value={partRuleForm.part_name_match}
                      onChange={e => setPartRuleForm(f => ({ ...f, part_name_match: e.target.value }))} />
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Leave blank to match all spare parts</div>
                  </div>
                  <div>
                    <Label>Part Source</Label>
                    <select className="input" value={partRuleForm.part_source_filter}
                      onChange={e => setPartRuleForm(f => ({ ...f, part_source_filter: e.target.value }))}>
                      <option value="">Both (Office + Market)</option>
                      <option value="OFFICE_STOCK">🏢 Office Stock only</option>
                      <option value="MARKET_PURCHASE">🛒 Market Purchase only</option>
                    </select>
                  </div>
                  <div>
                    <Label>Commission Type</Label>
                    <select className="input" value={partRuleForm.commission_type}
                      onChange={e => setPartRuleForm(f => ({ ...f, commission_type: e.target.value }))}>
                      <option value="PERCENTAGE">% Percentage of sale price</option>
                      <option value="FLAT">₹ Flat per unit</option>
                    </select>
                  </div>
                  <div>
                    <Label>{partRuleForm.commission_type === 'PERCENTAGE' ? 'Rate (%)' : 'Amount (₹) per unit'}</Label>
                    <input className="input" type="number" min={0} step={0.5}
                      value={partRuleForm.rate}
                      onChange={e => setPartRuleForm(f => ({ ...f, rate: parseFloat(e.target.value) || 0 }))} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={savePartRule} disabled={partRuleSaving}>
                    {partRuleSaving ? <Spinner size="sm" /> : editingPartRule ? '💾 Update Rule' : '✅ Add Rule'}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setShowPartRuleForm(false); setEditingPartRule(null) }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
      {/* Toast notifications */}
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
