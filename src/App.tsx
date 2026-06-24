import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import Layout from '@/components/layout/Layout'

import Login          from '@/pages/Login'
import Dashboard      from '@/pages/Dashboard'
import Bookings       from '@/pages/Bookings'
import Domains        from '@/pages/Domains'
import Cities         from '@/pages/Cities'
import Services       from '@/pages/Services'
import Customers      from '@/pages/Customers'
import Technicians    from '@/pages/Technicians'
import Inventory      from '@/pages/Inventory'
import Appliances     from '@/pages/Appliances'
import Quotations     from '@/pages/Quotations'
import Invoices       from '@/pages/Invoices'
import Payments       from '@/pages/Payments'
import Commissions    from '@/pages/Commissions'
import CashCollections from '@/pages/CashCollections'
import CommissionGroups from '@/pages/CommissionGroups'
import Wallet         from '@/pages/Wallet'
import Coupons        from '@/pages/Coupons'
import Escalations    from '@/pages/Escalations'
import Attendance     from '@/pages/Attendance'
import Refunds        from '@/pages/Refunds'
import Franchises     from '@/pages/Franchises'
import AMC            from '@/pages/AMC'
import Warranty       from '@/pages/Warranty'
import Notifications  from '@/pages/Notifications'
import Reports        from '@/pages/Reports'
import Audit          from '@/pages/Audit'
import Users          from '@/pages/Users'
import Settings       from '@/pages/Settings'
import CallbackRequests from '@/pages/CallbackRequests'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={
          <PrivateRoute>
            <Layout>
              <Routes>
                <Route path="/"             element={<Dashboard />} />
                <Route path="/bookings"     element={<Bookings />} />
                <Route path="/domains"      element={<Domains />} />
                <Route path="/cities"       element={<Cities />} />
                <Route path="/services"     element={<Services />} />
                <Route path="/customers"    element={<Customers />} />
                <Route path="/technicians"  element={<Technicians />} />
                <Route path="/inventory"    element={<Inventory />} />
                <Route path="/appliances"   element={<Appliances />} />
                <Route path="/quotations"   element={<Quotations />} />
                <Route path="/invoices"     element={<Invoices />} />
                <Route path="/payments"     element={<Payments />} />
                <Route path="/commissions"  element={<Commissions />} />
                <Route path="/cash-collections" element={<CashCollections />} />
                <Route path="/commission-groups" element={<CommissionGroups />} />
                <Route path="/wallet"       element={<Wallet />} />
                <Route path="/coupons"      element={<Coupons />} />
                <Route path="/escalations"  element={<Escalations />} />
                <Route path="/attendance"   element={<Attendance />} />
                <Route path="/refunds"      element={<Refunds />} />
                <Route path="/franchises"   element={<Franchises />} />
                <Route path="/amc"          element={<AMC />} />
                <Route path="/warranty"     element={<Warranty />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/reports"      element={<Reports />} />
                <Route path="/audit"        element={<Audit />} />
                <Route path="/users"        element={<Users />} />
                <Route path="/settings"     element={<Settings />} />
                <Route path="/callback-requests" element={<CallbackRequests />} />
                <Route path="*"             element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </PrivateRoute>
        } />
      </Routes>
    </BrowserRouter>
  )
}
