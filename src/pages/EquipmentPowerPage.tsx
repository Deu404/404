import { useEffect, useState } from 'react'
import { DateRangeFilter } from '../components/common/DateRangeFilter'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { EQUIPMENT_LAYOUT } from '../config/equipmentDataMap'
import { alertTypeLabels, getAlertsByEquipmentId, priorityLabels, severityLabels } from '../services/alertService'
import { getEquipmentCsvDetailById, getEquipmentDetailById } from '../services/powerService'
import { listEquipment } from '../services/equipmentService'
import type { EquipmentStatus } from '../types/status'
import { getDateRangeValidation, isDateInRange, type DateRange } from '../utils/dateRange'
import { getModelAnomaliesByEquipmentId } from '../services/anomalyService'

const GUIDE_KEY_BY_EQUIPMENT: Record<string, string> = {
  'cooling-02': 'power-consumption-increase',
  'motor-02': 'overcurrent',
  'compressor-01': 'power-consumption-increase',
  'compressor-02': 'power-consumption-increase',
  'robot-02': 'power-consumption-increase',
  'pump-02': 'low-power-factor',
  'transformer-01': 'phase-current-imbalance',
}
const statusLabels: Record<EquipmentStatus, string> = { normal: '정상', warning: '주의', critical: '이상' }

const CHART_WIDTH = 760
const CHART_HEIGHT = 300
const CHART_PADDING = { top: 34, right: 24, bottom: 54, left: 58 }

function formatNumber(value: number | undefined) {
  return value === undefined ? '데이터 없음' : value.toLocaleString('ko-KR')
}

function formatDifference(value: number | undefined, unit: string) {
  return value === undefined ? '데이터 없음' : `${value > 0 ? '+' : ''}${formatNumber(value)} ${unit}`
}

