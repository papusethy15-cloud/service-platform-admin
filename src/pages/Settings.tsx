import { useEffect, useState, useCallback, useRef } from 'react'
import { settingsAPI } from '@/services/api'
import PageHeader from '@/components/layout/PageHeader'
import Spinner from '@/components/ui/Spinner'
import CloudinaryImageUploader from '@/components/ui/CloudinaryImageUploader'
import { usePlatformStore } from '@/store/platformStore'

// ── Types ─────────────────────────────────────────────────────
type TabKey = 'Platform' | 'General' | 'Payment' | 'Notification' | 'Security' | 'MPIN' | 'Cloudinary' | 'Maps' | 'Dispatch' | 'Firebase'

interface FieldDef {
  key: string
  label: string
  type: 'text' | 'email' | 'password' | 'number' | 'textarea' | 'url' | 'toggle'
  placeholder?: string
  hint?: string
}

// ── Field definitions per tab ─────────────────────────────────
const FIELDS: Record<TabKey, FieldDef[]> = {
  Platform: [],  // rendered separately with image uploaders
  General: [
    { key: 'app_name',         label: 'App Name',         type: 'text',  placeholder: 'Palei Solutions' },
    { key: 'support_phone',    label: 'Support Phone',    type: 'text',  placeholder: '+91 98765 43210' },
    { key: 'support_email',    label: 'Support Email',    type: 'email', placeholder: 'support@palei.in' },
    { key: 'business_address', label: 'Business Address', type: 'textarea', placeholder: '123, Main Street, Bhubaneswar' },
    { key: 'gst_number',       label: 'GST Number',       type: 'text',  placeholder: '21XXXXXXXXXXXXX' },
    { key: 'invoice_prefix',   label: 'Invoice Prefix',   type: 'text',  placeholder: 'PAL',  hint: 'Used as prefix for invoice numbers' },
    { key: 'currency',         label: 'Currency Code',    type: 'text',  placeholder: 'INR' },
    { key: 'timezone',         label: 'Timezone',         type: 'text',  placeholder: 'Asia/Kolkata' },
  ],
  Payment: [
    { key: 'razorpay_key_id',     label: 'Razorpay Key ID',     type: 'text',     placeholder: 'rzp_live_...' },
    { key: 'razorpay_key_secret', label: 'Razorpay Key Secret', type: 'password', placeholder: '••••••••', hint: 'Stored encrypted. Enter new value to change.' },
    { key: 'payment_gateway',     label: 'Payment Gateway',     type: 'text',     placeholder: 'razorpay' },
    { key: 'upi_enabled',         label: 'UPI Enabled',         type: 'text',     placeholder: 'true' },
    { key: 'cash_enabled',        label: 'Cash Enabled',        type: 'text',     placeholder: 'true' },
    { key: 'razorpay_payout_enabled',    label: 'Razorpay Payout Enabled',  type: 'text',     placeholder: 'false', hint: 'Set to true to allow RazorpayX automated payouts to technicians.' },
    { key: 'razorpay_x_key_id',          label: 'RazorpayX Key ID',         type: 'text',     placeholder: 'rzp_live_...' },
    { key: 'razorpay_x_key_secret',      label: 'RazorpayX Key Secret',     type: 'password', placeholder: '••••••••', hint: 'Stored encrypted. Enter new value to change.' },
    { key: 'razorpay_x_account_number',  label: 'RazorpayX Account Number', type: 'text',     placeholder: 'Your linked business account number', hint: 'The source bank account registered with RazorpayX.' },
    { key: 'withdrawal_payout_mode',     label: 'Withdrawal Payout Mode',   type: 'text',     placeholder: 'manual', hint: 'manual = admin transfers manually. razorpay = auto-payout via RazorpayX.' },
  ],
  Notification: [
    { key: 'sms_api_key',       label: 'SMS API Key',         type: 'password', hint: 'Enter new value to update.' },
    { key: 'sms_sender_id',     label: 'SMS Sender ID',       type: 'text',     placeholder: 'PALEIS' },
    { key: 'whatsapp_api_key',  label: 'WhatsApp API Key',    type: 'password', hint: 'Enter new value to update.' },
    { key: 'whatsapp_phone_id', label: 'WhatsApp Phone ID',   type: 'text',     placeholder: '1234567890' },
    { key: 'email_host',        label: 'Email SMTP Host',     type: 'text',     placeholder: 'smtp.gmail.com' },
    { key: 'email_port',        label: 'Email SMTP Port',     type: 'number',   placeholder: '587' },
    { key: 'email_username',    label: 'Email Username',      type: 'email',    placeholder: 'noreply@yourdomain.com' },
    { key: 'email_password',    label: 'Email Password',      type: 'password', hint: 'Enter new value to update.' },
    { key: 'from_email',        label: 'From Email',          type: 'email',    placeholder: 'noreply@palei.in' },
    { key: 'from_name',         label: 'From Name',           type: 'text',     placeholder: 'Palei Solutions' },
  ],
  Security: [
    { key: 'otp_expiry_minutes',  label: 'OTP Expiry (minutes)',    type: 'number', placeholder: '10' },
    { key: 'jwt_expiry_minutes',  label: 'JWT Access Token (mins)', type: 'number', placeholder: '30' },
    { key: 'refresh_token_days',  label: 'Refresh Token (days)',    type: 'number', placeholder: '30' },
    { key: 'max_login_attempts',  label: 'Max Login Attempts',      type: 'number', placeholder: '5' },
  ],
  Cloudinary: [
    { key: 'cloud_name',    label: 'Cloud Name',    type: 'text',     placeholder: 'your-cloud-name',    hint: 'Found in Cloudinary Dashboard → Account Details' },
    { key: 'api_key',       label: 'API Key',       type: 'text',     placeholder: '123456789012345',    hint: 'Found in Cloudinary Dashboard → API Keys' },
    { key: 'api_secret',    label: 'API Secret',    type: 'password', placeholder: '••••••••••••••••',  hint: 'Stored securely. Enter new value to change.' },
    { key: 'upload_preset', label: 'Upload Preset', type: 'text',     placeholder: 'palei_unsigned',     hint: 'Create an unsigned upload preset in Cloudinary → Settings → Upload' },
    { key: 'folder',        label: 'Default Folder',type: 'text',     placeholder: 'palei',              hint: 'All uploads go into this folder in your Cloudinary media library' },
  ],
  Maps: [
    { key: 'google_maps_api_key',    label: 'Google Maps API Key',      type: 'password', placeholder: 'AIzaSy...', hint: 'Enable Maps JavaScript API, Geocoding API, and Distance Matrix API in Google Cloud Console.' },
    { key: 'geocoding_enabled',      label: 'Geocoding Enabled',        type: 'text',     placeholder: 'true',      hint: 'Set to true to geocode addresses on booking creation.' },
    { key: 'geofence_radius_meters', label: 'Geofence Radius (meters)', type: 'number',   placeholder: '100',       hint: 'Radius within which a technician is considered "arrived" at a job site.' },
    { key: 'assignment_radius_km',   label: 'Assignment Radius (km)',   type: 'number',   placeholder: '20',        hint: 'Maximum travel distance to consider a technician for auto-assignment.' },
  ],
  Dispatch: [
    { key: 'auto_assign_enabled', label: 'Auto-assign Enabled', type: 'toggle', hint: 'When ON, bookings created by Admin, CCO, or Customer are automatically assigned to the best available technician.' },
    { key: 'response_timeout_minutes',  label: 'Response Timeout (minutes)',    type: 'number', placeholder: '5',     hint: 'Time a technician has to accept/reject before the booking is re-queued.' },
    { key: 'max_reject_before_penalty', label: 'Max Rejects Before Penalty',    type: 'number', placeholder: '3',     hint: "Number of consecutive rejections before a technician's score is penalised." },
    { key: 'max_active_bookings',       label: 'Max Active Bookings per Tech',  type: 'number', placeholder: '5',     hint: 'Technicians with this many active jobs will be excluded from auto-assignment.' },
    { key: 'fcm_server_key',            label: 'FCM Server Key (Legacy HTTP)',  type: 'password', placeholder: 'AAAAx...',  hint: 'Legacy FCM HTTP v1 key. Use the Firebase tab for Admin SDK push notifications instead.' },
  ],
  Firebase: [],  // rendered separately — special JSON paste widget
  MPIN: [],      // rendered separately — custom toggle + PIN-pad widget
}

