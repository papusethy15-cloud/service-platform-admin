import { useEffect } from 'react'

type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastData {
  id: string
  type: ToastType
  title: string
  message?: string
}

interface ToastProps {
  toasts: ToastData[]
  onRemove: (id: string) => void
}

const ICONS: Record<ToastType, string>   = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' }
const BG:    Record<ToastType, string>   = { success: '#F0FDF4', error: '#FEF2F2', info: '#EFF6FF', warning: '#FFFBEB' }
const BORDER:Record<ToastType, string>   = { success: '#86EFAC', error: '#FCA5A5', info: '#BFDBFE', warning: '#FDE68A' }
const COLOR: Record<ToastType, string>   = { success: '#166534', error: '#991B1B', info: '#1E40AF', warning: '#92400E' }

function ToastItem({ toast, onRemove }: { toast: ToastData; onRemove: (id: string) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onRemove(toast.id), 3500)
    return () => clearTimeout(t)
  }, [toast.id, onRemove])

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px',
      background: BG[toast.type], border: `1px solid ${BORDER[toast.type]}`,
      borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.10)',
      minWidth: 300, maxWidth: 400,
      animation: 'toastIn 0.25s cubic-bezier(.34,1.56,.64,1)',
    }}>
      <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.3 }}>{ICONS[toast.type]}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: COLOR[toast.type] }}>{toast.title}</div>
        {toast.message && (
          <div style={{ fontSize: 12, color: COLOR[toast.type], opacity: 0.85, marginTop: 2 }}>{toast.message}</div>
        )}
      </div>
      <button onClick={() => onRemove(toast.id)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16,
          color: COLOR[toast.type], opacity: 0.6, padding: '0 2px', lineHeight: 1, flexShrink: 0 }}>×</button>
    </div>
  )
}

export default function Toast({ toasts, onRemove }: ToastProps) {
  if (toasts.length === 0) return null
  return (
    <>
      <style>{`@keyframes toastIn { from { opacity:0; transform:translateX(60px) scale(0.95) } to { opacity:1; transform:none } }`}</style>
      <div style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {toasts.map(t => <ToastItem key={t.id} toast={t} onRemove={onRemove} />)}
      </div>
    </>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────
import { useState, useCallback } from 'react'

export function useToast() {
  const [toasts, setToasts] = useState<ToastData[]>([])

  const addToast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = Date.now().toString()
    setToasts(t => [...t, { id, type, title, message }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(t => t.filter(x => x.id !== id))
  }, [])

  const toast = {
    success: (title: string, message?: string) => addToast('success', title, message),
    error:   (title: string, message?: string) => addToast('error',   title, message),
    info:    (title: string, message?: string) => addToast('info',    title, message),
    warning: (title: string, message?: string) => addToast('warning', title, message),
  }

  return { toasts, removeToast, toast }
}
