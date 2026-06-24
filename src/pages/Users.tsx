import { useEffect, useState } from 'react'
import { usersAPI } from '@/services/api'
import PageHeader from '@/components/layout/PageHeader'
import StatusBadge from '@/components/ui/StatusBadge'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'

const ROLES = ['SUPER_ADMIN','ADMIN','CCO','ACCOUNTANT','INVENTORY_MANAGER']
const EMPTY = { name:'', email:'', mobile:'', role:'ADMIN', password:'' }

export default function Users() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1); const [pages, setPages] = useState(1); const [total, setTotal] = useState(0)
  const [addModal, setAddModal] = useState(false)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false); const [err, setErr] = useState('')

  const fetch = async () => {
    setLoading(true)
    try { const r = await usersAPI.list({ page, per_page: 20, exclude_customers: true }); const d = r.data.data; setUsers(d.items||[]); setPages(d.pages||1); setTotal(d.total||0) }
    catch { setUsers([]) } finally { setLoading(false) }
  }
  useEffect(() => { fetch() }, [page])

  const handleCreate = async (e: any) => {
    e.preventDefault(); setSaving(true); setErr('')
    try { await usersAPI.create(form); setAddModal(false); setForm({ ...EMPTY }); fetch() }
    catch (ex: any) { setErr(ex.response?.data?.detail || 'Failed') } finally { setSaving(false) }
  }

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader title="Admin Users" subtitle={`${total} staff accounts`}
        actions={<button className="btn btn-primary" onClick={() => { setAddModal(true); setErr('') }}>+ Add User</button>} />
      <div style={{ height: 20 }} />
      <div className="card">
        {loading ? <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div> : (
          <><table className="data-table">
            <thead><tr><th>Name</th><th>Email</th><th>Mobile</th><th>Role</th><th>Status</th><th>Joined</th></tr></thead>
            <tbody>
              {users.length === 0 ? <tr><td colSpan={6} style={{ textAlign: 'center', color: '#94A3B8', padding: 32 }}>No admin users found</td></tr>
                : users.map((u: any) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td style={{ fontSize: 13 }}>{u.email}</td>
                  <td style={{ fontSize: 13 }}>{u.mobile}</td>
                  <td><span className="badge status-CONFIRMED" style={{ fontSize: 11 }}>{u.role}</span></td>
                  <td><StatusBadge status={u.is_active ? 'ACTIVE' : 'INACTIVE'} /></td>
                  <td style={{ fontSize: 12, color: '#94A3B8' }}>{u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table><Pagination page={page} pages={pages} onPage={setPage} /></>
        )}
      </div>
      {addModal && (
        <Modal title="Add Admin User" onClose={() => setAddModal(false)}>
          <form onSubmit={handleCreate}>
            {[['Name *','name','text'],['Email *','email','email'],['Mobile *','mobile','text'],['Password *','password','password']].map(([l,k,t])=>(
              <div key={k} style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{l}</label>
                <input className="input" type={t as string} value={(form as any)[k]} required onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
              </div>
            ))}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Role *</label>
              <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            {err && <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 12 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? <Spinner size="sm" /> : 'Create User'}</button>
              <button className="btn btn-secondary" type="button" onClick={() => setAddModal(false)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
