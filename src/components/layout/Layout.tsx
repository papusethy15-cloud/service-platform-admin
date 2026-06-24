import { ReactNode, useEffect } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { usePlatformStore } from '@/store/platformStore'
import PlatformSetupWizard from '@/components/ui/PlatformSetupWizard'

export default function Layout({ children }: { children: ReactNode }) {
  const { load, loaded, profileComplete } = usePlatformStore()

  useEffect(() => { load() }, [load])

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
    </div>
  )
}
