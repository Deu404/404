import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DateRangeFilter } from '../components/common/DateRangeFilter'
import { getForecastData, getForecastMae } from '../services/powerService'
import { getDateRangeValidation, isDateInRange, type DateRange } from '../utils/dateRange'
import type { ForecastMae, ForecastPoint } from '../types/forecast'

const formatNumber = (value: number | undefined, maximumFractionDigits = 0) => value === undefined || !Number.isFinite(value) ? '데이터 없음' : value.toLocaleString('ko-KR', { maximumFractionDigits })
const formatReadableMetric = (value: number | undefined, unit: string) => {
  if (value === undefined || !Number.isFinite(value)) return '데이터 없음'
  const absoluteValue = Math.abs(value)
  const scale = absoluteValue >= 100_000_000 ? 100_000_000 : absoluteValue >= 10_000 ? 10_000 : 1
  const suffix = scale === 100_000_000 ? `억 ${unit}` : scale === 10_000 ? `만 ${unit}` : unit
  const scaledValue = value / scale
  const maximumFractionDigits = scale === 1 ? 2 : scaledValue < 100 ? 1 : 0
  return `약 ${scaledValue.toLocaleString('ko-KR', { maximumFractionDigits })} ${suffix}`
}
type MetricTab = 'bill' | 'power' | 'carbon'

type ChartMetric = { key: 'billWon' | 'carbonKg'; title: string; eyebrow: string; unit: string; color: string; areaColor: string; description: string }
const FORECAST_METRICS: ChartMetric[] = [
  { key: 'billWon', title: '시간대별 예상 전기요금', eyebrow: 'HOURLY BILL FORECAST', unit: '원', color: '#36b9a6', areaColor: '#dff7f2', description: '예측 시간별 전기요금을 원 단위로 나타낸 그래프' },
  { key: 'carbonKg', title: '시간대별 예상 탄소배출량', eyebrow: 'HOURLY CARBON FORECAST', unit: 'kgCO2', color: '#7589d8', areaColor: '#e9edff', description: '예측 시간별 탄소배출량을 kgCO2 단위로 나타낸 그래프' },
]

