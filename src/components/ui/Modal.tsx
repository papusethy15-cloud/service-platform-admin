import { ReactNode, useEffect } from 'react'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean        // 760px max width
  size?: 'sm' | 'md' | 'lg' | 'xl'  // sm=440, md=560(default), lg=720, xl=900
}

const SIZE_MAP: Record<string, number> = { sm: 440, md: 560, lg: 720, xl: 900 }

export default function Modal({ title, onClose, children, wide, size = 'md' }: ModalProps) {
  const maxWidth = wide ? 760 : SIZE_MAP[size]

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:50,
        display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background:'white', borderRadius:16, width:'100%', maxWidth,
        maxHeight:'92vh', overflow:'auto', boxShadow:'0 20px 64px rgba(0,0,0,0.22)',
        animation: 'modalIn 0.18s ease' }}>
        <style>{`@keyframes modalIn { from { opacity:0; transform:translateY(-12px) scale(0.97) } to { opacity:1; transform:none } }`}</style>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'18px 24px', borderBottom:'1px solid #E2E8F0', position:'sticky', top:0,
          background:'white', zIndex:1, borderRadius:'16px 16px 0 0' }}>
          <h3 style={{ fontSize:16, fontWeight:700, color:'#0F172A', margin:0 }}>{title}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer',
            fontSize:22, color:'#94A3B8', lineHeight:1, padding:'2px 6px',
            borderRadius:6, transition:'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.color='#374151')}
            onMouseLeave={e => (e.currentTarget.style.color='#94A3B8')}>×</button>
        </div>
        <div style={{ padding:24 }}>{children}</div>
      </div>
    </div>
  )
}
