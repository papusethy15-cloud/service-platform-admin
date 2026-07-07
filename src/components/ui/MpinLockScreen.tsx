// src/components/ui/MpinLockScreen.tsx
// Full-screen overlay shown when the dashboard auto-locks after 10 minutes
// of inactivity (only when MPIN auto-lock is enabled in Settings → MPIN).
// Blocks all interaction with the dashboard underneath until the correct
// 6-digit MPIN is entered. Also offers a full logout as an escape hatch.
import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMpinStore } from '@/store/mpinStore'
import { useAuthStore } from '@/store/authStore'

export default function MpinLockScreen() {
  const { verify } = useMpinStore()
  const { logout } = useAuthStore()
  const navigate = useNavigate()

  const [digits, setDigits]   = useState<string[]>(['', '', '', '', '', ''])
  const [error, setError]     = useState('')
  const [checking, setChecking] = useState(false)
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  const focusInput = (i: number) => inputsRef.current[i]?.focus()

  const submit = useCallback(async (pin: string) => {
    setChecking(true); setError('')
    const ok = await verify(pin)
    setChecking(false)
    if (!ok) {
      setError('Incorrect MPIN. Try again.')
      setDigits(['', '', '', '', '', ''])
      focusInput(0)
    }
  }, [verify])

  const handleChange = (i: number, val: string) => {
    const v = val.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[i] = v
    setDigits(next)
    if (v && i < 5) focusInput(i + 1)
    if (next.every(d => d !== '')) submit(next.join(''))
  }

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) focusInput(i - 1)
  }

  const handleLogout = () => {
    logout()
    useMpinStore.getState().setLocked(false)
    navigate('/login', { replace: true })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(15, 23, 42, 0.97)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column',
    }}>
      <div style={{
        background: 'white', borderRadius: 16, padding: '36px 40px',
        width: 360, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}>
        <div style={{ fontSize: 38, marginBottom: 10 }}>🔒</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: '0 0 6px' }}>
          Dashboard Locked
        </h2>
        <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 22px' }}>
          You were inactive for a while. Enter your 6-digit MPIN to continue.
        </p>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 18 }}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => { inputsRef.current[i] = el }}
              value={d}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              disabled={checking}
              inputMode="numeric"
              maxLength={1}
              autoFocus={i === 0}
              type="password"
              style={{
                width: 42, height: 50, textAlign: 'center', fontSize: 22,
                fontWeight: 700, borderRadius: 10,
                border: error ? '1.5px solid #FCA5A5' : '1.5px solid #E2E8F0',
                outline: 'none', color: '#0F172A',
              }}
            />
          ))}
        </div>

        {error && (
          <div style={{ color: '#DC2626', fontSize: 13, marginBottom: 16, fontWeight: 600 }}>
            ⚠️ {error}
          </div>
        )}
        {checking && (
          <div style={{ color: '#64748B', fontSize: 13, marginBottom: 16 }}>Verifying…</div>
        )}

        <button
          onClick={handleLogout}
          style={{
            background: 'none', border: 'none', color: '#94A3B8',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 4,
            textDecoration: 'underline',
          }}
        >
          Log out instead
        </button>
      </div>
    </div>
  )
}