function ForecastChart({ data, metric }: { data: ForecastPoint[]; metric: ChartMetric }) {
  const width = 760
  const height = 280
  const padding = { top: 28, right: 24, bottom: 48, left: 70 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const values = data.map((item) => item[metric.key]).filter(Number.isFinite)
  const maxValue = values.length ? Math.max(...values) : 0
  const minValue = values.length ? Math.min(...values) : 0
  const range = Math.max(maxValue - minValue, maxValue * 0.08, 1)
  const domainMin = Math.max(0, minValue - range * 0.1)
  const domainMax = maxValue + range * 0.1
  const points = data.flatMap((item, index) => {
    const value = item[metric.key]
    if (!Number.isFinite(value)) return []
    return [{ item, value, x: padding.left + (index * chartWidth) / Math.max(data.length - 1, 1), y: padding.top + chartHeight - ((value - domainMin) / (domainMax - domainMin)) * chartHeight }]
  })
  const linePoints = points.map(({ x, y }) => `${x},${y}`).join(' ')
  const areaPoints = `${padding.left},${padding.top + chartHeight} ${linePoints} ${padding.left + chartWidth},${padding.top + chartHeight}`
  const ticks = [0, 1, 2, 3, 4].map((index) => domainMin + ((domainMax - domainMin) * index) / 4)
  const labelIndexes = data.length > 2 ? [0, Math.floor((data.length - 1) / 2), data.length - 1] : data.map((_, index) => index)

  return <section className="panel forecast-chart-panel" aria-labelledby={`${metric.key}-dashboard-title`}><div className="panel-heading"><div><p className="eyebrow">{metric.eyebrow}</p><h2 id={`${metric.key}-dashboard-title`}>{metric.title}</h2><p className="panel-description">예측 시간별 {metric.unit} 흐름</p></div><span className="chart-legend"><i className="legend-line" style={{ background: metric.color }} />예측 ({metric.unit})</span></div><div className="chart-wrap forecast-chart-wrap">{points.length ? <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${metric.key}-dashboard-title ${metric.key}-dashboard-description`}><desc id={`${metric.key}-dashboard-description`}>{metric.description}</desc>{ticks.map((value) => { const y = padding.top + chartHeight - ((value - domainMin) / (domainMax - domainMin)) * chartHeight; return <g key={value}><line className="chart-grid" x1={padding.left} x2={width - padding.right} y1={y} y2={y} /><text className="chart-label" x={padding.left - 10} y={y + 4} textAnchor="end">{formatNumber(value, metric.key === 'carbonKg' ? 1 : 0)}</text></g> })}<line className="chart-axis" x1={padding.left} x2={width - padding.right} y1={padding.top + chartHeight} y2={padding.top + chartHeight} /><polygon className="forecast-chart-area" style={{ fill: metric.areaColor }} points={areaPoints} /><polyline className="forecast-chart-line" style={{ stroke: metric.color }} points={linePoints} />{points.map(({ item, value, x, y }) => <g key={item.id}><circle className="forecast-chart-point" style={{ stroke: metric.color }} cx={x} cy={y} r="2.5" /><title>{`${item.id}: ${formatNumber(value, metric.key === 'carbonKg' ? 2 : 0)} ${metric.unit}`}</title></g>)}{labelIndexes.map((index) => { const point = points[index]; return point ? <text className="chart-label chart-x-label" key={point.item.id} x={point.x} y={height - 18} textAnchor="middle">{point.item.id.slice(6, 8)}시</text> : null })}<text className="chart-unit" x="12" y={padding.top - 8}>{metric.unit}</text><text className="chart-unit" x={width - padding.right} y={height - 2} textAnchor="end">예측 시간</text></svg> : <p className="empty-state">표시할 {metric.unit} 예측 데이터가 없습니다.</p>}</div></section>
}

const MAE_METRICS = [{ key: 'power', label: '전력 MAE' }, { key: 'bill', label: '전기요금 MAE' }, { key: 'carbon', label: '탄소배출량 MAE' }] as const
function ForecastMaeSummary({ mae }: { mae: ForecastMae }) {
  return <section className="panel" aria-labelledby="dashboard-forecast-mae-title"><div className="panel-heading"><div><p className="eyebrow">FORECAST ACCURACY</p><h2 id="dashboard-forecast-mae-title">정확도 (MAE)</h2><p className="panel-description">검증 CSV의 예측값과 실제값으로 계산</p></div><span className="panel-date">{mae.totalValidSampleCount.toLocaleString('ko-KR')}개 유효 행</span></div><div className="metric-grid">{MAE_METRICS.map(({ key, label }) => { const metric = mae[key]; return <div className="metric-card" key={key}><span className="metric-label">{label}</span>{metric ? <><strong>{formatNumber(metric.mae, key === 'bill' ? 0 : 2)} <small>{metric.unit}</small></strong><span className="metric-caption">{metric.sampleCount.toLocaleString('ko-KR')}개 유효 쌍 기준</span></> : <><strong>데이터 없음</strong><span className="metric-caption">유효한 실제값·예측값 쌍이 없습니다.</span></>}</div> })}</div></section>
}

export function DashboardPage() {
  const [metricTab, setMetricTab] = useState<MetricTab>('bill')
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: '', endDate: '' })

  const dateValidation = getDateRangeValidation(dateRange)
  const forecast = getForecastData().filter((item) => isDateInRange(item.hour || item.id, dateValidation))
  const mae = getForecastMae((time) => isDateInRange(time, dateValidation))
  const forecastValues = { bill: { label: '예측 전기요금', unit: '원', value: forecast.length ? forecast.reduce((sum, item) => sum + item.billWon, 0) : undefined, mae: mae.bill }, power: { label: '예측 전력량', unit: 'kWh', value: forecast[0]?.aggregatePowerKwh, mae: mae.power }, carbon: { label: '예측 탄소배출량', unit: 'kgCO2', value: forecast.length ? forecast.reduce((sum, item) => sum + item.carbonKg, 0) : undefined, mae: mae.carbon } } as const
  const selectedForecast = forecastValues[metricTab]

  return <div className="dashboard-page"><section className="dashboard-intro dashboard-hero"><div><p className="eyebrow">404 · 플랜트아이</p><h2>핵심 지표 대시보드</h2><p>실제 전력 데이터와 예측 검증 결과로 공장 운영의 흐름을 확인합니다.</p></div><nav className="dashboard-tabs" aria-label="지표 전환">{(['bill', 'power', 'carbon'] as const).map((tab) => <button className={metricTab === tab ? 'active' : ''} onClick={() => setMetricTab(tab)} key={tab}>{tab === 'bill' ? '요금' : tab === 'power' ? '전력' : '탄소'}</button>)}</nav></section>
    <DateRangeFilter {...dateRange} onChange={setDateRange} error={dateValidation.error} resultCount={forecast.length} />
    <section className="dashboard-forecast-section" aria-labelledby="dashboard-forecast-visualization-title"><div className="dashboard-section-heading"><p className="eyebrow">FORECAST VISUALIZATION</p><h2 id="dashboard-forecast-visualization-title">시간대별 전기요금 및 탄소배출량 예측 시각화</h2><p className="panel-description">실제 forecast CSV의 유효 예측 행 기준</p></div><div className="forecast-chart-grid dashboard-forecast-charts">{FORECAST_METRICS.map((metric) => <ForecastChart key={metric.key} data={forecast} metric={metric} />)}</div></section>
    <ForecastMaeSummary mae={mae} />
    <div className="dashboard-wire-grid"><section className="panel dashboard-wire-card dashboard-forecast" aria-labelledby="forecast-title"><div className="panel-heading"><div><p className="eyebrow">FORECAST SUMMARY</p><h2 id="forecast-title">예측 전력·요금·탄소 요약</h2><p className="panel-description">실제 forecast CSV의 유효 예측 행 기준</p></div><span className="panel-date">{forecast.length ? `${forecast.length.toLocaleString('ko-KR')}개 행` : '예측 데이터 없음'}</span></div><div className="forecast-tabs">{(['bill', 'power', 'carbon'] as const).map((tab) => <button className={metricTab === tab ? 'active' : ''} onClick={() => setMetricTab(tab)} key={tab}>{tab === 'bill' ? '전기요금' : tab === 'power' ? '전력량' : '탄소'}</button>)}</div><strong className="forecast-value">{formatReadableMetric(selectedForecast.value, selectedForecast.unit)}</strong><span className="metric-caption">{selectedForecast.label} · CSV 유효 행 기준</span><div className="forecast-mae"><span>MAE</span><strong>{formatReadableMetric(selectedForecast.mae?.mae, selectedForecast.mae?.unit ?? selectedForecast.unit)}</strong><small>{selectedForecast.mae ? `${selectedForecast.mae.sampleCount.toLocaleString('ko-KR')}개 검증 샘플` : '검증값 없음'}</small></div></section>
      <section className="panel dashboard-wire-card dashboard-summary" aria-labelledby="summary-title"><div><p className="eyebrow">AT A GLANCE</p><h2 id="summary-title">실제 장비 KPI 및 링크</h2><p>{forecast.length ? `${selectedForecast.label}은 ${formatReadableMetric(selectedForecast.value, selectedForecast.unit)}입니다.` : '예측 CSV 데이터가 없어 예측값을 표시할 수 없습니다.'}</p><small>모델 이상 결과와 점검 안내는 이상탐지·점검 화면에서 확인합니다.</small></div><Link className="dashboard-alert-link" to="/alerts">이상탐지 화면 이동 <span>→</span></Link></section>
    </div><div className="dashboard-related-links"><Link to="/equipment-power">설비별 전력·설비 분석</Link><Link to="/factory-layout">공장 배치도</Link><Link to="/alerts">모델 이상 결과·점검</Link></div>
  </div>
}
