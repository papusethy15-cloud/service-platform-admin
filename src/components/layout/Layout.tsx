import { ReactNode, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { usePlatformStore } from '@/store/platformStore'
import PlatformSetupWizard from '@/components/ui/PlatformSetupWizard'
import { useAuthStore } from '@/store/authStore'
import { useMpinStore } from '@/store/mpinStore'
import { useIdleTimeout } from '@/hooks/useIdleTimeout'
import MpinLockScreen from '@/components/ui/MpinLockScreen'

// 10 minutes of inactivity → auto-lock (only while MPIN auto-lock is enabled)
const MPIN_IDLE_TIMEOUT_MS = 10 * 60 * 1000

export default function Layout({ children }: { children: ReactNode }) {
  const { load, loaded, profileComplete } = usePlatformStore()
  const { isAuthenticated, idleLogout } = useAuthStore()
  const { enabled: mpinEnabled, locked, setLocked, loadStatus } = useMpinStore()
  const navigate = useNavigate()

  useEffect(() => { load() }, [load])

  // Load MPIN feature status once authenticated (and whenever auth changes —
  // e.g. a fresh login after a previous logout).
  useEffect(() => {
    if (isAuthenticated) loadStatus()
  }, [isAuthenticated, loadStatus])

  // ── Daily session expiry — logs out at 11:59 PM ────────────────────────────
  // The session itself no longer expires after a short idle period. Instead
  // it stays valid for the full working day and is force-logged-out at
  // 11:59 PM local time (or immediately scheduled for the *next* 11:59 PM if
  // somehow logging in after that time has already passed today).
  useEffect(() => {
    if (!isAuthenticated) return
    const now = new Date()
    const expiry = new Date(now)
    expiry.setHours(23, 59, 0, 0)
    if (expiry.getTime() <= now.getTime()) expiry.setDate(expiry.getDate() + 1)
    const ms = expiry.getTime() - now.getTime()

    const timer = setTimeout(() => {
      idleLogout()
      navigate('/login', { replace: true })
    }, ms)
    return () => clearTimeout(timer)
  }, [isAuthenticated, idleLogout, navigate])

  // ── MPIN auto-lock — 10 minutes of inactivity ───────────────────────────────
  // Only active when the admin has enabled MPIN auto-lock in
  // Settings → MPIN. Locking (unlike the daily expiry above) does NOT log
  // the admin out — it shows a full-screen MPIN modal over the dashboard.
  // The 10-minute window is measured from the last user action (mouse,
  // keyboard, touch, scroll), same as before.
  const handleIdle = useCallback(() => {
    if (mpinEnabled) setLocked(true)
  }, [mpinEnabled, setLocked])

  useIdleTimeout({
    timeoutMs: MPIN_IDLE_TIMEOUT_MS,
    onIdle: handleIdle,
    enabled: isAuthenticated && mpinEnabled,
  })
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#F8FAFC' }}>
      <Sidebar />
      {/* Main content area — offset by sidebar width */}
      <div style={{ marginLeft: 220, flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <Topbar />
        <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {children}
        </main>
      </div>

      {/* Platform setup wizard — blocks access until profile is complete */}
      {loaded && !profileComplete && <PlatformSetupWizard />}

      {/* MPIN auto-lock overlay — shown after 10 idle minutes when enabled */}
      {isAuthenticated && mpinEnabled && locked && <MpinLockScreen />}
    </div>
  )
}