const TAB_ICONS: Record<TabKey, string> = {
  Platform: '🏢', General: '⚙️', Payment: '💳', Notification: '🔔', Security: '🔒', Cloudinary: '☁️',
  Maps: '🗺️', Dispatch: '🚀', Firebase: '🔥', MPIN: '🔐',
}

const TAB_API: Record<TabKey, { get: () => Promise<any>; put: (d: any) => Promise<any> }> = {
  Platform:     { get: () => settingsAPI.platform(),      put: (d) => settingsAPI.updatePlatform(d) },
  General:      { get: () => settingsAPI.general(),      put: (d) => settingsAPI.updateGeneral(d) },
  Payment:      { get: () => settingsAPI.payment(),      put: (d) => settingsAPI.updatePayment(d) },
  Notification: { get: () => settingsAPI.notification(), put: (d) => settingsAPI.updateNotification(d) },
  Security:     { get: () => settingsAPI.security(),     put: (d) => settingsAPI.updateSecurity(d) },
  Cloudinary:   { get: () => settingsAPI.cloudinary(),   put: (d) => settingsAPI.updateCloudinary(d) },
  Maps:         { get: () => settingsAPI.maps(),         put: (d) => settingsAPI.updateMaps(d) },
  Dispatch:     { get: () => settingsAPI.dispatch(),     put: (d) => settingsAPI.updateDispatch(d) },
  Firebase:     { get: () => settingsAPI.firebase(),     put: (d) => settingsAPI.updateFirebase(d) },
  MPIN:         { get: () => Promise.resolve({ data: { data: {} } }), put: () => Promise.resolve() },
}

