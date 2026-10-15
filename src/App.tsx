import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { AlertsPage } from './pages/AlertsPage'
import { DashboardPage } from './pages/DashboardPage'
import { EquipmentPowerPage } from './pages/EquipmentPowerPage'
import { FactoryLayoutPage } from './pages/FactoryLayoutPage'
import { InspectionGuidePage } from './pages/InspectionGuidePage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/factory-layout" element={<FactoryLayoutPage />} />
        <Route path="/layout" element={<FactoryLayoutPage />} />
        <Route path="/equipment-power" element={<EquipmentPowerPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/inspection-guide" element={<InspectionGuidePage />} />
        <Route path="/forecast" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
