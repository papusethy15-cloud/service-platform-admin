import { useState, useEffect } from 'react'
import { usersAPI } from '@/services/api'
import CloudinaryImageUploader from '@/components/ui/CloudinaryImageUploader'
import PageHeader from '@/components/layout/PageHeader'
import StatusBadge from '@/components/ui/StatusBadge'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'
import Toast, { useToast } from '@/components/ui/Toast'

// ─── Permission catalog ───────────────────────────────────────────────────────
const PERMISSION_CATALOG = [
  { code: 'customer.view',     module: 'Customer Management',   name: 'View Customers',      desc: 'View customer profiles and history' },
  { code: 'customer.manage',   module: 'Customer Management',   name: 'Manage Customers',    desc: 'Create and update customer records' },
  { code: 'booking.view',      module: 'Booking Management',    name: 'View Bookings',       desc: 'View booking queue and history' },
  { code: 'booking.manage',    module: 'Booking Management',    name: 'Manage Bookings',     desc: 'Update booking lifecycle and schedules' },
  { code: 'assignment.manage', module: 'Booking Management',    name: 'Manage Assignments',  desc: 'Assign and reassign technicians' },
  { code: 'quotation.manage',  module: 'Payment Management',    name: 'Manage Quotations',   desc: 'Create and approve quotations' },
  { code: 'invoice.manage',    module: 'Payment Management',    name: 'Manage Invoices',     desc: 'Generate and send invoices' },
  { code: 'payment.manage',    module: 'Payment Management',    name: 'Manage Payments',     desc: 'Record and verify payments' },
  { code: 'technician.view',   module: 'Technician Management', name: 'View Technicians',    desc: 'View technician roster and status' },
  { code: 'technician.manage', module: 'Technician Management', name: 'Manage Technicians',  desc: 'Create and update technician profiles' },
  { code: 'tracking.view',     module: 'Tracking',              name: 'View Tracking',       desc: 'View technician live location' },
  { code: 'gst.view',          module: 'Finance',               name: 'View GST Settings',   desc: 'View GST configuration' },
  { code: 'report.view',       module: 'Reports',               name: 'View Reports',        desc: 'View operational and financial reports' },
  { code: 'report.export',     module: 'Reports',               name: 'Export Reports',      desc: 'Download and export report data' },
  { code: 'user.view',         module: 'User Management',       name: 'View Users',          desc: 'View staff directory and profiles' },
  { code: 'user.create',       module: 'User Management',       name: 'Create Users',        desc: 'Create internal staff accounts' },
  { code: 'user.update',       module: 'User Management',       name: 'Update Users',        desc: 'Update user information' },
]

const DEFAULT_CCO_PERMISSIONS = new Set([
  'customer.view','customer.manage','technician.view',
  'booking.view','booking.manage','assignment.manage',
  'quotation.manage','invoice.manage','payment.manage',
  'tracking.view','gst.view','report.view',
])

const grouped = PERMISSION_CATALOG.reduce<Record<string, typeof PERMISSION_CATALOG>>((acc, p) => {
  if (!acc[p.module]) acc[p.module] = []
  acc[p.module].push(p)
  return acc
}, {})

const STEPS = ['Basic Details', 'Documents', 'Permissions', 'Review & Register']

// ─── StepBar ──────────────────────────────────────────────────────────────────
function StepBar({ current }: { current: number }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', marginBottom:28 }}>
      {STEPS.map((label, idx) => {
        const done = idx < current; const active = idx === current
        return (
          <div key={label} style={{ display:'flex', alignItems:'center', flex: idx < STEPS.length-1 ? 1 : 'none' }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
              <div style={{ width:32, height:32, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:13, fontWeight:700, border:'2px solid', transition:'all 0.2s',
                borderColor: done||active ? '#1B4FD8':'#CBD5E1',
                background: done ? '#1B4FD8' : active ? '#EFF6FF':'#F8FAFC',
                color: done ? '#fff' : active ? '#1B4FD8':'#94A3B8' }}>
                {done ? '✓' : idx+1}
              </div>
              <span style={{ fontSize:11, fontWeight:500, whiteSpace:'nowrap', color: active?'#1B4FD8':done?'#475569':'#94A3B8' }}>{label}</span>
            </div>
            {idx < STEPS.length-1 && <div style={{ flex:1, height:2, margin:'0 8px', marginBottom:18, background: done?'#1B4FD8':'#E2E8F0', transition:'background 0.2s' }} />}
          </div>
        )
      })}
    </div>
  )
}

// ─── Field helper ─────────────────────────────────────────────────────────────
function Field({ label, required, error, children }: { label:string; required?:boolean; error?:string; children:React.ReactNode }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:5 }}>
        {label}{required && <span style={{ color:'#EF4444', marginLeft:3 }}>*</span>}
      </label>
      {children}
      {error && <p style={{ fontSize:11, color:'#EF4444', marginTop:3 }}>{error}</p>}
    </div>
  )
}
const iStyle = (err?: string): React.CSSProperties => ({
  width:'100%', padding:'8px 11px', fontSize:13, borderRadius:8, outline:'none', boxSizing:'border-box',
  border:`1.5px solid ${err?'#EF4444':'#E2E8F0'}`, background:'#FAFAFA', color:'#0F172A', transition:'border-color 0.15s',
})

// ─── Step 1: Basic Details ────────────────────────────────────────────────────
interface BasicDetails { name:string; mobile:string; email:string; password:string; confirmPassword:string; city:string; employeeId:string; joiningDate:string }
const BASIC_EMPTY: BasicDetails = { name:'', mobile:'', email:'', password:'', confirmPassword:'', city:'', employeeId:'', joiningDate:'' }

