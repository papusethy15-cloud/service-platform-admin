import { useEffect, useState, useCallback, useRef } from 'react'
import { inventoryAPI, techniciansAPI, domainsAPI, api } from '@/services/api'
import PageHeader from '@/components/layout/PageHeader'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'

// ─── Types ────────────────────────────────────────────────────
type Item = {
  id: string; name: string; sku: string; barcode?: string
  category_id?: string; category_name?: string
  category_ids?: string[]; categories?: {id:string;name:string;icon:string}[]
  brand_id?: string; brand_name?: string
  unit: string; description?: string; hsn_code?: string; gst_percent: number
  cost_price: number; selling_price: number; mrp: number
  current_stock: number; reserved_stock: number; available_stock: number
  min_stock_level: number; reorder_qty: number
  is_low_stock: boolean; is_consumable: boolean; is_serialised: boolean
  image_url?: string; is_active: boolean
}
type Category  = { id: string; name: string; description?: string; icon?: string; item_count: number }
type Brand     = { id: string; name: string }
type Warehouse = { id: string; name: string; code?: string; city?: string; address?: string; phone?: string; is_default: boolean }
type WhStock   = { item_id: string; item_name: string; sku?: string; unit: string; quantity: number; reserved_qty: number; available: number; is_low_stock: boolean }
type Movement  = { id: string; item_id: string; item_name?: string; movement_type: string; quantity: number; technician_id?: string; booking_id?: string; reason?: string; notes?: string; created_at: string }
type TechStock = { item_id: string; item_name: string; sku?: string; unit: string; quantity: number; assigned_qty: number; consumed_qty: number; returned_qty: number }
type Challan   = { id: string; challan_no: string; status: string; total_qty: number; total_value: number; from_warehouse_id: string; to_warehouse_id?: string; to_technician_id?: string; reference_no?: string; notes?: string; created_at: string; items: any[] }

const TABS = ['Items', 'Purchases', 'Stock', 'Technicians', 'Ledger', 'Warehouses', 'Challans', 'Sales', 'Market Purchases', 'Categories'] as const
type Tab = typeof TABS[number]

const UNITS = ['pcs', 'kg', 'ltr', 'm', 'set', 'pair', 'box', 'roll']
const MV_BG: Record<string,string> = { PURCHASE:'#DCFCE7', TRANSFER_IN:'#DBEAFE', OPENING:'#EDE9FE', TRANSFER_OUT:'#FEF3C7', ASSIGNMENT:'#FEE2E2', RETURN_IN:'#DCFCE7', RETURN_OUT:'#FEF3C7', ADJUSTMENT:'#F0F9FF', DAMAGE:'#FEE2E2', CONSUMPTION:'#FEF9EC', SCRAP:'#FEE2E2' }
const MV_FG: Record<string,string> = { PURCHASE:'#166534', TRANSFER_IN:'#1D4ED8', OPENING:'#6D28D9', TRANSFER_OUT:'#B45309', ASSIGNMENT:'#991B1B', RETURN_IN:'#166534', RETURN_OUT:'#B45309', ADJUSTMENT:'#0369A1', DAMAGE:'#991B1B', CONSUMPTION:'#92400E', SCRAP:'#991B1B' }

const EMPTY_ITEM = { name:'', sku:'', barcode:'', category_ids:[] as string[], brand_id:'', unit:'pcs', description:'', hsn_code:'', gst_percent:18, cost_price:0, selling_price:0, mrp:0, min_stock_level:10, reorder_qty:20, is_consumable:false, is_serialised:false, image_url:'' }

type PurchaseOrder = { id: string; po_number: string; vendor_id?: string; vendor_name?: string; vendor_invoice_no?: string; warehouse_id: string; warehouse_name?: string; items: any[]; subtotal: number; tax_amount: number; total_amount: number; payment_method: string; payment_status: string; status: string; notes?: string; received_at?: string; created_at: string }

// ─── helpers ────────────────────────────────────────────────
const inr = (v: number) => `₹${(v||0).toLocaleString('en-IN')}`
const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day:'2-digit', month:'short', year:'numeric' })
const fmtDateTime = (s: string) => new Date(s).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })

// ─── Shared label style ──────────────────────────────────────
const lbl: React.CSSProperties = { display:'block', fontSize:12, fontWeight:600, marginBottom:4, color:'#374151' }
const inp = 'input'

