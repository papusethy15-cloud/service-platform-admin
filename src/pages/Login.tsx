import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import Spinner from '@/components/ui/Spinner'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const handleLogin = async (e: any) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const res = await authAPI.login(email, password)
      login(res.data.data.access_token, res.data.data)
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid credentials')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg, #EEF2FF 0%, #F8FAFC 100%)' }}>
      <div style={{ background:'white', borderRadius:20, padding:48, width:420, boxShadow:'0 8px 40px rgba(27,79,216,0.10)', border:'1px solid #E2E8F0' }}>
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <div style={{ width:64, height:64, background:'linear-gradient(135deg, #1B4FD8 0%, #3B6EEA 100%)', borderRadius:18, display:'inline-flex',
            alignItems:'center', justifyContent:'center', color:'white', fontSize:28, fontWeight:800, marginBottom:16, boxShadow:'0 4px 16px rgba(27,79,216,0.25)' }}>P</div>
          <h1 style={{ fontSize:24, fontWeight:800, color:'#0F172A', margin:0 }}>Palei Admin</h1>
          <p style={{ color:'#64748B', fontSize:14, marginTop:6 }}>Management Console</p>
        </div>


        <form onSubmit={handleLogin}>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', fontSize:13, fontWeight:600, color:'#374151', marginBottom:6 }}>Email Address</label>
            <input
              style={{ width:'100%', padding:'10px 14px', border:'1.5px solid #E2E8F0', borderRadius:10, fontSize:14, outline:'none', boxSizing:'border-box', transition:'border 0.2s' }}
              type="email" value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="admin@bibekenterprises.com" required
              onFocus={e=>(e.target.style.border='1.5px solid #1B4FD8')}
              onBlur={e=>(e.target.style.border='1.5px solid #E2E8F0')}
            />
          </div>
          <div style={{ marginBottom:28 }}>
            <label style={{ display:'block', fontSize:13, fontWeight:600, color:'#374151', marginBottom:6 }}>Password</label>
            <input
              style={{ width:'100%', padding:'10px 14px', border:'1.5px solid #E2E8F0', borderRadius:10, fontSize:14, outline:'none', boxSizing:'border-box', transition:'border 0.2s' }}
              type="password" value={password} onChange={e=>setPassword(e.target.value)}
              placeholder="••••••••" required
              onFocus={e=>(e.target.style.border='1.5px solid #1B4FD8')}
              onBlur={e=>(e.target.style.border='1.5px solid #E2E8F0')}
            />
          </div>
          {error && <div style={{ background:'#FEE2E2', color:'#DC2626', padding:'10px 14px', borderRadius:10, fontSize:13, marginBottom:16 }}>{error}</div>}
          <button
            type="submit" disabled={loading}
            style={{ width:'100%', padding:'12px 16px', background:'linear-gradient(135deg, #1B4FD8 0%, #3B6EEA 100%)', color:'white', border:'none',
              borderRadius:12, fontSize:15, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              boxShadow:'0 4px 14px rgba(27,79,216,0.30)', transition:'opacity 0.2s', opacity: loading ? 0.7 : 1 }}>
            {loading ? <Spinner size="sm" /> : 'Sign In →'}
          </button>
        </form>
        <p style={{ textAlign:'center', color:'#94A3B8', fontSize:12, marginTop:24, marginBottom:0 }}>
          Palei Solutions © 2026 · Admin Portal
        </p>
      </div>
    </div>
  )
}
