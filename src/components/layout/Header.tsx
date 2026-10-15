import { useLocation } from 'react-router-dom'
import { navigationItems } from '../../config/navigation'

export function Header() {
  const { pathname } = useLocation()
  const currentPage = navigationItems.find((item) => item.path === pathname) ?? navigationItems[0]

  return (
    <header className="header">
      <div className="header-page">
        <p className="breadcrumb">404 / PlantEye / WORKSPACE</p>
        <h1>{currentPage.label}</h1>
        <p className="project-description">PlantEye 공장 설비 전력 모니터링 및 이상 탐지 서비스</p>
      </div>
      <div className="header-context" aria-label="프로젝트 정보">
        <div><span>TEAM</span><strong>404</strong></div>
        <div><span>PROJECT</span><strong>PlantEye</strong></div>
        <div className="header-status" aria-label="시스템 상태">
          <span className="status-dot" /> 시스템 준비 중
        </div>
      </div>
    </header>
  )
}