function Step1({ data, onChange, errors }: { data:BasicDetails; onChange:(f:keyof BasicDetails,v:string)=>void; errors:Partial<BasicDetails> }) {
  const [showPw, setShowPw] = useState(false)
  const [showCPw, setShowCPw] = useState(false)
  const inp = (f: keyof BasicDetails, label: string, type='text', placeholder='', req=false) => (
    <Field key={f} label={label} required={req} error={errors[f]}>
      <input style={iStyle(errors[f])} type={type} placeholder={placeholder} value={data[f]} onChange={e => onChange(f, e.target.value)} />
    </Field>
  )
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
      {inp('name','Full Name','text','e.g. Ravi Kumar',true)}
      {inp('mobile','Mobile Number','tel','10-digit mobile',true)}
      {inp('email','Email Address','email','ravi@paleisolutions.com',true)}
      {inp('city','City / Location','text','e.g. Bhubaneswar')}
      {inp('employeeId','Employee ID','text','e.g. CCO-001 (optional)')}
      {inp('joiningDate','Joining Date','date')}
      <Field label="Password" required error={errors.password}>
        <div style={{ position:'relative' }}>
          <input style={iStyle(errors.password)} type={showPw?'text':'password'} placeholder="Min. 6 characters" value={data.password} onChange={e => onChange('password', e.target.value)} />
          <button type="button" onClick={() => setShowPw(p=>!p)} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#94A3B8', fontSize:13 }}>{showPw?'🙈':'👁'}</button>
        </div>
      </Field>
      <Field label="Confirm Password" required error={errors.confirmPassword}>
        <div style={{ position:'relative' }}>
          <input style={iStyle(errors.confirmPassword)} type={showCPw?'text':'password'} placeholder="Re-enter password" value={data.confirmPassword} onChange={e => onChange('confirmPassword', e.target.value)} />
          <button type="button" onClick={() => setShowCPw(p=>!p)} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#94A3B8', fontSize:13 }}>{showCPw?'🙈':'👁'}</button>
        </div>
      </Field>
    </div>
  )
}

// ─── Step 2: Documents via Cloudinary ────────────────────────────────────────
interface Documents { profileImageUrl:string; idProofUrl:string; idProofType:string; addressProofUrl:string; addressProofType:string }
const DOCS_EMPTY: Documents = { profileImageUrl:'', idProofUrl:'', idProofType:'', addressProofUrl:'', addressProofType:'' }

function Step2({ docs, onChange }: { docs:Documents; onChange:(k:keyof Documents,v:string)=>void }) {
  const ID_TYPES   = ['Aadhaar Card','PAN Card','Voter ID','Passport','Driving Licence']
  const ADDR_TYPES = ['Aadhaar Card','Utility Bill','Bank Passbook','Rental Agreement','Voter ID']
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#1D4ED8' }}>
        ☁️ All documents are uploaded to <strong>Cloudinary</strong> and stored as secure URLs. Photo and ID proof are required.
      </div>

      <CloudinaryImageUploader
        label="Profile Photo"
        fieldKey="cco_profile_photo"
        aspectRatio={1}
        recommendedSize="256×256px"
        hint="Square photo shown in the CCO portal and admin dashboard."
        currentUrl={docs.profileImageUrl}
        onChange={url => onChange('profileImageUrl', url)}
      />

      <div>
        <CloudinaryImageUploader
          label="ID Proof Document"
          fieldKey="cco_id_proof"
          recommendedSize="Any size"
          hint="Upload a scan or photo of the ID document (Aadhaar, PAN, Passport, etc.)"
          currentUrl={docs.idProofUrl}
          onChange={url => onChange('idProofUrl', url)}
        />
        <div style={{ marginTop:10 }}>
          <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:5 }}>
            ID Proof Type <span style={{ color:'#EF4444' }}>*</span>
          </label>
          <select style={iStyle()} value={docs.idProofType} onChange={e => onChange('idProofType', e.target.value)}>
            <option value="">Select document type</option>
            {ID_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div>
        <CloudinaryImageUploader
          label="Address Proof (Optional)"
          fieldKey="cco_address_proof"
          recommendedSize="Any size"
          hint="Upload a scan of the address proof document if available."
          currentUrl={docs.addressProofUrl}
          onChange={url => onChange('addressProofUrl', url)}
        />
        <div style={{ marginTop:10 }}>
          <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:5 }}>Address Proof Type</label>
          <select style={iStyle()} value={docs.addressProofType} onChange={e => onChange('addressProofType', e.target.value)}>
            <option value="">Select document type (optional)</option>
            {ADDR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}

