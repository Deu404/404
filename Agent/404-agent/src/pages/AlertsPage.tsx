import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AgentPanel } from '../components/alerts/AgentPanel'
import { DateRangeFilter } from '../components/common/DateRangeFilter'
import { listModelAnomalies } from '../services/anomalyService'
import { listEquipment } from '../services/equipmentService'
import { getEquipmentCsvDetailById } from '../services/powerService'
import { getDateRangeValidation, isDateInRange, type DateRange } from '../utils/dateRange'
import type { AnomalyDetection } from '../types/anomaly'
import type { EquipmentDetail } from '../types/equipment'

type FilterValue = 'all' | string

const CHART_WIDTH = 760
const CHART_HEIGHT = 280
const CHART_PADDING = { top: 30, right: 24, bottom: 46, left: 58 }

function PowerTrend({ detail, equipmentName }: { detail?: EquipmentDetail; equipmentName: string }) {
  const series = detail?.currentPowerSeries ?? []
  const points = series.flatMap((item, index) => item.powerKw === undefined ? [] : [{ ...item, x: CHART_PADDING.left + (index * (CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right)) / Math.max(series.length - 1, 1), power: item.powerKw }])
  const values = points.map(({ power }) => power)
  const maxPower = values.length ? Math.max(1, Math.ceil(Math.max(...values) / 10) * 10) : 1
  const chartHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom
  const plotted = points.map(({ x, power, ...item }) => ({ ...item, x, power, y: CHART_PADDING.top + chartHeight - (power / maxPower) * chartHeight }))
  const line = plotted.map(({ x, y }) => `${x},${y}`).join(' ')
  const ticks = [0, 1, 2, 3, 4].map((index) => (maxPower / 4) * index)

  return <section className="panel alert-power-panel" aria-labelledby="alert-power-title">
    <div className="panel-heading"><div><p className="eyebrow">LIVE EQUIPMENT DATA</p><h2 id="alert-power-title">{equipmentName} 전력 추이</h2><p className="panel-description">선택 설비 CSV의 실제 측정 시각별 유효 전력입니다.</p></div><span className="equipment-count">{points.length ? `${points.length}건` : '데이터 없음'}</span></div>
    <div className="alert-power-chart">{plotted.length ? <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-label={`${equipmentName} 실제 전력 추이`}>
      {ticks.map((value) => { const y = CHART_PADDING.top + chartHeight - (value / maxPower) * chartHeight; return <g key={value}><line className="chart-grid" x1={CHART_PADDING.left} x2={CHART_WIDTH - CHART_PADDING.right} y1={y} y2={y} /><text className="chart-label" x={CHART_PADDING.left - 9} y={y + 4} textAnchor="end">{Math.round(value)}</text></g> })}
      <line className="chart-axis" x1={CHART_PADDING.left} x2={CHART_WIDTH - CHART_PADDING.right} y1={CHART_HEIGHT - CHART_PADDING.bottom} y2={CHART_HEIGHT - CHART_PADDING.bottom} /><polyline className="detail-chart-line current" points={line} />
      {plotted.map(({ time, power, x, y }, index) => <g key={`${time}-${index}`}><circle className="detail-chart-point current" cx={x} cy={y} r="3" /><title>{`${time}: ${power} kW`}</title></g>)}
      <text className="chart-unit" x="12" y={CHART_PADDING.top - 8}>전력 (kW)</text><text className="chart-unit" x={CHART_WIDTH - CHART_PADDING.right} y={CHART_HEIGHT - 5} textAnchor="end">측정 시각</text>
    </svg> : <div className="empty-state alert-chart-empty">선택 설비의 실제 전력 데이터가 없습니다.</div>}</div>
  </section>
}

