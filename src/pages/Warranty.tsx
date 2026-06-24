import { useEffect, useState } from 'react'
import { warrantyAPI } from '@/services/api'
import PageHeader from '@/components/layout/PageHeader'
import StatusBadge from '@/components/ui/StatusBadge'
import Pagination from '@/components/ui/Pagination'
import Spinner from '@/components/ui/Spinner'

export default function Warranty() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')

  const fetch = async () => {
    setLoading(true)
    try {
      const r = await warrantyAPI.list({ page, per_page: 20, search: search || undefined })
      const d = r.data.data
      setItems(d.items || []); setPages(d.pages || 1); setTotal(d.total || 0)
    } catch { setItems([]) } finally { setLoading(false) }
  }

  useEffect(() => { fetch() }, [page])
  useEffect(() => { setPage(1); fetch() }, [search])

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader title="Warranty" subtitle={`${total} warranty registrations`} />
      <div style={{ height: 20 }} />
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <input className="input" style={{ width: 300 }} placeholder="Search by customer or serial..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="card">
        {loading ? <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div> : (
          <>
            <table className="data-table">
              <thead><tr><th>Customer</th><th>Appliance</th><th>Serial No.</th><th>Purchase Date</th><th>Expiry</th><th>Status</th></tr></thead>
              <tbody>
                {items.length === 0
                  ? <tr><td colSpan={6} style={{ textAlign: 'center', color: '#94A3B8', padding: 32 }}>No warranty records found</td></tr>
                  : items.map((w: any) => {
                    const expired = w.expiry_date && new Date(w.expiry_date) < new Date()
                    return (
                      <tr key={w.id}>
                        <td style={{ fontWeight: 500 }}>{w.customer_name || w.customer_id}</td>
                        <td>{w.appliance_type || '—'}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{w.serial_number || '—'}</td>
                        <td>{w.purchase_date ? new Date(w.purchase_date).toLocaleDateString('en-IN') : '—'}</td>
                        <td style={{ color: expired ? '#DC2626' : '#059669' }}>
                          {w.expiry_date ? new Date(w.expiry_date).toLocaleDateString('en-IN') : '—'}
                        </td>
                        <td><StatusBadge status={expired ? 'CANCELLED' : 'ACTIVE'} /></td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
            <Pagination page={page} pages={pages} onPage={setPage} />
          </>
        )}
      </div>
    </div>
  )
}