// ─── Step 3: Permissions ──────────────────────────────────────────────────────
function Step3({ selected, onChange }: { selected:Set<string>; onChange:(code:string,checked:boolean)=>void }) {
  const allOn = PERMISSION_CATALOG.every(p => selected.has(p.code))
  const modOn = (mod:string) => grouped[mod].every(p => selected.has(p.code))
  const modPartial = (mod:string) => grouped[mod].some(p => selected.has(p.code)) && !modOn(mod)
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <p style={{ fontWeight:600, fontSize:13, color:'#0F172A', margin:0 }}>Permission Overrides</p>
          <p style={{ fontSize:12, color:'#64748B', margin:'2px 0 0' }}>Default CCO permissions are pre-selected.</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <span style={{ fontSize:12, background:'#EFF6FF', color:'#1D4ED8', fontWeight:600, padding:'3px 10px', borderRadius:20 }}>{selected.size}/{PERMISSION_CATALOG.length} granted</span>
          <button onClick={() => { DEFAULT_CCO_PERMISSIONS.forEach(c=>onChange(c,true)); PERMISSION_CATALOG.filter(p=>!DEFAULT_CCO_PERMISSIONS.has(p.code)).forEach(p=>onChange(p.code,false)) }}
            style={{ fontSize:11, color:'#64748B', background:'none', border:'1px solid #E2E8F0', borderRadius:6, padding:'3px 10px', cursor:'pointer' }}>Reset defaults</button>
          <button onClick={() => { if(allOn) PERMISSION_CATALOG.forEach(p=>onChange(p.code,false)); else PERMISSION_CATALOG.forEach(p=>onChange(p.code,true)) }}
            style={{ fontSize:11, color:allOn?'#EF4444':'#1B4FD8', background:'none', border:`1px solid ${allOn?'#FCA5A5':'#BFDBFE'}`, borderRadius:6, padding:'3px 10px', cursor:'pointer' }}>
            {allOn ? 'Remove All' : 'Grant All'}
          </button>
        </div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {Object.entries(grouped).map(([mod, perms]) => (
          <div key={mod} style={{ border:'1px solid #E2E8F0', borderRadius:10, overflow:'hidden' }}>
            <div onClick={() => { const on=modOn(mod); perms.forEach(p=>onChange(p.code,!on)) }}
              style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:'#F8FAFC', cursor:'pointer', userSelect:'none' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:16, height:16, borderRadius:4, border:`2px solid ${modOn(mod)||modPartial(mod)?'#1B4FD8':'#CBD5E1'}`,
                  background: modOn(mod)?'#1B4FD8':modPartial(mod)?'#DBEAFE':'white',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'white' }}>
                  {modOn(mod)?'✓':modPartial(mod)?'−':''}
                </div>
                <span style={{ fontSize:13, fontWeight:600, color:'#0F172A' }}>{mod}</span>
              </div>
              <span style={{ fontSize:11, color:'#64748B' }}>{perms.filter(p=>selected.has(p.code)).length}/{perms.length}</span>
            </div>
            <div>
              {perms.map(perm => (
                <label key={perm.code} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'9px 14px 9px 28px',
                  cursor:'pointer', borderTop:'1px solid #F1F5F9', background:selected.has(perm.code)?'#FAFEFF':'white' }}>
                  <div style={{ marginTop:1, width:15, height:15, borderRadius:3, flexShrink:0,
                    border:`2px solid ${selected.has(perm.code)?'#1B4FD8':'#CBD5E1'}`,
                    background:selected.has(perm.code)?'#1B4FD8':'white',
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'white' }}>
                    {selected.has(perm.code)&&'✓'}
                  </div>
                  <input type="checkbox" style={{ display:'none' }} checked={selected.has(perm.code)} onChange={e=>onChange(perm.code,e.target.checked)} />
                  <div style={{ flex:1 }}>
                    <p style={{ fontSize:12, fontWeight:600, color:'#1E293B', margin:0 }}>{perm.name}</p>
                    <p style={{ fontSize:11, color:'#64748B', margin:'1px 0 0' }}>{perm.desc}</p>
                  </div>
                  {DEFAULT_CCO_PERMISSIONS.has(perm.code) && (
                    <span style={{ fontSize:10, background:'#DBEAFE', color:'#1D4ED8', padding:'1px 7px', borderRadius:10, fontWeight:600, flexShrink:0, marginTop:2 }}>DEFAULT</span>
                  )}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Step 4: Review ───────────────────────────────────────────────────────────
function Step4({ basic, docs, permissions, onEdit }: { basic:BasicDetails; docs:Documents; permissions:Set<string>; onEdit:(s:number)=>void }) {
  const grantedPerms = PERMISSION_CATALOG.filter(p => permissions.has(p.code))
  const Section = ({ title, step, children }: { title:string; step:number; children:React.ReactNode }) => (
    <div style={{ border:'1px solid #E2E8F0', borderRadius:10, overflow:'hidden', marginBottom:12 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px', background:'#F8FAFC', borderBottom:'1px solid #E2E8F0' }}>
        <span style={{ fontSize:13, fontWeight:700, color:'#0F172A' }}>{title}</span>
        <button onClick={()=>onEdit(step)} style={{ fontSize:12, color:'#1B4FD8', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>Edit</button>
      </div>
      <div style={{ padding:'12px 16px' }}>{children}</div>
    </div>
  )
  const Row = ({ label, value }: { label:string; value:string }) => (
    <div style={{ display:'flex', gap:12, marginBottom:6 }}>
      <span style={{ fontSize:12, color:'#64748B', width:110, flexShrink:0 }}>{label}</span>
      <span style={{ fontSize:13, fontWeight:600, color:'#0F172A' }}>{value||'—'}</span>
    </div>
  )
  return (
    <div>
      <div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#92400E', marginBottom:16 }}>
        ⚠️ Please review all details carefully before registering the CCO agent.
      </div>
      <Section title="Basic Details" step={0}>
        <Row label="Full Name" value={basic.name} /><Row label="Mobile" value={basic.mobile} />
        <Row label="Email" value={basic.email} /><Row label="City" value={basic.city} />
        <Row label="Employee ID" value={basic.employeeId} /><Row label="Joining Date" value={basic.joiningDate} />
      </Section>
      <Section title="Documents (Cloudinary)" step={1}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
          {[
            { label:'Profile Photo', url:docs.profileImageUrl, type:'', required:true },
            { label:'ID Proof', url:docs.idProofUrl, type:docs.idProofType, required:true },
            { label:'Address Proof', url:docs.addressProofUrl, type:docs.addressProofType, required:false },
          ].map(({ label, url, type, required }) => (
            <div key={label} style={{ border:`1px solid ${url?'#BBF7D0':'#E2E8F0'}`, borderRadius:8, padding:'10px 12px', background:url?'#F0FDF4':'#F8FAFC' }}>
              {url && <img src={url} alt="" style={{ width:'100%', height:60, objectFit:'cover', borderRadius:6, marginBottom:6 }} />}
              <p style={{ fontSize:11, fontWeight:700, color:'#374151', margin:0 }}>{label}</p>
              {type && <p style={{ fontSize:10, color:'#64748B', margin:'1px 0' }}>{type}</p>}
              <p style={{ fontSize:10, color:url?'#16A34A':'#94A3B8', margin:'2px 0 0' }}>{url?'✅ Uploaded to Cloudinary':required?'❌ Required':'— Optional'}</p>
            </div>
          ))}
        </div>
      </Section>
      <Section title={`Permissions (${grantedPerms.length} granted)`} step={2}>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          {grantedPerms.map(p => (
            <span key={p.code} style={{ fontSize:11, background:'#EFF6FF', border:'1px solid #BFDBFE', color:'#1D4ED8', padding:'2px 10px', borderRadius:20, fontWeight:600 }}>✓ {p.name}</span>
          ))}
          {grantedPerms.length===0 && <span style={{ fontSize:13, color:'#94A3B8' }}>No permissions granted</span>}
        </div>
      </Section>
    </div>
  )
}

// ─── Register Modal ───────────────────────────────────────────────────────────
function RegisterModal({ onClose, onSuccess }: { onClose:()=>void; onSuccess:(name:string)=>void }) {
  const [step, setStep] = useState(0)
  const [basic, setBasic] = useState<BasicDetails>({...BASIC_EMPTY})
  const [basicErrors, setBasicErrors] = useState<Partial<BasicDetails>>({})
  const [docs, setDocs] = useState<Documents>({...DOCS_EMPTY})
  const [permissions, setPermissions] = useState<Set<string>>(new Set(DEFAULT_CCO_PERMISSIONS))
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const updBasic = (f:keyof BasicDetails, v:string) => { setBasic(p=>({...p,[f]:v})); setBasicErrors(p=>({...p,[f]:''})) }
  const updDoc = (k:keyof Documents, v:string) => setDocs(p=>({...p,[k]:v}))
  const updPerm = (code:string, checked:boolean) => setPermissions(prev=>{ const n=new Set(prev); if(checked) n.add(code); else n.delete(code); return n })

  const validate1 = () => {
    const e: Partial<BasicDetails> = {}
    if (!basic.name.trim()) e.name='Full name is required'
    if (!/^[6-9]\d{9}$/.test(basic.mobile.trim())) e.mobile='Enter a valid 10-digit Indian mobile number (starts with 6–9)'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(basic.email.trim())) e.email='Enter a valid email address'
    if (basic.password.length < 6) e.password='Password must be at least 6 characters'
    if (basic.password !== basic.confirmPassword) e.confirmPassword='Passwords do not match'
    setBasicErrors(e); return Object.keys(e).length === 0
  }

  const validate2 = () => {
    if (!docs.profileImageUrl) { setErr('Please upload a profile photo.'); return false }
    if (!docs.idProofUrl)      { setErr('Please upload an ID proof document.'); return false }
    if (!docs.idProofType)     { setErr('Please select the ID proof type.'); return false }
    setErr(''); return true
  }

  const handleNext = () => {
    setErr('')
    if (step===0 && !validate1()) return
    if (step===1 && !validate2()) return
    setStep(s=>s+1)
  }

  const handleSubmit = async () => {
    setLoading(true); setErr('')
    try {
      const res = await usersAPI.create({
        name: basic.name.trim(),
        mobile: basic.mobile.trim(),
        email: basic.email.trim(),
        password: basic.password,
        city: basic.city.trim() || undefined,
        role: 'CCO',
        profile_image: docs.profileImageUrl || undefined,
        id_proof_url: docs.idProofUrl || undefined,
        id_proof_type: docs.idProofType || undefined,
        address_proof_url: docs.addressProofUrl || undefined,
        address_proof_type: docs.addressProofType || undefined,
      })
      const userId = res.data?.data?.id || res.data?.id

      const overrides = PERMISSION_CATALOG
        .map(p => ({ permission_code: p.code, is_granted: permissions.has(p.code) }))
        .filter(o => o.is_granted !== DEFAULT_CCO_PERMISSIONS.has(o.permission_code))

      if (overrides.length > 0) {
        await usersAPI.updatePermissions(userId, overrides)
      }
      onSuccess(basic.name.trim())
    } catch(ex:any) {
      const msg = ex?.response?.data?.message || ex?.response?.data?.detail || 'Registration failed. Please try again.'
      setErr(typeof msg==='string' ? msg : JSON.stringify(msg))
    } finally { setLoading(false) }
  }

  const BtnStyle = (primary=true): React.CSSProperties => ({
    padding:'8px 20px', fontSize:13, fontWeight:600, borderRadius:8, cursor: loading?'not-allowed':'pointer',
    background: primary?'#1B4FD8':'white', color: primary?'white':'#374151',
    border: primary?'none':'1px solid #E2E8F0', opacity: loading?0.7:1,
    display:'flex', alignItems:'center', gap:6,
  })

  return (
    <Modal title="Register CCO Agent" onClose={onClose} size="xl">
      <StepBar current={step} />
      <div style={{ marginBottom:18 }}>
        <p style={{ fontSize:14, fontWeight:700, color:'#0F172A', margin:0 }}>
          {['Basic Information','Document Upload','Module Permissions','Review & Register'][step]}
        </p>
        <p style={{ fontSize:12, color:'#64748B', marginTop:3 }}>
          {['Enter personal and login details for the CCO agent.',
            'Upload profile photo and identity documents via Cloudinary.',
            'Configure which modules this CCO agent can access.',
            'Review all information carefully before creating the account.'][step]}
        </p>
      </div>
      {err && (
        <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, padding:'9px 14px', fontSize:13, color:'#DC2626', marginBottom:16, display:'flex', justifyContent:'space-between' }}>
          <span>⚠️ {err}</span>
          <button onClick={()=>setErr('')} style={{ background:'none', border:'none', cursor:'pointer', color:'#94A3B8', fontSize:16 }}>×</button>
        </div>
      )}
      {step===0 && <Step1 data={basic} onChange={updBasic} errors={basicErrors} />}
      {step===1 && <Step2 docs={docs} onChange={updDoc} />}
      {step===2 && <Step3 selected={permissions} onChange={updPerm} />}
      {step===3 && <Step4 basic={basic} docs={docs} permissions={permissions} onEdit={setStep} />}
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:24, paddingTop:18, borderTop:'1px solid #E2E8F0' }}>
        <button style={BtnStyle(false)} onClick={step===0 ? onClose : ()=>{ setErr(''); setStep(s=>s-1) }} disabled={loading}>
          {step===0 ? 'Cancel' : '← Back'}
        </button>
        {step < 3 ? (
          <button style={BtnStyle()} onClick={handleNext}>
            {['Continue to Documents →','Continue to Permissions →','Review Details →'][step]}
          </button>
        ) : (
          <button style={BtnStyle()} onClick={handleSubmit} disabled={loading}>
            {loading ? <><Spinner size="sm" /> Registering…</> : '✓ Register CCO Agent'}
          </button>
        )}
      </div>
      <p style={{ textAlign:'center', fontSize:11, color:'#94A3B8', marginTop:10 }}>Step {step+1} of {STEPS.length}</p>
    </Modal>
  )
}

// ─── Edit User Modal ──────────────────────────────────────────────────────────
const STAFF_ROLES = ['SUPER_ADMIN','ADMIN','CCO','ACCOUNTANT','INVENTORY_MANAGER']

function EditUserModal({ user, onClose, onSaved }: { user:any; onClose:()=>void; onSaved:()=>void }) {
  const [form, setForm] = useState({
    name: user.name || '',
    email: user.email || '',
    mobile: user.mobile || '',
    city: user.city || '',
    role: user.role || 'CCO',
    password: '',
    is_active: user.is_active ?? true,
    is_verified: user.is_verified ?? true,
    profile_image: user.profile_image || '',
    id_proof_url: user.id_proof_url || '',
    id_proof_type: user.id_proof_type || '',
    address_proof_url: user.address_proof_url || '',
    address_proof_type: user.address_proof_type || '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const ID_TYPES   = ['Aadhaar Card','PAN Card','Voter ID','Passport','Driving Licence']
  const ADDR_TYPES = ['Aadhaar Card','Utility Bill','Bank Passbook','Rental Agreement','Voter ID']

  const upd = (k: string, v: any) => setForm(f => ({...f, [k]: v}))

  const handleSave = async () => {
    setSaving(true); setErr('')
    try {
      if (form.mobile && !/^[6-9]\d{9}$/.test(form.mobile.trim())) {
        setErr('Enter a valid 10-digit Indian mobile number (starts with 6–9)')
        setSaving(false); return
      }
      const payload: any = {
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        mobile: form.mobile.trim(),
        city: form.city.trim() || undefined,
        role: form.role,
        is_active: form.is_active,
        is_verified: form.is_verified,
        profile_image: form.profile_image || undefined,
        id_proof_url: form.id_proof_url || undefined,
        id_proof_type: form.id_proof_type || undefined,
        address_proof_url: form.address_proof_url || undefined,
        address_proof_type: form.address_proof_type || undefined,
      }
      if (form.password.trim()) payload.password = form.password.trim()
      await usersAPI.update(user.id, payload)
      onSaved()
    } catch(ex:any) {
      const msg = ex?.response?.data?.detail || ex?.response?.data?.message || 'Failed to save changes.'
      setErr(typeof msg==='string' ? msg : JSON.stringify(msg))
    } finally { setSaving(false) }
  }

  return (
    <Modal title={`Edit — ${user.name}`} onClose={onClose} size="lg">
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

        {/* Status banner for suspended accounts */}
        {!form.is_active && (
          <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#DC2626', display:'flex', alignItems:'center', gap:8 }}>
            🚫 <strong>Account is currently suspended.</strong> This user cannot log in to any portal.
          </div>
        )}

        {err && (
          <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, padding:'9px 14px', fontSize:13, color:'#DC2626' }}>⚠️ {err}</div>
        )}

        {/* Basic Info */}
        <div style={{ border:'1px solid #E2E8F0', borderRadius:10, overflow:'hidden' }}>
          <div style={{ padding:'10px 16px', background:'#F8FAFC', borderBottom:'1px solid #E2E8F0', fontSize:13, fontWeight:700, color:'#0F172A' }}>👤 Basic Information</div>
          <div style={{ padding:'16px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <Field label="Full Name" required>
              <input style={iStyle()} value={form.name} onChange={e=>upd('name',e.target.value)} />
            </Field>
            <Field label="Mobile">
              <input style={iStyle()} type="tel" maxLength={10} placeholder="10-digit mobile"
                value={form.mobile}
                onChange={e=>upd('mobile',e.target.value.replace(/\D/g,'').slice(0,10))} />
              {form.mobile && !/^[6-9]\d{9}$/.test(form.mobile) && (
                <span style={{fontSize:11,color:'#DC2626',marginTop:2,display:'block'}}>Enter a valid 10-digit Indian mobile number</span>
              )}
            </Field>
            <Field label="Email">
              <input style={iStyle()} type="email" value={form.email} onChange={e=>upd('email',e.target.value)} />
            </Field>
            <Field label="City">
              <input style={iStyle()} value={form.city} onChange={e=>upd('city',e.target.value)} />
            </Field>
            <Field label="Role">
              <select style={iStyle()} value={form.role} onChange={e=>upd('role',e.target.value)}>
                {STAFF_ROLES.map(r=><option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="New Password (leave blank to keep current)">
              <input style={iStyle()} type="password" placeholder="••••••" value={form.password} onChange={e=>upd('password',e.target.value)} />
            </Field>
          </div>
        </div>

        {/* Account Status */}
        <div style={{ border:'1px solid #E2E8F0', borderRadius:10, overflow:'hidden' }}>
          <div style={{ padding:'10px 16px', background:'#F8FAFC', borderBottom:'1px solid #E2E8F0', fontSize:13, fontWeight:700, color:'#0F172A' }}>🔒 Account Status</div>
          <div style={{ padding:'16px', display:'flex', gap:24 }}>
            <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
              <div onClick={()=>upd('is_active',!form.is_active)} style={{
                width:44, height:24, borderRadius:12, position:'relative', cursor:'pointer', transition:'background 0.2s',
                background: form.is_active ? '#22C55E' : '#EF4444',
              }}>
                <div style={{ position:'absolute', top:3, left: form.is_active ? 23 : 3, width:18, height:18, borderRadius:'50%', background:'white', transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }} />
              </div>
              <div>
                <p style={{ fontSize:13, fontWeight:600, color:'#0F172A', margin:0 }}>{form.is_active ? 'Active' : 'Suspended'}</p>
                <p style={{ fontSize:11, color:'#64748B', margin:0 }}>{form.is_active ? 'User can log in normally' : 'User is blocked from all portals'}</p>
              </div>
            </label>
            <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
              <div onClick={()=>upd('is_verified',!form.is_verified)} style={{
                width:44, height:24, borderRadius:12, position:'relative', cursor:'pointer', transition:'background 0.2s',
                background: form.is_verified ? '#1B4FD8' : '#94A3B8',
              }}>
                <div style={{ position:'absolute', top:3, left: form.is_verified ? 23 : 3, width:18, height:18, borderRadius:'50%', background:'white', transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }} />
              </div>
              <div>
                <p style={{ fontSize:13, fontWeight:600, color:'#0F172A', margin:0 }}>{form.is_verified ? 'Verified' : 'Unverified'}</p>
                <p style={{ fontSize:11, color:'#64748B', margin:0 }}>Account verification status</p>
              </div>
            </label>
          </div>
        </div>

        {/* Profile Image */}
        <div style={{ border:'1px solid #E2E8F0', borderRadius:10, overflow:'hidden' }}>
          <div style={{ padding:'10px 16px', background:'#F8FAFC', borderBottom:'1px solid #E2E8F0', fontSize:13, fontWeight:700, color:'#0F172A' }}>🖼️ Profile Photo</div>
          <div style={{ padding:'16px' }}>
            <CloudinaryImageUploader
              label="Profile Photo"
              fieldKey="staff_profile_photo"
              aspectRatio={1}
              recommendedSize="256×256px"
              currentUrl={form.profile_image}
              onChange={url => upd('profile_image', url)}
            />
          </div>
        </div>

        {/* Documents */}
        <div style={{ border:'1px solid #E2E8F0', borderRadius:10, overflow:'hidden' }}>
          <div style={{ padding:'10px 16px', background:'#F8FAFC', borderBottom:'1px solid #E2E8F0', fontSize:13, fontWeight:700, color:'#0F172A' }}>📄 Documents</div>
          <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:16 }}>
            <div>
              <CloudinaryImageUploader
                label="ID Proof Document"
                fieldKey="staff_id_proof"
                currentUrl={form.id_proof_url}
                onChange={url => upd('id_proof_url', url)}
              />
              <div style={{ marginTop:8 }}>
                <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:5 }}>ID Proof Type</label>
                <select style={iStyle()} value={form.id_proof_type} onChange={e=>upd('id_proof_type',e.target.value)}>
                  <option value="">Select type</option>
                  {ID_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div>
              <CloudinaryImageUploader
                label="Address Proof (Optional)"
                fieldKey="staff_address_proof"
                currentUrl={form.address_proof_url}
                onChange={url => upd('address_proof_url', url)}
              />
              <div style={{ marginTop:8 }}>
                <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:5 }}>Address Proof Type</label>
                <select style={iStyle()} value={form.address_proof_type} onChange={e=>upd('address_proof_type',e.target.value)}>
                  <option value="">Select type (optional)</option>
                  {ADDR_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

      </div>

      <div style={{ display:'flex', justifyContent:'space-between', marginTop:24, paddingTop:18, borderTop:'1px solid #E2E8F0' }}>
        <button style={{ padding:'8px 20px', fontSize:13, fontWeight:600, borderRadius:8, cursor:'pointer', background:'white', color:'#374151', border:'1px solid #E2E8F0' }} onClick={onClose}>Cancel</button>
        <button style={{ padding:'8px 20px', fontSize:13, fontWeight:600, borderRadius:8, cursor: saving?'not-allowed':'pointer', background:'#1B4FD8', color:'white', border:'none', opacity:saving?0.7:1, display:'flex', alignItems:'center', gap:6 }} onClick={handleSave} disabled={saving}>
          {saving ? <><Spinner size="sm" /> Saving…</> : '✓ Save Changes'}
        </button>
      </div>
    </Modal>
  )
}

// ─── Detail View Modal ────────────────────────────────────────────────────────
function DetailModal({ user, onClose, onEdit, onToggleActive, actionLoading }: {
  user:any; onClose:()=>void; onEdit:()=>void; onToggleActive:(u:any)=>void; actionLoading:boolean
}) {
  const [detailTab, setDetailTab] = useState<'info'|'permissions'>('info')
  const [permData, setPermData] = useState<any|null>(null)
  const [loadingPerms, setLoadingPerms] = useState(false)

  const loadPerms = async () => {
    setDetailTab('permissions')
    if (permData) return
    setLoadingPerms(true)
    try { const r = await usersAPI.getUserPermissions(user.id); setPermData(r.data.data) }
    catch { setPermData(null) } finally { setLoadingPerms(false) }
  }

  const roleBadgeColor = (role: string) => ({ SUPER_ADMIN:'#7C3AED', ADMIN:'#1B4FD8', CCO:'#0891B2', ACCOUNTANT:'#059669', INVENTORY_MANAGER:'#D97706' }[role]||'#64748B')

  return (
    <Modal title={`${user.name} — Staff Profile`} onClose={onClose} size="lg">
      {/* Tab bar */}
      <div style={{ display:'flex', gap:0, borderBottom:'1px solid #E2E8F0', marginBottom:20 }}>
        {(['info','permissions'] as const).map(tab=>(
          <button key={tab} onClick={()=>{ if(tab==='permissions') loadPerms(); else setDetailTab('info') }}
            style={{ padding:'8px 20px', fontSize:13, fontWeight:600, background:'none', border:'none', cursor:'pointer',
              borderBottom: detailTab===tab?'2px solid #1B4FD8':'2px solid transparent',
              color: detailTab===tab?'#1B4FD8':'#64748B', textTransform:'capitalize' }}>
            {tab==='info'?'Profile Info':'Permissions'}
          </button>
        ))}
      </div>

      {detailTab==='info' && (
        <div>
          {/* Profile image */}
          <div style={{ display:'flex', justifyContent:'center', marginBottom:16 }}>
            <div style={{ position:'relative' }}>
              {user.profile_image
                ? <img src={user.profile_image} alt="" style={{ width:80, height:80, borderRadius:'50%', objectFit:'cover', border:'3px solid #E2E8F0' }} />
                : <div style={{ width:80, height:80, borderRadius:'50%', background:roleBadgeColor(user.role), display:'flex', alignItems:'center', justifyContent:'center', border:'3px solid #E2E8F0' }}>
                    <span style={{ color:'white', fontWeight:800, fontSize:28 }}>{(user.name||'?').charAt(0).toUpperCase()}</span>
                  </div>
              }
              {!user.is_active && (
                <div style={{ position:'absolute', bottom:-4, right:-4, background:'#EF4444', borderRadius:'50%', width:22, height:22, display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid white', fontSize:11 }}>🚫</div>
              )}
            </div>
          </div>

          {/* Suspension warning */}
          {!user.is_active && (
            <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#DC2626', marginBottom:14, textAlign:'center' }}>
              🚫 <strong>Account Suspended</strong> — This user cannot access any portal or dashboard.
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {[
              ['Name', user.name],['Role', user.role],['Email', user.email],['Mobile', user.mobile],
              ['City', user.city||'—'],['Status', user.is_active?'Active':'Suspended'],
              ['Verified', user.is_verified?'Yes':'No'],['Joined', user.created_at?new Date(user.created_at).toLocaleDateString('en-IN'):'—'],
            ].map(([l,v])=>(
              <div key={l as string} style={{ background:'#F8FAFC', borderRadius:8, padding:'10px 14px' }}>
                <p style={{ fontSize:11, color:'#64748B', margin:'0 0 2px', textTransform:'uppercase', fontWeight:600, letterSpacing:'0.04em' }}>{l}</p>
                <p style={{ fontSize:13, fontWeight:700, color: l==='Status' ? (user.is_active?'#16A34A':'#DC2626') : '#0F172A', margin:0 }}>{v}</p>
              </div>
            ))}
          </div>

          {/* Document links */}
          {(user.id_proof_url || user.address_proof_url) && (
            <div style={{ marginTop:14 }}>
              <p style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:8 }}>Uploaded Documents</p>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                {user.id_proof_url && (
                  <a href={user.id_proof_url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize:12, color:'#1D4ED8', background:'#EFF6FF', border:'1px solid #BFDBFE', padding:'5px 12px', borderRadius:8, textDecoration:'none', fontWeight:600 }}>
                    🪪 View ID Proof {user.id_proof_type ? `(${user.id_proof_type})` : ''}
                  </a>
                )}
                {user.address_proof_url && (
                  <a href={user.address_proof_url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize:12, color:'#065F46', background:'#ECFDF5', border:'1px solid #A7F3D0', padding:'5px 12px', borderRadius:8, textDecoration:'none', fontWeight:600 }}>
                    🏠 View Address Proof {user.address_proof_type ? `(${user.address_proof_type})` : ''}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {detailTab==='permissions' && (
        <div>
          {loadingPerms ? <div style={{ textAlign:'center', padding:30 }}><Spinner /></div> : !permData ? (
            <p style={{ color:'#94A3B8', textAlign:'center', padding:20 }}>Could not load permissions.</p>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'flex', gap:10 }}>
                {[['Role Permissions', permData.role_permissions?.length||0,'#EFF6FF','#1D4ED8'],['Effective Total',permData.effective_permissions?.length||0,'#F0FDF4','#16A34A'],['Overrides',permData.overrides?.length||0,'#FFFBEB','#D97706']].map(([l,c,bg,col])=>(
                  <div key={l as string} style={{ flex:1, background:bg as string, borderRadius:8, padding:'10px 14px', textAlign:'center', border:`1px solid ${(bg as string).replace(/F/g,'E')}` }}>
                    <p style={{ fontSize:20, fontWeight:800, color:col as string, margin:0 }}>{c as number}</p>
                    <p style={{ fontSize:11, color:'#475569', margin:'2px 0 0' }}>{l as string}</p>
                  </div>
                ))}
              </div>
              <div>
                <p style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:8 }}>Effective Permissions</p>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {(permData.effective_permissions||[]).map((code:string) => {
                    const meta = PERMISSION_CATALOG.find(p=>p.code===code)
                    return <span key={code} style={{ fontSize:11, background:'#F0FDF4', border:'1px solid #BBF7D0', color:'#15803D', padding:'2px 10px', borderRadius:20, fontWeight:600 }}>✓ {meta?.name||code}</span>
                  })}
                </div>
              </div>
              {(permData.overrides||[]).length > 0 && (
                <div>
                  <p style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:8 }}>Custom Overrides</p>
                  {permData.overrides.map((o:any) => {
                    const meta = PERMISSION_CATALOG.find(p=>p.code===o.permission_code)
                    return (
                      <div key={o.permission_code} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', background:o.is_granted?'#F0FDF4':'#FEF2F2', borderRadius:6, marginBottom:4 }}>
                        <span>{o.is_granted?'✅':'❌'}</span>
                        <span style={{ fontSize:12, fontWeight:600 }}>{meta?.name||o.permission_code}</span>
                        <span style={{ marginLeft:'auto', fontSize:11, fontWeight:700, color:o.is_granted?'#16A34A':'#DC2626' }}>{o.is_granted?'GRANTED':'REVOKED'}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display:'flex', gap:10, marginTop:24, paddingTop:18, borderTop:'1px solid #E2E8F0' }}>
        <button onClick={onEdit}
          style={{ flex:1, padding:'8px 0', fontSize:13, fontWeight:600, borderRadius:8, cursor:'pointer', background:'#1B4FD8', color:'white', border:'none' }}>
          ✏️ Edit User
        </button>
        <button onClick={()=>onToggleActive(user)} disabled={actionLoading}
          style={{ flex:1, padding:'8px 0', fontSize:13, fontWeight:600, borderRadius:8, cursor:actionLoading?'not-allowed':'pointer',
            background: user.is_active ? '#FEF2F2' : '#F0FDF4',
            color: user.is_active ? '#DC2626' : '#16A34A',
            border: `1px solid ${user.is_active?'#FECACA':'#BBF7D0'}`,
            opacity: actionLoading ? 0.6 : 1,
          }}>
          {actionLoading ? <Spinner size="sm" /> : user.is_active ? '🚫 Suspend Account' : '✅ Reactivate Account'}
        </button>
      </div>
    </Modal>
  )
}

// ─── Main Users Page ──────────────────────────────────────────────────────────
const STAFF_ROLES_FILTER = ['SUPER_ADMIN','ADMIN','CCO','ACCOUNTANT','INVENTORY_MANAGER']
const EMPTY_FORM = { name:'', email:'', mobile:'', role:'ADMIN', password:'' }

export default function Users() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [roleFilter, setRoleFilter] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const [showRegister, setShowRegister] = useState(false)
  const [addModal, setAddModal] = useState(false)
  const [form, setForm] = useState({...EMPTY_FORM})
  const [saving, setSaving] = useState(false)
  const [formErr, setFormErr] = useState('')

  const [selected, setSelected] = useState<any|null>(null)
  const [editTarget, setEditTarget] = useState<any|null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const { toasts, removeToast, toast } = useToast()

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const params: any = { page, per_page: 20, include_inactive: showInactive }
      if (roleFilter) params.role = roleFilter
      if (searchQ) params.search = searchQ
      const r = await usersAPI.list(params)
      const d = r.data.data
      setUsers(d.items||[])
      setPages(d.pages||1)
      setTotal(d.total||0)
    } catch { setUsers([]) } finally { setLoading(false) }
  }

  const handleCreate = async (e: any) => {
    e.preventDefault(); setSaving(true); setFormErr('')
    try {
      await usersAPI.create(form)
      setAddModal(false); setForm({...EMPTY_FORM})
      toast.success('User created successfully'); fetchUsers()
    } catch(ex:any) { setFormErr(ex.response?.data?.detail||'Failed') } finally { setSaving(false) }
  }

  const handleToggleActive = async (u: any) => {
    setActionLoading(true)
    try {
      if (u.is_active) {
        await usersAPI.update(u.id, { is_active: false })
        toast.warning(`${u.name} has been suspended.`)
      } else {
        await usersAPI.update(u.id, { is_active: true })
        toast.success(`${u.name} has been reactivated.`)
      }
      setSelected(null)
      fetchUsers()
    } catch(ex:any) {
      toast.error(ex?.response?.data?.detail || 'Failed to update status.')
    } finally { setActionLoading(false) }
  }

  const roleBadgeColor = (role: string) => ({
    SUPER_ADMIN:'#7C3AED', ADMIN:'#1B4FD8', CCO:'#0891B2', ACCOUNTANT:'#059669', INVENTORY_MANAGER:'#D97706'
  }[role]||'#64748B')

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); fetchUsers() }

  useEffect(() => { fetchUsers() }, [page, roleFilter, showInactive]) // eslint-disable-line

  // Refresh detail after edit
  const handleEditSaved = () => {
    setEditTarget(null)
    setSelected(null)
    toast.success('User updated successfully')
    fetchUsers()
  }

  return (
    <div style={{ padding:'24px 28px' }}>
      <Toast toasts={toasts} onRemove={removeToast} />
      <PageHeader title="Staff & CCO Management" subtitle={`${total} staff accounts`}
        actions={
          <div style={{ display:'flex', gap:10 }}>
            <button className="btn btn-secondary" onClick={() => { setAddModal(true); setFormErr('') }}>+ Quick Add</button>
            <button className="btn btn-primary" onClick={() => setShowRegister(true)}>+ Register CCO Agent</button>
          </div>
        }
      />

      {/* Filters */}
      <div style={{ display:'flex', gap:10, margin:'16px 0', flexWrap:'wrap', alignItems:'center' }}>
        <form onSubmit={handleSearch} style={{ display:'flex', gap:8 }}>
          <input placeholder="Search name, email, mobile…" value={searchQ} onChange={e=>setSearchQ(e.target.value)}
            style={{ width:240, padding:'7px 11px', fontSize:13, border:'1px solid #E2E8F0', borderRadius:8, outline:'none' }} />
          <button className="btn btn-secondary" type="submit" style={{ padding:'7px 14px', fontSize:13 }}>Search</button>
        </form>
        <select value={roleFilter} onChange={e=>{setRoleFilter(e.target.value);setPage(1)}}
          style={{ padding:'7px 11px', fontSize:13, border:'1px solid #E2E8F0', borderRadius:8, outline:'none', width:170 }}>
          <option value="">All Roles</option>
          {STAFF_ROLES_FILTER.map(r=><option key={r} value={r}>{r}</option>)}
        </select>
        <label style={{ display:'flex', alignItems:'center', gap:7, fontSize:13, color:'#64748B', cursor:'pointer', userSelect:'none' }}>
          <input type="checkbox" checked={showInactive} onChange={e=>setShowInactive(e.target.checked)} style={{ accentColor:'#1B4FD8' }} />
          Show suspended
        </label>
      </div>

      {/* Role chips */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        {STAFF_ROLES_FILTER.map(role => {
          const count = users.filter(u=>u.role===role).length
          if (!count && roleFilter !== role) return null
          return (
            <button key={role} onClick={()=>{ setRoleFilter(r=>r===role?'':role); setPage(1) }}
              style={{ fontSize:11, fontWeight:600, padding:'3px 12px', borderRadius:20, cursor:'pointer',
                background: roleFilter===role ? roleBadgeColor(role):'#F1F5F9',
                color: roleFilter===role ? 'white':'#475569',
                border: `1px solid ${roleFilter===role ? roleBadgeColor(role):'#E2E8F0'}` }}>
              {role} {count > 0 ? `(${count})` : ''}
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div className="card">
        {loading ? <div style={{ padding:40, textAlign:'center' }}><Spinner /></div> : (
          <>
            <table className="data-table">
              <thead><tr><th>Agent</th><th>Mobile</th><th>Role</th><th>City</th><th>Status</th><th>Joined</th><th></th></tr></thead>
              <tbody>
                {users.length===0 ? (
                  <tr><td colSpan={7} style={{ textAlign:'center', color:'#94A3B8', padding:40, fontSize:14 }}>No staff accounts found</td></tr>
                ) : users.map(u=>(
                  <tr key={u.id} style={{ cursor:'pointer', opacity: u.is_active ? 1 : 0.65 }} onClick={()=>setSelected(u)}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:36, height:36, borderRadius:'50%', overflow:'hidden', flexShrink:0, background: roleBadgeColor(u.role), display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
                          {u.profile_image
                            ? <img src={u.profile_image} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                            : <span style={{ color:'white', fontWeight:700, fontSize:14 }}>{(u.name||'?').charAt(0).toUpperCase()}</span>
                          }
                        </div>
                        <div>
                          <p style={{ fontWeight:600, fontSize:13, margin:0, color:'#0F172A' }}>
                            {u.name}
                            {!u.is_active && <span style={{ marginLeft:6, fontSize:10, background:'#FEE2E2', color:'#DC2626', padding:'1px 6px', borderRadius:10, fontWeight:700 }}>SUSPENDED</span>}
                          </p>
                          <p style={{ fontSize:11, color:'#64748B', margin:0 }}>{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize:13 }}>{u.mobile}</td>
                    <td><span style={{ fontSize:11, fontWeight:700, padding:'2px 10px', borderRadius:20, background: roleBadgeColor(u.role)+'1A', color: roleBadgeColor(u.role) }}>{u.role}</span></td>
                    <td style={{ fontSize:13, color:'#475569' }}>{u.city||'—'}</td>
                    <td><StatusBadge status={u.is_active?'ACTIVE':'INACTIVE'} /></td>
                    <td style={{ fontSize:12, color:'#94A3B8' }}>{u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN') : '—'}</td>
                    <td>
                      <div style={{ display:'flex', gap:6 }}>
                        <button className="btn btn-secondary" style={{ fontSize:11, padding:'4px 10px' }}
                          onClick={e=>{e.stopPropagation();setSelected(u)}}>View</button>
                        <button className="btn btn-secondary" style={{ fontSize:11, padding:'4px 10px' }}
                          onClick={e=>{e.stopPropagation();setEditTarget(u)}}>Edit</button>
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

      {/* CCO Register Modal */}
      {showRegister && (
        <RegisterModal onClose={() => setShowRegister(false)}
          onSuccess={name => { setShowRegister(false); toast.success(`CCO agent "${name}" registered successfully!`); fetchUsers() }} />
      )}

      {/* Quick Add Modal */}
      {addModal && (
        <Modal title="Quick Add Staff" onClose={()=>setAddModal(false)} size="sm">
          <form onSubmit={handleCreate}>
            {([['Name *','name','text'],['Email *','email','email'],['Mobile *','mobile','text'],['Password *','password','password']] as [string,string,string][]).map(([l,k,t])=>(
              <div key={k} style={{ marginBottom:12 }}>
                <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:4 }}>{l}</label>
                <input className="input" type={t} value={(form as any)[k]} required onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} />
              </div>
            ))}
            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:4 }}>Role *</label>
              <select className="input" value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
                {STAFF_ROLES_FILTER.map(r=><option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            {formErr && <div style={{ background:'#FEE2E2', color:'#DC2626', padding:'8px 12px', borderRadius:6, fontSize:13, marginBottom:12 }}>{formErr}</div>}
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>{saving?<Spinner size="sm"/>:'Create User'}</button>
              <button className="btn btn-secondary" type="button" onClick={()=>setAddModal(false)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Detail View Modal */}
      {selected && !editTarget && (
        <DetailModal
          user={selected}
          onClose={()=>setSelected(null)}
          onEdit={()=>setEditTarget(selected)}
          onToggleActive={handleToggleActive}
          actionLoading={actionLoading}
        />
      )}

      {/* Edit Modal */}
      {editTarget && (
        <EditUserModal
          user={editTarget}
          onClose={()=>{ setEditTarget(null) }}
          onSaved={handleEditSaved}
        />
      )}
    </div>
  )
}