const TABS: TabKey[] = ['Platform', 'General', 'Payment', 'Notification', 'Security', 'MPIN', 'Cloudinary', 'Maps', 'Dispatch', 'Firebase']

// ── Reusable field renderer ───────────────────────────────────
function SettingField({ def, value, onChange }: {
  def: FieldDef; value: string; onChange: (v: string) => void
}) {
  const [show, setShow] = useState(false)
  const isSecret = def.type === 'password'
  const isMasked = isSecret && value === '***'

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none',
    background: isMasked ? '#F8FAFC' : 'white', color: '#0F172A',
    boxSizing: 'border-box' as any,
    fontFamily: isSecret && !show ? 'monospace' : 'inherit',
  }

  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700,
        color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {def.label}
      </label>
      <div style={{ position: 'relative' }}>
        {def.type === 'toggle' ? (
          <div
            onClick={() => onChange(value === 'true' ? 'false' : 'true')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              cursor: 'pointer', userSelect: 'none',
            }}
          >
            <div style={{
              width: 48, height: 26, borderRadius: 13, position: 'relative',
              background: value === 'true' ? '#1B4FD8' : '#CBD5E1',
              transition: 'background 0.2s',
              flexShrink: 0,
            }}>
              <div style={{
                position: 'absolute', top: 3, left: value === 'true' ? 25 : 3,
                width: 20, height: 20, borderRadius: '50%', background: 'white',
                boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                transition: 'left 0.2s',
              }} />
            </div>
            <span style={{
              fontSize: 14, fontWeight: 600,
              color: value === 'true' ? '#1B4FD8' : '#64748B',
            }}>
              {value === 'true' ? 'ON' : 'OFF'}
            </span>
          </div>
        ) : def.type === 'textarea' ? (
          <textarea
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
            placeholder={def.placeholder}
            value={isMasked ? '' : value}
            onChange={e => onChange(e.target.value)}
          />
        ) : (
          <input
            type={isSecret && !show ? 'password' : def.type === 'password' ? 'text' : def.type}
            style={inputStyle}
            placeholder={isMasked ? 'Enter new value to change' : def.placeholder}
            value={isMasked ? '' : value}
            onChange={e => onChange(e.target.value)}
          />
        )}
        {isSecret && !isMasked && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#94A3B8' }}>
            {show ? '🙈' : '👁'}
          </button>
        )}
      </div>
      {isMasked && (
        <p style={{ fontSize: 12, color: '#15803D', marginTop: 4, fontWeight: 600 }}>
          ✅ Value is saved — leave blank to keep current, or type a new value to replace it.
        </p>
      )}
      {!isMasked && def.hint && (
        <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>💡 {def.hint}</p>
      )}
    </div>
  )
}

// ── Cloudinary test widget ────────────────────────────────────
function CloudinaryTestWidget({ settings }: { settings: Record<string, string> }) {
  const allSet = settings.cloud_name && settings.api_key && settings.upload_preset
  if (!allSet) return null
  return (
    <div style={{ marginTop: 20, padding: 16, background: '#F0FDF4',
      border: '1px solid #86EFAC', borderRadius: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 20 }}>☁️</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#166534' }}>Cloudinary Connected</div>
          <div style={{ fontSize: 12, color: '#15803D' }}>Cloud: <b>{settings.cloud_name}</b> · Preset: <b>{settings.upload_preset}</b></div>
        </div>
      </div>
      <p style={{ fontSize: 12, color: '#166534', margin: 0 }}>
        ✅ Images uploaded from Domain Profile (logo, OG image, banner) will use these credentials.
        Folder: <b>{settings.folder || 'root'}</b>
      </p>
    </div>
  )
}

