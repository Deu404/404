import { Link } from 'react-router-dom'
import { PowerConsumptionChart } from '../components/dashboard/PowerConsumptionChart'
import { listEquipment } from '../services/equipmentService'
import { getAlertSummary, getAttentionEquipment } from '../services/powerService'
import type { EquipmentStatus } from '../types/status'

export function DashboardPage() {
  const equipment = listEquipment()
  const alertSummary = getAlertSummary()
  const attentionEquipment = getAttentionEquipment()
  const counts = equipment.reduce<Record<EquipmentStatus, number>>((result, item) => ({ ...result, [item.status]: result[item.status] + 1 }), { normal: 0, warning: 0, critical: 0 })
  const measuredPower = equipment.map(({ powerKw }) => powerKw).filter((value): value is number => value !== undefined)
  const totalPower = measuredPower.length ? measuredPower.reduce((sum, value) => sum + value, 0) : undefined

  return <div className="dashboard-page">
    <section className="dashboard-intro"><div><p className="eyebrow">OVERVIEW / LIVE STATUS</p><h2>공장 전력 운영 현황</h2><p>주요 설비의 상태와 전력 소비를 한눈에 확인합니다.</p></div><span className="mock-badge">DEVELOPMENT MOCK DATA</span></section>
    <section className="metric-grid" aria-label="설비 상태 요약">
      <article className="metric-card"><span className="metric-label">전체 설비</span><strong>{equipment.length}<small> 대</small></strong><span className="metric-caption">모니터링 대상</span></article>
      <article className="metric-card status-normal"><span className="metric-label">정상 설비</span><strong>{counts.normal}<small> 대</small></strong><span className="metric-caption">정상 운전 중</span></article>
      <article className="metric-card status-warning"><span className="metric-label">주의 설비</span><strong>{counts.warning}<small> 대</small></strong><span className="metric-caption">관찰이 필요합니다</span></article>
      <article className="metric-card status-critical"><span className="metric-label">이상 설비</span><strong>{counts.critical}<small> 대</small></strong><span className="metric-caption">즉시 확인 필요</span></article>
    </section>
    <div className="dashboard-main-grid"><PowerConsumptionChart /><section className="panel consumption-card"><div className="panel-heading"><div><p className="eyebrow">TOTAL CONSUMPTION</p><h2>공장 전체 전력</h2></div><span className="trend-up">비교 데이터 없음</span></div><strong className="consumption-value">{totalPower === undefined ? '데이터 없음' : <>{totalPower.toLocaleString()} <small>kW</small></>}</strong><p className="muted">현재 측정값 합계 기준 · 전일 및 목표 데이터 없음</p></section></div>
    <div className="dashboard-bottom-grid"><section className="panel alert-panel"><div className="panel-heading"><div><p className="eyebrow">ALERT SUMMARY</p><h2>이상 알림 요약</h2></div><span className="panel-date">오늘 09:40 기준</span></div><div className="alert-list">{alertSummary.length ? alertSummary.map((alert) => <div className="alert-row" key={alert.label}><span className={`status-dot-large ${alert.status}`} /><span>{alert.label}</span><strong>{alert.value === undefined ? '데이터 없음' : alert.value}</strong>{alert.value === undefined ? null : <span className="alert-unit">건</span>}</div>) : <p className="empty-state">표시할 알림 요약이 없습니다.</p>}</div></section><section className="panel attention-panel"><div className="panel-heading"><div><p className="eyebrow">NEEDS ATTENTION</p><h2>주의가 필요한 설비</h2></div><span className="panel-date">{attentionEquipment.length}개 설비</span></div><div className="attention-list">{attentionEquipment.length ? attentionEquipment.map((item) => <Link className="attention-row" key={item.id} to={`/equipment-power?equipment=${item.id}`}><span className={`status-dot-large ${item.status}`} /><div><strong>{item.name}</strong><small>{item.zone} · {item.message}</small></div><b>{item.powerKw === undefined ? '데이터 없음' : `${item.powerKw} kW`}</b></Link>) : <p className="empty-state">주의가 필요한 설비가 없습니다.</p>}</div></section></div>
  </div>
}
