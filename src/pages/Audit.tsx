import { todayIST, fmtDateIST, fmtDateTimeIST, fmtTimeIST } from "../lib/tz";
import { useEffect, useState } from 'react'
import { auditAPI } from '@/services/api'
import PageHeader from '@/components/layout/PageHeader'
import Pagination from '@/components/ui/Pagination'
import Spinner from '@/components/ui/Spinner'

const ACTION_COLOR: Record<string, string> = {
  CREATE: '#059669', UPDATE: '#1B4FD8', DELETE: '#DC2626',
  LOGIN: '#7C3AED', LOGOUT: '#94A3B8', APPROVE: '#059669', REJECT: '#DC2626',
}

export default function Audit() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [resource, setResource] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const r = await auditAPI.list({ page, per_page: 25, search: search || undefined, resource: resource || undefined })
      const d = r.data.data
      setLogs(d.items || []); setPages(d.pages || 1); setTotal(d.total || 0)
    } catch { setLogs([]) } finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [page, resource])

  const handleSearch = (e: any) => { e.preventDefault(); setPage(1); fetchData() }

  const fmt = (d: string) => d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' }) : '—'

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader title="Audit Logs" subtitle={`${total} audit events`} />
      <div style={{ height: 20 }} />

      {/* Filters */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input className="input" style={{ maxWidth: 300 }} value={search}
          onChange={e => setSearch(e.target.value)} placeholder="Search by user, action..." />
        <select className="input" style={{ maxWidth: 200 }} value={resource} onChange={e => { setResource(e.target.value); setPage(1) }}>
          <option value="">All Resources</option>
          {['booking', 'customer', 'technician', 'user', 'service', 'quotation', 'invoice', 'payment', 'refund', 'coupon', 'setting'].map(r => (
            <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
          ))}
        </select>
        <button className="btn btn-primary" type="submit">Filter</button>
      </form>

      <div className="card">
        {loading ? <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div> : (
          <>
            <table className="data-table">
              <thead>
                <tr><th>Timestamp</th><th>User</th><th>Action</th><th>Resource</th><th>Resource ID</th><th>IP</th><th>Details</th></tr>
              </thead>
              <tbody>
                {logs.length === 0
                  ? <tr><td colSpan={7} style={{ textAlign: 'center', color: '#94A3B8', padding: 32 }}>No audit logs found</td></tr>
                  : logs.map((l: any) => (
                    <>
                      <tr key={l.id} style={{ cursor: l.changes ? 'pointer' : 'default' }}
                        onClick={() => setExpandedId(expandedId === l.id ? null : l.id)}>
                        <td style={{ fontSize: 12, color: '#64748B', whiteSpace: 'nowrap' }}>{fmt(l.created_at)}</td>
                        <td style={{ fontSize: 12 }}>
                          <div style={{ fontWeight: 500 }}>{l.user_name || '—'}</div>
                          <div style={{ color: '#94A3B8', fontSize: 11 }}>{l.user_role || ''}</div>
                        </td>
                        <td>
                          <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                            background: `${ACTION_COLOR[l.action] || '#64748B'}18`, color: ACTION_COLOR[l.action] || '#64748B' }}>
                            {l.action}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, textTransform: 'capitalize', color: '#334155' }}>{l.resource || '—'}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#1B4FD8' }}>
                          {l.resource_id ? l.resource_id.substring(0, 8) + '…' : '—'}
                        </td>
                        <td style={{ fontSize: 12, color: '#94A3B8' }}>{l.ip_address || '—'}</td>
                        <td style={{ fontSize: 12, color: '#64748B' }}>
                          {l.description || l.summary || (l.changes ? '▾ View changes' : '—')}
                        </td>
                      </tr>
                      {expandedId === l.id && l.changes && (
                        <tr key={`${l.id}-detail`}>
                          <td colSpan={7} style={{ background: '#F8FAFC', padding: '10px 16px' }}>
                            <pre style={{ fontSize: 11, color: '#334155', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                              {typeof l.changes === 'string' ? l.changes : JSON.stringify(l.changes, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
              </tbody>
            </table>
            <Pagination page={page} pages={pages} onPage={setPage} />
          </>
        )}
      </div>
    </div>
  )
}
