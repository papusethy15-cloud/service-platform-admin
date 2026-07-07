import { create } from 'zustand'

interface AuthState {
  token: string | null
  user: any | null
  isAuthenticated: boolean
  login: (token: string, user: any) => void
  logout: () => void
  idleLogout: () => void
}

/**
 * BUG FIX: `user` (and therefore `user.role`) was never persisted to
 * localStorage -- only the JWT `token` was. On a hard page reload (e.g.
 * navigating straight to /customers, or just hitting refresh) the store
 * re-initializes with `user: null`, so anything gated on `user.role`
 * (like admin-only action buttons) silently disappears even though the
 * person is still fully logged in. Decode the role straight out of the
 * persisted JWT on store init so role-gated UI survives a refresh without
 * needing an extra profile API call.
 */
function decodeUserFromToken(token: string | null): any | null {
  if (!token) return null
  try {
    const payload = token.split('.')[1]
    // base64url -> base64
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    )
    const decoded = JSON.parse(json)
    // Token claims are { sub, role, exp } -- shape this like the login
    // response's user object (user_id, role) so existing `user.role` /
    // `user.user_id` reads elsewhere keep working.
    return { user_id: decoded.sub, role: decoded.role }
  } catch {
    return null
  }
}

const persistedToken = localStorage.getItem('access_token')

export const useAuthStore = create<AuthState>((set) => ({
  token: persistedToken,
  user: decodeUserFromToken(persistedToken),
  isAuthenticated: !!persistedToken,

  login: (token, user) => {
    localStorage.setItem('access_token', token)
    // Record login time so idle timer has a reference point
    localStorage.setItem('admin_last_active', Date.now().toString())
    set({ token, user, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('admin_last_active')
    set({ token: null, user: null, isAuthenticated: false })
  },

  // Called by idle timer — same as logout but keeps a flag so
  // the login page can show "Session expired" message
  idleLogout: () => {
    localStorage.removeItem('access_token')
    localStorage.setItem('admin_last_active', '0') // sentinel = session expired
    localStorage.setItem('admin_session_expired', '1')
    set({ token: null, user: null, isAuthenticated: false })
  },
}))
