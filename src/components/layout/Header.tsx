import { useLocation } from 'react-router-dom'
import { navigationItems } from '../../config/navigation'

export function Header() {
  const { pathname } = useLocation()
  const currentPage = navigationItems.find((item) => item.path === pathname) ?? navigationItems[0]

  return (
    <header className="header">
      <div>
        <p className="breadcrumb">PlantEye / WORKSPACE</p>
        <h1>{currentPage.label}</h1>
      </div>
      <div className="header-status" aria-label="시스템 상태">
        <span className="status-dot" /> 시스템 준비 중
      </div>
    </header>
  )
}
