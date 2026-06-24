import { create } from 'zustand'
interface AuthState {
  token: string | null; user: any | null; isAuthenticated: boolean
  login: (token: string, user: any) => void; logout: () => void
}
export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('access_token'),
  user: null,
  isAuthenticated: !!localStorage.getItem('access_token'),
  login: (token, user) => { localStorage.setItem('access_token', token); set({ token, user, isAuthenticated: true }) },
  logout: () => { localStorage.removeItem('access_token'); set({ token: null, user: null, isAuthenticated: false }) },
}))
