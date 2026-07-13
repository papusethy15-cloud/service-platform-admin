import { create } from 'zustand'

interface AuthState {
  token: string | null
  user: any | null
  isAuthenticated: boolean
  freshLogin: boolean          // true only after a real login(), cleared on reload
  login: (token: string, user: any) => void
  logout: () => void
  idleLogout: () => void
}

function decodeUserFromToken(token: string | null): any | null {
  if (!token) return null
  try {
    const payload = token.split('.')[1]
    const base64  = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json    = decodeURIComponent(
      atob(base64).split('').map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
    )
    const decoded = JSON.parse(json)
    // Merge JWT claims with any persisted user profile (e.g. name) stored on login
    const persisted = (() => { try { return JSON.parse(localStorage.getItem('admin_user') || '{}') } catch { return {} } })()
    return { user_id: decoded.sub, role: decoded.role, exp: decoded.exp, ...persisted }
  } catch {
    return null
  }
}

// On page load: check if the persisted token is already expired.
// If so, clear it immediately so PrivateRoute redirects to /login
// without needing a reload.
function getInitialToken(): string | null {
  const t = localStorage.getItem('access_token')
  if (!t) return null
  try {
    const decoded = decodeUserFromToken(t)
    if (decoded?.exp && decoded.exp * 1000 < Date.now()) {
      // Token expired — clear storage and treat as logged out
      localStorage.removeItem('access_token')
      localStorage.removeItem('admin_last_active')
      localStorage.removeItem('admin_user')
      localStorage.setItem('admin_session_expired', '1')
      return null
    }
  } catch { /* ignore */ }
  return t
}

const persistedToken = getInitialToken()

export const useAuthStore = create<AuthState>((set) => ({
  token:           persistedToken,
  user:            decodeUserFromToken(persistedToken),
  isAuthenticated: !!persistedToken,
  freshLogin:      false,   // never true on reload — only set by login()

  login: (token, user) => {
    localStorage.setItem('access_token', token)
    localStorage.setItem('admin_last_active', Date.now().toString())
    // Persist non-sensitive profile fields so they survive reload
    const profile = { name: user?.name, email: user?.email }
    localStorage.setItem('admin_user', JSON.stringify(profile))
    set({ token, user: { ...decodeUserFromToken(token), ...profile }, isAuthenticated: true, freshLogin: true })
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('admin_last_active')
    localStorage.removeItem('admin_user')
    set({ token: null, user: null, isAuthenticated: false, freshLogin: false })
  },

  idleLogout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('admin_user')
    localStorage.setItem('admin_last_active', '0')
    localStorage.setItem('admin_session_expired', '1')
    set({ token: null, user: null, isAuthenticated: false, freshLogin: false })
  },
}))
