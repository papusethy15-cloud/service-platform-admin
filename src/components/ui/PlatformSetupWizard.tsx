/**
 * PlatformSetupWizard — blocking modal shown when platform profile is incomplete.
 * Admin must fill app_name, support_email, and upload a logo before accessing the dashboard.
 */
import { useState } from 'react'
import { settingsAPI } from '@/services/api'
import { usePlatformStore } from '@/store/platformStore'
import Spinner from '@/components/ui/Spinner'
import CloudinaryImageUploader from '@/components/ui/CloudinaryImageUploader'

export default function PlatformSetupWizard() {
  const { settings, load } = usePlatformStore()
  const [form, setForm] = useState({
    app_name:      settings.app_name || '',
    tagline:       settings.tagline  || '',
    support_email: settings.support_email || '',
    support_phone: settings.support_phone || '',
    logo_url:      settings.logo_url  || '',
    favicon_url:   settings.favicon_url || '',
    primary_color: settings.primary_color || '#1B4FD8',
    address:       settings.address || '',
    website_url:   settings.website_url || '',
    gst_number:    settings.gst_number || '',
  })
  const [saving, setSaving]   = useState(false)
  const [err,    setErr]      = useState('')
  const [step,   setStep]     = useState(1)

  const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const canProceedStep1 = form.app_name.trim().length >= 2 && form.support_email.includes('@')
  const canSave = canProceedStep1

  const save = async () => {
    if (!canSave) return
    setSaving(true); setErr('')
    try {
      await settingsAPI.updatePlatform(form)
      await load()   // reload store — profileComplete will become true, wizard closes
    } catch (e: any) {
      setErr(e.response?.data?.detail || 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 13px', borderRadius: 8, border: '1.5px solid #E2E8F0',
    fontSize: 14, outline: 'none', boxSizing: 'border-box', color: '#0F172A',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(10,15,30,0.85)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff', borderRadius: 18, width: '100%', maxWidth: 560,
        boxShadow: '0 24px 60px rgba(0,0,0,0.25)', overflow: 'hidden',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,#1B4FD8,#7C3AED)', padding: '28px 32px 24px', color: '#fff' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🚀</div>
          <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 6 }}>Welcome! Set Up Your Platform</div>
          <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.5 }}>
            Complete your platform profile to start using the admin dashboard. This takes less than 2 minutes.
          </div>
          {/* Steps */}
          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            {[1, 2].map(s => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: s < step || step === s ? 'default' : 'default' }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: step >= s ? '#fff' : 'rgba(255,255,255,0.25)',
                  color: step >= s ? '#1B4FD8' : 'rgba(255,255,255,0.7)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 12,
                }}>{s < step ? '✓' : s}</div>
                <span style={{ fontSize: 12, opacity: step >= s ? 1 : 0.6 }}>
                  {s === 1 ? 'Basic Info' : 'Branding'}
                </span>
                {s < 2 && <span style={{ color: 'rgba(255,255,255,0.4)', margin: '0 2px' }}>›</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
          {step === 1 && (
            <>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Platform / Business Name <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input style={inp} value={form.app_name}
                  onChange={e => update('app_name', e.target.value)}
                  placeholder="e.g. Bibek Enterprises" />
                <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>This appears throughout the admin dashboard.</p>
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Tagline
                </label>
                <input style={inp} value={form.tagline}
                  onChange={e => update('tagline', e.target.value)}
                  placeholder="e.g. Trusted Home Services" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Support Email <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input style={inp} type="email" value={form.support_email}
                    onChange={e => update('support_email', e.target.value)}
                    placeholder="support@example.com" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Support Phone
                  </label>
                  <input style={inp} value={form.support_phone}
                    onChange={e => update('support_phone', e.target.value)}
                    placeholder="+91 98765 43210" />
                </div>
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Business Address
                </label>
                <textarea style={{ ...inp, resize: 'none' } as any} rows={2}
                  value={form.address} onChange={e => update('address', e.target.value)}
                  placeholder="123, Main Street, Bhubaneswar, Odisha" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    GST Number
                  </label>
                  <input style={inp} value={form.gst_number}
                    onChange={e => update('gst_number', e.target.value)}
                    placeholder="21XXXXXXXXXXXXX" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Website URL
                  </label>
                  <input style={inp} value={form.website_url}
                    onChange={e => update('website_url', e.target.value)}
                    placeholder="https://yoursite.com" />
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Platform Logo
                </label>
                <CloudinaryImageUploader
                  fieldKey="platform_logo"
                  label="Logo"
                  aspectRatio={4}
                  currentUrl={form.logo_url}
                  onChange={url => update('logo_url', url)}
                  hint="Recommended: 400×100px PNG/SVG. Used in sidebar and emails."
                />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Favicon
                </label>
                <CloudinaryImageUploader
                  fieldKey="platform_favicon"
                  label="Favicon"
                  aspectRatio={1}
                  currentUrl={form.favicon_url}
                  onChange={url => update('favicon_url', url)}
                  hint="Recommended: 64×64px PNG/ICO. Shows in browser tab."
                />
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Primary Brand Color
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input type="color" value={form.primary_color}
                    onChange={e => update('primary_color', e.target.value)}
                    style={{ width: 48, height: 40, border: '1.5px solid #E2E8F0', borderRadius: 8, cursor: 'pointer', padding: 3 }} />
                  <input style={{ ...inp, flex: 1 }} value={form.primary_color}
                    onChange={e => update('primary_color', e.target.value)}
                    placeholder="#1B4FD8" />
                </div>
                <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>Used for accents, buttons, and branding elements.</p>
              </div>
              <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 10, padding: '12px 16px', marginTop: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#166534', marginBottom: 4 }}>📋 Preview</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {form.logo_url
                    ? <img src={form.logo_url} style={{ height: 36, objectFit: 'contain', borderRadius: 6, background: '#fff', padding: 4 }} alt="logo" />
                    : <div style={{ width: 36, height: 36, background: form.primary_color, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16 }}>
                        {(form.app_name || 'P').charAt(0).toUpperCase()}
                      </div>
                  }
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>{form.app_name || 'Your Platform'}</div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>{form.tagline || 'Admin Dashboard'}</div>
                  </div>
                </div>
              </div>
            </>
          )}

          {err && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', color: '#991B1B', fontSize: 13, marginTop: 16 }}>
              ⚠️ {err}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 32px 24px', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: '#94A3B8' }}>
            You can always update these from <b>Settings → Platform</b>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {step === 2 && (
              <button onClick={() => setStep(1)} style={{
                padding: '9px 20px', borderRadius: 8, border: '1.5px solid #E2E8F0',
                background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>← Back</button>
            )}
            {step === 1 && (
              <button
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
                style={{
                  padding: '9px 24px', borderRadius: 8, border: 'none',
                  background: canProceedStep1 ? '#1B4FD8' : '#E2E8F0',
                  color: canProceedStep1 ? '#fff' : '#94A3B8',
                  fontSize: 13, fontWeight: 700, cursor: canProceedStep1 ? 'pointer' : 'not-allowed',
                }}>Next: Branding →</button>
            )}
            {step === 2 && (
              <button
                onClick={save}
                disabled={saving || !canSave}
                style={{
                  padding: '9px 24px', borderRadius: 8, border: 'none',
                  background: '#1B4FD8', color: '#fff',
                  fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8, opacity: saving ? 0.7 : 1,
                }}>
                {saving ? <><Spinner size="sm" /> Saving…</> : '🚀 Launch Dashboard'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
