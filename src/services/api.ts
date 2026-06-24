import axios from 'axios'

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  'http://localhost:8000/api/v1'

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('access_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Auth ───────────────────────────────────────────────────────
export const authAPI = {
  login:          (email: string, password: string) => api.post('/auth/login', { email, password }),
  profile:        ()                                => api.get('/auth/profile'),
  updateProfile:  (d: any)                          => api.put('/auth/profile', d),
  changePassword: (d: any)                          => api.post('/auth/change-password', d),
}

// ── Analytics / Dashboard ──────────────────────────────────────
export const analyticsAPI = {
  dashboard: ()              => api.get('/analytics/dashboard'),
  revenue:   (period = 'monthly') => api.get(`/analytics/revenue?period=${period}`),
  bookings:  (p?: any)       => api.get('/analytics/bookings', { params: p }),
}

// ── Bookings ───────────────────────────────────────────────────
export const bookingsAPI = {
  list:       (params?: any)                     => api.get('/bookings', { params }),
  get:        (id: string)                       => api.get(`/bookings/${id}`),
  create:     (d: any)                           => api.post('/bookings', d),
  update:     (id: string, d: any)               => api.put(`/bookings/${id}`, d),
  cancel:     (id: string, reason: string)       => api.post(`/bookings/${id}/cancel`, { reason }),
  reschedule: (id: string, d: any)               => api.post(`/bookings/${id}/reschedule`, d),
  assign:     (id: string, technician_id: string) => api.post(`/bookings/${id}/assign`, { technician_id }),
  verify:     (id: string)                       => api.post(`/bookings/${id}/verify`, {}),
  accept:     (id: string)                       => api.post(`/bookings/${id}/accept`, {}),
  reject:     (id: string, d: any)               => api.post(`/bookings/${id}/reject`, d),
  arrived:    (id: string)                       => api.post(`/bookings/${id}/arrived`, {}),
  startInspection: (id: string)                  => api.post(`/bookings/${id}/start-inspection`, {}),
  startWork:  (id: string)                       => api.post(`/bookings/${id}/start-work`, {}),
  pauseWork:  (id: string)                       => api.post(`/bookings/${id}/pause-work`, {}),
  resumeWork: (id: string)                       => api.post(`/bookings/${id}/resume-work`, {}),
  completeWork: (id: string)                     => api.post(`/bookings/${id}/complete-work`, {}),
  timeline:   (id: string)                       => api.get(`/bookings/${id}/timeline`),
  markInvoiceGenerated: (id: string)             => api.post(`/bookings/${id}/mark-invoice-generated`, {}),
  markPaymentPending:   (id: string)             => api.post(`/bookings/${id}/mark-payment-pending`, {}),
  markPaid:             (id: string)             => api.post(`/bookings/${id}/mark-paid`, {}),
  commissionPreview:    (id: string)             => api.get(`/bookings/${id}/commission-preview`),
  settleBooking:        (id: string, payload: any) => api.post(`/bookings/${id}/settle`, payload),
  closeBooking:         (id: string, commission_pct?: number, notes?: string) =>
                          api.post(`/bookings/${id}/close`, {}, { params: { commission_pct: commission_pct || 20, notes } }),
  approveQuotation:     (id: string, quotation_id?: string) =>
                          api.post(`/bookings/${id}/approve-quotation`, {}, { params: quotation_id ? { quotation_id } : {} }),
}

// ── Customers ──────────────────────────────────────────────────
export const customersAPI = {
  list:          (params?: any)        => api.get('/customers', { params }),
  get:           (id: string)          => api.get(`/customers/${id}`),
  create:        (d: any)              => api.post('/customers', d),
  update:        (id: string, d: any)  => api.put(`/customers/${id}`, d),
  deactivate:    (id: string)          => api.delete(`/customers/${id}`),
  bookings:      (id: string)          => api.get(`/customers/${id}/bookings`),
  history:       (id: string)          => api.get(`/customers/${id}/history`),
  payments:      (id: string)          => api.get(`/customers/${id}/payments`),
  addresses:     (id: string)          => api.get(`/customers/${id}/addresses`),
  addAddress:    (id: string, d: any)  => api.post(`/customers/${id}/addresses`, d),
  updateAddress: (id: string, aId: string, d: any) => api.put(`/customers/${id}/addresses/${aId}`, d),
  deleteAddress: (id: string, aId: string)         => api.delete(`/customers/${id}/addresses/${aId}`),
  checkMobile:   (mobile: string)      => api.get(`/customers/check-mobile/${mobile}`),
  appliances:    (id: string)          => api.get(`/appliances/customer/${id}`),
}

// ── Technicians ────────────────────────────────────────────────
export const techniciansAPI = {
  list:              (params?: any)                       => api.get('/technicians', { params }),
  get:               (id: string)                         => api.get(`/technicians/${id}`),
  create:            (d: any)                             => api.post('/technicians', d),
  update:            (id: string, d: any)                 => api.put(`/technicians/${id}`, d),
  deactivate:        (id: string)                         => api.delete(`/technicians/${id}`),
  skills:            (id: string)                         => api.get(`/technicians/${id}/skills`),
  addSkill:          (id: string, d: any)                 => api.post(`/technicians/${id}/skills`, d),
  removeSkill:       (id: string, skillId: string)        => api.delete(`/technicians/${id}/skills/${skillId}`),
  ratings:           (id: string)                         => api.get(`/technicians/${id}/ratings`),
  performance:       (id: string)                         => api.get(`/technicians/${id}/performance`),
  availability:      (id: string)                         => api.get(`/technicians/${id}/availability`),
  setAvailability:   (id: string, d: any)                 => api.put(`/technicians/${id}/availability`, d),
  updateProfileImage:(id: string, url: string)            => api.put(`/technicians/${id}/profile-image`, { profile_image: url }),
  updateDocuments:   (id: string, d: any)                 => api.put(`/technicians/${id}/documents`, d),
}

// ── Services ───────────────────────────────────────────────────
export const servicesAPI = {
  list:           (params?: any)        => api.get('/services', { params }),
  search:         (q: string, params?: any) => api.get('/services', { params: { ...params, search: q, visible_only: false, per_page: 500 } }),
  get:            (id: string)          => api.get(`/services/${id}`),
  create:         (d: any)              => api.post('/services', d),
  update:         (id: string, d: any)  => api.put(`/services/${id}`, d),
  delete:         (id: string)          => api.delete(`/services/${id}`),
  categories:     ()                    => api.get('/services/categories'),
  createCategory: (d: any)              => api.post('/services/categories', d),
  updateCategory: (id: string, d: any)  => api.put(`/services/categories/${id}`, d),
  deleteCategory: (id: string)          => api.delete(`/services/categories/${id}`),
  cityPrices:     (serviceId: string)   => api.get(`/services/${serviceId}/city-prices`),
}

// ── Assignments ────────────────────────────────────────────────
export const assignmentsAPI = {
  auto:    (d: any)              => api.post('/assignments/auto', d),
  manual:  (d: any)              => api.post('/assignments/manual', d),
  history: (bookingId: string)   => api.get(`/assignments/history/${bookingId}`),
  rules:   ()                    => api.get('/assignments/rules'),
  updateRules: (d: any)          => api.put('/assignments/rules', d),
}

// ── Quotations ─────────────────────────────────────────────────
export const quotationsAPI = {
  list:       (params?: any)        => api.get('/quotations', { params }),
  get:        (id: string)          => api.get(`/quotations/${id}`),
  create:     (d: any)              => api.post('/quotations', d),
  update:     (id: string, d: any)  => api.put(`/quotations/${id}`, d),
  delete:     (id: string)          => api.delete(`/quotations/${id}`),
  submit:     (id: string)          => api.post(`/quotations/${id}/submit`, {}),
  approve:    (id: string)          => api.post(`/quotations/${id}/approve`, {}),
  reject:     (id: string, d: any)  => api.post(`/quotations/${id}/reject`, d),
  revise:     (id: string, d: any)  => api.post(`/quotations/${id}/revise`, d),
  revertToDraft: (id: string)        => api.post(`/quotations/${id}/revert-to-draft`, {}),
  history:    (id: string)          => api.get(`/quotations/${id}/history`),
  addService:    (id: string, d: any)                    => api.post(`/quotations/${id}/services`, d),
  updateService: (id: string, itemId: string, d: any)   => api.put(`/quotations/${id}/services/${itemId}`, d),
  deleteService: (id: string, itemId: string)           => api.delete(`/quotations/${id}/services/${itemId}`),
  addPart:       (id: string, d: any)                    => api.post(`/quotations/${id}/parts`, d),
  updatePart:    (id: string, partId: string, d: any)   => api.put(`/quotations/${id}/parts/${partId}`, d),
  deletePart:    (id: string, partId: string)           => api.delete(`/quotations/${id}/parts/${partId}`),
  discount:      (id: string, d: any)                    => api.post(`/quotations/${id}/discount`, d),
  applyCoupon:   (id: string, coupon_code: string)       => api.post(`/quotations/${id}/apply-coupon`, { coupon_code }),
  adjustment:    (id: string, d: any)                    => api.post(`/quotations/${id}/adjustment`, d),
  // Appliance management in quotation
  listAppliances:   (id: string)       => api.get(`/quotations/${id}/appliances`),
  addAppliance:     (id: string, d: any) => api.post(`/quotations/${id}/appliances`, d),
  removeAppliance:  (id: string, label: string) => api.delete(`/quotations/${id}/appliances/${encodeURIComponent(label)}`),
  markRepeat:       (id: string, d: any) => api.post(`/quotations/${id}/appliances/repeat`, d),
  repeatCheck:      (quotationId: string, customerId: string) => api.get(`/quotations/${quotationId}/repeat-check/${customerId}`),
}

// ── Invoices ───────────────────────────────────────────────────
export const invoicesAPI = {
  list:      (params?: any) => api.get('/invoices', { params }),
  get:       (id: string)   => api.get(`/invoices/${id}`),
  create:    (d: any)       => api.post('/invoices', d),
  pdf:       (id: string)   => api.get(`/invoices/${id}/pdf`, { responseType: 'blob' }),
  email:     (id: string)   => api.post(`/invoices/${id}/email`, {}),
  whatsapp:  (id: string)   => api.post(`/invoices/${id}/whatsapp`, {}),
}

// ── Payments ───────────────────────────────────────────────────
export const paymentsAPI = {
  history:      (params?: any) => api.get('/payments/history', { params }),
  createOrder:  (d: any)       => api.post('/payments/order', d),
  verify:       (d: any)       => api.post('/payments/verify', d),
  cash:         (d: any)       => api.post('/payments/cash', d),
  bankTransfer: (d: any)       => api.post('/payments/bank-transfer', d),
  generateLink: (d: any)       => api.post('/payments/link', d),
  generateQR:   (d: any)       => api.post('/payments/qr', d),
}

// ── Cash Collections ───────────────────────────────────────────
export const cashCollectionsAPI = {
  list:          (params?: any)                => api.get('/cash-collections', { params }),
  summary:       (status?: string)             => api.get('/cash-collections/summary', { params: status ? { status } : {} }),
  forTechnician: (techId: string, status?: string) =>
                   api.get(`/cash-collections/technician/${techId}`, { params: status ? { status } : {} }),
  markCollected: (id: string, d: any)          => api.post(`/cash-collections/${id}/collect`, d),
  collectAll:    (techId: string, d: any)      => api.post(`/cash-collections/technician/${techId}/collect-all`, d),
}

// ── Inventory ──────────────────────────────────────────────────
export const inventoryAPI = {
  // Items
  list:             (params?: any)        => api.get('/inventory', { params }),
  search:           (q: string, p?: any)  => api.get('/inventory', { params: { search: q, per_page: 50, ...p } }),
  pendingVerify:    ()                    => api.get('/inventory', { params: { pending_verify: true, per_page: 100 } }),
  verifyItem:       (id: string)          => api.post(`/inventory/${id}/verify`),
  get:              (id: string)          => api.get(`/inventory/${id}`),
  create:           (d: any)              => api.post('/inventory', d),
  update:           (id: string, d: any)  => api.put(`/inventory/${id}`, d),
  deactivate:       (id: string)          => api.delete(`/inventory/${id}`),
  lowStock:         ()                    => api.get('/inventory/low-stock'),
  stockSummary:     (params?: any)        => api.get('/inventory/stock', { params }),

  // Categories
  categories:       ()                    => api.get('/inventory/categories'),
  createCategory:   (d: any)             => api.post('/inventory/categories', d),
  updateCategory:   (id: string, d: any) => api.put(`/inventory/categories/${id}`, d),

  // Brands
  brands:           ()                    => api.get('/inventory/brands'),

  // Warehouses
  warehouses:       ()                    => api.get('/inventory/warehouses'),
  createWarehouse:  (d: any)             => api.post('/inventory/warehouses', d),
  updateWarehouse:  (id: string, d: any) => api.put(`/inventory/warehouses/${id}`, d),
  warehouseStock:   (id: string, p?: any)=> api.get(`/inventory/warehouses/${id}/stock`, { params: p }),

  // Stock movements
  opening:          (d: any)             => api.post('/inventory/opening', d),
  adjust:           (d: any)             => api.post('/inventory/adjust', d),
  transfer:         (d: any)             => api.post('/inventory/transfer', d),
  assignTech:       (d: any)             => api.post('/inventory/assign-tech', d),
  returnTech:       (d: any)             => api.post('/inventory/return-tech', d),
  consume:          (d: any)             => api.post('/inventory/consume', d),
  damage:           (d: any)             => api.post('/inventory/damage', d),
  movements:        (params?: any)       => api.get('/inventory/movements', { params }),

  // Technician stock
  techStock:        (techId: string)     => api.get(`/inventory/technician/${techId}`),
  itemWarehouseStock: (itemId: string)    => api.get(`/inventory/item-warehouse-stock/${itemId}`),
  techStockHistory: (techId: string, p?: any) => api.get(`/inventory/technician/${techId}/history`, { params: p }),

  // Reorder
  reorderRules:     ()                   => api.get('/inventory/reorder-rules'),
  upsertReorderRule:(d: any)             => api.post('/inventory/reorder-rules', d),

  // Challans
  challans:         (p?: any)      => api.get('/inventory/challans', { params: p }),
  getChallan:       (id: string)   => api.get(`/inventory/challans/${id}`),
  createChallan:    (d: any)       => api.post('/inventory/challans', d),
  receiveChallan:   (id: string, d: any) => api.post(`/inventory/challans/${id}/receive`, d),
  // Direct sales
  directSales:      (p?: any)      => api.get('/inventory/direct-sales', { params: p }),
  createDirectSale: (d: any)       => api.post('/inventory/direct-sale', d),
  // Purchase Orders
  purchaseOrders:    (p?: any)      => api.get('/inventory/purchase-orders', { params: p }),
  getPurchaseOrder:  (id: string)   => api.get(`/inventory/purchase-orders/${id}`),
  createPurchaseOrder: (d: any)     => api.post('/inventory/purchase-orders', d),

  // Booking parts
  bookingParts:     (bookingId: string) => api.get(`/inventory/booking-parts/${bookingId}`),
  bookingConsume:   (d: any)       => api.post('/inventory/booking-consume', d),
}

// ── Commissions ────────────────────────────────────────────────
export const commissionsAPI = {
  list:              (params?: any)                        => api.get('/commissions', { params }),
  rules:             ()                                    => api.get('/commissions/rules'),
  createRule:        (d: any)                              => api.post('/commissions/rules', d),
  approve:           (id: string, notes?: string)           => api.post(`/commissions/${id}/approve`, { notes }),
  pay:               (id: string)                          => api.post(`/commissions/${id}/pay`, {}),
  bulkApprove:       (ids: string[])                       => api.post('/commissions/bulk-approve', { ids }),
  bulkPay:           (ids: string[])                       => api.post('/commissions/bulk-pay', { ids }),

  // Commission Groups
  listGroups:        ()                                    => api.get('/commissions/groups'),
  createGroup:       (d: any)                              => api.post('/commissions/groups', d),
  getGroup:          (id: string)                          => api.get(`/commissions/groups/${id}`),
  updateGroup:       (id: string, d: any)                  => api.put(`/commissions/groups/${id}`, d),
  deleteGroup:       (id: string)                          => api.delete(`/commissions/groups/${id}`),
  assignTechnician:  (groupId: string, techId: string)     => api.post(`/commissions/groups/${groupId}/assign`, { technician_id: techId }),
  removeAssignment:  (groupId: string, techId: string)     => api.delete(`/commissions/groups/${groupId}/assign/${techId}`),
  groupsForTech:     (techId: string)                      => api.get(`/commissions/groups-for-technician/${techId}`),
  // Part commission rules
  listPartRules:     (groupId: string)                        => api.get(`/commissions/groups/${groupId}/part-rules`),
  addPartRule:       (groupId: string, d: any)                => api.post(`/commissions/groups/${groupId}/part-rules`, d),
  updatePartRule:    (groupId: string, ruleId: string, d: any) => api.put(`/commissions/groups/${groupId}/part-rules/${ruleId}`, d),
  deletePartRule:    (groupId: string, ruleId: string)        => api.delete(`/commissions/groups/${groupId}/part-rules/${ruleId}`),
}

// ── Wallet ─────────────────────────────────────────────────────
export const walletAPI = {
  all:              (params?: any)                  => api.get('/wallet', { params }),
  me:               ()                              => api.get('/wallet/me'),
  myTransactions:   (params?: any)                  => api.get('/wallet/me/transactions', { params }),
  transactions:     (walletId: string, params?: any) => api.get(`/wallet/${walletId}/transactions`, { params }),
  credit:           (d: any)                        => api.post('/wallet/credit', d),
  debit:            (d: any)                        => api.post('/wallet/debit', d),
  withdraw:         (d: any)                        => api.post('/wallet/withdraw', d),
}

// ── CRM ────────────────────────────────────────────────────────
export const crmAPI = {
  customers:  (params?: any) => api.get('/crm/customers', { params }),
  followups:  (params?: any) => api.get('/crm/followups', { params }),
  tasks:      (params?: any) => api.get('/crm/tasks', { params }),
}

// ── AMC ────────────────────────────────────────────────────────
export const amcAPI = {
  plans:            ()               => api.get('/amc/plans'),
  createPlan:       (d: any)         => api.post('/amc/plans', d),
  subscriptions:    (params?: any)   => api.get('/amc/subscriptions', { params }),
  byCustomer:       (cid: string)    => api.get(`/amc/customer/${cid}`),
  renewals:         ()               => api.get('/amc/renewals'),
}

// ── Warranty ───────────────────────────────────────────────────
export const warrantyAPI = {
  list:   (params?: any) => api.get('/warranty', { params }),
  claims: (params?: any) => api.get('/warranty/claims', { params }),
}

// ── Notifications ──────────────────────────────────────────────
export const notificationsAPI = {
  list:      (params?: any) => api.get('/notifications', { params }),
  send:      (d: any)       => api.post('/notifications/send', d),
  bulk:      (d: any)       => api.post('/notifications/bulk', d),
  templates: ()             => api.get('/notifications/templates'),
  markRead:  (id: string)   => api.patch(`/notifications/${id}/read`, {}),
}

// ── Reports ────────────────────────────────────────────────────
export const reportsAPI = {
  revenue:   (params?: any) => api.get('/reports/revenue', { params }),
  gst:       (params?: any) => api.get('/reports/gst', { params }),
  customers: (params?: any) => api.get('/reports/customers', { params }),
}

// ── GST ────────────────────────────────────────────────────────
export const gstAPI = {
  settings:   ()        => api.get('/gst/settings'),
  update:     (d: any)  => api.put('/gst/settings', d),
  validate:   (gstin: string) => api.post('/gst/validate', { gstin }),
  report:     (params?: any)  => api.get('/gst/report', { params }),
}

// ── Tracking ───────────────────────────────────────────────────
export const trackingAPI = {
  technicianLocation: (id: string)     => api.get(`/tracking/technician/${id}`),
  bookingTracking:    (id: string)     => api.get(`/tracking/booking/${id}`),
}

// ── Cities & Areas ─────────────────────────────────────────────
export const citiesAPI = {
  list:          (params?: any)                            => api.get('/cities', { params }),
  search:        (q: string)                               => api.get('/cities/search', { params: { q } }),
  get:           (id: string)                              => api.get(`/cities/${id}`),
  create:        (d: any)                                  => api.post('/cities', d),
  update:        (id: string, d: any)                      => api.put(`/cities/${id}`, d),
  deactivate:    (id: string)                              => api.delete(`/cities/${id}`),
  areas:         (id: string, zoneId?: string)             => api.get(`/cities/${id}/areas`, { params: zoneId ? { zone_id: zoneId } : {} }),
  createArea:    (id: string, d: any)                      => api.post(`/cities/${id}/areas`, d),
  bulkAreas:     (id: string, d: any)                      => api.post(`/cities/${id}/areas/bulk`, d),
  updateArea:    (cityId: string, areaId: string, d: any)  => api.put(`/cities/${cityId}/areas/${areaId}`, d),
  deleteArea:    (cityId: string, areaId: string)          => api.delete(`/cities/${cityId}/areas/${areaId}`),
  zones:         (id: string)                              => api.get(`/cities/${id}/zones`),
  createZone:    (id: string, d: any)                      => api.post(`/cities/${id}/zones`, d),
  pricing:       (id: string)                              => api.get(`/cities/${id}/pricing`),
  updatePricing: (id: string, d: any)                      => api.put(`/cities/${id}/pricing`, d),
  settings:      (id: string)                              => api.get(`/cities/${id}/settings`),
  updateSettings:(id: string, d: any)                      => api.put(`/cities/${id}/settings`, d),
}

// ── Domains ────────────────────────────────────────────────────
export const domainsAPI = {
  list:            (params?: any)                    => api.get('/domains', { params }),
  get:             (id: string)                      => api.get(`/domains/${id}`),
  create:          (d: any)                          => api.post('/domains', d),
  update:          (id: string, d: any)              => api.put(`/domains/${id}`, d),
  deactivate:      (id: string)                      => api.delete(`/domains/${id}`),
  services:        (id: string)                      => api.get(`/domains/${id}/services`),
  linkService:     (id: string, d: any)              => api.post(`/domains/${id}/services`, d),
  bulkLinkServices:(id: string, service_ids: string[]) => api.post(`/domains/${id}/services/bulk`, { service_ids }),
  unlinkService:   (id: string, dsId: string)        => api.delete(`/domains/${id}/services/${dsId}`),
  toggleFeatured:  (id: string, dsId: string)        => api.patch(`/domains/${id}/services/${dsId}`, {}),
  categories:      (id: string)                      => api.get(`/domains/${id}/categories`),
  linkCategory:    (id: string, d: any)              => api.post(`/domains/${id}/categories`, d),
  unlinkCategory:  (id: string, dcId: string)        => api.delete(`/domains/${id}/categories/${dcId}`),
  seo:             (id: string)                      => api.get(`/domains/${id}/seo`),
  updateSeo:       (id: string, d: any)              => api.put(`/domains/${id}/seo`, d),
  profile:         (id: string)                      => api.get(`/domains/${id}/profile`),
  updateProfile:   (id: string, d: any)              => api.put(`/domains/${id}/profile`, d),
}

// ── Service City Pricing ────────────────────────────────────────
export const servicePricingAPI = {
  cityPrices:    (serviceId: string)          => api.get(`/services/${serviceId}/city-prices`),
  setCityPrice:  (serviceId: string, d: any)  => api.post(`/services/${serviceId}/city-prices`, d),
  updateCityPrice: (id: string, d: any)       => api.put(`/services/city-prices/${id}`, d),
}

// ── Coupons ────────────────────────────────────────────────────
export const couponsAPI = {
  list:     (params?: any)        => api.get('/coupons', { params }),
  create:   (d: any)              => api.post('/coupons', d),
  update:   (id: string, d: any)  => api.put(`/coupons/${id}`, d),
  delete:   (id: string)          => api.delete(`/coupons/${id}`),
  validate: (d: any)              => api.post('/coupons/validate', d),
}

// ── Escalations ────────────────────────────────────────────────
export const escalationsAPI = {
  list:    (params?: any) => api.get('/escalations', { params }),
  get:     (id: string)   => api.get(`/escalations/${id}`),
  resolve: (id: string, d: any) => api.post(`/escalations/${id}/resolve`, d),
}

// ── Vendors ────────────────────────────────────────────────────
export const vendorsAPI = {
  list:   (params?: any) => api.get('/vendors', { params }),
  get:    (id: string)   => api.get(`/vendors/${id}`),
  create: (d: any)       => api.post('/vendors', d),
  update: (id: string, d: any) => api.put(`/vendors/${id}`, d),
}

// ── Attendance ─────────────────────────────────────────────────
export const attendanceAPI = {
  list:     (params?: any) => api.get('/attendance', { params }),
  checkIn:  (d: any)       => api.post('/attendance/check-in', d),
  checkOut: (d: any)       => api.post('/attendance/check-out', d),
}

// ── Leaves ─────────────────────────────────────────────────────
export const leavesAPI = {
  list:   (params?: any)        => api.get('/leave', { params }),
  apply:  (d: any)              => api.post('/leave', d),
  review: (id: string, d: any)  => api.post(`/leave/${id}/review`, d),
}

// ── Refunds ────────────────────────────────────────────────────
export const refundsAPI = {
  list:    (params?: any)        => api.get('/refunds', { params }),
  create:  (d: any)              => api.post('/refunds', d),
  approve: (id: string, d?: any) => api.post(`/refunds/${id}/approve`, d || {}),
  process: (id: string, d: any)  => api.post(`/refunds/${id}/process`, d),
}

// ── Appliances ─────────────────────────────────────────────────
export const appliancesAPI = {
  // Catalogue — public
  categories:      ()                  => api.get('/appliances/categories'),
  brands:          (params?: any)      => api.get('/appliances/brands', { params }),
  types:           (params?: any)      => api.get('/appliances/types', { params }),
  domainCatalogue: (slug: string)      => api.get(`/appliances/domain/${slug}`),
  // Brand CRUD
  createBrand:     (d: any)            => api.post('/appliances/brands', d),
  updateBrand:     (id: string, d: any) => api.put(`/appliances/brands/${id}`, d),
  // Type CRUD
  createType:      (d: any)            => api.post('/appliances/types', d),
  updateType:      (id: string, d: any) => api.put(`/appliances/types/${id}`, d),
  // Customer appliance CRUD
  list:            (params?: any)      => api.get('/appliances', { params }),
  get:             (id: string)        => api.get(`/appliances/${id}`),
  add:             (d: any)            => api.post('/appliances', d),
  update:          (id: string, d: any) => api.put(`/appliances/${id}`, d),
  remove:          (id: string)        => api.delete(`/appliances/${id}`),
  byCustomer:      (cid: string)       => api.get(`/appliances/customer/${cid}`),
  // Sub-resources
  history:         (id: string, params?: any) => api.get(`/appliances/${id}/history`, { params }),
  warranty:        (id: string)        => api.get(`/appliances/${id}/warranty`),
  amc:             (id: string)        => api.get(`/appliances/${id}/amc`),
}

// ── SLA ────────────────────────────────────────────────────────
export const slaAPI = {
  policies:     ()           => api.get('/sla/policies'),
  createPolicy: (d: any)     => api.post('/sla/policies', d),
  breaches:     (params?: any) => api.get('/sla/breaches', { params }),
}

// ── Audit Logs ─────────────────────────────────────────────────
export const auditAPI = {
  list: (params?: any) => api.get('/audit', { params }),
}

// ── Franchises ─────────────────────────────────────────────────
export const franchisesAPI = {
  list:   (params?: any)        => api.get('/franchises', { params }),
  get:    (id: string)          => api.get(`/franchises/${id}`),
  create: (d: any)              => api.post('/franchises', d),
  update: (id: string, d: any)  => api.put(`/franchises/${id}`, d),
}

// ── Admin Users / Roles / Permissions ──────────────────────────
export const usersAPI = {
  list:            (params?: any)        => api.get('/users', { params }),
  get:             (id: string)          => api.get(`/users/${id}`),
  create:          (d: any)              => api.post('/users', d),
  update:          (id: string, d: any)  => api.put(`/users/${id}`, d),
  deactivate:      (id: string)          => api.delete(`/users/${id}`),
  roles:           ()                    => api.get('/users/roles'),
  permissions:     ()                    => api.get('/users/permissions'),
  rolePermissions: (roleId: string)      => api.get(`/users/roles/${roleId}/permissions`),
  assignRole:      (userId: string, d: any) => api.post(`/users/${userId}/role`, d),
}

// ── System Settings ────────────────────────────────────────────
export const settingsAPI = {
  general:            ()        => api.get('/settings/general'),
  updateGeneral:      (d: any)  => api.put('/settings/general', d),
  payment:            ()        => api.get('/settings/payment'),
  updatePayment:      (d: any)  => api.put('/settings/payment', d),
  notification:       ()        => api.get('/settings/notification'),
  updateNotification: (d: any)  => api.put('/settings/notification', d),
  security:           ()        => api.get('/settings/security'),
  updateSecurity:     (d: any)  => api.put('/settings/security', d),
  cloudinary:         ()        => api.get('/settings/cloudinary'),
  updateCloudinary:   (d: any)  => api.put('/settings/cloudinary', d),
  group:              (g: string)        => api.get(`/settings/group/${g}`),
  updateGroup:        (g: string, d: any) => api.put(`/settings/group/${g}`, d),
  platform:           ()        => api.get('/settings/platform'),
  updatePlatform:     (d: any)  => api.put('/settings/platform', d),
  platformPublic:     ()        => api.get('/settings/platform/public'),
  profileComplete:    ()        => api.get('/settings/profile-complete'),
}