// ═══════════════════════════════════════════════════════════════
export default function Inventory() {
  const [tab, setTab]               = useState<Tab>('Items')
  const [items, setItems]           = useState<Item[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands]         = useState<Brand[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [movements, setMovements]   = useState<Movement[]>([])
  const [deletingMovId, setDeletingMovId] = useState<string|null>(null)
  const [techList, setTechList]     = useState<any[]>([])
  const [techStock, setTechStock]   = useState<TechStock[]>([])
  const [stockSummary, setStockSummary] = useState<any[]>([])
  const [challans, setChallans]     = useState<Challan[]>([])
  const [purchases, setPurchases]   = useState<PurchaseOrder[]>([])
  const [vendors, setVendors]       = useState<any[]>([])
  const [sales, setSales]           = useState<any[]>([])
  const [mktPurchases, setMktPurchases] = useState<any[]>([])
  const [mktLoading, setMktLoading]     = useState(false)
  const [mktVerifyModal, setMktVerifyModal] = useState<any>(null)
  const [mktAction, setMktAction]       = useState<'add_new'|'link_and_update'|'reject'>('add_new')
  const [mktForm, setMktForm]           = useState<any>({
    // link_and_update fields
    override_cost_price:'', override_selling_price:'',
    selected_item_id:'', selected_item_name:'',
    // add_new full fields
    new_item_name:'', new_cost_price:'', new_selling_price:'',
    category_ids:[] as string[], sku:'', barcode:'', brand_id:'',
    unit:'pcs', description:'', hsn_code:'', gst_percent:18,
    mrp:0, is_consumable:false, is_serialised:false,
  })
  const [mktSaving, setMktSaving]       = useState(false)
  const [mktErr, setMktErr]             = useState('')
  // item search for link_and_update
  const [mktItemSearch, setMktItemSearch]   = useState('')
  const [mktItemResults, setMktItemResults] = useState<any[]>([])
  const [mktItemSearching, setMktItemSearching] = useState(false)
  const [domains, setDomains]           = useState<any[]>([])

  const [loading, setLoading]       = useState(true)
  const [page, setPage]             = useState(1)
  const [pages, setPages]           = useState(1)
  const [total, setTotal]           = useState(0)
  const [search, setSearch]         = useState('')
  const [catFilter, setCatFilter]   = useState('')
  const [lowOnly, setLowOnly]       = useState(false)
  const [selectedTech, setSelectedTech] = useState('')
  const [techLoading, setTechLoading] = useState(false)

  // ── Item detail panel (right-side) ──────────────────────────
  const [detailItem, setDetailItem]       = useState<Item | null>(null)
  const [detailWhStock, setDetailWhStock] = useState<{wh_name:string; wh_id:string; quantity:number; reserved_qty:number; available:number}[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  // ── Item modal ───────────────────────────────────────────────
  const [itemModal, setItemModal]   = useState<Item | 'new' | null>(null)
  const [itemForm, setItemForm]     = useState({ ...EMPTY_ITEM })
  const [itemSaving, setItemSaving] = useState(false)
  const [itemErr, setItemErr]       = useState('')
  // Opening stock fields (only for new items)
  const [openingStocks, setOpeningStocks] = useState<{warehouse_id:string; quantity:number}[]>([])

  // ── Adjust modal ─────────────────────────────────────────────
  const [adjustModal, setAdjustModal]   = useState<Item | null>(null)
  const [adjustForm, setAdjustForm]     = useState({ warehouse_id:'', quantity:0, reason:'', notes:'' })
  const [adjustSaving, setAdjustSaving] = useState(false)
  const [adjustErr, setAdjustErr]       = useState('')

  // ── Assign to tech modal ─────────────────────────────────────
  const [assignModal, setAssignModal]   = useState<Item | null>(null)
  const [assignForm, setAssignForm]     = useState({ technician_id:'', warehouse_id:'', quantity:1, notes:'', booking_id:'' })
  const [assignSaving, setAssignSaving] = useState(false)
  const [assignErr, setAssignErr]       = useState('')
  const [whStockMap, setWhStockMap]     = useState<Record<string, number>>({})  // warehouseId → available qty
  const [assignWhLoading, setAssignWhLoading] = useState(false)

  // ── Transfer modal (quick item transfer) ─────────────────────
  const [transferModal, setTransferModal]   = useState<Item | null>(null)
  const [transferForm, setTransferForm]     = useState({ from_warehouse_id:'', to_warehouse_id:'', quantity:1, notes:'', reference_no:'' })
  const [transferSaving, setTransferSaving] = useState(false)
  const [transferErr, setTransferErr]       = useState('')

  // ── Challan modal ────────────────────────────────────────────
  const [challanModal, setChallanModal]   = useState(false)
  const [challanForm, setChallanForm]     = useState<any>({ from_warehouse_id:'', to_warehouse_id:'', to_technician_id:'', items:[{item_id:'',quantity:1}], reference_no:'', notes:'' })
  const [challanSaving, setChallanSaving] = useState(false)
  const [challanErr, setChallanErr]       = useState('')
  const [receiveModal, setReceiveModal]   = useState<Challan|null>(null)
  const [receiveSaving, setReceiveSaving] = useState(false)

  // ── Direct sale modal ────────────────────────────────────────
  const [saleModal, setSaleModal]   = useState(false)
  const [saleForm, setSaleForm]     = useState<any>({ warehouse_id:'', customer_name:'', customer_mobile:'', items:[{item_id:'',quantity:1,unit_price:0}], payment_method:'CASH', notes:'' })
  const [saleSaving, setSaleSaving] = useState(false)
  const [saleErr, setSaleErr]       = useState('')

  // ── Purchase Order modal ──────────────────────────────────────────────
  const [poModal, setPoModal]     = useState(false)
  const [poForm, setPoForm]       = useState<any>({ warehouse_id:'', vendor_id:'', vendor_name:'', vendor_invoice_no:'', items:[{item_id:'',quantity:1,unit_cost:0}], payment_method:'CASH', notes:'', update_cost_price:false })
  const [poSaving, setPoSaving]   = useState(false)
  const [poErr, setPoErr]         = useState('')

  // ── Warehouse stock view modal ────────────────────────────────
  const [whModal, setWhModal]           = useState<Warehouse | 'new' | null>(null)
  const [whForm, setWhForm]             = useState({ name:'', code:'', address:'', city:'', phone:'', is_default:false })
  const [whSaving, setWhSaving]         = useState(false)
  const [whErr, setWhErr]               = useState('')
  const [whStockModal, setWhStockModal] = useState<Warehouse | null>(null)
  const [whStockData, setWhStockData]   = useState<WhStock[]>([])
  const [whStockLoading, setWhStockLoading] = useState(false)

  // ── Category modal ────────────────────────────────────────────
  const [catModal, setCatModal]   = useState<Category | 'new' | null>(null)
  const [catForm, setCatForm]     = useState({ name:'', description:'', icon:'', sort_order:0 })
  const [catSaving, setCatSaving] = useState(false)

  const searchRef = useRef<HTMLInputElement>(null)

  // ── Fetch ─────────────────────────────────────────────────────
  const fetchItems = useCallback(async (p = page) => {
    setLoading(true)
    try {
      const [iRes, cRes, bRes, wRes, techRes] = await Promise.all([
        inventoryAPI.list({ page:p, per_page:20, search:search||undefined, category_id:catFilter||undefined, low_stock:lowOnly||undefined }),
        inventoryAPI.categories(),
        inventoryAPI.brands(),
        inventoryAPI.warehouses(),
        techniciansAPI.list({ status:'ACTIVE', per_page:100 }),
      ])
      const d = iRes.data.data
      setItems(d.items || [])
      setPages(d.pages || 1)
      setTotal(d.total || 0)
      setCategories(cRes.data.data || [])
      setBrands(bRes.data.data || [])
      setWarehouses(wRes.data.data || [])
      const td = techRes.data.data
      setTechList(Array.isArray(td) ? td : (td?.technicians || td?.items || []))
      // Background loads
      inventoryAPI.challans().then(r => setChallans(r.data.data?.items || [])).catch(() => {})
      inventoryAPI.purchaseOrders().then(r => setPurchases(r.data.data?.items || [])).catch(() => {})
      api.get('/vendors').then((r: any) => setVendors(r.data.data?.items || r.data.data || [])).catch(() => {})
      inventoryAPI.directSales().then(r => setSales(r.data.data?.items || [])).catch(() => {})
    } catch { setItems([]) } finally { setLoading(false) }
  }, [page, search, catFilter, lowOnly])

  const fetchLedger = async () => {
    try { const r = await inventoryAPI.movements({ page:1, per_page:80 }); setMovements(r.data.data?.items || []) } catch {}
  }
  const fetchStock = async () => {
    try { const r = await inventoryAPI.stockSummary({ per_page:200 }); setStockSummary(r.data.data?.items || []) } catch {}
  }
  const fetchPurchases = async () => {
    try { const r = await inventoryAPI.purchaseOrders(); setPurchases(r.data.data?.items || []) } catch {}
  }

  const fetchChallans = async () => {
    try { const r = await inventoryAPI.challans(); setChallans(r.data.data?.items || []) } catch {}
  }

  const fetchMktPurchases = async () => {
    setMktLoading(true)
    try { const r = await inventoryAPI.marketPurchaseVerifications({ per_page: 50 }); setMktPurchases(r.data.data?.items || []) } catch {}
    finally { setMktLoading(false) }
  }

  useEffect(() => { fetchItems(page) }, [page, search, catFilter, lowOnly])
  useEffect(() => {
    if (tab === 'Ledger') fetchLedger()
    else if (tab === 'Purchases') fetchPurchases()
    else if (tab === 'Stock') fetchStock()
    else if (tab === 'Challans') fetchChallans()
    else if (tab === 'Market Purchases') { fetchMktPurchases(); domainsAPI.list({ per_page: 100 }).then((r: any) => setDomains(r.data.data?.items || r.data.data || [])).catch(() => {}) }
  }, [tab])

  // ── Item detail: load per-warehouse stock ──────────────────
  const openDetail = async (item: Item) => {
    setDetailItem(item)
    setDetailLoading(true)
    setDetailWhStock([])
    try {
      // For each warehouse, query its stock for this item
      const results: any[] = []
      for (const wh of warehouses) {
        try {
          const r = await inventoryAPI.warehouseStock(wh.id, { per_page:200 })
          const rows: WhStock[] = r.data.data?.items || []
          const row = rows.find((s: any) => s.item_id === item.id)
          if (row) {
            results.push({ wh_name: wh.name, wh_id: wh.id, quantity: row.quantity, reserved_qty: row.reserved_qty || 0, available: row.available })
          }
        } catch {}
      }
      setDetailWhStock(results)
    } finally { setDetailLoading(false) }
  }

  // ── Item CRUD ─────────────────────────────────────────────────
  const openItemModal = (item?: Item) => {
    if (item) {
      setItemForm({ name:item.name, sku:item.sku||'', barcode:item.barcode||'', category_ids:item.category_ids||[], brand_id:item.brand_id||'', unit:item.unit, description:item.description||'', hsn_code:item.hsn_code||'', gst_percent:item.gst_percent, cost_price:item.cost_price, selling_price:item.selling_price, mrp:item.mrp, min_stock_level:item.min_stock_level, reorder_qty:item.reorder_qty, is_consumable:item.is_consumable, is_serialised:item.is_serialised, image_url:item.image_url||'' })
      setItemModal(item)
      setOpeningStocks([])
    } else {
      setItemForm({ ...EMPTY_ITEM })
      setItemModal('new')
      // Default opening stock row for default warehouse
      const defWh = warehouses.find(w => w.is_default)
      setOpeningStocks(defWh ? [{ warehouse_id: defWh.id, quantity: 0 }] : [])
    }
    setItemErr('')
  }

  const saveItem = async (e: any) => {
    e.preventDefault(); setItemSaving(true); setItemErr('')
    try {
      const payload = { ...itemForm, brand_id:itemForm.brand_id||undefined, sku:itemForm.sku||undefined, barcode:itemForm.barcode||undefined, image_url:itemForm.image_url||undefined }
      if (itemModal === 'new') {
        const res = await inventoryAPI.create(payload)
        const newId = res.data.data?.id
        // Set opening stock for each configured warehouse
        if (newId) {
          for (const os of openingStocks) {
            if (os.warehouse_id && os.quantity > 0) {
              await inventoryAPI.opening({ item_id: newId, warehouse_id: os.warehouse_id, quantity: os.quantity }).catch(() => {})
            }
          }
        }
      } else {
        await inventoryAPI.update((itemModal as Item).id, payload)
      }
      setItemModal(null)
      fetchItems(page)
      if (detailItem && itemModal !== 'new') openDetail({ ...detailItem, ...payload } as any)
    } catch (ex: any) { setItemErr(ex.response?.data?.detail || 'Failed to save') } finally { setItemSaving(false) }
  }

  // ── Stock ops ─────────────────────────────────────────────────
  const saveAdjust = async (e: any) => {
    e.preventDefault(); setAdjustSaving(true); setAdjustErr('')
    try {
      await inventoryAPI.adjust({ item_id:adjustModal!.id, ...adjustForm, quantity:+adjustForm.quantity })
      setAdjustModal(null); fetchItems(page)
      if (detailItem?.id === adjustModal?.id) openDetail(detailItem!)
    } catch (ex: any) { setAdjustErr(ex.response?.data?.detail || 'Failed') } finally { setAdjustSaving(false) }
  }

  const loadWhStock = async (itemId: string) => {
    setAssignWhLoading(true)
    try {
      const r = await inventoryAPI.itemWarehouseStock(itemId)
      const rows: any[] = r.data.data || []
      const map: Record<string, number> = {}
      rows.forEach((row: any) => { map[row.warehouse_id] = row.available })
      setWhStockMap(map)
      // Auto-select warehouse with most stock if none selected
      if (rows.length > 0) {
        const best = rows.reduce((a: any, b: any) => (b.available > a.available ? b : a))
        setAssignForm(f => ({ ...f, warehouse_id: f.warehouse_id || best.warehouse_id }))
      }
    } catch { setWhStockMap({}) } finally { setAssignWhLoading(false) }
  }

  const saveAssign = async (e: any) => {
    e.preventDefault(); setAssignSaving(true); setAssignErr('')
    try {
      await inventoryAPI.assignTech({ item_id:assignModal!.id, ...assignForm, quantity:+assignForm.quantity })
      setAssignModal(null); fetchItems(page)
    } catch (ex: any) { setAssignErr(ex.response?.data?.detail || 'Failed to assign stock — check warehouse has sufficient stock') } finally { setAssignSaving(false) }
  }

  const saveTransfer = async (e: any) => {
    e.preventDefault(); setTransferSaving(true); setTransferErr('')
    try {
      await inventoryAPI.transfer({ item_id:transferModal!.id, ...transferForm, quantity:+transferForm.quantity })
      setTransferModal(null); fetchItems(page)
      if (detailItem?.id === transferModal?.id) openDetail(detailItem!)
    } catch (ex: any) { setTransferErr(ex.response?.data?.detail || 'Transfer failed') } finally { setTransferSaving(false) }
  }

  const saveChallan = async (e: any) => {
    e.preventDefault(); setChallanSaving(true); setChallanErr('')
    try {
      await inventoryAPI.createChallan(challanForm)
      setChallanModal(false)
      fetchChallans()
      fetchItems(page)
    } catch (ex: any) { setChallanErr(ex.response?.data?.detail || 'Failed to create challan') } finally { setChallanSaving(false) }
  }

  const receiveChallan = async () => {
    if (!receiveModal) return
    setReceiveSaving(true)
    try {
      await inventoryAPI.receiveChallan(receiveModal.id, { challan_id: receiveModal.id })
      setReceiveModal(null)
      fetchChallans()
      fetchItems(page)
    } catch {} finally { setReceiveSaving(false) }
  }

  // ── Warehouse stock view ──────────────────────────────────────
  const openWhStock = async (wh: Warehouse) => {
    setWhStockModal(wh); setAssignWhLoading(true); setWhStockData([])
    try { const r = await inventoryAPI.warehouseStock(wh.id, { per_page:200 }); setWhStockData(r.data.data?.items || []) }
    catch {} finally { setAssignWhLoading(false) }
  }

  const fetchTechStock = async (techId: string) => {
    if (!techId) return; setTechLoading(true)
    try { const r = await inventoryAPI.techStock(techId); setTechStock(r.data.data || []) }
    catch { setTechStock([]) } finally { setTechLoading(false) }
  }

  // ── Styles ────────────────────────────────────────────────────
  const tabBtn = (t: Tab) => ({ padding:'7px 15px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:500, background:tab===t?'#1B4FD8':'#F1F5F9', color:tab===t?'#fff':'#334155' })
  const lowBadge = (item: Item) => item.is_low_stock ? <span style={{ fontSize:10, background:'#FEE2E2', color:'#DC2626', borderRadius:4, padding:'1px 6px', marginLeft:6, fontWeight:700 }}>LOW</span> : null

  // ── STATUS color for challans ──────────────────────────────────
  const challanStatusStyle = (s: string): React.CSSProperties => {
    if (s === 'DELIVERED') return { background:'#DCFCE7', color:'#166534' }
    if (s === 'IN_TRANSIT') return { background:'#DBEAFE', color:'#1D4ED8' }
    if (s === 'CANCELLED') return { background:'#FEE2E2', color:'#DC2626' }
    return { background:'#FEF3C7', color:'#92400E' }
  }

  return (
    <div style={{ padding:'24px 28px' }}>
      <PageHeader
        title="Inventory"
        subtitle={`${total} spare parts & consumables across ${warehouses.length} warehouse(s)`}
        actions={
          <div style={{ display:'flex', gap:8 }}>
            {lowOnly && <span style={{ background:'#FEE2E2', color:'#DC2626', padding:'6px 12px', borderRadius:8, fontSize:12, fontWeight:600 }}>⚠ Low Stock Filter ON</span>}
            <button className="btn btn-secondary" onClick={() => { setChallanForm({ from_warehouse_id:'', to_warehouse_id:'', to_technician_id:'', items:[{item_id:'',quantity:1}], reference_no:'', notes:'' }); setChallanErr(''); setChallanModal(true) }}>⇄ Transfer Challan</button>
            <button className="btn btn-primary" onClick={() => openItemModal()}>+ New Part</button>
          </div>
        }
      />

      {/* Tab bar */}
      <div style={{ display:'flex', gap:6, margin:'16px 0', flexWrap:'wrap' }}>
        {TABS.map(t => <button key={t} style={tabBtn(t)} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      {/* ══ ITEMS TAB ══════════════════════════════════════════ */}
      {tab === 'Items' && (
        <div style={{ display:'grid', gridTemplateColumns: detailItem ? '1fr 360px' : '1fr', gap:16 }}>
          {/* Left: list */}
          <div>
            {/* Filter bar */}
            <div className="card" style={{ padding:'10px 16px', marginBottom:14, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
              <input ref={searchRef} className={inp} placeholder="🔍 Search name, SKU, barcode…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} style={{ width:240 }} />
              <select className={inp} style={{ width:180 }} value={catFilter} onChange={e => { setCatFilter(e.target.value); setPage(1) }}>
                <option value="">All Categories</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
              <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, cursor:'pointer' }}>
                <input type="checkbox" checked={lowOnly} onChange={e => setLowOnly(e.target.checked)} /> Low stock only
              </label>
              <span style={{ fontSize:13, color:'#94A3B8', marginLeft:'auto' }}>{total} items</span>
            </div>

            {loading ? <div style={{ padding:48, textAlign:'center' }}><Spinner /></div> : (
              <div className="card">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Part / SKU</th>
                      <th>Categories</th>
                      <th>Unit</th>
                      <th>Cost</th>
                      <th>Sell</th>
                      <th>Total Stock</th>
                      <th>Warehouses</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0
                      ? <tr><td colSpan={8} style={{ textAlign:'center', color:'#94A3B8', padding:40 }}>No items found</td></tr>
                      : items.map(item => (
                        <tr key={item.id} style={{ background: detailItem?.id === item.id ? '#EFF6FF' : undefined }}>
                          <td>
                            <div style={{ fontWeight:600, fontSize:14 }}>{item.name}{lowBadge(item)}</div>
                            <div style={{ fontSize:11, color:'#94A3B8', marginTop:2, fontFamily:'monospace' }}>
                              {item.sku || '—'}
                              {item.brand_name && <span style={{ fontFamily:'sans-serif', background:'#F8FAFC', color:'#64748B', borderRadius:4, padding:'0 5px', fontSize:10, marginLeft:6, border:'1px solid #E2E8F0' }}>{item.brand_name}</span>}
                              {item.is_consumable && <span style={{ background:'#F0F9FF', color:'#0369A1', borderRadius:4, padding:'0 4px', fontSize:10, marginLeft:4 }}>CONSUMABLE</span>}
                            </div>
                          </td>
                          <td>
                            {item.categories && item.categories.length > 0
                              ? <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                                  {item.categories.map((c:any) => (
                                    <span key={c.id} style={{ fontSize:10, padding:'2px 7px', borderRadius:20, background:'#EFF6FF', color:'#1D4ED8', fontWeight:600 }}>{c.icon} {c.name}</span>
                                  ))}
                                </div>
                              : <span style={{ fontSize:13, color:'#94A3B8' }}>—</span>
                            }
                          </td>
                          <td style={{ fontSize:13 }}>{item.unit}</td>
                          <td style={{ fontSize:13 }}>{inr(item.cost_price)}</td>
                          <td style={{ fontWeight:600, color:'#059669' }}>{inr(item.selling_price)}</td>
                          <td>
                            <span style={{ fontWeight:700, color:item.is_low_stock?'#DC2626':'#0F172A' }}>{item.current_stock}</span>
                            {item.reserved_stock > 0 && <span style={{ fontSize:11, color:'#D97706', marginLeft:4 }}>({item.reserved_stock} rsv)</span>}
                          </td>
                          <td>
                            <button
                              style={{ fontSize:11, background:'#F1F5F9', border:'none', borderRadius:6, padding:'3px 8px', cursor:'pointer', color:'#1B4FD8', fontWeight:600 }}
                              onClick={() => openDetail(item)}
                            >
                              📦 View stock
                            </button>
                          </td>
                          <td>
                            <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                              <button className="btn btn-secondary btn-sm" onClick={() => openItemModal(item)}>Edit</button>
                              <button className="btn btn-secondary btn-sm" style={{ color:'#1B4FD8' }} onClick={() => { setAdjustModal(item); setAdjustForm({ warehouse_id:warehouses.find(w=>w.is_default)?.id||'', quantity:0, reason:'', notes:'' }) }}>± Adjust</button>
                              <button className="btn btn-secondary btn-sm" style={{ color:'#059669' }} onClick={() => { setAssignModal(item); setAssignErr(''); setWhStockMap({}); const defWh = warehouses.find(w=>w.is_default)?.id||''; setAssignForm({ technician_id:'', warehouse_id:defWh, quantity:1, notes:'', booking_id:'' }); loadWhStock(item.id) }}>→ Assign</button>
                              <button className="btn btn-secondary btn-sm" style={{ color:'#D97706' }} onClick={() => { setTransferModal(item); setTransferForm({ from_warehouse_id:'', to_warehouse_id:'', quantity:1, notes:'', reference_no:'' }) }}>⇄ Move</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                <Pagination page={page} pages={pages} onPage={p => { setPage(p); fetchItems(p) }} />
              </div>
            )}
          </div>

          {/* Right: Part Detail Panel */}
          {detailItem && (
            <div className="card" style={{ padding:0, height:'fit-content', position:'sticky', top:20 }}>
              {/* Header */}
              <div style={{ padding:'14px 16px', borderBottom:'1px solid #F1F5F9', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:15, color:'#0F172A' }}>{detailItem.name}</div>
                  <div style={{ fontSize:12, color:'#94A3B8', marginTop:2, fontFamily:'monospace' }}>{detailItem.sku || 'No SKU'}</div>
                </div>
                <button onClick={() => setDetailItem(null)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'#94A3B8', lineHeight:1 }}>×</button>
              </div>

              {/* Summary chips */}
              <div style={{ padding:'10px 16px', borderBottom:'1px solid #F8FAFC', display:'flex', gap:8, flexWrap:'wrap' }}>
                <span style={{ fontSize:12, background:'#EFF6FF', color:'#1D4ED8', borderRadius:6, padding:'3px 8px', fontWeight:600 }}>Total: {detailItem.current_stock} {detailItem.unit}</span>
                <span style={{ fontSize:12, background:'#FEF3C7', color:'#B45309', borderRadius:6, padding:'3px 8px', fontWeight:600 }}>Reserved: {detailItem.reserved_stock}</span>
                <span style={{ fontSize:12, background:'#DCFCE7', color:'#166534', borderRadius:6, padding:'3px 8px', fontWeight:600 }}>Available: {detailItem.available_stock}</span>
                {detailItem.is_low_stock && <span style={{ fontSize:12, background:'#FEE2E2', color:'#DC2626', borderRadius:6, padding:'3px 8px', fontWeight:700 }}>⚠ LOW STOCK</span>}
              </div>

              {/* Pricing */}
              <div style={{ padding:'10px 16px', borderBottom:'1px solid #F8FAFC', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                {[['Cost', detailItem.cost_price], ['Sell', detailItem.selling_price], ['MRP', detailItem.mrp]].map(([l, v]) => (
                  <div key={l as string} style={{ textAlign:'center' }}>
                    <div style={{ fontSize:10, color:'#94A3B8', marginBottom:2 }}>{l}</div>
                    <div style={{ fontWeight:700, fontSize:13, color:'#0F172A' }}>{inr(v as number)}</div>
                  </div>
                ))}
              </div>

              {/* Per-warehouse stock breakdown */}
              <div style={{ padding:'12px 16px' }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:10, display:'flex', justifyContent:'space-between' }}>
                  <span>📦 Stock per Warehouse</span>
                  <button style={{ fontSize:11, background:'none', border:'none', color:'#1B4FD8', cursor:'pointer' }} onClick={() => openDetail(detailItem)}>↺ Refresh</button>
                </div>
                {detailLoading ? <div style={{ textAlign:'center', padding:16 }}><Spinner /></div> : (
                  detailWhStock.length === 0
                    ? <div style={{ textAlign:'center', color:'#94A3B8', fontSize:12, padding:'12px 0' }}>
                        No warehouse stock yet.<br />Use <strong>± Adjust</strong> to set opening stock.
                      </div>
                    : <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                        {detailWhStock.map(ws => (
                          <div key={ws.wh_id} style={{ background:'#F8FAFC', borderRadius:8, padding:'10px 12px', border:'1px solid #E2E8F0' }}>
                            <div style={{ fontWeight:600, fontSize:13, color:'#0F172A', marginBottom:6 }}>🏭 {ws.wh_name}</div>
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4, fontSize:12 }}>
                              <div><span style={{ color:'#94A3B8' }}>Total</span><br /><strong>{ws.quantity}</strong></div>
                              <div><span style={{ color:'#94A3B8' }}>Reserved</span><br /><strong style={{ color:'#D97706' }}>{ws.reserved_qty}</strong></div>
                              <div><span style={{ color:'#94A3B8' }}>Available</span><br /><strong style={{ color: ws.available <= 0 ? '#DC2626' : '#059669' }}>{ws.available}</strong></div>
                            </div>
                            <div style={{ marginTop:8, display:'flex', gap:6 }}>
                              <button className="btn btn-secondary btn-sm" style={{ fontSize:11 }} onClick={() => { setAdjustModal(detailItem); setAdjustForm({ warehouse_id:ws.wh_id, quantity:0, reason:'', notes:'' }) }}>± Adjust</button>
                              <button className="btn btn-secondary btn-sm" style={{ fontSize:11, color:'#D97706' }} onClick={() => { setTransferModal(detailItem); setTransferForm({ from_warehouse_id:ws.wh_id, to_warehouse_id:'', quantity:1, notes:'', reference_no:'' }) }}>⇄ Transfer</button>
                            </div>
                          </div>
                        ))}
                        {/* Warehouses with no stock yet */}
                        {warehouses.filter(wh => !detailWhStock.find(ws => ws.wh_id === wh.id)).map(wh => (
                          <div key={wh.id} style={{ background:'#F8FAFC', borderRadius:8, padding:'10px 12px', border:'1px dashed #E2E8F0' }}>
                            <div style={{ fontWeight:500, fontSize:13, color:'#94A3B8', marginBottom:4 }}>🏭 {wh.name}</div>
                            <div style={{ fontSize:11, color:'#CBD5E1' }}>No stock in this warehouse</div>
                            <button className="btn btn-secondary btn-sm" style={{ fontSize:11, marginTop:6 }} onClick={() => { setAdjustModal(detailItem); setAdjustForm({ warehouse_id:wh.id, quantity:0, reason:'Opening stock entry', notes:'' }) }}>+ Add stock</button>
                          </div>
                        ))}
                      </div>
                )}
              </div>

              {/* Quick actions */}
              <div style={{ padding:'12px 16px', borderTop:'1px solid #F1F5F9', display:'flex', gap:8 }}>
                <button className="btn btn-secondary btn-sm" style={{ flex:1 }} onClick={() => openItemModal(detailItem)}>✏ Edit Part</button>
                <button className="btn btn-secondary btn-sm" style={{ flex:1, color:'#D97706' }} onClick={() => { setTransferModal(detailItem); setTransferForm({ from_warehouse_id:'', to_warehouse_id:'', quantity:1, notes:'', reference_no:'' }) }}>⇄ Transfer</button>
              </div>
            </div>
          )}
        </div>
      )}


      {/* ══ PURCHASES TAB ══════════════════════════════════════ */}
      {tab === 'Purchases' && (
        <div>
          <div style={{ background:'#F0F9FF', border:'1px solid #BAE6FD', borderRadius:10, padding:'12px 16px', marginBottom:14, fontSize:13, color:'#0369A1', display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>
            <span>📦 <strong>Purchase Orders</strong> — Record incoming stock from vendors. Each PO immediately updates warehouse stock and creates a ledger entry.</span>
            <button className="btn btn-primary btn-sm" style={{ flexShrink:0 }} onClick={() => {
              const defWh = warehouses.find(w => w.is_default)
              setPoForm({ warehouse_id:defWh?.id||'', vendor_id:'', vendor_name:'', vendor_invoice_no:'', items:[{item_id:'',quantity:1,unit_cost:0}], payment_method:'CASH', notes:'' })
              setPoErr(''); setPoModal(true)
            }}>+ New Purchase Order</button>
          </div>

          <div className="card" style={{ overflowX:'auto' }}>
            <table className="data-table">
              <thead>
                <tr><th>PO Number</th><th>Warehouse</th><th>Vendor</th><th>Parts</th><th>Subtotal</th><th>GST</th><th>Total</th><th>Payment</th><th>Date</th></tr>
              </thead>
              <tbody>
                {purchases.length === 0
                  ? <tr><td colSpan={9} style={{ textAlign:'center', color:'#94A3B8', padding:40 }}>
                      No purchase orders yet.<br />
                      <span style={{ fontSize:12 }}>Click <strong>+ New Purchase Order</strong> to record stock received from a vendor or market purchase.</span>
                    </td></tr>
                  : purchases.map((po: PurchaseOrder) => (
                    <tr key={po.id}>
                      <td>
                        <span style={{ fontFamily:'monospace', fontWeight:700, color:'#7C3AED' }}>{po.po_number}</span>
                        {po.vendor_invoice_no && <div style={{ fontSize:11, color:'#94A3B8' }}>Inv: {po.vendor_invoice_no}</div>}
                      </td>
                      <td style={{ fontWeight:500 }}>🏭 {po.warehouse_name}</td>
                      <td>
                        <div style={{ fontWeight:500 }}>{po.vendor_name || '—'}</div>
                      </td>
                      <td>
                        <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                          {(po.items || []).slice(0,3).map((it: any, i: number) => (
                            <span key={i} style={{ fontSize:11, color:'#374151' }}>
                              {it.item_name} × {it.quantity} @ {inr(it.unit_cost)}
                            </span>
                          ))}
                          {(po.items||[]).length > 3 && <span style={{ fontSize:11, color:'#94A3B8' }}>+{po.items.length-3} more</span>}
                        </div>
                      </td>
                      <td style={{ fontWeight:600 }}>{inr(po.subtotal)}</td>
                      <td style={{ color:'#D97706' }}>{inr(po.tax_amount)}</td>
                      <td style={{ fontWeight:700, color:'#059669', fontSize:15 }}>{inr(po.total_amount)}</td>
                      <td>
                        <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, fontWeight:600, background:'#DCFCE7', color:'#166534' }}>{po.payment_method}</span>
                      </td>
                      <td style={{ fontSize:12, color:'#64748B', whiteSpace:'nowrap' }}>{po.received_at ? fmtDate(po.received_at) : fmtDate(po.created_at)}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ STOCK TAB ═══════════════════════════════════════════ */}
      {tab === 'Stock' && (
        <div className="card">
          <table className="data-table">
            <thead><tr><th>Part</th><th>SKU</th><th>Unit</th><th>Total Stock</th><th>Reserved</th><th>Available</th><th>Min Level</th><th>Status</th></tr></thead>
            <tbody>
              {stockSummary.length === 0
                ? <tr><td colSpan={8} style={{ textAlign:'center', color:'#94A3B8', padding:40 }}>No stock data — switch to Items tab to add parts</td></tr>
                : stockSummary.map((s: any) => (
                  <tr key={s.item_id}>
                    <td style={{ fontWeight:500 }}>{s.item_name}</td>
                    <td style={{ fontFamily:'monospace', fontSize:12 }}>{s.sku || '—'}</td>
                    <td>{s.unit}</td>
                    <td style={{ fontWeight:700 }}>{s.current_stock}</td>
                    <td style={{ color:'#D97706' }}>{s.reserved_stock}</td>
                    <td style={{ fontWeight:700, color:s.available_stock===0?'#DC2626':'#059669' }}>{s.available_stock}</td>
                    <td>{s.min_stock_level}</td>
                    <td>{s.is_low_stock ? <span className="badge status-INACTIVE">⚠ Low</span> : <span className="badge status-ACTIVE">OK</span>}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ══ TECHNICIANS TAB ══════════════════════════════════════ */}
      {tab === 'Technicians' && (
        <>
          <div className="card" style={{ padding:'12px 16px', marginBottom:14, display:'flex', alignItems:'center', gap:12 }}>
            <label style={{ fontSize:13, fontWeight:600 }}>Technician:</label>
            <select className={inp} style={{ width:280 }} value={selectedTech} onChange={e => { setSelectedTech(e.target.value); fetchTechStock(e.target.value) }}>
              <option value="">— Select technician —</option>
              {techList.map((t: any) => <option key={t.id} value={t.id}>{t.name} ({t.technician_code || t.id.slice(0,8)})</option>)}
            </select>
            {selectedTech && <button className="btn btn-secondary btn-sm" onClick={() => fetchTechStock(selectedTech)}>↺ Refresh</button>}
          </div>
          <div className="card">
            {techLoading ? <div style={{ padding:40, textAlign:'center' }}><Spinner /></div> : (
              <table className="data-table">
                <thead><tr><th>Part Name</th><th>SKU</th><th>Unit</th><th>Carrying</th><th>Total Assigned</th><th>Consumed</th><th>Returned</th></tr></thead>
                <tbody>
                  {!selectedTech
                    ? <tr><td colSpan={7} style={{ textAlign:'center', color:'#94A3B8', padding:40 }}>Select a technician to view their stock</td></tr>
                    : techStock.length === 0
                    ? <tr><td colSpan={7} style={{ textAlign:'center', color:'#94A3B8', padding:40 }}>No stock assigned to this technician</td></tr>
                    : techStock.map(ts => (
                      <tr key={ts.item_id}>
                        <td style={{ fontWeight:600 }}>{ts.item_name}</td>
                        <td style={{ fontFamily:'monospace', fontSize:12 }}>{ts.sku || '—'}</td>
                        <td>{ts.unit}</td>
                        <td style={{ fontWeight:700, color:ts.quantity===0?'#94A3B8':'#1B4FD8' }}>{ts.quantity}</td>
                        <td>{ts.assigned_qty}</td>
                        <td style={{ color:'#D97706' }}>{ts.consumed_qty}</td>
                        <td style={{ color:'#059669' }}>{ts.returned_qty}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ══ LEDGER TAB ═══════════════════════════════════════════ */}
      {tab === 'Ledger' && (
        <div className="card">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Part</th><th>Movement</th><th>Qty</th><th>From → To</th><th>Ref / Reason</th><th>Booking</th><th>Action</th></tr></thead>
            <tbody>
              {movements.length === 0
                ? <tr><td colSpan={7} style={{ textAlign:'center', color:'#94A3B8', padding:40 }}>No movements recorded yet</td></tr>
                : movements.map(m => {
                    const fromWh = warehouses.find(w => w.id === (m as any).from_warehouse_id)
                    const toWh   = warehouses.find(w => w.id === (m as any).to_warehouse_id)
                    return (
                      <tr key={m.id}>
                        <td style={{ fontSize:12, color:'#94A3B8', whiteSpace:'nowrap' }}>{fmtDateTime(m.created_at)}</td>
                        <td style={{ fontWeight:500 }}>{m.item_name || m.item_id.slice(0,8)}</td>
                        <td><span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:MV_BG[m.movement_type]||'#F8FAFC', color:MV_FG[m.movement_type]||'#334155', fontWeight:700 }}>{m.movement_type}</span></td>
                        <td style={{ fontWeight:700, color:m.quantity>0?'#059669':'#DC2626' }}>{m.quantity>0?'+':''}{m.quantity}</td>
                        <td style={{ fontSize:11, color:'#64748B' }}>
                          {fromWh ? fromWh.name : '—'}
                          {(fromWh || toWh) ? ' → ' : ''}
                          {toWh ? toWh.name : m.technician_id ? 'Technician' : ''}
                        </td>
                        <td style={{ fontSize:12, color:'#64748B' }}>{m.reason || m.notes || '—'}</td>
                        <td style={{ fontSize:12 }}>{m.booking_id ? m.booking_id.slice(0,8) : '—'}</td>
                        <td>
                          <button
                            disabled={deletingMovId === m.id}
                            onClick={async () => {
                              if (!window.confirm(`Delete this ${m.movement_type} movement (qty: ${m.quantity}) for "${m.item_name}"? This will reverse the stock impact.`)) return
                              setDeletingMovId(m.id)
                              try {
                                await inventoryAPI.deleteMovement(m.id)
                                setMovements(prev => prev.filter(x => x.id !== m.id))
                                // refresh items list to reflect corrected stock
                                fetchItems()
                              } catch (e: any) {
                                alert(e?.response?.data?.detail || 'Failed to delete movement')
                              } finally { setDeletingMovId(null) }
                            }}
                            style={{ fontSize:11, padding:'2px 8px', borderRadius:4, border:'1px solid #FECACA', background:'#FEF2F2', color:'#DC2626', cursor:'pointer', opacity: deletingMovId === m.id ? 0.5 : 1 }}>
                            {deletingMovId === m.id ? '…' : '🗑 Delete'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
            </tbody>
          </table>
        </div>
      )}

      {/* ══ WAREHOUSES TAB ══════════════════════════════════════ */}
      {tab === 'Warehouses' && (
        <>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
            <button className="btn btn-primary" onClick={() => { setWhModal('new'); setWhForm({ name:'', code:'', address:'', city:'', phone:'', is_default:false }); setWhErr('') }}>+ New Warehouse</button>
          </div>
          {warehouses.length === 0
            ? <div className="card" style={{ padding:48, textAlign:'center', color:'#94A3B8' }}>No warehouses yet. Add your first warehouse to start tracking stock locations.</div>
            : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:14 }}>
                {warehouses.map(wh => (
                  <div key={wh.id} className="card" style={{ padding:'16px 18px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                      <div>
                        <div style={{ fontWeight:700, fontSize:15 }}>🏭 {wh.name}</div>
                        {wh.code && <div style={{ fontSize:11, color:'#94A3B8', fontFamily:'monospace' }}>{wh.code}</div>}
                      </div>
                      {wh.is_default && <span style={{ fontSize:10, background:'#DCFCE7', color:'#166534', borderRadius:20, padding:'2px 8px', fontWeight:700 }}>DEFAULT</span>}
                    </div>
                    {wh.city && <div style={{ fontSize:12, color:'#64748B', marginBottom:3 }}>📍 {wh.city}</div>}
                    {wh.address && <div style={{ fontSize:11, color:'#94A3B8', marginBottom:8 }}>{wh.address}</div>}
                    {wh.phone && <div style={{ fontSize:11, color:'#94A3B8' }}>📞 {wh.phone}</div>}
                    <div style={{ display:'flex', gap:8, marginTop:12 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => { setWhModal(wh); setWhForm({ name:wh.name, code:wh.code||'', address:wh.address||'', city:wh.city||'', phone:wh.phone||'', is_default:wh.is_default }); setWhErr('') }}>Edit</button>
                      <button className="btn btn-secondary btn-sm" style={{ color:'#1B4FD8' }} onClick={() => openWhStock(wh)}>📦 View Stock</button>
                      <button className="btn btn-secondary btn-sm" style={{ color:'#D97706' }} onClick={() => { setChallanForm({ from_warehouse_id:wh.id, to_warehouse_id:'', to_technician_id:'', items:[{item_id:'',quantity:1}], reference_no:'', notes:'' }); setChallanErr(''); setChallanModal(true) }}>⇄ Transfer</button>
                    </div>
                  </div>
                ))}
              </div>
          }
        </>
      )}

      {/* ══ CHALLANS TAB ════════════════════════════════════════ */}
      {tab === 'Challans' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <h3 style={{ margin:0, fontSize:15, fontWeight:600 }}>Transfer Challans</h3>
            <button className="btn btn-primary" onClick={() => { setChallanForm({ from_warehouse_id:'', to_warehouse_id:'', to_technician_id:'', items:[{item_id:'',quantity:1}], reference_no:'', notes:'' }); setChallanErr(''); setChallanModal(true) }}>+ New Transfer Challan</button>
          </div>
          <div className="card" style={{ overflowX:'auto' }}>
            <table className="data-table">
              <thead>
                <tr><th>Challan No</th><th>From</th><th>To</th><th>Parts</th><th>Total Qty</th><th>Total Value</th><th>Status</th><th>Date</th><th>Action</th></tr>
              </thead>
              <tbody>
                {challans.length === 0
                  ? <tr><td colSpan={9} style={{ textAlign:'center', color:'#94A3B8', padding:32 }}>No challans yet. Create a transfer challan to move stock between warehouses or assign to technicians.</td></tr>
                  : challans.map((c: Challan) => {
                      const fromWh = warehouses.find(w => w.id === c.from_warehouse_id)
                      const toWh   = warehouses.find(w => w.id === c.to_warehouse_id)
                      return (
                        <tr key={c.id}>
                          <td><span style={{ fontFamily:'monospace', fontWeight:700, color:'#1B4FD8' }}>{c.challan_no}</span></td>
                          <td style={{ fontSize:12, fontWeight:500 }}>{fromWh?.name || '—'}</td>
                          <td style={{ fontSize:12, fontWeight:500 }}>
                            {toWh?.name || (c.to_technician_id ? '→ Technician' : '—')}
                          </td>
                          <td>
                            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                              {(c.items || []).slice(0,3).map((it: any, i: number) => (
                                <span key={i} style={{ fontSize:11, color:'#374151' }}>{it.item_name} × {it.quantity}</span>
                              ))}
                              {(c.items||[]).length > 3 && <span style={{ fontSize:11, color:'#94A3B8' }}>+{c.items.length-3} more</span>}
                            </div>
                          </td>
                          <td style={{ fontWeight:600 }}>{c.total_qty}</td>
                          <td style={{ fontWeight:600, color:'#059669' }}>{inr(c.total_value)}</td>
                          <td><span style={{ fontSize:11, padding:'2px 9px', borderRadius:20, fontWeight:700, ...challanStatusStyle(c.status) }}>{c.status}</span></td>
                          <td style={{ fontSize:12, color:'#64748B' }}>{fmtDate(c.created_at)}</td>
                          <td>
                            {c.status === 'IN_TRANSIT' && (
                              <button className="btn btn-secondary btn-sm" style={{ color:'#059669', fontSize:11 }} onClick={() => setReceiveModal(c)}>✓ Receive</button>
                            )}
                          </td>
                        </tr>
                      )
                    })
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ SALES TAB ═══════════════════════════════════════════ */}
      {tab === 'Sales' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <h3 style={{ margin:0, fontSize:15, fontWeight:600 }}>Direct Part Sales</h3>
            <button className="btn btn-primary" onClick={() => { setSaleForm({ warehouse_id:'', customer_name:'', customer_mobile:'', items:[{item_id:'',quantity:1,unit_price:0}], payment_method:'CASH', notes:'' }); setSaleErr(''); setSaleModal(true) }}>+ New Sale</button>
          </div>
          <div className="card" style={{ overflowX:'auto' }}>
            <table className="data-table">
              <thead><tr><th>Sale No</th><th>Customer</th><th>Items</th><th>Subtotal</th><th>GST</th><th>Total</th><th>Payment</th><th>Date</th></tr></thead>
              <tbody>
                {sales.length === 0
                  ? <tr><td colSpan={8} style={{ textAlign:'center', color:'#94A3B8', padding:32 }}>No direct sales yet.</td></tr>
                  : sales.map((s: any) => (
                    <tr key={s.id}>
                      <td><span style={{ fontFamily:'monospace', fontWeight:600, color:'#7C3AED' }}>{s.sale_no}</span></td>
                      <td><div style={{ fontWeight:500 }}>{s.customer_name || '—'}</div><div style={{ fontSize:11, color:'#94A3B8' }}>{s.customer_mobile}</div></td>
                      <td style={{ fontSize:12 }}>{s.items?.length||0} part(s)</td>
                      <td>{inr(s.subtotal)}</td>
                      <td style={{ color:'#D97706' }}>{inr(s.gst_amount)}</td>
                      <td style={{ fontWeight:700, color:'#059669' }}>{inr(s.total_amount)}</td>
                      <td><span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, fontWeight:600, background:'#DCFCE7', color:'#166534' }}>{s.payment_method}</span></td>
                      <td style={{ fontSize:12, color:'#64748B' }}>{fmtDate(s.created_at)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* ══ MARKET PURCHASES TAB ════════════════════════════════ */}
      {tab === 'Market Purchases' && (
        <>
          <div style={{ background:'#FFF7ED', border:'1px solid #FED7AA', borderRadius:10, padding:'12px 16px', marginBottom:16, fontSize:13, color:'#92400E' }}>
            🛒 <strong>Market Purchase Verification</strong> — Technicians who bought parts in the field and submitted them for catalogue review appear here. You can add them as new items, update the existing item's price, or reject.
          </div>
          {mktLoading ? <div style={{ textAlign:'center', padding:40 }}><Spinner /></div> : mktPurchases.length === 0 ? (
            <div style={{ textAlign:'center', padding:40, color:'#94A3B8', fontSize:14 }}>✅ No pending market purchase verifications</div>
          ) : (
            <table className="data-table">
              <thead><tr>
                <th>Part Name</th><th>Tech's Purchase ₹</th><th>Tech's Sale ₹</th><th>Qty</th>
                <th>Vendor</th><th>Bill No.</th>
                <th>Catalogue Match</th><th>Cat. Cost</th><th>Cat. Sale</th>
                <th>Domain</th><th>Booking</th><th>Date</th><th>Action</th>
              </tr></thead>
              <tbody>
                {mktPurchases.map((p: any) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight:600 }}>{p.part_name}</td>
                    <td style={{ color:'#DC2626', fontWeight:700 }}>{inr(p.purchase_price)}</td>
                    <td style={{ color:'#059669', fontWeight:700 }}>{inr(p.sale_price)}</td>
                    <td>{p.quantity}</td>
                    <td style={{ fontSize:12 }}>{p.vendor_name || '—'}</td>
                    <td style={{ fontSize:12 }}>{p.bill_number || '—'}</td>
                    <td>
                      {p.inventory_item ? (
                        <span style={{ background:'#DBEAFE', color:'#1D4ED8', borderRadius:4, padding:'2px 8px', fontSize:12, fontWeight:600 }}>
                          🔗 {p.inventory_item.name}
                          {!p.inventory_item.is_active && <span style={{ marginLeft:4, color:'#DC2626', fontSize:10 }}>(inactive)</span>}
                        </span>
                      ) : <span style={{ color:'#94A3B8', fontSize:12 }}>New (no match)</span>}
                    </td>
                    <td style={{ color:'#6B7280', fontSize:12 }}>{p.inventory_item ? inr(p.inventory_item.cost_price) : '—'}</td>
                    <td style={{ color:'#6B7280', fontSize:12 }}>{p.inventory_item ? inr(p.inventory_item.selling_price) : '—'}</td>
                    <td style={{ fontSize:12 }}>{p.domain_name ? <span style={{ background:'#F0FDF4', color:'#166534', borderRadius:4, padding:'2px 8px', fontWeight:600 }}>{p.domain_name}</span> : '—'}</td>
                    <td style={{ fontSize:12 }}>{p.booking_id ? <a href={`/bookings?highlight=${p.booking_id}`} target="_blank" rel="noreferrer" style={{ color:'#3B82F6' }}>View</a> : '—'}</td>
                    <td style={{ fontSize:12 }}>{p.created_at ? fmtDate(p.created_at) : '—'}</td>
                    <td>
                      <button className="btn btn-primary btn-sm" onClick={() => {
                        setMktVerifyModal(p)
                        setMktAction(p.inventory_item ? 'link_and_update' : 'add_new')
                        setMktForm({
                          override_cost_price: String(p.purchase_price||''),
                          override_selling_price: String(p.sale_price||''),
                          selected_item_id: p.inventory_item?.id || '',
                          selected_item_name: p.inventory_item?.name || '',
                          new_item_name: p.part_name,
                          new_cost_price: String(p.purchase_price||''),
                          new_selling_price: String(p.sale_price||''),
                          category_ids: [], sku: '', barcode: '', brand_id: '',
                          unit: 'pcs', description: '', hsn_code: '', gst_percent: 18,
                          mrp: 0, is_consumable: false, is_serialised: false,
                        })
                        setMktItemSearch('')
                        setMktItemResults([])
                        setMktErr('')
                      }}>Review</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
      {/* ══ CATEGORIES TAB ═════════════════════════════════════ */}
      {tab === 'Categories' && (
        <>
          <div style={{ background:'#F0F9FF', border:'1px solid #BAE6FD', borderRadius:10, padding:'12px 16px', marginBottom:14, fontSize:13, color:'#0369A1', display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>
            <span>💡 <strong>Service categories are shared</strong> — categories here also appear in Services. A spare part can belong to multiple categories.</span>
            <button className="btn btn-primary btn-sm" style={{ flexShrink:0 }} onClick={() => { setCatModal('new'); setCatForm({ name:'', description:'', icon:'', sort_order:0 }) }}>+ New Category</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:12 }}>
            {categories.map(c => (
              <div key={c.id} className="card" style={{ padding:'14px 16px' }}>
                <div style={{ fontSize:28, marginBottom:6 }}>{c.icon || '📦'}</div>
                <div style={{ fontWeight:700, fontSize:14 }}>{c.name}</div>
                <div style={{ fontSize:12, color:'#94A3B8', marginTop:2 }}>{c.item_count} parts</div>
                {c.description && <div style={{ fontSize:11, color:'#64748B', marginTop:6 }}>{c.description}</div>}
                <button className="btn btn-secondary btn-sm" style={{ marginTop:10 }} onClick={() => { setCatModal(c); setCatForm({ name:c.name, description:c.description||'', icon:c.icon||'', sort_order:0 }) }}>Edit</button>
              </div>
            ))}
          </div>
        </>
      )}


      {/* ── Market Purchase Verify Modal ────────────────────────── */}
      {mktVerifyModal && (
        <Modal title={`🛒 Review: ${mktVerifyModal.part_name}`} onClose={() => setMktVerifyModal(null)}>
          <div style={{ fontSize:13, marginBottom:14, background:'#F8FAFC', borderRadius:8, padding:12 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <div><span style={{ color:'#64748B' }}>Tech Purchase Price:</span> <strong style={{ color:'#DC2626' }}>{inr(mktVerifyModal.purchase_price)}</strong></div>
              <div><span style={{ color:'#64748B' }}>Tech Sale Price:</span> <strong style={{ color:'#059669' }}>{inr(mktVerifyModal.sale_price)}</strong></div>
              <div><span style={{ color:'#64748B' }}>Vendor:</span> {mktVerifyModal.vendor_name || '—'}</div>
              <div><span style={{ color:'#64748B' }}>Bill No:</span> {mktVerifyModal.bill_number || '—'}</div>
              {mktVerifyModal.domain_name && (
                <div style={{ gridColumn:'1 / -1' }}><span style={{ color:'#64748B' }}>Brand/Domain:</span> <strong style={{ color:'#166534' }}>{mktVerifyModal.domain_name}</strong></div>
              )}
              {mktVerifyModal.inventory_item && (
                <>
                  <div><span style={{ color:'#64748B' }}>Catalogue Item:</span> <strong>{mktVerifyModal.inventory_item.name}</strong></div>
                  <div><span style={{ color:'#64748B' }}>Catalogue Cost:</span> {inr(mktVerifyModal.inventory_item.cost_price)} · Sale: {inr(mktVerifyModal.inventory_item.selling_price)}</div>
                </>
              )}
            </div>
          </div>

          {/* Action selector */}
          <div style={{ display:'flex', gap:8, marginBottom:14 }}>
            {(mktVerifyModal.inventory_item
              ? [['link_and_update','🔄 Update Existing Price'],['add_new','➕ Add as New Item'],['reject','❌ Reject']]
              : [['add_new','➕ Add to Catalogue'],['reject','❌ Reject']]
            ).map(([val, label]: any) => (
              <button key={val} onClick={() => { setMktAction(val as any); setMktItemSearch(''); setMktItemResults([]) }}
                style={{ flex:1, padding:'7px 10px', borderRadius:8, border:`2px solid ${mktAction===val?'#3B82F6':'#E2E8F0'}`,
                  background:mktAction===val?'#EFF6FF':'#fff', color:mktAction===val?'#1D4ED8':'#374151',
                  fontWeight:mktAction===val?700:400, fontSize:12, cursor:'pointer' }}>
                {label}
              </button>
            ))}
          </div>

          {mktAction === 'link_and_update' && (
            <div style={{ marginBottom:14 }}>
              <div style={{ background:'#FFF7ED', border:'1px solid #FED7AA', borderRadius:8, padding:'10px 12px', marginBottom:10, fontSize:12, color:'#92400E' }}>
                🔍 Search and select the existing catalogue item whose price you want to update. The tech's market purchase will be linked to it.
              </div>
              <label style={lbl}>Search Existing Part *</label>
              <div style={{ position:'relative', marginBottom:10 }}>
                <input className="input" placeholder="Type part name to search…" value={mktItemSearch}
                  onChange={async e => {
                    const q = e.target.value
                    setMktItemSearch(q)
                    setMktForm((f: any) => ({ ...f, selected_item_id: '', selected_item_name: '' }))
                    if (q.trim().length < 2) { setMktItemResults([]); return }
                    setMktItemSearching(true)
                    try {
                      const r = await inventoryAPI.list({ search: q, per_page: 10 })
                      setMktItemResults(r.data.data?.items || [])
                    } catch { setMktItemResults([]) }
                    finally { setMktItemSearching(false) }
                  }} />
                {mktItemSearching && <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', fontSize:12, color:'#64748B' }}>Searching…</span>}
                {mktItemResults.length > 0 && !mktForm.selected_item_id && (
                  <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:50, background:'#fff', border:'1px solid #E2E8F0', borderRadius:8, boxShadow:'0 4px 12px rgba(0,0,0,0.08)', maxHeight:200, overflowY:'auto' }}>
                    {mktItemResults.map((it: any) => (
                      <div key={it.id} onClick={() => {
                        setMktForm((f: any) => ({ ...f, selected_item_id: it.id, selected_item_name: it.name, override_cost_price: String(it.cost_price||''), override_selling_price: String(it.selling_price||'') }))
                        setMktItemSearch(it.name)
                        setMktItemResults([])
                      }} style={{ padding:'8px 12px', cursor:'pointer', fontSize:13, borderBottom:'1px solid #F1F5F9', display:'flex', justifyContent:'space-between', alignItems:'center' }}
                        onMouseEnter={e => (e.currentTarget.style.background='#F8FAFC')}
                        onMouseLeave={e => (e.currentTarget.style.background='#fff')}>
                        <span><strong>{it.name}</strong>{it.sku ? <span style={{ marginLeft:6, fontSize:11, color:'#64748B' }}>SKU: {it.sku}</span> : ''}</span>
                        <span style={{ fontSize:12, color:'#059669', fontWeight:600 }}>₹{it.cost_price} / ₹{it.selling_price}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {mktForm.selected_item_id && (
                <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:8, padding:'8px 12px', marginBottom:10, fontSize:13 }}>
                  ✅ Selected: <strong>{mktForm.selected_item_name}</strong>
                  <button onClick={() => { setMktForm((f: any) => ({ ...f, selected_item_id: '', selected_item_name: '' })); setMktItemSearch('') }}
                    style={{ marginLeft:10, fontSize:11, color:'#DC2626', background:'none', border:'none', cursor:'pointer' }}>✕ Clear</button>
                </div>
              )}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <label style={lbl}>New Cost Price (₹) *</label>
                  <input className="input" type="number" value={mktForm.override_cost_price}
                    onChange={e => setMktForm((f: any) => ({ ...f, override_cost_price: e.target.value }))} />
                </div>
                <div>
                  <label style={lbl}>New Sale Price (₹)</label>
                  <input className="input" type="number" value={mktForm.override_selling_price}
                    onChange={e => setMktForm((f: any) => ({ ...f, override_selling_price: e.target.value }))} />
                </div>
              </div>
            </div>
          )}

          {mktAction === 'add_new' && (
            <div style={{ maxHeight:360, overflowY:'auto', paddingRight:4, marginBottom:14 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div style={{ gridColumn:'1 / -1' }}>
                  <label style={lbl}>Part Name *</label>
                  <input className="input" value={mktForm.new_item_name}
                    onChange={e => setMktForm((f: any) => ({ ...f, new_item_name: e.target.value }))} />
                </div>
                <div>
                  <label style={lbl}>Cost Price (₹) *</label>
                  <input className="input" type="number" value={mktForm.new_cost_price}
                    onChange={e => setMktForm((f: any) => ({ ...f, new_cost_price: e.target.value }))} />
                </div>
                <div>
                  <label style={lbl}>Sale Price (₹) *</label>
                  <input className="input" type="number" value={mktForm.new_selling_price}
                    onChange={e => setMktForm((f: any) => ({ ...f, new_selling_price: e.target.value }))} />
                </div>
                <div>
                  <label style={lbl}>MRP (₹)</label>
                  <input className="input" type="number" value={mktForm.mrp}
                    onChange={e => setMktForm((f: any) => ({ ...f, mrp: +e.target.value }))} />
                </div>
                <div>
                  <label style={lbl}>SKU</label>
                  <input className="input" value={mktForm.sku}
                    onChange={e => setMktForm((f: any) => ({ ...f, sku: e.target.value }))} />
                </div>
                <div>
                  <label style={lbl}>Barcode</label>
                  <input className="input" value={mktForm.barcode}
                    onChange={e => setMktForm((f: any) => ({ ...f, barcode: e.target.value }))} />
                </div>
                <div>
                  <label style={lbl}>HSN Code</label>
                  <input className="input" value={mktForm.hsn_code}
                    onChange={e => setMktForm((f: any) => ({ ...f, hsn_code: e.target.value }))} />
                </div>
                <div>
                  <label style={lbl}>Unit *</label>
                  <select className="input" value={mktForm.unit}
                    onChange={e => setMktForm((f: any) => ({ ...f, unit: e.target.value }))}>
                    {['pcs','kg','ltr','m','set','pair','box','roll'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>GST %</label>
                  <select className="input" value={mktForm.gst_percent}
                    onChange={e => setMktForm((f: any) => ({ ...f, gst_percent: +e.target.value }))}>
                    {[0,5,12,18,28].map(g => <option key={g} value={g}>{g}%</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Brand</label>
                  <select className="input" value={mktForm.brand_id}
                    onChange={e => setMktForm((f: any) => ({ ...f, brand_id: e.target.value }))}>
                    <option value="">— No brand / generic —</option>
                    {brands.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                {/* Multi-category picker */}
                <div style={{ gridColumn:'1 / -1' }}>
                  <label style={lbl}>Categories <span style={{ fontWeight:400, color:'#64748B', fontSize:11 }}>(select all that apply)</span></label>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8, padding:'8px 12px', background:'#F8FAFC', borderRadius:8, border:'1px solid #E2E8F0' }}>
                    {categories.length === 0
                      ? <span style={{ fontSize:12, color:'#94A3B8' }}>No categories available.</span>
                      : categories.map((c: any) => {
                          const checked = (mktForm.category_ids||[]).includes(c.id)
                          return (
                            <label key={c.id} style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:20, cursor:'pointer', fontSize:13, fontWeight:checked?600:400, background:checked?'#DBEAFE':'#fff', border:`1px solid ${checked?'#3B82F6':'#E2E8F0'}`, color:checked?'#1D4ED8':'#334155', userSelect:'none' }}>
                              <input type="checkbox" checked={checked} style={{ display:'none' }}
                                onChange={e => setMktForm((f: any) => ({ ...f, category_ids: e.target.checked ? [...(f.category_ids||[]), c.id] : (f.category_ids||[]).filter((id: string) => id !== c.id) }))} />
                              <span style={{ fontSize:14 }}>{c.icon||'📦'}</span>{c.name}
                            </label>
                          )
                        })
                    }
                  </div>
                </div>
                <div style={{ gridColumn:'1 / -1' }}>
                  <label style={lbl}>Description</label>
                  <textarea className="input" rows={2} style={{ resize:'vertical' }} value={mktForm.description}
                    onChange={e => setMktForm((f: any) => ({ ...f, description: e.target.value }))} />
                </div>
                <div style={{ gridColumn:'1 / -1', display:'flex', gap:20 }}>
                  <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, cursor:'pointer' }}>
                    <input type="checkbox" checked={mktForm.is_consumable}
                      onChange={e => setMktForm((f: any) => ({ ...f, is_consumable: e.target.checked }))} /> Consumable
                  </label>
                  <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, cursor:'pointer' }}>
                    <input type="checkbox" checked={mktForm.is_serialised}
                      onChange={e => setMktForm((f: any) => ({ ...f, is_serialised: e.target.checked }))} /> Serialised
                  </label>
                </div>
              </div>
            </div>
          )}

          {mktAction === 'reject' && (
            <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, padding:12, marginBottom:14, fontSize:13, color:'#991B1B' }}>
              ❌ This part will be marked as rejected. No changes to the inventory catalogue will be made. The part is still recorded in the quotation.
            </div>
          )}

          {mktErr && <div style={{ color:'#DC2626', fontSize:13, marginBottom:8 }}>{mktErr}</div>}

          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setMktVerifyModal(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={mktSaving} onClick={async () => {
              setMktSaving(true); setMktErr('')
              try {
                const body: any = { action: mktAction }
                if (mktAction === 'link_and_update') {
                  if (!mktForm.selected_item_id) { setMktErr('Please search and select an existing part first'); setMktSaving(false); return }
                  if (!mktForm.override_cost_price) { setMktErr('New cost price is required'); setMktSaving(false); return }
                  body.inventory_item_id = mktForm.selected_item_id
                  body.override_cost_price = parseFloat(mktForm.override_cost_price)
                  if (mktForm.override_selling_price) body.override_selling_price = parseFloat(mktForm.override_selling_price)
                } else if (mktAction === 'add_new') {
                  if (!mktForm.new_item_name || !mktForm.new_cost_price || !mktForm.new_selling_price) { setMktErr('Part name, cost price and sale price are required'); setMktSaving(false); return }
                  body.new_item_name = mktForm.new_item_name
                  body.new_cost_price = parseFloat(mktForm.new_cost_price)
                  body.new_selling_price = parseFloat(mktForm.new_selling_price)
                  body.category_ids = mktForm.category_ids || []
                  body.sku = mktForm.sku || undefined
                  body.barcode = mktForm.barcode || undefined
                  body.brand_id = mktForm.brand_id || undefined
                  body.unit = mktForm.unit || 'pcs'
                  body.description = mktForm.description || undefined
                  body.hsn_code = mktForm.hsn_code || undefined
                  body.gst_percent = mktForm.gst_percent || 18
                  body.mrp = mktForm.mrp || undefined
                  body.is_consumable = mktForm.is_consumable || false
                  body.is_serialised = mktForm.is_serialised || false
                }
                await inventoryAPI.verifyMarketPurchase(mktVerifyModal.id, body)
                setMktVerifyModal(null)
                fetchMktPurchases()
              } catch (e: any) {
                setMktErr(e?.response?.data?.detail || 'Error verifying purchase')
              } finally { setMktSaving(false) }
            }}>
              {mktSaving ? 'Saving…' : mktAction === 'reject' ? '❌ Reject' : mktAction === 'add_new' ? '➕ Add to Catalogue' : '🔄 Link & Update Price'}
            </button>
          </div>
        </Modal>
      )}
      {/* ════════════ MODALS ════════════════════════════════════ */}

      {/* ── Create / Edit Item Modal ───────────────────────────── */}
      {itemModal && (
        <Modal title={itemModal==='new' ? '+ New Spare Part' : `Edit: ${(itemModal as Item).name}`} onClose={() => setItemModal(null)}>
          <form onSubmit={saveItem}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div style={{ gridColumn:'1 / -1' }}>
                <label style={lbl}>Part Name *</label>
                <input className={inp} value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name:e.target.value }))} required />
              </div>
              {[['SKU', 'sku', 'text'], ['Barcode', 'barcode', 'text'], ['HSN Code', 'hsn_code', 'text']].map(([l, k]) => (
                <div key={k}>
                  <label style={lbl}>{l}</label>
                  <input className={inp} value={(itemForm as any)[k]} onChange={e => setItemForm(f => ({ ...f, [k]:e.target.value }))} />
                </div>
              ))}

              {/* Multi-category picker */}
              <div style={{ gridColumn:'1 / -1' }}>
                <label style={lbl}>Categories <span style={{ fontWeight:400, color:'#64748B', fontSize:11 }}>(select all that apply)</span></label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8, padding:'8px 12px', background:'#F8FAFC', borderRadius:8, border:'1px solid #E2E8F0' }}>
                  {categories.length === 0
                    ? <span style={{ fontSize:12, color:'#94A3B8' }}>No categories — add from Services page first.</span>
                    : categories.map(c => {
                        const checked = (itemForm.category_ids||[]).includes(c.id)
                        return (
                          <label key={c.id} style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:20, cursor:'pointer', fontSize:13, fontWeight:checked?600:400, background:checked?'#DBEAFE':'#fff', border:`1px solid ${checked?'#3B82F6':'#E2E8F0'}`, color:checked?'#1D4ED8':'#334155', userSelect:'none' }}>
                            <input type="checkbox" checked={checked} style={{ display:'none' }} onChange={e => setItemForm(f => ({ ...f, category_ids: e.target.checked ? [...(f.category_ids||[]), c.id] : (f.category_ids||[]).filter(id => id !== c.id) }))} />
                            <span style={{ fontSize:14 }}>{c.icon||'📦'}</span>{c.name}
                          </label>
                        )
                      })
                  }
                </div>
              </div>

              <div>
                <label style={lbl}>Brand {brands.length===0 && <span style={{ fontWeight:400, fontSize:11, color:'#D97706', marginLeft:6 }}>— Add brands from Appliances page</span>}</label>
                <select className={inp} value={itemForm.brand_id} onChange={e => setItemForm(f => ({ ...f, brand_id:e.target.value }))}>
                  <option value="">— No brand / generic —</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Unit *</label>
                <select className={inp} value={itemForm.unit} onChange={e => setItemForm(f => ({ ...f, unit:e.target.value }))}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>GST %</label>
                <select className={inp} value={itemForm.gst_percent} onChange={e => setItemForm(f => ({ ...f, gst_percent:+e.target.value }))}>
                  {[0,5,12,18,28].map(g => <option key={g} value={g}>{g}%</option>)}
                </select>
              </div>
              {[['Cost Price ₹','cost_price'],['Sell Price ₹','selling_price'],['MRP ₹','mrp'],['Min Stock','min_stock_level'],['Reorder Qty','reorder_qty']].map(([l,k]) => (
                <div key={k}>
                  <label style={lbl}>{l}</label>
                  <input className={inp} type="number" min="0" value={(itemForm as any)[k]} onChange={e => setItemForm(f => ({ ...f, [k]:+e.target.value }))} />
                </div>
              ))}
            </div>

            <div style={{ marginBottom:12 }}>
              <label style={lbl}>Description</label>
              <textarea className={inp} rows={2} style={{ resize:'vertical' }} value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description:e.target.value }))} />
            </div>
            <div style={{ display:'flex', gap:20, marginBottom:16 }}>
              <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, cursor:'pointer' }}>
                <input type="checkbox" checked={itemForm.is_consumable} onChange={e => setItemForm(f => ({ ...f, is_consumable:e.target.checked }))} /> Consumable
              </label>
              <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, cursor:'pointer' }}>
                <input type="checkbox" checked={itemForm.is_serialised} onChange={e => setItemForm(f => ({ ...f, is_serialised:e.target.checked }))} /> Serialised
              </label>
            </div>

            {/* Opening stock section — only for new items */}
            {itemModal === 'new' && warehouses.length > 0 && (
              <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:10, padding:'12px 16px', marginBottom:16 }}>
                <div style={{ fontWeight:600, fontSize:13, color:'#166534', marginBottom:10 }}>📦 Opening Stock (optional)</div>
                <p style={{ fontSize:12, color:'#4B5563', marginBottom:12 }}>Set initial stock quantity per warehouse when creating this part. Leave 0 to skip.</p>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {warehouses.map(wh => {
                    const row = openingStocks.find(os => os.warehouse_id === wh.id)
                    const qty = row?.quantity || 0
                    return (
                      <div key={wh.id} style={{ display:'grid', gridTemplateColumns:'1fr 120px', gap:10, alignItems:'center' }}>
                        <label style={{ fontSize:13, fontWeight:500, color:'#374151' }}>
                          🏭 {wh.name}{wh.is_default ? <span style={{ fontSize:10, color:'#059669', marginLeft:6 }}>DEFAULT</span> : ''}
                        </label>
                        <input className={inp} type="number" min="0" value={qty}
                          onChange={e => {
                            const newQty = +e.target.value
                            setOpeningStocks(prev => {
                              const existing = prev.find(os => os.warehouse_id === wh.id)
                              if (existing) return prev.map(os => os.warehouse_id === wh.id ? { ...os, quantity: newQty } : os)
                              return [...prev, { warehouse_id: wh.id, quantity: newQty }]
                            })
                          }}
                          placeholder="0"
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {itemErr && <div style={{ background:'#FEE2E2', color:'#DC2626', padding:'8px 12px', borderRadius:6, fontSize:13, marginBottom:12 }}>{itemErr}</div>}
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-primary" type="submit" disabled={itemSaving}>{itemSaving ? <Spinner size="sm" /> : itemModal==='new' ? 'Create Part' : 'Save Changes'}</button>
              <button className="btn btn-secondary" type="button" onClick={() => setItemModal(null)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Adjust Stock Modal ───────────────────────────────────── */}
      {adjustModal && (
        <Modal title={`± Adjust Stock — ${adjustModal.name}`} onClose={() => setAdjustModal(null)}>
          <div style={{ background:'#F8FAFC', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:13 }}>
            Total stock: <strong>{adjustModal.current_stock} {adjustModal.unit}</strong> &nbsp;·&nbsp; Available: <strong>{adjustModal.available_stock}</strong>
          </div>
          <form onSubmit={saveAdjust}>
            <div style={{ marginBottom:12 }}>
              <label style={lbl}>Warehouse *</label>
              <select className={inp} value={adjustForm.warehouse_id} onChange={e => setAdjustForm(f => ({ ...f, warehouse_id:e.target.value }))} required>
                <option value="">Select warehouse</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}{w.is_default?' (default)':''}</option>)}
              </select>
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={lbl}>Quantity * <span style={{ fontWeight:400, color:'#64748B' }}>(positive = add, negative = reduce)</span></label>
              <input className={inp} type="number" value={adjustForm.quantity} onChange={e => setAdjustForm(f => ({ ...f, quantity:+e.target.value }))} required />
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={lbl}>Reason *</label>
              <input className={inp} value={adjustForm.reason} onChange={e => setAdjustForm(f => ({ ...f, reason:e.target.value }))} placeholder="e.g. Physical count correction, opening stock" required />
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={lbl}>Notes</label>
              <input className={inp} value={adjustForm.notes} onChange={e => setAdjustForm(f => ({ ...f, notes:e.target.value }))} />
            </div>
            {adjustErr && <div style={{ background:'#FEE2E2', color:'#DC2626', padding:'8px 12px', borderRadius:6, fontSize:13, marginBottom:12 }}>{adjustErr}</div>}
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-primary" type="submit" disabled={adjustSaving || !adjustForm.warehouse_id || !adjustForm.reason}>{adjustSaving ? <Spinner size="sm" /> : 'Apply Adjustment'}</button>
              <button className="btn btn-secondary" type="button" onClick={() => setAdjustModal(null)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Assign to Technician Modal ────────────────────────────── */}
      {assignModal && (
        <Modal title={`→ Assign to Technician — ${assignModal.name}`} onClose={() => setAssignModal(null)}>
          <div style={{ background:'#F0F9FF', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:13 }}>
            <div>Total item stock: <strong style={{ color:assignModal.available_stock===0?'#DC2626':'#059669' }}>{assignModal.available_stock} {assignModal.unit}</strong></div>
            {assignWhLoading && <div style={{ fontSize:11, color:'#64748B', marginTop:4 }}>Loading warehouse stock…</div>}
            {!assignWhLoading && Object.keys(whStockMap).length > 0 && (
              <div style={{ marginTop:6, display:'flex', gap:8, flexWrap:'wrap' }}>
                {warehouses.filter(w => whStockMap[w.id] !== undefined).map(w => (
                  <span key={w.id} style={{ fontSize:11, background: whStockMap[w.id]>0?'#DCFCE7':'#FEE2E2', color: whStockMap[w.id]>0?'#166534':'#DC2626', border:'1px solid', borderColor: whStockMap[w.id]>0?'#86EFAC':'#FECACA', borderRadius:4, padding:'2px 7px' }}>
                    {w.name}: <b>{whStockMap[w.id]}</b>
                  </span>
                ))}
              </div>
            )}
            {!assignWhLoading && Object.keys(whStockMap).length === 0 && assignModal.available_stock > 0 && (
              <div style={{ fontSize:11, color:'#F59E0B', marginTop:4 }}>⚠ No warehouse stock rows found. Stock may have been added directly to item master. Use Stock Adjustment to add stock to a warehouse first.</div>
            )}
          </div>
          <form onSubmit={saveAssign}>
            <div style={{ marginBottom:12 }}>
              <label style={lbl}>Technician *</label>
              <select className={inp} value={assignForm.technician_id} onChange={e => setAssignForm(f => ({ ...f, technician_id:e.target.value }))} required>
                <option value="">Select technician</option>
                {techList.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={lbl}>From Warehouse *</label>
              <select className={inp} value={assignForm.warehouse_id} onChange={e => setAssignForm(f => ({ ...f, warehouse_id:e.target.value }))} required>
                <option value="">Select warehouse</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}{whStockMap[w.id] !== undefined ? ` (available: ${whStockMap[w.id]})` : ''}</option>)}
              </select>
              {assignForm.warehouse_id && whStockMap[assignForm.warehouse_id] !== undefined && (
                <div style={{ fontSize:11, color: whStockMap[assignForm.warehouse_id]>0?'#059669':'#DC2626', marginTop:3 }}>
                  {whStockMap[assignForm.warehouse_id]>0
                    ? `✓ ${whStockMap[assignForm.warehouse_id]} ${assignModal.unit} available in this warehouse`
                    : `✗ No stock in this warehouse — please select another warehouse`}
                </div>
              )}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div>
                <label style={lbl}>Quantity *</label>
                <input className={inp} type="number" min="1" value={assignForm.quantity} onChange={e => setAssignForm(f => ({ ...f, quantity:+e.target.value }))} required />
              </div>
              <div>
                <label style={lbl}>Booking ID <span style={{ fontWeight:400 }}>(optional)</span></label>
                <input className={inp} value={assignForm.booking_id} onChange={e => setAssignForm(f => ({ ...f, booking_id:e.target.value }))} placeholder="Link to job" />
              </div>
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={lbl}>Notes</label>
              <input className={inp} value={assignForm.notes} onChange={e => setAssignForm(f => ({ ...f, notes:e.target.value }))} />
            </div>
            {assignErr && <div style={{ background:'#FEE2E2', color:'#DC2626', padding:'8px 12px', borderRadius:6, fontSize:13, marginBottom:12 }}>{assignErr}</div>}
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-primary" type="submit" disabled={assignSaving || (assignForm.warehouse_id ? (whStockMap[assignForm.warehouse_id]??assignModal.available_stock)<=0 : assignModal.available_stock===0)}>{assignSaving ? <Spinner size="sm" /> : 'Assign Stock'}</button>
              <button className="btn btn-secondary" type="button" onClick={() => setAssignModal(null)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Transfer (quick, single item) Modal ─────────────────── */}
      {transferModal && (
        <Modal title={`⇄ Move Stock — ${transferModal.name}`} onClose={() => setTransferModal(null)}>
          <p style={{ fontSize:13, color:'#64748B', marginBottom:14 }}>Move this part from one warehouse to another. A stock movement entry will be recorded in the ledger.</p>
          <form onSubmit={saveTransfer}>
            {[['From Warehouse *','from_warehouse_id'],['To Warehouse *','to_warehouse_id']].map(([label, key]) => (
              <div key={key} style={{ marginBottom:12 }}>
                <label style={lbl}>{label}</label>
                <select className={inp} value={(transferForm as any)[key]} onChange={e => setTransferForm(f => ({ ...f, [key]:e.target.value }))} required>
                  <option value="">Select warehouse</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}{w.is_default?' (default)':''}</option>)}
                </select>
              </div>
            ))}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div>
                <label style={lbl}>Quantity *</label>
                <input className={inp} type="number" min="1" value={transferForm.quantity} onChange={e => setTransferForm(f => ({ ...f, quantity:+e.target.value }))} required />
              </div>
              <div>
                <label style={lbl}>Reference No.</label>
                <input className={inp} value={transferForm.reference_no} onChange={e => setTransferForm(f => ({ ...f, reference_no:e.target.value }))} />
              </div>
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={lbl}>Notes</label>
              <input className={inp} value={transferForm.notes} onChange={e => setTransferForm(f => ({ ...f, notes:e.target.value }))} />
            </div>
            {transferErr && <div style={{ background:'#FEE2E2', color:'#DC2626', padding:'8px 12px', borderRadius:6, fontSize:13, marginBottom:12 }}>{transferErr}</div>}
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-primary" type="submit" disabled={transferSaving}>{transferSaving ? <Spinner size="sm" /> : 'Move Stock'}</button>
              <button className="btn btn-secondary" type="button" onClick={() => setTransferModal(null)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Transfer Challan Modal ─────────────────────────────── */}
      {challanModal && (
        <Modal title="⇄ Create Transfer Challan" onClose={() => setChallanModal(false)}>
          <p style={{ fontSize:13, color:'#64748B', marginBottom:14 }}>Move multiple spare parts from one warehouse to another or assign to a technician. A numbered challan document is generated for tracking and acknowledgement.</p>
          <form onSubmit={saveChallan}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div>
                <label style={lbl}>From Warehouse *</label>
                <select className="input" value={challanForm.from_warehouse_id} onChange={e => setChallanForm((f: any) => ({ ...f, from_warehouse_id:e.target.value }))} required>
                  <option value="">Select source warehouse</option>
                  {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>To Warehouse</label>
                <select className="input" value={challanForm.to_warehouse_id} onChange={e => setChallanForm((f: any) => ({ ...f, to_warehouse_id:e.target.value, to_technician_id:'' }))}>
                  <option value="">Select destination warehouse</option>
                  {warehouses.filter((w: any) => w.id !== challanForm.from_warehouse_id).map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>— OR — To Technician</label>
                <select className="input" value={challanForm.to_technician_id} onChange={e => setChallanForm((f: any) => ({ ...f, to_technician_id:e.target.value, to_warehouse_id:'' }))}>
                  <option value="">Select technician</option>
                  {techList.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Reference No.</label>
                <input className="input" value={challanForm.reference_no} onChange={e => setChallanForm((f: any) => ({ ...f, reference_no:e.target.value }))} placeholder="PO number / reference" />
              </div>
            </div>

            <div style={{ marginBottom:12 }}>
              <label style={{ ...lbl, marginBottom:8 }}>Parts to Transfer *</label>
              <div style={{ background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:8, padding:'10px 12px', display:'flex', flexDirection:'column', gap:8 }}>
                {challanForm.items.map((line: any, i: number) => (
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 90px 32px', gap:8 }}>
                    <select className="input" value={line.item_id} onChange={e => { const its=[...challanForm.items]; its[i]={...its[i],item_id:e.target.value}; setChallanForm((f: any) => ({ ...f, items:its })) }} required>
                      <option value="">Select part…</option>
                      {items.map((it: any) => <option key={it.id} value={it.id}>{it.name}{it.sku?` (${it.sku})`:''} — Stock: {it.current_stock} {it.unit}</option>)}
                    </select>
                    <input className="input" type="number" min="1" value={line.quantity} onChange={e => { const its=[...challanForm.items]; its[i]={...its[i],quantity:+e.target.value}; setChallanForm((f: any) => ({ ...f, items:its })) }} placeholder="Qty" required />
                    {challanForm.items.length > 1 && (
                      <button type="button" style={{ background:'#FEE2E2', border:'none', borderRadius:6, color:'#DC2626', cursor:'pointer', fontSize:18 }} onClick={() => setChallanForm((f: any) => ({ ...f, items:f.items.filter((_: any, j: number) => j !== i) }))}>×</button>
                    )}
                  </div>
                ))}
                <button type="button" style={{ fontSize:12, color:'#1B4FD8', background:'none', border:'none', cursor:'pointer', padding:0, textAlign:'left' }} onClick={() => setChallanForm((f: any) => ({ ...f, items:[...f.items, {item_id:'',quantity:1}] }))}>+ Add another part</button>
              </div>
            </div>

            <div style={{ marginBottom:16 }}>
              <label style={lbl}>Notes</label>
              <input className="input" value={challanForm.notes} onChange={e => setChallanForm((f: any) => ({ ...f, notes:e.target.value }))} placeholder="Optional dispatch notes" />
            </div>

            {challanErr && <div style={{ background:'#FEE2E2', color:'#DC2626', padding:'8px 12px', borderRadius:6, fontSize:13, marginBottom:12 }}>{challanErr}</div>}
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-primary" type="submit" disabled={challanSaving || !challanForm.from_warehouse_id || (!challanForm.to_warehouse_id && !challanForm.to_technician_id)}>
                {challanSaving ? <Spinner size="sm" /> : 'Generate Challan'}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => setChallanModal(false)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Receive Challan Modal ────────────────────────────────── */}
      {receiveModal && (
        <Modal title={`✓ Receive Challan — ${receiveModal.challan_no}`} onClose={() => setReceiveModal(null)}>
          <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:10, padding:'14px 16px', marginBottom:16 }}>
            <div style={{ fontWeight:600, fontSize:14, color:'#166534', marginBottom:8 }}>Challan Summary</div>
            <div style={{ fontSize:13, color:'#374151', marginBottom:4 }}>
              From: <strong>{warehouses.find(w => w.id === receiveModal.from_warehouse_id)?.name || '—'}</strong>
            </div>
            <div style={{ fontSize:13, color:'#374151', marginBottom:10 }}>
              To: <strong>{warehouses.find(w => w.id === receiveModal.to_warehouse_id)?.name || (receiveModal.to_technician_id ? 'Technician' : '—')}</strong>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {(receiveModal.items || []).map((it: any, i: number) => (
                <div key={i} style={{ fontSize:12, display:'flex', justifyContent:'space-between', background:'#fff', borderRadius:6, padding:'5px 10px' }}>
                  <span>{it.item_name}</span>
                  <span style={{ fontWeight:600 }}>× {it.quantity} {it.unit}</span>
                </div>
              ))}
            </div>
          </div>
          <p style={{ fontSize:13, color:'#64748B', marginBottom:16 }}>Confirm that all items have been physically received and counted. This action cannot be undone.</p>
          <div style={{ display:'flex', gap:10 }}>
            <button className="btn btn-primary" style={{ background:'#059669', borderColor:'#059669' }} disabled={receiveSaving} onClick={receiveChallan}>
              {receiveSaving ? <Spinner size="sm" /> : '✓ Confirm Receipt'}
            </button>
            <button className="btn btn-secondary" onClick={() => setReceiveModal(null)}>Cancel</button>
          </div>
        </Modal>
      )}

      {/* ── Direct Sale Modal ────────────────────────────────────── */}
      {saleModal && (
        <Modal title="🛒 Direct Part Sale" onClose={() => setSaleModal(false)}>
          <p style={{ fontSize:13, color:'#64748B', marginBottom:14 }}>Sell spare parts directly to a customer. Stock will be deducted from the selected warehouse.</p>
          <form onSubmit={async (e: any) => { e.preventDefault(); setSaleSaving(true); setSaleErr(''); try { await inventoryAPI.createDirectSale(saleForm); setSaleModal(false); const sr = await inventoryAPI.directSales(); setSales(sr.data.data?.items||[]) } catch (ex: any) { setSaleErr(ex.response?.data?.detail || 'Failed') } finally { setSaleSaving(false) } }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div>
                <label style={lbl}>Warehouse *</label>
                <select className="input" value={saleForm.warehouse_id} onChange={e => setSaleForm((f: any) => ({ ...f, warehouse_id:e.target.value }))} required>
                  <option value="">Select warehouse</option>
                  {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Payment Method</label>
                <select className="input" value={saleForm.payment_method} onChange={e => setSaleForm((f: any) => ({ ...f, payment_method:e.target.value }))}>
                  {['CASH','UPI','CARD','CREDIT'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Customer Name</label>
                <input className="input" value={saleForm.customer_name} onChange={e => setSaleForm((f: any) => ({ ...f, customer_name:e.target.value }))} placeholder="Walk-in customer name" />
              </div>
              <div>
                <label style={lbl}>Mobile</label>
                <input className="input" value={saleForm.customer_mobile} onChange={e => setSaleForm((f: any) => ({ ...f, customer_mobile:e.target.value }))} placeholder="Customer mobile" />
              </div>
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={{ ...lbl, marginBottom:8 }}>Parts to Sell *</label>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {saleForm.items.map((line: any, i: number) => (
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 70px 90px 32px', gap:8 }}>
                    <select className="input" value={line.item_id} onChange={e => { const its=[...saleForm.items]; const it=items.find((x: any) => x.id===e.target.value); its[i]={...its[i],item_id:e.target.value,unit_price:it?.selling_price||0}; setSaleForm((f: any) => ({ ...f, items:its })) }} required>
                      <option value="">Select part</option>
                      {items.map((it: any) => <option key={it.id} value={it.id}>{it.name} — {inr(it.selling_price)}</option>)}
                    </select>
                    <input className="input" type="number" min="1" value={line.quantity} onChange={e => { const its=[...saleForm.items]; its[i]={...its[i],quantity:+e.target.value}; setSaleForm((f: any) => ({ ...f, items:its })) }} placeholder="Qty" required />
                    <input className="input" type="number" min="0" value={line.unit_price} onChange={e => { const its=[...saleForm.items]; its[i]={...its[i],unit_price:+e.target.value}; setSaleForm((f: any) => ({ ...f, items:its })) }} placeholder="Price" required />
                    {saleForm.items.length > 1 && <button type="button" style={{ background:'#FEE2E2', border:'none', borderRadius:6, color:'#DC2626', cursor:'pointer', fontSize:18 }} onClick={() => setSaleForm((f: any) => ({ ...f, items:f.items.filter((_: any, j: number) => j !== i) }))}>×</button>}
                  </div>
                ))}
                <button type="button" style={{ fontSize:12, color:'#1B4FD8', background:'none', border:'none', cursor:'pointer', padding:0, textAlign:'left' }} onClick={() => setSaleForm((f: any) => ({ ...f, items:[...f.items, {item_id:'',quantity:1,unit_price:0}] }))}>+ Add part</button>
              </div>
            </div>
            {saleErr && <div style={{ background:'#FEE2E2', color:'#DC2626', padding:'8px 12px', borderRadius:6, fontSize:13, marginBottom:12 }}>{saleErr}</div>}
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-primary" type="submit" disabled={saleSaving}>{saleSaving ? <Spinner size="sm" /> : 'Record Sale'}</button>
              <button className="btn btn-secondary" type="button" onClick={() => setSaleModal(false)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Warehouse Modal (create/edit) ────────────────────────── */}
      {whModal && (
        <Modal title={whModal==='new' ? 'New Warehouse' : `Edit: ${(whModal as Warehouse).name}`} onClose={() => setWhModal(null)}>
          <form onSubmit={async e => { e.preventDefault(); setWhSaving(true); try { if (whModal==='new') await inventoryAPI.createWarehouse(whForm); else await inventoryAPI.updateWarehouse((whModal as Warehouse).id, whForm); setWhModal(null); const r = await inventoryAPI.warehouses(); setWarehouses(r.data.data||[]) } catch (ex: any) { setWhErr(ex.response?.data?.detail||'Failed to save warehouse') } finally { setWhSaving(false) } }}>
            {[['Name *','name','text'],['Code','code','text'],['City','city','text'],['Phone','phone','text']].map(([l,k,t]) => (
              <div key={k} style={{ marginBottom:12 }}>
                <label style={lbl}>{l}</label>
                <input className={inp} type={t} value={(whForm as any)[k]} onChange={e => setWhForm(f => ({ ...f, [k]:e.target.value }))} {...(l.includes('*')?{required:true}:{})} />
              </div>
            ))}
            <div style={{ marginBottom:12 }}>
              <label style={lbl}>Address</label>
              <textarea className={inp} rows={2} value={whForm.address} onChange={e => setWhForm(f => ({ ...f, address:e.target.value }))} />
            </div>
            <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer', marginBottom:16 }}>
              <input type="checkbox" checked={whForm.is_default} onChange={e => setWhForm(f => ({ ...f, is_default:e.target.checked }))} /> Set as default warehouse
            </label>
            {whErr && <div style={{ background:'#FEE2E2', color:'#DC2626', padding:'8px 12px', borderRadius:6, fontSize:13, marginBottom:12 }}>{whErr}</div>}
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-primary" type="submit" disabled={whSaving}>{whSaving ? <Spinner size="sm" /> : whModal==='new' ? 'Create' : 'Save'}</button>
              <button className="btn btn-secondary" type="button" onClick={() => { setWhModal(null); setWhErr('') }}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Warehouse Stock View Modal ───────────────────────────── */}
      {whStockModal && (
        <Modal title={`📦 Stock — ${whStockModal.name}`} onClose={() => setWhStockModal(null)}>
          {whStockLoading ? <div style={{ textAlign:'center', padding:32 }}><Spinner /></div> : (
            <table className="data-table">
              <thead><tr><th>Part</th><th>SKU</th><th>Unit</th><th>Qty</th><th>Reserved</th><th>Available</th><th>Status</th></tr></thead>
              <tbody>
                {whStockData.length === 0
                  ? <tr><td colSpan={7} style={{ textAlign:'center', color:'#94A3B8', padding:32 }}>No stock in this warehouse yet.<br />Use ± Adjust on any part to add opening stock.</td></tr>
                  : whStockData.map((s: WhStock) => (
                    <tr key={s.item_id}>
                      <td style={{ fontWeight:500 }}>{s.item_name}</td>
                      <td style={{ fontFamily:'monospace', fontSize:12 }}>{s.sku || '—'}</td>
                      <td>{s.unit}</td>
                      <td style={{ fontWeight:700 }}>{s.quantity}</td>
                      <td style={{ color:'#D97706' }}>{s.reserved_qty || 0}</td>
                      <td style={{ fontWeight:700, color:s.available<=0?'#DC2626':'#059669' }}>{s.available}</td>
                      <td>{s.is_low_stock ? <span className="badge status-INACTIVE">Low</span> : <span className="badge status-ACTIVE">OK</span>}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </Modal>
      )}


      {/* ── Purchase Order Modal ───────────────────────────────── */}
      {poModal && (
        <Modal title="📦 New Purchase Order" onClose={() => setPoModal(false)}>
          <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:10, padding:'12px 16px', marginBottom:16, fontSize:13, color:'#166534' }}>
            <strong>Stock will be immediately added</strong> to the selected warehouse and recorded in the movement ledger with type PURCHASE.
          </div>
          <form onSubmit={async (e: any) => {
            e.preventDefault(); setPoSaving(true); setPoErr('')
            try {
              await inventoryAPI.createPurchaseOrder(poForm)
              setPoModal(false)
              fetchPurchases()
              fetchItems(page)
            } catch (ex: any) { setPoErr(ex.response?.data?.detail || 'Failed to create purchase order') }
            finally { setPoSaving(false) }
          }}>
            {/* Warehouse (required) */}
            <div style={{ marginBottom:12 }}>
              <label style={lbl}>Destination Warehouse * <span style={{ fontWeight:400, color:'#64748B', fontSize:11 }}>(stock will be added here)</span></label>
              <select className="input" value={poForm.warehouse_id} onChange={(e: any) => setPoForm((f: any) => ({ ...f, warehouse_id:e.target.value }))} required>
                <option value="">Select warehouse</option>
                {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}{w.is_default?' (default)':''}</option>)}
              </select>
            </div>

            {/* Vendor */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div>
                <label style={lbl}>Vendor <span style={{ fontWeight:400, fontSize:11, color:'#64748B' }}>(optional)</span></label>
                {vendors.length > 0
                  ? <select className="input" value={poForm.vendor_id} onChange={(e: any) => {
                      const v = vendors.find((x: any) => x.id === e.target.value)
                      setPoForm((f: any) => ({ ...f, vendor_id:e.target.value, vendor_name:v?.name||'' }))
                    }}>
                      <option value="">Walk-in / Market purchase</option>
                      {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  : <input className="input" placeholder="Vendor name" value={poForm.vendor_name} onChange={(e: any) => setPoForm((f: any) => ({ ...f, vendor_name:e.target.value }))} />
                }
              </div>
              <div>
                <label style={lbl}>Vendor Invoice No.</label>
                <input className="input" value={poForm.vendor_invoice_no} onChange={(e: any) => setPoForm((f: any) => ({ ...f, vendor_invoice_no:e.target.value }))} placeholder="e.g. INV-2024-001" />
              </div>
            </div>

            {/* Line items */}
            <div style={{ marginBottom:12 }}>
              <label style={{ ...lbl, marginBottom:8 }}>Parts Received *</label>
              <div style={{ background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:8, padding:'10px 12px' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 110px 32px', gap:8, marginBottom:6 }}>
                  <span style={{ fontSize:11, fontWeight:600, color:'#64748B' }}>PART</span>
                  <span style={{ fontSize:11, fontWeight:600, color:'#64748B' }}>QTY</span>
                  <span style={{ fontSize:11, fontWeight:600, color:'#64748B' }}>UNIT COST ₹</span>
                  <span></span>
                </div>
                {poForm.items.map((line: any, i: number) => {
                  const selItem = items.find((it: any) => it.id === line.item_id)
                  return (
                    <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 80px 110px 32px', gap:8, marginBottom:8 }}>
                      <select className="input" value={line.item_id}
                        onChange={(e: any) => {
                          const it = items.find((x: any) => x.id === e.target.value)
                          const its = [...poForm.items]
                          its[i] = { ...its[i], item_id:e.target.value, unit_cost:it?.cost_price||0 }
                          setPoForm((f: any) => ({ ...f, items:its }))
                        }} required>
                        <option value="">Select part…</option>
                        {items.map((it: any) => (
                          <option key={it.id} value={it.id}>{it.name}{it.sku?` (${it.sku})`:''}</option>
                        ))}
                      </select>
                      <input className="input" type="number" min="1" value={line.quantity}
                        onChange={(e: any) => { const its=[...poForm.items]; its[i]={...its[i],quantity:+e.target.value}; setPoForm((f: any) => ({ ...f, items:its })) }}
                        placeholder="Qty" required />
                      <input className="input" type="number" min="0" step="0.01" value={line.unit_cost}
                        onChange={(e: any) => { const its=[...poForm.items]; its[i]={...its[i],unit_cost:+e.target.value}; setPoForm((f: any) => ({ ...f, items:its })) }}
                        placeholder="₹0.00" />
                      {poForm.items.length > 1 && (
                        <button type="button" style={{ background:'#FEE2E2', border:'none', borderRadius:6, color:'#DC2626', cursor:'pointer', fontSize:18, lineHeight:1 }}
                          onClick={() => setPoForm((f: any) => ({ ...f, items:f.items.filter((_: any, j: number) => j !== i) }))}>×</button>
                      )}
                    </div>
                  )
                })}

                {/* Running total */}
                {poForm.items.some((l: any) => l.item_id && l.quantity > 0) && (
                  <div style={{ borderTop:'1px solid #E2E8F0', paddingTop:8, marginTop:4, display:'flex', justifyContent:'flex-end', gap:16, fontSize:13 }}>
                    {(() => {
                      const sub = poForm.items.reduce((s: number, l: any) => s + (l.quantity||0) * (l.unit_cost||0), 0)
                      const gst = sub * 0.18
                      return <>
                        <span>Subtotal: <strong>{inr(sub)}</strong></span>
                        <span style={{ color:'#D97706' }}>~GST 18%: <strong>{inr(gst)}</strong></span>
                        <span style={{ color:'#059669', fontWeight:700 }}>Total: <strong>{inr(sub + gst)}</strong></span>
                      </>
                    })()}
                  </div>
                )}

                <button type="button"
                  style={{ fontSize:12, color:'#1B4FD8', background:'none', border:'none', cursor:'pointer', padding:'4px 0 0', display:'block' }}
                  onClick={() => setPoForm((f: any) => ({ ...f, items:[...f.items, {item_id:'',quantity:1,unit_cost:0}] }))}>
                  + Add another part
                </button>
              </div>
            </div>

            {/* Cost price update option */}
            <div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:8, padding:'10px 14px', marginBottom:12 }}>
              <label style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer' }}>
                <input type="checkbox" checked={poForm.update_cost_price} style={{ marginTop:2 }}
                  onChange={(e: any) => setPoForm((f: any) => ({ ...f, update_cost_price:e.target.checked }))} />
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'#92400E' }}>Update cost price using weighted average</div>
                  <div style={{ fontSize:11, color:'#78350F', marginTop:2, lineHeight:1.4 }}>
                    When checked: recalculates the part's standard cost price as a weighted average of existing stock cost + this purchase cost.<br />
                    <strong>Selling price and MRP are never changed</strong> — update those separately on the item master.
                  </div>
                </div>
              </label>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div>
                <label style={lbl}>Payment Method</label>
                <select className="input" value={poForm.payment_method} onChange={(e: any) => setPoForm((f: any) => ({ ...f, payment_method:e.target.value }))}>
                  {['CASH','UPI','CARD','BANK_TRANSFER','CREDIT'].map((m: string) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Notes</label>
                <input className="input" value={poForm.notes} onChange={(e: any) => setPoForm((f: any) => ({ ...f, notes:e.target.value }))} placeholder="Optional notes" />
              </div>
            </div>

            {poErr && <div style={{ background:'#FEE2E2', color:'#DC2626', padding:'8px 12px', borderRadius:6, fontSize:13, marginBottom:12 }}>{poErr}</div>}
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-primary" type="submit"
                disabled={poSaving || !poForm.warehouse_id || poForm.items.every((l: any) => !l.item_id)}>
                {poSaving ? <Spinner size="sm" /> : '📦 Record Purchase & Update Stock'}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => setPoModal(false)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Category Modal ───────────────────────────────────────── */}
      {catModal && (
        <Modal title={catModal==='new' ? 'New Category' : `Edit: ${(catModal as Category).name}`} onClose={() => setCatModal(null)}>
          <form onSubmit={async e => { e.preventDefault(); setCatSaving(true); try { if (catModal==='new') await inventoryAPI.createCategory(catForm); else await inventoryAPI.updateCategory((catModal as Category).id, catForm); setCatModal(null); fetchItems(page) } catch {} finally { setCatSaving(false) } }}>
            <div style={{ marginBottom:12 }}>
              <label style={lbl}>Name *</label>
              <input className={inp} value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name:e.target.value }))} required />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div>
                <label style={lbl}>Icon (emoji)</label>
                <input className={inp} value={catForm.icon} onChange={e => setCatForm(f => ({ ...f, icon:e.target.value }))} placeholder="🔧 ❄️ ⚡" />
              </div>
              <div>
                <label style={lbl}>Sort Order</label>
                <input className={inp} type="number" value={catForm.sort_order} onChange={e => setCatForm(f => ({ ...f, sort_order:+e.target.value }))} />
              </div>
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={lbl}>Description</label>
              <input className={inp} value={catForm.description} onChange={e => setCatForm(f => ({ ...f, description:e.target.value }))} />
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-primary" type="submit" disabled={catSaving}>{catSaving ? <Spinner size="sm" /> : catModal==='new' ? 'Create' : 'Save'}</button>
              <button className="btn btn-secondary" type="button" onClick={() => setCatModal(null)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