// ── Platform Tab renderer ────────────────────────────────────
function PlatformTab({ data, update, cloudSettings }: { data: Record<string, string>; update: (k: string, v: string) => void; cloudSettings: Record<string, string> }) {
  const hasCloud = !!(cloudSettings.cloud_name && cloudSettings.api_key && cloudSettings.upload_preset)
  const inp: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0',
    fontSize: 14, outline: 'none', boxSizing: 'border-box' as any, color: '#0F172A',
  }
  return (
    <div>
      {!hasCloud && (
        <div style={{ background: '#FFF7ED', border: '1px solid #FCD34D', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#92400E', marginBottom: 4 }}>⚠️ Cloudinary not configured</div>
          <div style={{ fontSize: 12, color: '#92400E' }}>
            Logo and Favicon upload requires Cloudinary. Go to the <b>Cloudinary</b> tab and enter your credentials first.
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Platform Name</label>
          <input style={inp} value={data.app_name || ''} onChange={e => update('app_name', e.target.value)} placeholder="e.g. Bibek Enterprises" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tagline</label>
          <input style={inp} value={data.tagline || ''} onChange={e => update('tagline', e.target.value)} placeholder="Home Services Platform" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Support Email</label>
          <input style={inp} type="email" value={data.support_email || ''} onChange={e => update('support_email', e.target.value)} placeholder="support@example.com" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Support Phone</label>
          <input style={inp} value={data.support_phone || ''} onChange={e => update('support_phone', e.target.value)} placeholder="+91 98765 43210" />
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Business Address</label>
        <textarea style={{ ...inp, resize: 'none' } as any} rows={2} value={data.address || ''} onChange={e => update('address', e.target.value)} placeholder="123, Main Street, Bhubaneswar, Odisha" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>GST Number</label>
          <input style={inp} value={data.gst_number || ''} onChange={e => update('gst_number', e.target.value)} placeholder="21XXXXXXXXXXXXX" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Website URL</label>
          <input style={inp} value={data.website_url || ''} onChange={e => update('website_url', e.target.value)} placeholder="https://yoursite.com" />
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Primary Brand Color</label>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input type="color" value={data.primary_color || '#1B4FD8'} onChange={e => update('primary_color', e.target.value)}
            style={{ width: 48, height: 40, border: '1.5px solid #E2E8F0', borderRadius: 8, cursor: 'pointer', padding: 3 }} />
          <input style={{ ...inp, flex: 1 }} value={data.primary_color || ''} onChange={e => update('primary_color', e.target.value)} placeholder="#1B4FD8" />
        </div>
        <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>💡 Used for sidebar accents and brand elements.</p>
      </div>

      {/* Logo upload */}
      <div style={{ marginBottom: 24, padding: 20, background: '#F8FAFC', borderRadius: 12, border: '1px solid #E2E8F0' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 14 }}>🖼️ Logo</div>
        {hasCloud
          ? <CloudinaryImageUploader fieldKey="platform_logo" label="Logo" aspectRatio={4}
              currentUrl={data.logo_url || ''} onChange={url => update('logo_url', url)}
              hint="Recommended: 400×100px PNG/SVG. Shown in sidebar and emails." />
          : <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input style={inp} value={data.logo_url || ''} onChange={e => update('logo_url', e.target.value)} placeholder="https://example.com/logo.png" />
            </div>
        }
      </div>

      {/* Favicon upload */}
      <div style={{ marginBottom: 24, padding: 20, background: '#F8FAFC', borderRadius: 12, border: '1px solid #E2E8F0' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 14 }}>🔖 Favicon</div>
        {hasCloud
          ? <CloudinaryImageUploader fieldKey="platform_favicon" label="Favicon" aspectRatio={1}
              currentUrl={data.favicon_url || ''} onChange={url => update('favicon_url', url)}
              hint="Recommended: 64×64px square PNG/ICO. Shows in browser tab." />
          : <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input style={inp} value={data.favicon_url || ''} onChange={e => update('favicon_url', e.target.value)} placeholder="https://example.com/favicon.ico" />
            </div>
        }
      </div>

      {/* Live preview */}
      <div style={{ padding: 16, background: '#0F1729', borderRadius: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sidebar Preview</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {data.logo_url
            ? <img src={data.logo_url} style={{ height: 32, objectFit: 'contain', borderRadius: 6, background: 'rgba(255,255,255,0.1)', padding: 4 }} alt="logo" />
            : <div style={{ width: 32, height: 32, background: data.primary_color || '#1B4FD8', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14 }}>
                {(data.app_name || 'P').charAt(0).toUpperCase()}
              </div>
          }
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>{data.app_name || 'Your Platform'}</div>
            <div style={{ fontSize: 10, color: '#475569' }}>{data.tagline || 'Admin Dashboard'}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Firebase Tab renderer ────────────────────────────────────
function FirebaseTab({ data, update }: { data: Record<string, string>; update: (k: string, v: string) => void }) {
  const [jsonMode, setJsonMode] = useState(false)
  const [jsonText, setJsonText] = useState('')
  const [jsonErr, setJsonErr]   = useState('')

  // '***' means the value is saved but masked (is_secret=true). Treat it as connected.
  const isConnected = !!(data.firebase_project_id && data.firebase_client_email && data.firebase_private_key)

  const applyJson = () => {
    setJsonErr('')
    try {
      const parsed = JSON.parse(jsonText)
      const required = ['project_id', 'client_email', 'private_key']
      const missing = required.filter(k => !parsed[k])
      if (missing.length) { setJsonErr(`Missing fields in JSON: ${missing.join(', ')}`); return }
      update('firebase_project_id',   parsed.project_id)
      update('firebase_client_email', parsed.client_email)
      update('firebase_private_key',  parsed.private_key)
      update('firebase_sdk_json',     jsonText)
      setJsonMode(false)
      setJsonText('')
    } catch {
      setJsonErr('Invalid JSON — paste the full Firebase Admin SDK JSON file content.')
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0',
    fontSize: 14, outline: 'none', boxSizing: 'border-box' as any, color: '#0F172A',
  }

  return (
    <div>
      {isConnected ? (
        <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#166534' }}>🔥 Firebase Admin SDK Connected</div>
          <div style={{ fontSize: 12, color: '#15803D', marginTop: 4 }}>
            Project: <b>{data.firebase_project_id}</b> · Client: <b>{data.firebase_client_email}</b>
          </div>
        </div>
      ) : (
        <div style={{ background: '#FFF7ED', border: '1px solid #FCD34D', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#92400E' }}>⚠️ Firebase not configured</div>
          <div style={{ fontSize: 12, color: '#92400E', marginTop: 4 }}>
            Required for Captain App push notifications. Download the Admin SDK JSON from Firebase Console → Project Settings → Service Accounts.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button type="button" onClick={() => setJsonMode(false)}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            background: !jsonMode ? '#1B4FD8' : 'white', color: !jsonMode ? 'white' : '#374151' }}>
          ✏️ Manual Entry
        </button>
        <button type="button" onClick={() => setJsonMode(true)}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            background: jsonMode ? '#1B4FD8' : 'white', color: jsonMode ? 'white' : '#374151' }}>
          📋 Paste JSON
        </button>
      </div>

      {jsonMode ? (
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Firebase Admin SDK JSON
          </label>
          <textarea
            rows={14}
            style={{ ...inp, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' } as any}
            placeholder={`{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk@your-project.iam.gserviceaccount.com",
  ...
}`}
            value={jsonText}
            onChange={e => setJsonText(e.target.value)}
          />
          <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>
            💡 Firebase Console → Project Settings → Service Accounts → Generate new private key
          </p>
          {jsonErr && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', color: '#991B1B', fontSize: 13, margin: '8px 0' }}>
              ⚠️ {jsonErr}
            </div>
          )}
          <button type="button" onClick={applyJson}
            style={{ marginTop: 10, padding: '9px 20px', background: '#1B4FD8', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            ✅ Apply JSON
          </button>
          <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 8 }}>
            Populates the fields below. Click "Save Firebase Settings" to persist.
          </p>
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Project ID</label>
            <input style={inp} value={data.firebase_project_id || ''} onChange={e => update('firebase_project_id', e.target.value)} placeholder="your-firebase-project-id" />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Client Email</label>
            <input style={inp} type="email" value={data.firebase_client_email || ''} onChange={e => update('firebase_client_email', e.target.value)} placeholder="firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com" />
            <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>💡 Found in your service account JSON under "client_email"</p>
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Private Key (PEM)</label>
            <textarea
              rows={6}
              style={{ ...inp, fontFamily: 'monospace', fontSize: 11, resize: 'vertical' } as any}
              placeholder={"-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----"}
              value={data.firebase_private_key === '***' ? '' : (data.firebase_private_key || '')}
              onChange={e => update('firebase_private_key', e.target.value)}
            />
            {data.firebase_private_key === '***'
              ? <p style={{ fontSize: 12, color: '#15803D', marginTop: 4, fontWeight: 600 }}>✅ Private key is saved — leave blank to keep it, or paste a new PEM to replace.</p>
              : <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>💡 Stored encrypted. Include the full PEM with BEGIN/END lines. Use "Paste JSON" mode for easier setup.</p>
            }
          </div>
        </div>
      )}
    </div>
  )
}


// ── MpinTab — 6-digit MPIN auto-lock configuration ───────────────────────────
function MpinTab() {
  const [status, setStatus]     = useState<{ enabled: boolean; configured: boolean } | null>(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // PIN entry (set / change)
  const [pin, setPin]           = useState<string[]>(['','','','','',''])
  const [confirm, setConfirm]   = useState<string[]>(['','','','','',''])
  const pinRefs    = useRef<(HTMLInputElement | null)[]>([])
  const confirmRefs = useRef<(HTMLInputElement | null)[]>([])

  const flash = (type: 'ok' | 'err', text: string) => {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 4000)
  }

  // Load current status
  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const r = await settingsAPI.mpinStatus()
      const { enabled, configured } = r.data?.data || {}
      setStatus({ enabled: !!enabled, configured: !!configured })
    } catch { flash('err', 'Failed to load MPIN status') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { reload() }, [reload])

  // PIN digit input helpers
  const handlePinChange = (
    arr: string[], setArr: (v: string[]) => void,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>,
    i: number, val: string
  ) => {
    const v = val.replace(/\D/g, '').slice(-1)
    const next = [...arr]; next[i] = v; setArr(next)
    if (v && i < 5) refs.current[i + 1]?.focus()
  }

  const handlePinKeyDown = (
    arr: string[],
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>,
    i: number, e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === 'Backspace' && !arr[i] && i > 0) refs.current[i - 1]?.focus()
  }

  const pinValue    = pin.join('')
  const confirmValue = confirm.join('')
  const canSave     = pinValue.length === 6 && confirmValue.length === 6

  const handleSavePin = async () => {
    if (pinValue !== confirmValue) { flash('err', 'PINs do not match'); return }
    if (!/^\d{6}$/.test(pinValue))  { flash('err', 'MPIN must be exactly 6 digits'); return }
    setSaving(true)
    try {
      await settingsAPI.mpinSet(pinValue)
      flash('ok', 'MPIN saved successfully')
      setPin(['','','','','','']); setConfirm(['','','','','',''])
      reload()
    } catch (e: any) {
      flash('err', e?.response?.data?.detail || 'Failed to save MPIN')
    } finally { setSaving(false) }
  }

  const handleToggle = async (enable: boolean) => {
    if (enable && !status?.configured) {
      flash('err', 'Set an MPIN first, then enable auto-lock'); return
    }
    setSaving(true)
    try {
      await settingsAPI.mpinEnable(enable)
      flash('ok', enable ? 'MPIN auto-lock enabled' : 'MPIN auto-lock disabled')
      reload()
    } catch (e: any) {
      flash('err', e?.response?.data?.detail || 'Failed to update MPIN status')
    } finally { setSaving(false) }
  }

  const pinBoxStyle = (filled: boolean, error: boolean): React.CSSProperties => ({
    width: 44, height: 52, textAlign: 'center', fontSize: 22, fontWeight: 700,
    borderRadius: 10, border: `1.5px solid ${error ? '#FCA5A5' : filled ? '#1B4FD8' : '#E2E8F0'}`,
    outline: 'none', color: '#0F172A', transition: 'border-color 0.15s',
  })

  if (loading) return <div style={{ color: '#94A3B8', fontSize: 14 }}>Loading MPIN status…</div>

  const mismatch = confirmValue.length === 6 && pinValue !== confirmValue

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Status banner */}
      <div style={{ background: status?.enabled ? '#EFF6FF' : '#F8FAFC',
        border: `1px solid ${status?.enabled ? '#BFDBFE' : '#E2E8F0'}`,
        borderRadius: 10, padding: '14px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#0F172A', marginBottom: 3 }}>
            {status?.enabled ? '🔐 MPIN Auto-Lock: ON' : '🔓 MPIN Auto-Lock: OFF'}
          </div>
          <div style={{ fontSize: 13, color: '#64748B' }}>
            {status?.enabled
              ? 'Dashboard locks after 10 minutes of inactivity. Enter MPIN to unlock.'
              : 'Enable to lock the dashboard after 10 minutes of inactivity.'}
            {!status?.configured && ' No MPIN set yet — configure one below first.'}
          </div>
        </div>
        <button
          disabled={saving}
          onClick={() => handleToggle(!status?.enabled)}
          style={{
            minWidth: 96, padding: '8px 18px', borderRadius: 8, fontWeight: 700,
            fontSize: 13, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
            background: status?.enabled ? '#FEE2E2' : '#1B4FD8',
            color: status?.enabled ? '#991B1B' : 'white',
            opacity: saving ? 0.7 : 1, transition: 'all 0.15s',
          }}
        >
          {saving ? '…' : status?.enabled ? 'Disable' : 'Enable'}
        </button>
      </div>

      {/* Set / change MPIN */}
      <div style={{ background: '#FAFAFA', border: '1px solid #E2E8F0', borderRadius: 10, padding: '20px 24px' }}>
        <h4 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', margin: '0 0 4px' }}>
          {status?.configured ? 'Change MPIN' : 'Set MPIN'}
        </h4>
        <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 18px' }}>
          {status?.configured
            ? 'Enter a new 6-digit PIN to replace the current one.'
            : 'Choose a 6-digit PIN. You must set this before enabling auto-lock.'}
        </p>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>
            New MPIN
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {pin.map((d, i) => (
              <input
                key={i}
                ref={el => { pinRefs.current[i] = el }}
                value={d}
                type="password"
                inputMode="numeric"
                maxLength={1}
                onChange={e => handlePinChange(pin, setPin, pinRefs, i, e.target.value)}
                onKeyDown={e => handlePinKeyDown(pin, pinRefs, i, e)}
                style={pinBoxStyle(!!d, false)}
              />
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>
            Confirm MPIN
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {confirm.map((d, i) => (
              <input
                key={i}
                ref={el => { confirmRefs.current[i] = el }}
                value={d}
                type="password"
                inputMode="numeric"
                maxLength={1}
                onChange={e => handlePinChange(confirm, setConfirm, confirmRefs, i, e.target.value)}
                onKeyDown={e => handlePinKeyDown(confirm, confirmRefs, i, e)}
                style={pinBoxStyle(!!d, mismatch)}
              />
            ))}
          </div>
          {mismatch && (
            <p style={{ fontSize: 12, color: '#DC2626', marginTop: 6, fontWeight: 600 }}>
              ⚠️ PINs do not match
            </p>
          )}
        </div>

        <button
          disabled={!canSave || saving || mismatch}
          onClick={handleSavePin}
          style={{
            background: canSave && !mismatch ? '#1B4FD8' : '#94A3B8',
            color: 'white', border: 'none', borderRadius: 8,
            padding: '10px 24px', fontSize: 14, fontWeight: 600,
            cursor: canSave && !mismatch && !saving ? 'pointer' : 'not-allowed',
            transition: 'background 0.15s',
          }}
        >
          {saving ? 'Saving…' : status?.configured ? '🔄 Update MPIN' : '💾 Save MPIN'}
        </button>
      </div>

      {/* Info box */}
      <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 10, padding: '14px 18px' }}>
        <div style={{ fontSize: 13, color: '#0369A1', lineHeight: 1.7 }}>
          <strong>ℹ️ How it works</strong><br />
          • When enabled, the dashboard locks automatically after <strong>10 minutes</strong> of inactivity.<br />
          • Inactivity = no mouse movement, keyboard input, clicks, or scrolling.<br />
          • Locking does <em>not</em> log you out — enter your MPIN to resume instantly.<br />
          • The session itself stays valid until <strong>11:59 PM</strong> each day.<br />
          • You can always log out from the lock screen if needed.
        </div>
      </div>

      {/* Flash message */}
      {msg && (
        <div style={{
          background: msg.type === 'ok' ? '#F0FDF4' : '#FEF2F2',
          border: `1px solid ${msg.type === 'ok' ? '#86EFAC' : '#FECACA'}`,
          borderRadius: 8, padding: '10px 14px',
          color: msg.type === 'ok' ? '#166534' : '#991B1B',
          fontSize: 13, fontWeight: 600,
        }}>
          {msg.type === 'ok' ? '✅' : '⚠️'} {msg.text}
        </div>
      )}
    </div>
  )
}

// ── Main Settings component ───────────────────────────────────
export default function Settings() {
  const [tab, setTab]         = useState<TabKey>('Platform')
  const [data, setData]       = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [err,     setErr]     = useState('')
  const [cloudSettings, setCloudSettings] = useState<Record<string, string>>({})
  const { load: reloadPlatform } = usePlatformStore()

  const loadTab = useCallback(async (t: TabKey) => {
    setLoading(true); setErr(''); setSaved(false)
    try {
      const r = await TAB_API[t].get()
      setData(r.data?.data || {})
      // Also load cloudinary settings when on Platform tab (needed for upload widget)
      if (t === 'Platform') {
        try {
          const cr = await settingsAPI.cloudinary()
          setCloudSettings(cr.data?.data || {})
        } catch { /* ignore */ }
      }
    } catch {
      setData({})
      setErr('Failed to load settings. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTab(tab) }, [tab, loadTab])

  const save = async () => {
    setSaving(true); setErr(''); setSaved(false)
    try {
      await TAB_API[tab].put(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      // Reload global platform settings if we saved the Platform tab
      if (tab === 'Platform') reloadPlatform()
    } catch (e: any) {
      setErr(e.response?.data?.detail || 'Failed to save settings.')
    } finally {
      setSaving(false)
    }
  }

  const update = (key: string, val: string) =>
    setData(prev => ({ ...prev, [key]: val }))

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader title="System Settings" subtitle="Configure platform credentials and operational defaults" />

      {/* ── Tab Bar ── */}
      <div style={{ display: 'flex', gap: 6, marginTop: 20, marginBottom: 24,
        borderBottom: '2px solid #E2E8F0', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7,
            borderBottom: `3px solid ${tab === t ? '#1B4FD8' : 'transparent'}`,
            color: tab === t ? '#1B4FD8' : '#64748B',
            marginBottom: -2, transition: 'all 0.15s',
          }}>
            <span>{TAB_ICONS[t]}</span> {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spinner /></div>
      ) : (
        <div style={{ maxWidth: 680 }}>
          {/* ── Platform info banner ── */}
          {tab === 'Platform' && (
            <div style={{ marginBottom: 20, padding: 16, background: '#EFF6FF',
              border: '1px solid #BFDBFE', borderRadius: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#1E40AF', marginBottom: 6 }}>
                🏢 Platform Branding — Your Admin Dashboard Identity
              </div>
              <p style={{ fontSize: 13, color: '#1D4ED8', margin: 0, lineHeight: 1.6 }}>
                Set your platform name, logo, and favicon. These appear in the sidebar, browser tab, emails,
                and invoices. Upload images using Cloudinary (configure it in the <b>Cloudinary</b> tab first).
              </p>
            </div>
          )}

          {/* ── Cloudinary info banner ── */}
          {tab === 'Cloudinary' && (
            <div style={{ marginBottom: 20, padding: 16, background: '#EFF6FF',
              border: '1px solid #BFDBFE', borderRadius: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#1E40AF', marginBottom: 6 }}>
                ☁️ Cloudinary — Media Storage for Domain Uploads
              </div>
              <p style={{ fontSize: 13, color: '#1D4ED8', margin: 0, lineHeight: 1.6 }}>
                Cloudinary is used to upload logos, OG images, favicons, and banners from the{' '}
                <b>Domain → Profile</b> tab. Set up a free account at{' '}
                <a href="https://cloudinary.com" target="_blank" rel="noreferrer"
                  style={{ color: '#1D4ED8', fontWeight: 700 }}>cloudinary.com</a>{' '}
                then paste your credentials below.
              </p>
            </div>
          )}

          {/* ── Fields ── */}
          <div style={{ background: 'white', borderRadius: 14, padding: 28,
            border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>

            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A',
              marginBottom: 22, display: 'flex', alignItems: 'center', gap: 8 }}>
              {TAB_ICONS[tab]} {tab} Settings
            </h3>

            {tab === 'Platform'
              ? <PlatformTab data={data} update={update} cloudSettings={cloudSettings} />
              : tab === 'MPIN'
              ? <MpinTab />
              : tab === 'Firebase'
              ? <FirebaseTab data={data} update={update} />
              : FIELDS[tab].map(def => (
                  <SettingField
                    key={def.key}
                    def={def}
                    value={data[def.key] || ''}
                    onChange={val => update(def.key, val)}
                  />
                ))
            }

            {/* Cloudinary status widget */}
            {tab === 'Cloudinary' && <CloudinaryTestWidget settings={data} />}

            {/* Feedback */}
            {saved && (
              <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC',
                borderRadius: 8, padding: '10px 14px', color: '#166534',
                fontSize: 13, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
                ✅ {tab} settings saved successfully.
              </div>
            )}
            {err && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA',
                borderRadius: 8, padding: '10px 14px', color: '#991B1B',
                fontSize: 13, marginBottom: 16 }}>
                ⚠️ {err}
              </div>
            )}

            {tab !== 'MPIN' && <button
              onClick={save}
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 8,
                background: '#1B4FD8', color: 'white', border: 'none',
                borderRadius: 8, padding: '10px 24px', fontSize: 14,
                fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1, transition: 'opacity 0.15s' }}>
              {saving ? <><Spinner size="sm" /> Saving…</> : `💾 Save ${tab} Settings`}
            </button>}
          </div>
        </div>
      )}
    </div>
  )
}