export function EquipmentPowerPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const requestedEquipmentId = searchParams.get('equipment')
  const equipmentRecords = listEquipment()
  const layoutEquipment = EQUIPMENT_LAYOUT.flatMap((layoutItem) => {
    const item = equipmentRecords.find(({ id }) => id === layoutItem.id)
    return item ? [{ ...item, name: layoutItem.name }] : []
  })
  const equipment = requestedEquipmentId === null
    ? layoutEquipment[0]
    : layoutEquipment.find(({ id }) => id === requestedEquipmentId)
  const equipmentId = equipment?.id
  const equipmentSelector = <label className="equipment-selector">분석 설비<select value={equipmentId ?? ''} onChange={(event) => navigate(`/equipment-power?equipment=${event.target.value}`)}>{layoutEquipment.map(({ id, name }) => <option value={id} key={id}>{name}</option>)}</select></label>
  const [csvDetail, setCsvDetail] = useState<Awaited<ReturnType<typeof getEquipmentCsvDetailById>>>()
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: '', endDate: '' })
  const dateValidation = getDateRangeValidation(dateRange)
  useEffect(() => {
    let cancelled = false
    setCsvDetail(undefined)
    if (equipmentId) getEquipmentCsvDetailById(equipmentId).then((nextDetail) => { if (!cancelled) setCsvDetail(nextDetail) })
    return () => { cancelled = true }
  }, [equipmentId])
  const detail = csvDetail ?? (equipmentId ? getEquipmentDetailById(equipmentId) : undefined)
  const filteredDetail = detail ? {
    ...detail,
    currentPowerSeries: detail.currentPowerSeries.filter(({ time }) => isDateInRange(time, dateValidation)),
    lastMonthPowerSeries: detail.lastMonthPowerSeries.filter(({ time }) => isDateInRange(time, dateValidation)),
  } : undefined
  const relatedAlerts = equipment ? getAlertsByEquipmentId(equipment.id).filter(({ occurredAt }) => isDateInRange(occurredAt, dateValidation)) : []
  const modelAnomalies = getModelAnomaliesByEquipmentId(equipmentId)
  const relatedGuideKey = relatedAlerts[0]?.guideKey || (equipment ? GUIDE_KEY_BY_EQUIPMENT[equipment.id] : undefined) || 'power-consumption-increase'
  const relatedAlertsPanel = <section className="panel equipment-alerts-panel" aria-labelledby="equipment-alerts-title"><div className="panel-heading"><div><p className="eyebrow">RELATED ALERTS</p><h2 id="equipment-alerts-title">관련 알림</h2></div><span className="equipment-count">{relatedAlerts.length}건</span></div>{relatedAlerts.length ? <div className="equipment-alert-list">{relatedAlerts.map((alert) => <Link className="equipment-alert-row" key={alert.id} to={`/alerts?alert=${alert.id}`}><span className={`status-dot-large ${alert.severity}`} /><span><strong>{alertTypeLabels[alert.type]}</strong><small>{alert.occurredAt} · {alert.summary}</small></span><b>{severityLabels[alert.severity]} · {priorityLabels[alert.priority]} →</b></Link>)}</div> : <p className="empty-state">이 설비와 연결된 알림이 없습니다.</p>}<Link className="detail-link" to={relatedGuideKey ? `/inspection-guide?guide=${relatedGuideKey}` : '/inspection-guide'}>설비 관련 점검 가이드 보기 <span>→</span></Link></section>

  if (!equipment) return <div className="dashboard-page equipment-power-page"><section className="dashboard-intro"><div><p className="eyebrow">EQUIPMENT POWER / DETAIL ANALYSIS</p><h2>설비 전력 분석</h2><p>선택된 설비의 전력 상세 정보를 확인할 수 있습니다.</p></div>{equipmentSelector}<span className="mock-badge">DEVELOPMENT MOCK DATA</span></section><section className="panel invalid-selection-panel"><p className="eyebrow">EQUIPMENT NOT FOUND</p><h2>설비를 찾을 수 없습니다.</h2><p className="empty-state">요청한 설비 ID <strong>{requestedEquipmentId}</strong>에 해당하는 데이터가 없습니다.</p><Link className="detail-link" to="/equipment-power">기본 설비로 돌아가기 <span>→</span></Link></section></div>

  if (!detail) return <div className="dashboard-page equipment-power-page">
    <section className="dashboard-intro"><div><p className="eyebrow">EQUIPMENT POWER / DETAIL ANALYSIS</p><h2>{equipment.name} 전력 분석</h2><p>{equipment.zone} · 설비 ID {equipment.id}</p></div>{equipmentSelector}<span className="mock-badge">DEVELOPMENT MOCK DATA</span></section>
    <DateRangeFilter {...dateRange} onChange={setDateRange} error={dateValidation.error} resultCount={filteredDetail?.currentPowerSeries.length ?? 0} />
    <section className="panel equipment-summary-panel" aria-labelledby="equipment-summary-title"><div className="equipment-summary-heading"><div><p className="eyebrow">EQUIPMENT IDENTITY</p><h2 id="equipment-summary-title">{equipment.name}</h2><p className="equipment-meta">{equipment.id} · {equipment.zone}</p></div><span className={`detail-status ${equipment.status}`}>{statusLabels[equipment.status]} 운전</span></div><p className="empty-state">이 설비의 상세 분석 데이터가 없습니다. 분석 데이터가 제공되면 연결할 수 있습니다.</p></section>
    {relatedAlertsPanel}
    <section className="panel anomaly-panel"><div className="panel-heading"><div><p className="eyebrow">MODEL OUTPUT</p><h2>모델 감지 결과</h2></div><span className="alert-badge warning">의심 항목</span></div>{modelAnomalies.length ? modelAnomalies.map((anomaly) => <p key={anomaly.id}><strong>{anomaly.fields.join(', ')}</strong> · 모델 감지 <small>source: {anomaly.source}</small></p>) : <p className="empty-state">이 설비에서 모델 감지 결과가 없습니다.</p>}<p className="muted">fault 확정이나 심각도·우선순위가 아닌 모델 출력입니다.</p></section>
    <section className="panel detail-chart-panel"><p className="empty-state">표시할 전력 비교 데이터가 없습니다.</p></section>
    <div className="equipment-analysis-grid"><section className="panel anomaly-panel"><p className="empty-state">표시할 이상 탐지 데이터가 없습니다.</p></section><section className="panel history-panel"><p className="empty-state">기록된 이상 탐지 이력이 없습니다.</p></section></div>
  </div>

  const currentPowerSeries = Array.isArray(filteredDetail?.currentPowerSeries) ? filteredDetail.currentPowerSeries : []
  const lastMonthPowerSeries = Array.isArray(filteredDetail?.lastMonthPowerSeries) ? filteredDetail.lastMonthPowerSeries : []
  const anomalyHistory = Array.isArray(detail.anomalyHistory) ? detail.anomalyHistory : []
  const energyKwh = detail.energyKwh
  const currentPower = detail.powerKw ?? equipment.powerKw
  const activeAnomaly = anomalyHistory.find(({ state }) => state === 'open')
  const powerValues = [...currentPowerSeries, ...lastMonthPowerSeries].map(({ powerKw }) => powerKw).filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const maxPower = powerValues.length ? Math.max(50, Math.ceil(Math.max(...powerValues) / 50) * 50) : 50
  const chartWidth = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right
  const chartHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom
  const pointsFor = (series: typeof currentPowerSeries) => series.flatMap((item, index) => item.powerKw === undefined ? [] : [{
    ...item,
    x: CHART_PADDING.left + (index * chartWidth) / Math.max(series.length - 1, 1),
    y: CHART_PADDING.top + chartHeight - (item.powerKw / maxPower) * chartHeight,
  }])
  const currentPoints = pointsFor(currentPowerSeries)
  const lastMonthPoints = pointsFor(lastMonthPowerSeries)
  const currentLinePoints = currentPoints.map(({ x, y }) => `${x},${y}`).join(' ')
  const lastMonthLinePoints = lastMonthPoints.map(({ x, y }) => `${x},${y}`).join(' ')
  const chartTicks = [0, 1, 2, 3, 4].map((index) => (maxPower / 4) * index)

  return <div className="dashboard-page equipment-power-page">
    <section className="dashboard-intro"><div><p className="eyebrow">EQUIPMENT POWER / DETAIL ANALYSIS</p><h2>{equipment.name} 전력 분석</h2><p>{equipment.zone} · 설비 ID {equipment.id}</p></div>{equipmentSelector}<span className="mock-badge">DEVELOPMENT MOCK DATA</span></section>

    <DateRangeFilter {...dateRange} onChange={setDateRange} error={dateValidation.error} resultCount={filteredDetail?.currentPowerSeries.length ?? 0} />
    <section className="panel equipment-summary-panel" aria-labelledby="equipment-summary-title">
      <div className="equipment-summary-heading"><div><p className="eyebrow">EQUIPMENT IDENTITY</p><h2 id="equipment-summary-title">{equipment.name}</h2><p className="equipment-meta">{equipment.id} · {equipment.zone}</p></div><span className={`detail-status ${equipment.status}`}>{statusLabels[equipment.status]} 운전</span></div>
      <div className="equipment-metric-grid">
        <div className="equipment-metric"><span>현재 전력</span><strong>{formatNumber(currentPower)} <small>kW</small></strong><em>실시간 기준</em></div>
        <div className="equipment-metric"><span>현재 누적 전력량</span><strong>{formatNumber(energyKwh.current)} <small>kWh</small></strong><em>이번 달 누적</em></div>
        <div className="equipment-metric"><span>지난달 동일 기간 대비</span><strong className={energyKwh.difference === undefined || energyKwh.difference >= 0 ? 'metric-increase' : 'metric-decrease'}>{formatDifference(energyKwh.difference, 'kWh')}</strong><em>{energyKwh.changeRatePercent === undefined ? '데이터 없음' : `${energyKwh.changeRatePercent > 0 ? '+' : ''}${energyKwh.changeRatePercent}% 변화`}</em></div>
      </div>
    </section>

    {relatedAlertsPanel}

    <section className="panel anomaly-panel"><div className="panel-heading"><div><p className="eyebrow">MODEL OUTPUT</p><h2>모델 감지 결과</h2></div><span className="alert-badge warning">의심 항목</span></div>{modelAnomalies.length ? modelAnomalies.map((anomaly) => <p key={anomaly.id}><strong>{anomaly.fields.join(', ')}</strong> · 모델 감지 <small>source: {anomaly.source}</small></p>) : <p className="empty-state">이 설비에서 모델 감지 결과가 없습니다.</p>}<p className="muted">fault 확정이나 심각도·우선순위가 아닌 모델 출력입니다.</p></section>

    <section className="panel detail-chart-panel" aria-labelledby="equipment-chart-title">
      <div className="panel-heading"><div><p className="eyebrow">HOURLY POWER COMPARISON</p><h2 id="equipment-chart-title">시간대별 전력 소비 비교</h2><p className="panel-description">현재와 지난달 동일 시간대의 순간 전력을 비교합니다.</p></div><div className="detail-chart-legend" aria-label="차트 범례"><span><i className="detail-legend-line current" />현재</span><span><i className="detail-legend-line last-month" />지난달</span></div></div>
      <div className="detail-chart-wrap">
        {currentPoints.length || lastMonthPoints.length ? <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-labelledby="equipment-chart-title equipment-chart-description">
          <desc id="equipment-chart-description">{equipment.name}의 현재와 지난달 동일 시간대 전력 소비량을 kW 단위로 비교한 그래프</desc>
          {chartTicks.map((value) => { const y = CHART_PADDING.top + chartHeight - (value / maxPower) * chartHeight; return <g key={value}><line className="chart-grid" x1={CHART_PADDING.left} x2={CHART_WIDTH - CHART_PADDING.right} y1={y} y2={y} /><text className="chart-label" x={CHART_PADDING.left - 10} y={y + 4} textAnchor="end">{Math.round(value)}</text></g> })}
          <line className="chart-axis" x1={CHART_PADDING.left} x2={CHART_WIDTH - CHART_PADDING.right} y1={CHART_PADDING.top + chartHeight} y2={CHART_PADDING.top + chartHeight} />
          <polyline className="detail-chart-line last-month" points={lastMonthLinePoints} />
          <polyline className="detail-chart-line current" points={currentLinePoints} />
          {currentPoints.map(({ time, powerKw, x, y }, index) => <g key={`current-${equipment.id}-${time}-${powerKw}-${index}`}><circle className="detail-chart-point current" cx={x} cy={y} r="4" /><title>{`${time} 현재: ${powerKw} kW`}</title></g>)}
          {lastMonthPoints.map(({ time, powerKw, x, y }, index) => <g key={`last-month-${equipment.id}-${time}-${powerKw}-${index}`}><circle className="detail-chart-point last-month" cx={x} cy={y} r="3" /><text className="chart-label chart-x-label" x={x} y={CHART_HEIGHT - 20} textAnchor="middle">{time}</text><title>{`${time} 지난달: ${powerKw} kW`}</title></g>)}
          <text className="chart-unit" x="12" y={CHART_PADDING.top - 10}>전력 (kW)</text><text className="chart-unit" x={CHART_WIDTH - CHART_PADDING.right} y={CHART_HEIGHT - 3} textAnchor="end">시간</text>
        </svg> : <p className="empty-state">표시할 전력 비교 데이터가 없습니다.</p>}
      </div>
    </section>

    <div className="equipment-analysis-grid">
      <section className="panel anomaly-panel" aria-labelledby="anomaly-title"><div className="panel-heading"><div><p className="eyebrow">ANOMALY DETECTION</p><h2 id="anomaly-title">이상 탐지 결과</h2></div><span className={`detail-status ${activeAnomaly?.severity ?? 'normal'}`}>{activeAnomaly ? '확인 필요' : '정상'}</span></div><div className={`anomaly-summary ${activeAnomaly ? `is-${activeAnomaly.severity}` : 'is-normal'}`}><span className={`status-dot-large ${activeAnomaly?.severity ?? 'normal'}`} /><div><strong>{activeAnomaly?.message ?? '현재 감지된 이상이 없습니다.'}</strong><p>{activeAnomaly ? '미해결 이상 항목이 있어 점검이 필요합니다.' : '최근 데이터 기준 정상 범위 내에서 운전 중입니다.'}</p></div></div><Link className="detail-link" to={`/inspection-guide?guide=${relatedGuideKey}&equipment=${equipment.id}`}>관련 점검 가이드 보기 <span>→</span></Link></section>
      <section className="panel history-panel" aria-labelledby="history-title"><div className="panel-heading"><div><p className="eyebrow">ANOMALY HISTORY</p><h2 id="history-title">이상 탐지 이력</h2></div><span className="equipment-count">{anomalyHistory.length}건</span></div>{anomalyHistory.length > 0 ? <div className="anomaly-history">{anomalyHistory.map((item) => <div className="anomaly-history-row" key={`${item.detectedAt}-${item.message}`}><span className={`status-dot-large ${item.severity}`} /><div><strong>{item.message}</strong><small>{item.detectedAt}</small></div><span className={`history-state ${item.state}`}>{item.state === 'open' ? '미해결' : '처리됨'}</span></div>)}</div> : <p className="empty-history">기록된 이상 탐지 이력이 없습니다.</p>}</section>
    </div>
  </div>
}
