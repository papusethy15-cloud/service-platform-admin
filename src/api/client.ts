import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

export const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("access_token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// ── AUTH ─────────────────────────────────────────────────────
export const authAPI = {
  login: (email: string, password: string) => api.post("/auth/login", { email, password }),
  profile: () => api.get("/auth/profile"),
};

// ── DASHBOARD SUMMARY ────────────────────────────────────────
export const dashboardAPI = {
  bookings: (params?: object) => api.get("/bookings", { params }),
  customers: (params?: object) => api.get("/customers", { params }),
  technicians: (params?: object) => api.get("/technicians", { params }),
  services: (params?: object) => api.get("/services", { params }),
  revenue: (params?: object) => api.get("/reports/revenue", { params }),
  gstReport: (params?: object) => api.get("/reports/gst", { params }),
};

// ── CUSTOMERS ────────────────────────────────────────────────
export const customersAPI = {
  list: (p?: object) => api.get("/customers", { params: p }),
  get: (id: string) => api.get(`/customers/${id}`),
  create: (d: object) => api.post("/customers", d),
  update: (id: string, d: object) => api.put(`/customers/${id}`, d),
  delete: (id: string) => api.delete(`/customers/${id}`),
  bookings: (id: string) => api.get(`/customers/${id}/bookings`),
  history: (id: string) => api.get(`/customers/${id}/history`),
};

// ── BOOKINGS ─────────────────────────────────────────────────
export const bookingsAPI = {
  list: (p?: object) => api.get("/bookings", { params: p }),
  get: (id: string) => api.get(`/bookings/${id}`),
  update: (id: string, d: object) => api.put(`/bookings/${id}`, d),
  assign: (id: string, d: object) => api.post(`/bookings/${id}/assign`, d),
  cancel: (id: string, d: object) => api.post(`/bookings/${id}/cancel`, d),
  timeline: (id: string) => api.get(`/bookings/${id}/timeline`),
};

// ── TECHNICIANS ───────────────────────────────────────────────
export const techniciansAPI = {
  list: (p?: object) => api.get("/technicians", { params: p }),
  get: (id: string) => api.get(`/technicians/${id}`),
  create: (d: object) => api.post("/technicians", d),
  update: (id: string, d: object) => api.put(`/technicians/${id}`, d),
  deactivate: (id: string) => api.delete(`/technicians/${id}`),
  performance: (id: string) => api.get(`/technicians/${id}/performance`),
};

// ── SERVICES ─────────────────────────────────────────────────
export const servicesAPI = {
  list: () => api.get("/services"),
  create: (d: object) => api.post("/services", d),
  update: (id: string, d: object) => api.put(`/services/${id}`, d),
  delete: (id: string) => api.delete(`/services/${id}`),
  categories: () => api.get("/services/categories"),
};

// ── INVENTORY ────────────────────────────────────────────────
export const inventoryAPI = {
  items: (p?: object) => api.get("/inventory/items", { params: p }),
  createItem: (d: object) => api.post("/inventory/items", d),
  stock: () => api.get("/inventory/stock"),
  ledger: () => api.get("/inventory/ledger"),
};

// ── REPORTS ──────────────────────────────────────────────────
export const reportsAPI = {
  revenue: (p?: object) => api.get("/reports/revenue", { params: p }),
  gst: (p?: object) => api.get("/reports/gst", { params: p }),
  customer: (p?: object) => api.get("/reports/customer", { params: p }),
};
