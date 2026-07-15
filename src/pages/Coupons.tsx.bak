import { useEffect, useState } from 'react'
import { couponsAPI, domainsAPI } from '@/services/api'
import PageHeader from '@/components/layout/PageHeader'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'

export default function Coupons() {
  const [coupons, setCoupons] = useState<any[]>([])
  const [domains, setDomains] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [filterDomain, setFilterDomain] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [form, setForm] = useState({
    code: '', discount_type: 'PERCENTAGE', discount_value: 10,
    min_order_amount: 0, max_discount_amount: '', valid_from: '',
    valid_until: '', max_uses: '', description: '',
    domain_id: '',  // '' = global coupon
    customer_mobile_numbers: '',   // comma-separated mobiles
    service_ids: '',               // comma-separated UUIDs
    category_ids: '',              // comma-separated UUIDs
    per_customer_limit: '',
  })

  const fetchDomains = async () => {
    try {
      const res = await domainsAPI.list()
      setDomains(res.data.data?.items || [])
    } catch { setDomains([]) }
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

  useEffect(() => { fetchDomains() }, [])
  useEffect(() => { fetchCoupons() }, [page, filterDomain])

  const handleCreate = async (e: any) => {
    e.preventDefault(); setSaving(true); setErr('')
    try {
      const payload: any = {
        ...form,
        discount_value: +form.discount_value,
        min_order_amount: +form.min_order_amount,
      }
      if (form.max_discount_amount) payload.max_discount_amount = +form.max_discount_amount
      if (form.max_uses) payload.max_uses = +form.max_uses
      if (!form.valid_from) delete payload.valid_from
      if (!form.valid_until) delete payload.valid_until
      if (!form.domain_id) delete payload.domain_id  // null = global
      if (form.customer_mobile_numbers.trim()) {
        payload.customer_mobile_numbers = form.customer_mobile_numbers.split(',').map((s: string) => s.trim()).filter(Boolean)
      }
      if (form.service_ids.trim()) {
        payload.service_ids = form.service_ids.split(',').map((s: string) => s.trim()).filter(Boolean)
      }
      if (form.category_ids.trim()) {
        payload.category_ids = form.category_ids.split(',').map((s: string) => s.trim()).filter(Boolean)
      }
      if (form.per_customer_limit) payload.per_customer_limit = +form.per_customer_limit
      await couponsAPI.create(payload)
      setShowCreate(false)
      setForm({
        code: '', discount_type: 'PERCENTAGE', discount_value: 10,
        min_order_amount: 0, max_discount_amount: '', valid_from: '',
        valid_until: '', max_uses: '', description: '', domain_id: '',
        customer_mobile_numbers: '', service_ids: '', category_ids: '', per_customer_limit: '',
      })
      fetchCoupons()
    } catch (ex: any) { setErr(ex.response?.data?.detail || 'Failed to create coupon') } finally { setSaving(false) }
  }

  const isExpired = (d: string) => d && new Date(d) < new Date()

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader title="Coupons & Discounts" subtitle={`${total} coupons`}
        actions={<button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Coupon</button>} />
      <div style={{ height: 20 }} />

      {/* Domain filter bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>Filter by Domain:</label>
        <select
          className="input"
          style={{ maxWidth: 260 }}
          value={filterDomain}
          onChange={e => { setFilterDomain(e.target.value); setPage(1) }}
        >
          <option value="">All Domains (incl. Global)</option>
          {domains.map((d: any) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        {filterDomain && (
          <button className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }}
            onClick={() => { setFilterDomain(''); setPage(1) }}>
            × Clear
          </button>
        )}
      </div>

      <div className="card">
        {loading ? <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div> : (
          <>
            <table className="data-table">
              <thead><tr>
                <th>Code</th><th>Domain</th><th>Type</th><th>Discount</th><th>Min Order</th><th>Max Uses</th><th>Used</th><th>Targeting</th><th>Valid Until</th><th>Status</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {coupons.length === 0
                  ? <tr><td colSpan={10} style={{ textAlign: 'center', color: '#94A3B8', padding: 32 }}>No coupons found</td></tr>
                  : coupons.map((c: any) => {
                    const expired = isExpired(c.valid_until)
                    const exhausted = c.usage_limit && c.used_count >= c.usage_limit
                    const status = !c.is_active ? 'INACTIVE' : expired ? 'EXPIRED' : exhausted ? 'EXHAUSTED' : 'ACTIVE'
                    return (
                      <tr key={c.id}>
                        <td><code style={{ background: '#F1F5F9', padding: '3px 8px', borderRadius: 4, fontWeight: 700, color: '#1B4FD8' }}>{c.code}</code></td>
                        <td>
                          {c.domain_id
                            ? <span style={{ fontSize: 12, background: '#EFF6FF', color: '#1B4FD8', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>{c.domain_name || c.domain_id.slice(0,8)}</span>
                            : <span style={{ fontSize: 12, background: '#F0FDF4', color: '#15803D', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>🌐 Global</span>
                          }
                        </td>
                        <td>{c.discount_type === 'PERCENTAGE' ? 'Percentage %' : 'Flat ₹'}</td>
                        <td style={{ fontWeight: 700, color: '#059669' }}>
                          {c.discount_type === 'PERCENTAGE' ? `${c.discount_value}%` : `₹${c.discount_value}`}
                        </td>
                        <td>₹{c.min_order_amount || 0}</td>
                        <td>{c.usage_limit || '∞'}</td>
                        <td>{c.used_count || 0}</td>
                        <td style={{ fontSize: 11 }}>
                          {c.customer_mobile_numbers?.length > 0 && (
                            <span title={c.customer_mobile_numbers.join(', ')} style={{ display: 'inline-block', background: '#FEF3C7', color: '#D97706', padding: '2px 6px', borderRadius: 6, marginBottom: 2 }}>
                              👤 {c.customer_mobile_numbers.length} customers
                            </span>
                          )}
                          {c.service_ids?.length > 0 && (
                            <span style={{ display: 'inline-block', background: '#EDE9FE', color: '#7C3AED', padding: '2px 6px', borderRadius: 6, marginBottom: 2, marginLeft: 4 }}>
                              ⚙ {c.service_ids.length} services
                            </span>
                          )}
                          {c.category_ids?.length > 0 && (
                            <span style={{ display: 'inline-block', background: '#DCFCE7', color: '#059669', padding: '2px 6px', borderRadius: 6, marginLeft: 4 }}>
                              🏷 {c.category_ids.length} cats
                            </span>
                          )}
                          {!c.customer_mobile_numbers?.length && !c.service_ids?.length && !c.category_ids?.length && (
                            <span style={{ color: '#94A3B8' }}>All</span>
                          )}
                        </td>
                        <td style={{ fontSize: 12, color: expired ? '#DC2626' : '#64748B' }}>
                          {c.valid_until ? new Date(c.valid_until).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—'}
                        </td>
                        <td>
                          <span className={`badge status-${status === 'ACTIVE' ? 'ACTIVE' : 'CANCELLED'}`}>
                            {status}
                          </span>
                        </td>
                        <td>
                          {c.is_active && (
                            <button
                              onClick={async () => { if(window.confirm('Deactivate this coupon?')) { await couponsAPI.delete(c.id); fetchCoupons(); } }}
                              style={{ fontSize:11, color:'#DC2626', background:'#FEE2E2', border:'none', padding:'3px 8px', borderRadius:4, cursor:'pointer' }}
                            >Deactivate</button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
            <Pagination page={page} pages={pages} onPage={setPage} />
          </>
        )}
      </div>

      {showCreate && (
        <Modal title="Create Coupon" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate}>
            {/* Domain Scope — full width at top */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                Domain Scope
              </label>
              <select
                className="input"
                value={form.domain_id}
                onChange={e => setForm(f => ({ ...f, domain_id: e.target.value }))}
              >
                <option value="">🌐 Global — valid on ALL domains</option>
                {domains.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>
                {form.domain_id
                  ? 'This coupon will ONLY work on the selected domain website.'
                  : 'Global coupons work across all domain websites.'}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Coupon Code *</label>
                <input className="input" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="e.g. SUMMER20" required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Discount Type</label>
                <select className="input" value={form.discount_type} onChange={e => setForm(f => ({ ...f, discount_type: e.target.value }))}>
                  <option value="PERCENTAGE">Percentage %</option>
                  <option value="FLAT">Fixed Amount ₹</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  Discount Value * {form.discount_type === 'PERCENTAGE' ? '(%)' : '(₹)'}
                </label>
                <input className="input" type="number" value={form.discount_value} onChange={e => setForm(f => ({ ...f, discount_value: +e.target.value }))} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Min Order Amount ₹</label>
                <input className="input" type="number" value={form.min_order_amount} onChange={e => setForm(f => ({ ...f, min_order_amount: +e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Max Discount ₹ (optional)</label>
                <input className="input" type="number" value={form.max_discount_amount} onChange={e => setForm(f => ({ ...f, max_discount_amount: e.target.value }))} placeholder="No limit" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Max Uses (optional)</label>
                <input className="input" type="number" value={form.max_uses} onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))} placeholder="Unlimited" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Valid From</label>
                <input className="input" type="date" value={form.valid_from} onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Valid Until</label>
                <input className="input" type="date" value={form.valid_until} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Description</label>
              <input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Internal note" />
            </div>

            <div style={{ marginTop: 16, borderTop: '1px solid #E2E8F0', paddingTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                🎯 Advanced Targeting (optional)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    Customer-Specific (Mobile Numbers)
                  </label>
                  <input className="input" value={form.customer_mobile_numbers}
                    onChange={e => setForm(f => ({ ...f, customer_mobile_numbers: e.target.value }))}
                    placeholder="e.g. 9876543210, 9123456789 (comma-separated)" />
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>
                    Leave blank = available to all customers
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    Service IDs (optional)
                  </label>
                  <input className="input" value={form.service_ids}
                    onChange={e => setForm(f => ({ ...f, service_ids: e.target.value }))}
                    placeholder="UUID1, UUID2 (comma-separated)" />
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>Only valid for these services</div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    Category IDs (optional)
                  </label>
                  <input className="input" value={form.category_ids}
                    onChange={e => setForm(f => ({ ...f, category_ids: e.target.value }))}
                    placeholder="UUID1, UUID2 (comma-separated)" />
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>Only valid for these categories</div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    Per-Customer Use Limit
                  </label>
                  <input className="input" type="number" value={form.per_customer_limit}
                    onChange={e => setForm(f => ({ ...f, per_customer_limit: e.target.value }))}
                    placeholder="e.g. 1 (leave blank = unlimited)" />
                </div>
              </div>
            </div>
            {err && <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginTop: 12 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? <Spinner size="sm" /> : 'Create Coupon'}</button>
              <button className="btn btn-secondary" type="button" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
