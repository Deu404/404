import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AgentDock } from '../components/alerts/AgentDock'
import { EquipmentOverview } from '../components/alerts/EquipmentOverview'
import { summarizeEquipment, type EquipmentSummary } from '../services/equipmentOverview'
import { AlertFilterBar } from '../components/alerts/AlertFilterBar'
import { listModelAnomalies } from '../services/anomalyService'
import { listEquipment } from '../services/equipmentService'
import { getEquipmentCsvDetailById } from '../services/powerService'
import { getDateRangeValidation, isDateInRange, type DateRange } from '../utils/dateRange'
import type { AnomalyDetection } from '../types/anomaly'
import type { EquipmentDetail } from '../types/equipment'

type FilterValue = 'all' | string

const ALERT_PAGE_SIZE = 50
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
  const [dockExpanded, setDockExpanded] = useState(false)
  const [loadingAnomalies, setLoadingAnomalies] = useState(true)
  const requestedId = searchParams.get('anomaly')
  const requestedEquipment = searchParams.get('equipment')
  const [query, setQuery] = useState('')
  const [pageIndex, setPageIndex] = useState(0)
  const [equipmentFilter, setEquipmentFilter] = useState<FilterValue>(() => equipmentOptions.some(item => item.id === requestedEquipment) ? requestedEquipment! : 'all')
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: '', endDate: '' })
  const [selectedId, setSelectedId] = useState(requestedId ?? '')
  const [powerDetail, setPowerDetail] = useState<EquipmentDetail>()
  const dateValidation = useMemo(() => getDateRangeValidation(dateRange), [dateRange])

  useEffect(() => {
    let cancelled = false
    listModelAnomalies().then((results) => { if (!cancelled) { setModelAnomalies(results); setLoadingAnomalies(false) } })
    return () => { cancelled = true }
  }, [])

  const anomalies = useMemo(() => modelAnomalies.filter((anomaly) => {
    const searchable = `${anomaly.id} ${anomaly.equipmentId} ${anomaly.equipmentName} ${anomaly.fields.join(' ')}`.toLowerCase()
    return isDateInRange(anomaly.occurredAt, dateValidation) && (equipmentFilter === 'all' || anomaly.equipmentId === equipmentFilter) && searchable.includes(query.toLowerCase())
  }).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)), [modelAnomalies, equipmentFilter, query, dateValidation])
  const selected = requestedId ? anomalies.find(({ id }) => id === requestedId) : anomalies.find(({ id }) => id === selectedId) ?? anomalies[0]
  const selectedEquipmentId = selected?.equipmentId ?? requestedEquipment ?? equipmentOptions[0]?.id
  const selectedEquipment = equipmentOptions.find(({ id }) => id === selectedEquipmentId) ?? equipmentOptions[0]

  useEffect(() => {
    let cancelled = false
    setPowerDetail(undefined)
    if (selectedEquipmentId) getEquipmentCsvDetailById(selectedEquipmentId).then((detail) => { if (!cancelled) setPowerDetail(detail) })
    return () => { cancelled = true }
  }, [selectedEquipmentId])

  const latestDataDate = useMemo(() => modelAnomalies.reduce((latest, item) => { const day = item.occurredAt.slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(day) && day > latest ? day : latest }, ''), [modelAnomalies])

  const overview = useMemo(() => summarizeEquipment(equipmentOptions,
    modelAnomalies.filter(anomaly => isDateInRange(anomaly.occurredAt, dateValidation))),
  [equipmentOptions, modelAnomalies, dateValidation])

  const selectAnomaly = (anomaly: AnomalyDetection) => {
    setSelectedId(anomaly.id)
    setSearchParams({ anomaly: anomaly.id })
  }
  function selectEquipment(item: EquipmentSummary) {
    setEquipmentFilter(item.id)
    setQuery('')
    setPageIndex(0)
    setSelectedId(item.latest?.id ?? '')
    setSearchParams(item.latest ? { anomaly: item.latest.id } : { equipment: item.id })
  }
  function showAllEquipment() {
    setEquipmentFilter('all')
    setQuery('')
    setPageIndex(0)
    setSelectedId('')
    setSearchParams({})
  }
  function resetSelection(equipment = equipmentFilter) {
    setPageIndex(0)
    setSelectedId('')
    setSearchParams(equipment === 'all' ? {} : { equipment })
  }
  const filteredPowerDetail = powerDetail ? { ...powerDetail, currentPowerSeries: powerDetail.currentPowerSeries.filter(({ time }) => isDateInRange(time, dateValidation)) } : undefined
  const hasModelResults = anomalies.length > 0
  const pageCount = Math.max(1, Math.ceil(anomalies.length / ALERT_PAGE_SIZE))
  const currentPage = Math.min(pageIndex, pageCount - 1)
  const pageAnomalies = anomalies.slice(currentPage * ALERT_PAGE_SIZE, (currentPage + 1) * ALERT_PAGE_SIZE)
  function changePage(page: number) {
    const next = Math.max(0, Math.min(pageCount - 1, page))
    setPageIndex(next)
    const first = anomalies[next * ALERT_PAGE_SIZE]
    if (first) selectAnomaly(first)
  }

  return <div className={`dashboard-page alerts-page ${dockExpanded ? 'dock-expanded' : 'dock-collapsed'}`}>
    

    <AlertFilterBar query={query} onQueryChange={value => { setQuery(value); resetSelection() }}
      equipment={equipmentFilter} equipmentOptions={equipmentOptions}
      onEquipmentChange={value => { setEquipmentFilter(value); resetSelection(value) }}
      dateRange={dateRange} onDateChange={range => { setDateRange(range); resetSelection() }}
      latestDate={latestDataDate} error={dateValidation.error} resultCount={anomalies.length}
      loading={loadingAnomalies} onReset={() => { setDateRange({ startDate: '', endDate: '' }); showAllEquipment() }} />
    <div className="alerts-wire-grid">
      <aside className="panel alert-inbox-panel" aria-labelledby="alert-inbox-title"><div className="panel-heading"><div><p className="eyebrow">FIELD INBOX</p><h2 id="alert-inbox-title">확인할 이상 알림</h2></div><span className="equipment-count">{anomalies.length ? `${anomalies.length}건` : '데이터 없음'}</span></div>
      {anomalies.length ? <><div className="alert-detail-list">{pageAnomalies.map((anomaly) => <button type="button" className={`alert-detail-row ${selected?.id === anomaly.id ? 'selected' : ''}`} key={anomaly.id} onClick={() => selectAnomaly(anomaly)}><span className="status-dot-large warning" /><span className="alert-row-main"><strong>{anomaly.equipmentName}</strong><small>{anomaly.occurredAt}</small><p>{anomaly.fields.join(', ')} · 확인 상태 데이터 없음</p></span></button>)}</div><nav className="alert-pagination" aria-label="알림 목록 페이지" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', paddingTop: 16 }}><button type="button" disabled={currentPage === 0} onClick={() => changePage(currentPage - 1)}>이전</button><span>{currentPage + 1} / {pageCount} 페이지 · {pageAnomalies.length}건 표시</span><button type="button" disabled={currentPage >= pageCount - 1} onClick={() => changePage(currentPage + 1)}>다음</button></nav></> : <div className="alert-empty"><strong>표시할 모델 이상 결과가 없습니다.</strong><p>test_data 기반 모델 결과가 없거나 아직 로드되지 않았습니다.</p></div>}</aside>
      <main className="alert-evidence-column"><PowerTrend detail={filteredPowerDetail} equipmentName={selectedEquipment?.name ?? '선택 설비'} />{hasModelResults && <section className="panel alert-reason-panel" aria-labelledby="alert-reason-title"><div className="panel-heading"><div><p className="eyebrow">MODEL EVIDENCE</p><h2 id="alert-reason-title">왜 이상인가?</h2></div><span className="equipment-count">모델 근거</span></div><p className="selected-equipment">{selected?.equipmentName} · {selected?.occurredAt}</p><p className="selected-detail">모델이 의심 대상으로 반환한 항목: <strong>{selected?.fields.join(', ')}</strong></p><div className="alert-fact-grid"><span>발생 시각<strong>{selected?.occurredAt}</strong></span><span>전력 추이용 데이터<strong>{powerDetail ? '조회됨' : '데이터 없음'}</strong></span><span>모델 제공 심각도<strong>데이터 없음</strong></span><span>모델 제공 우선순위<strong>데이터 없음</strong></span></div></section>}</main>
      <EquipmentOverview equipment={overview} loading={loadingAnomalies} hasSourceData={modelAnomalies.length > 0}
        activeEquipment={equipmentFilter} onSelect={selectEquipment} onShowAll={showAllEquipment} />
    </div>

    <footer className="page-source-note">test_data 기반 모델 결과와 설비 측정 데이터를 기준으로 확인합니다.</footer>

    <AgentDock anomaly={selected} expanded={dockExpanded} onToggle={() => setDockExpanded(value => !value)} onExpand={() => setDockExpanded(true)} />
  </div>
}
