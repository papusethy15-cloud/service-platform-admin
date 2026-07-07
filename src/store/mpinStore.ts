// src/store/mpinStore.ts
// Tracks whether the MPIN auto-lock feature is enabled/configured, and
// whether the dashboard is currently locked. "locked" is mirrored to
// localStorage so a page refresh while locked does NOT bypass the lock
// screen — the admin must always re-enter the MPIN to get back in.
import { create } from 'zustand'
import { settingsAPI } from '@/services/api'

const LOCK_KEY = 'admin_dashboard_locked'

interface MpinState {
  enabled: boolean
  configured: boolean
  locked: boolean
  loaded: boolean
  loadStatus: () => Promise<void>
  setLocked: (v: boolean) => void
  verify: (mpin: string) => Promise<boolean>
}

export const useMpinStore = create<MpinState>((set, get) => ({
  enabled: false,
  configured: false,
  locked: localStorage.getItem(LOCK_KEY) === '1',
  loaded: false,

  loadStatus: async () => {
    try {
      const r = await settingsAPI.mpinStatus()
      const { enabled, configured } = r.data?.data || {}
      set({ enabled: !!enabled, configured: !!configured, loaded: true })
      // If the feature got disabled server-side while a lock was pending
      // (e.g. another admin turned it off), don't leave the dashboard stuck.
      if (!enabled && get().locked) {
        localStorage.removeItem(LOCK_KEY)
        set({ locked: false })
      }
    } catch {
      set({ loaded: true })
    }
  },

  setLocked: (v: boolean) => {
    if (v) localStorage.setItem(LOCK_KEY, '1')
    else localStorage.removeItem(LOCK_KEY)
    set({ locked: v })
  },

  verify: async (mpin: string) => {
    try {
      const r = await settingsAPI.mpinVerify(mpin)
      const valid = !!r.data?.data?.valid
      if (valid) {
        localStorage.removeItem(LOCK_KEY)
        set({ locked: false })
      }
      return valid
    } catch {
      return false
    }
  },
}))
