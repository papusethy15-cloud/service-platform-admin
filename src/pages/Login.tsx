import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI, settingsAPI } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import Spinner from '@/components/ui/Spinner'

interface PlatformBrand {
  app_name: string
  tagline: string
  logo_url: string
  favicon_url: string
  primary_color: string
}

const DEFAULTS: PlatformBrand = {
  app_name:      'Palei Admin',
  tagline:       'Management Console',
  logo_url:      '',
  favicon_url:   '',
  primary_color: '#1B4FD8',
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sessionExpired, setSessionExpired] = useState(false)
  const [brand, setBrand] = useState<PlatformBrand>(DEFAULTS)
  const { login } = useAuthStore()

  // Fetch platform branding (public — no auth required)
  useEffect(() => {
    settingsAPI.platformPublic()
      .then(res => {
        const d = res.data?.data || {}
        const b: PlatformBrand = {
          app_name:      d.app_name      || DEFAULTS.app_name,
          tagline:       d.tagline       || DEFAULTS.tagline,
          logo_url:      d.logo_url      || '',
          favicon_url:   d.favicon_url   || '',
          primary_color: d.primary_color || DEFAULTS.primary_color,
        }
        setBrand(b)
        // Update browser tab title
        document.title = b.app_name + ' — Admin'
        // Update favicon if set
        if (b.favicon_url) {
          const link = (document.getElementById('app-favicon') || document.createElement('link')) as HTMLLinkElement
          link.id   = 'app-favicon'
          link.type = 'image/x-icon'
          link.rel  = 'shortcut icon'
          link.href = b.favicon_url
          if (!link.parentNode) document.head.appendChild(link)
        }
      })
      .catch(() => { /* use defaults silently */ })
  }, [])

  // Check if redirected here due to idle timeout
  useEffect(() => {
    const expired = localStorage.getItem('admin_session_expired')
    if (expired === '1') {
      setSessionExpired(true)
      localStorage.removeItem('admin_session_expired')
    }
  }, [])

  const navigate = useNavigate()

  const handleLogin = async (e: any) => {
    e.preventDefault(); setLoading(true); setError('')
    setSessionExpired(false)
    try {
      const res = await authAPI.login(email, password)
      login(res.data.data.access_token, res.data.data)
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid credentials')
    } finally { setLoading(false) }
  }

  const color = brand.primary_color

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg, #EEF2FF 0%, #F8FAFC 100%)' }}>
      <div style={{ background:'white', borderRadius:20, padding:48, width:420, boxShadow:'0 8px 40px rgba(27,79,216,0.10)', border:'1px solid #E2E8F0' }}>
        <div style={{ textAlign:'center', marginBottom:36 }}>
          {brand.logo_url ? (
            <img
              src={brand.logo_url}
              alt={brand.app_name}
              style={{ height:56, maxWidth:200, objectFit:'contain', marginBottom:16, display:'block', margin:'0 auto 16px' }}
            />
          ) : (
            <div style={{ width:64, height:64, background:`linear-gradient(135deg, ${color} 0%, ${color}CC 100%)`, borderRadius:18, display:'inline-flex',
              alignItems:'center', justifyContent:'center', color:'white', fontSize:28, fontWeight:800, marginBottom:16, boxShadow:`0 4px 16px ${color}40` }}>
              {brand.app_name.charAt(0).toUpperCase()}
            </div>
          )}
          <h1 style={{ fontSize:24, fontWeight:800, color:'#0F172A', margin:0 }}>{brand.app_name}</h1>
          <p style={{ color:'#64748B', fontSize:14, marginTop:6 }}>{brand.tagline}</p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', fontSize:13, fontWeight:600, color:'#374151', marginBottom:6 }}>Email Address</label>
            <input
              style={{ width:'100%', padding:'10px 14px', border:'1.5px solid #E2E8F0', borderRadius:10, fontSize:14, outline:'none', boxSizing:'border-box', transition:'border 0.2s' }}
              type="email" value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="admin@bibekenterprises.com" required
              onFocus={e=>(e.target.style.border=`1.5px solid ${color}`)}
              onBlur={e=>(e.target.style.border='1.5px solid #E2E8F0')}
            />
          </div>
          <div style={{ marginBottom:28 }}>
            <label style={{ display:'block', fontSize:13, fontWeight:600, color:'#374151', marginBottom:6 }}>Password</label>
            <input
              style={{ width:'100%', padding:'10px 14px', border:'1.5px solid #E2E8F0', borderRadius:10, fontSize:14, outline:'none', boxSizing:'border-box', transition:'border 0.2s' }}
              type="password" value={password} onChange={e=>setPassword(e.target.value)}
              placeholder="••••••••" required
              onFocus={e=>(e.target.style.border=`1.5px solid ${color}`)}
              onBlur={e=>(e.target.style.border='1.5px solid #E2E8F0')}
            />
          </div>
          {sessionExpired && (
            <div style={{ background:'#FEF3C7', color:'#92400E', padding:'12px 14px', borderRadius:10, fontSize:13, marginBottom:16, display:'flex', alignItems:'center', gap:8, border:'1px solid #FDE68A' }}>
              <span style={{ fontSize:16 }}>⏱</span>
              <span><strong>Session expired</strong> — you were inactive for 5 minutes. Please log in again.</span>
            </div>
          )}
          {error && <div style={{ background:'#FEE2E2', color:'#DC2626', padding:'10px 14px', borderRadius:10, fontSize:13, marginBottom:16 }}>{error}</div>}
          <button
            type="submit" disabled={loading}
            style={{ width:'100%', padding:'12px 16px', background:`linear-gradient(135deg, ${color} 0%, ${color}CC 100%)`, color:'white', border:'none',
              borderRadius:12, fontSize:15, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              boxShadow:`0 4px 14px ${color}40`, transition:'opacity 0.2s', opacity: loading ? 0.7 : 1 }}>
            {loading ? <Spinner size="sm" /> : 'Sign In →'}
          </button>
        </form>
        <p style={{ textAlign:'center', color:'#94A3B8', fontSize:12, marginTop:24, marginBottom:0 }}>
          Palei Solutions © {new Date().getFullYear()} · Admin Portal
        </p>
      </div>
    </div>
  )
}
