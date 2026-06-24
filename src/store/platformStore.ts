/**
 * platformStore — global platform branding settings
 * Loaded once after login and used throughout the app.
 */
import { create } from 'zustand'
import { settingsAPI } from '@/services/api'

export interface PlatformSettings {
  app_name:      string
  tagline:       string
  logo_url:      string
  favicon_url:   string
  primary_color: string
  support_email: string
  support_phone: string
  address:       string
  website_url:   string
  gst_number:    string
  currency:      string
  timezone:      string
}

const DEFAULTS: PlatformSettings = {
  app_name:      'Palei Solutions',
  tagline:       'Home Services Platform',
  logo_url:      '',
  favicon_url:   '',
  primary_color: '#1B4FD8',
  support_email: 'support@palei.in',
  support_phone: '',
  address:       '',
  website_url:   '',
  gst_number:    '',
  currency:      'INR',
  timezone:      'Asia/Kolkata',
}

interface PlatformState {
  settings:    PlatformSettings
  loaded:      boolean
  loading:     boolean
  profileComplete: boolean
  missingFields:   string[]
  load:        () => Promise<void>
  update:      (s: Partial<PlatformSettings>) => void
}

export const usePlatformStore = create<PlatformState>((set, get) => ({
  settings:        DEFAULTS,
  loaded:          false,
  loading:         false,
  profileComplete: false,
  missingFields:   [],

  load: async () => {
    if (get().loading) return
    set({ loading: true })
    try {
      const r = await settingsAPI.profileComplete()
      const d = r.data?.data
      set({
        settings:        { ...DEFAULTS, ...d.settings },
        profileComplete: d.complete,
        missingFields:   d.missing || [],
        loaded:          true,
      })
      // Apply favicon if set
      const fav = d.settings?.favicon_url
      if (fav) {
        const link = (document.getElementById('app-favicon') || document.createElement('link')) as HTMLLinkElement
        link.id   = 'app-favicon'
        link.type = 'image/x-icon'
        link.rel  = 'shortcut icon'
        link.href = fav
        if (!link.parentNode) document.head.appendChild(link)
      }
      // Apply page title
      if (d.settings?.app_name) {
        document.title = d.settings.app_name + ' — Admin'
      }
    } catch {
      set({ loaded: true, profileComplete: false })
    } finally {
      set({ loading: false })
    }
  },

  update: (s) => set(st => ({ settings: { ...st.settings, ...s } })),
}))