export function AlertsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const equipmentOptions = useMemo(() => listEquipment(), [])
  const [modelAnomalies, setModelAnomalies] = useState<AnomalyDetection[]>([])
  const requestedId = searchParams.get('anomaly')
  const requestedEquipment = searchParams.get('equipment')
  const [query, setQuery] = useState('')
  const [equipmentFilter, setEquipmentFilter] = useState<FilterValue>('all')
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: '', endDate: '' })
  const [selectedId, setSelectedId] = useState(requestedId ?? '')
  const [powerDetail, setPowerDetail] = useState<EquipmentDetail>()
  const dateValidation = getDateRangeValidation(dateRange)

  useEffect(() => {
    let cancelled = false
    listModelAnomalies().then((results) => { if (!cancelled) setModelAnomalies(results) })
    return () => { cancelled = true }
  }, [])

  const anomalies = useMemo(() => modelAnomalies.filter((anomaly) => {
    const searchable = `${anomaly.id} ${anomaly.equipmentId} ${anomaly.equipmentName} ${anomaly.fields.join(' ')}`.toLowerCase()
    return isDateInRange(anomaly.occurredAt, dateValidation) && (equipmentFilter === 'all' || anomaly.equipmentId === equipmentFilter) && searchable.includes(query.toLowerCase())
  }), [modelAnomalies, equipmentFilter, query, dateValidation])
  const selected = requestedId ? anomalies.find(({ id }) => id === requestedId) : anomalies.find(({ id }) => id === selectedId) ?? anomalies[0]
  const selectedEquipmentId = selected?.equipmentId ?? requestedEquipment ?? equipmentOptions[0]?.id
  const selectedEquipment = equipmentOptions.find(({ id }) => id === selectedEquipmentId) ?? equipmentOptions[0]

  useEffect(() => {
    let cancelled = false
    setPowerDetail(undefined)
    if (selectedEquipmentId) getEquipmentCsvDetailById(selectedEquipmentId).then((detail) => { if (!cancelled) setPowerDetail(detail) })
    return () => { cancelled = true }
  }, [selectedEquipmentId])

  const equipmentSummary = useMemo(() => {
    const counts = new Map<string, number>()
    anomalies.forEach(({ equipmentId }) => counts.set(equipmentId, (counts.get(equipmentId) ?? 0) + 1))
    return [...counts.entries()].map(([id, count]) => ({ equipment: equipmentOptions.find(({ id: itemId }) => itemId === id), count })).filter(({ equipment }) => equipment)
  }, [anomalies, equipmentOptions])

  const selectAnomaly = (anomaly: AnomalyDetection) => {
    setSelectedId(anomaly.id)
    setSearchParams({ anomaly: anomaly.id })
  }
  const filteredPowerDetail = powerDetail ? { ...powerDetail, currentPowerSeries: powerDetail.currentPowerSeries.filter(({ time }) => isDateInRange(time, dateValidation)) } : undefined
  const filteredPowerCount = filteredPowerDetail?.currentPowerSeries.length ?? 0
  const hasModelResults = anomalies.length > 0

  return <div className="dashboard-page alerts-page">
    <section className="dashboard-intro"><div><p className="eyebrow">ANOMALY MONITORING / FIELD VIEW</p><h2>이상탐지 대시보드</h2><p>실제 모델 결과와 설비 측정 데이터를 기준으로 확인합니다.</p></div><span className="data-badge">REAL DATA ONLY</span></section>

    <div className="agent-top-section"><Link className="detail-link" to="/agent-demo">연습용 에이전트 확인</Link><p className="panel-description">선택한 설비의 이상 항목과 측정 근거를 바탕으로 초기 점검을 안내합니다. 모델 감지는 고장 확정이 아닙니다.</p><AgentPanel key={selected?.id ?? 'no-anomaly'} anomaly={selected} /></div>

    <section className="alert-summary-grid" aria-label="이상 알림 요약">
      <div className="alert-summary-card urgent"><span>긴급</span><strong>룰 판정 자료 대기</strong><small>모델 결과에 심각도·우선순위가 없습니다.</small></div>
      <div className="alert-summary-card caution"><span>주의</span><strong>룰 판정 자료 대기</strong><small>임의 규칙으로 분류하지 않습니다.</small></div>
      <div className="alert-summary-card resolved"><span>확인 완료</span><strong>데이터 없음</strong><small>확인 상태가 제공되지 않았습니다.</small></div>
    </section>

    <DateRangeFilter {...dateRange} onChange={setDateRange} error={dateValidation.error} resultCount={filteredPowerCount} />
    <section className="alert-controls panel" aria-label="이상 알림 필터"><label>검색<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="설비명, 의심 항목" /></label><label>설비<select value={equipmentFilter} onChange={(event) => setEquipmentFilter(event.target.value)}><option value="all">전체 설비</option>{equipmentOptions.map(({ id, name }) => <option value={id} key={id}>{name}</option>)}</select></label><span className="control-help">필터는 실제 모델 결과와 실제 측정 데이터에만 적용됩니다.</span></section>

    <div className="alerts-wire-grid">
      <aside className="panel alert-inbox-panel" aria-labelledby="alert-inbox-title"><div className="panel-heading"><div><p className="eyebrow">FIELD INBOX</p><h2 id="alert-inbox-title">확인할 이상 알림</h2></div><span className="equipment-count">{anomalies.length ? `${anomalies.length}건` : '데이터 없음'}</span></div>{anomalies.length ? <div className="alert-detail-list">{anomalies.map((anomaly) => <button type="button" className={`alert-detail-row ${selected?.id === anomaly.id ? 'selected' : ''}`} key={anomaly.id} onClick={() => selectAnomaly(anomaly)}><span className="status-dot-large warning" /><span className="alert-row-main"><strong>{anomaly.equipmentName}</strong><small>{anomaly.occurredAt}</small><p>{anomaly.fields.join(', ')} · 확인 상태 데이터 없음</p></span></button>)}</div> : <div className="alert-empty"><strong>표시할 모델 이상 결과가 없습니다.</strong><p>실제 모델 결과 API가 연결되면 장비명, 발생 시각, 의심 항목이 여기에 표시됩니다.</p></div>}</aside>

      <main className="alert-evidence-column"><PowerTrend detail={filteredPowerDetail} equipmentName={selectedEquipment?.name ?? '선택 설비'} />{hasModelResults && <section className="panel alert-reason-panel" aria-labelledby="alert-reason-title"><div className="panel-heading"><div><p className="eyebrow">MODEL EVIDENCE</p><h2 id="alert-reason-title">왜 이상인가?</h2></div><span className="equipment-count">모델 근거</span></div><p className="selected-equipment">{selected?.equipmentName} · {selected?.occurredAt}</p><p className="selected-detail">모델이 의심 대상으로 반환한 항목: <strong>{selected?.fields.join(', ')}</strong></p><div className="alert-fact-grid"><span>발생 시각<strong>{selected?.occurredAt}</strong></span><span>측정 근거<strong>{powerDetail ? 'CSV 조회됨' : '데이터 없음'}</strong></span><span>심각도<strong>데이터 없음</strong></span><span>우선순위<strong>데이터 없음</strong></span></div></section>}</main>
    </div>

    {hasModelResults && <section className="panel equipment-summary-panel alert-equipment-summary" aria-labelledby="alert-equipment-summary-title"><div className="panel-heading"><div><p className="eyebrow">EQUIPMENT TREND</p><h2 id="alert-equipment-summary-title">설비별 이상 건수와 추이</h2></div><span className="equipment-count">모델 결과 기준</span></div><div className="alert-detail-list">{equipmentSummary.map(({ equipment, count }) => <Link className="equipment-alert-row" to={`/alerts?anomaly=${anomalies.find(({ equipmentId }) => equipmentId === equipment?.id)?.id ?? ''}`} key={equipment?.id}><span><strong>{equipment?.name}</strong><small>{count}건 · 실제 발생 시각은 알림 목록에서 확인</small></span><b>{count}건</b></Link>)}</div></section>}
  </div>
}
