import { NavLink } from 'react-router-dom'
import { navigationItems } from '../../config/navigation'

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">P</span>
        <div>
          <strong>PlantEye</strong>
          <span>전력 모니터링</span>
        </div>
      </div>
      <nav className="sidebar-nav" aria-label="주요 메뉴">
        <p className="nav-heading">MENU</p>
        {navigationItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <span className="nav-dot" aria-hidden="true" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">PlantEye <span>v0.1</span></div>
    </aside>
  )
}
