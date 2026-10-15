import { useState } from 'react'
import { DateRangeFilter } from '../components/common/DateRangeFilter'
import { getForecastData, getForecastMae } from '../services/powerService'
import { getDateRangeValidation, isDateInRange, type DateRange } from '../utils/dateRange'
import type { ForecastMae, ForecastPoint } from '../types/forecast'

const WIDTH = 760
const HEIGHT = 280
const PADDING = { top: 28, right: 24, bottom: 48, left: 70 }

type ChartMetric = {
  key: 'billWon' | 'carbonKg'
  title: string
  eyebrow: string
  unit: string
  color: string
  areaColor: string
  description: string
}

const METRICS: ChartMetric[] = [
  { key: 'billWon', title: '시간대별 예상 전기요금', eyebrow: 'HOURLY BILL FORECAST', unit: '원', color: '#36b9a6', areaColor: '#dff7f2', description: '예측 시간별 전기요금을 원 단위로 나타낸 그래프' },
  { key: 'carbonKg', title: '시간대별 예상 탄소배출량', eyebrow: 'HOURLY CARBON FORECAST', unit: 'kgCO2', color: '#7589d8', areaColor: '#e9edff', description: '예측 시간별 탄소배출량을 kgCO2 단위로 나타낸 그래프' },
]

function formatNumber(value: number | undefined, maximumFractionDigits = 0) {
  return value === undefined || !Number.isFinite(value) ? '데이터 없음' : value.toLocaleString('ko-KR', { maximumFractionDigits })
}

function ForecastChart({ data, metric }: { data: ForecastPoint[]; metric: ChartMetric }) {
  const chartWidth = WIDTH - PADDING.left - PADDING.right
  const chartHeight = HEIGHT - PADDING.top - PADDING.bottom
  const values = data.map((item) => item[metric.key]).filter(Number.isFinite)
  const maxValue = values.length ? Math.max(...values) : 0
  const minValue = values.length ? Math.min(...values) : 0
  const range = Math.max(maxValue - minValue, maxValue * 0.08, 1)
  const domainMin = Math.max(0, minValue - range * 0.1)
  const domainMax = maxValue + range * 0.1
  const points = data.flatMap((item, index) => {
    const value = item[metric.key]
    if (!Number.isFinite(value)) return []
    return [{ item, value, x: PADDING.left + (index * chartWidth) / Math.max(data.length - 1, 1), y: PADDING.top + chartHeight - ((value - domainMin) / (domainMax - domainMin)) * chartHeight }]
  })
  const linePoints = points.map(({ x, y }) => `${x},${y}`).join(' ')
  const areaPoints = `${PADDING.left},${PADDING.top + chartHeight} ${linePoints} ${PADDING.left + chartWidth},${PADDING.top + chartHeight}`
  const ticks = [0, 1, 2, 3, 4].map((index) => domainMin + ((domainMax - domainMin) * index) / 4)
  const labelIndexes = data.length > 2 ? [0, Math.floor((data.length - 1) / 2), data.length - 1] : data.map((_, index) => index)

  return (
    <section className="panel forecast-chart-panel" aria-labelledby={`${metric.key}-title`}>
      <div className="panel-heading"><div><p className="eyebrow">{metric.eyebrow}</p><h2 id={`${metric.key}-title`}>{metric.title}</h2><p className="panel-description">예측 시간별 {metric.unit} 흐름</p></div><span className="chart-legend"><i className="legend-line" style={{ background: metric.color }} />예측 ({metric.unit})</span></div>
      <div className="chart-wrap forecast-chart-wrap">
        {points.length ? <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-labelledby={`${metric.key}-title ${metric.key}-description`}>
          <desc id={`${metric.key}-description`}>{metric.description}</desc>
          {ticks.map((value) => { const y = PADDING.top + chartHeight - ((value - domainMin) / (domainMax - domainMin)) * chartHeight; return <g key={value}><line className="chart-grid" x1={PADDING.left} x2={WIDTH - PADDING.right} y1={y} y2={y} /><text className="chart-label" x={PADDING.left - 10} y={y + 4} textAnchor="end">{formatNumber(value, metric.key === 'carbonKg' ? 1 : 0)}</text></g> })}
          <line className="chart-axis" x1={PADDING.left} x2={WIDTH - PADDING.right} y1={PADDING.top + chartHeight} y2={PADDING.top + chartHeight} />
          <polygon className="forecast-chart-area" style={{ fill: metric.areaColor }} points={areaPoints} /><polyline className="forecast-chart-line" style={{ stroke: metric.color }} points={linePoints} />
          {points.map(({ item, value, x, y }) => <g key={item.id}><circle className="forecast-chart-point" style={{ stroke: metric.color }} cx={x} cy={y} r="2.5" /><title>{`${item.id}: ${formatNumber(value, metric.key === 'carbonKg' ? 2 : 0)} ${metric.unit}`}</title></g>)}
          {labelIndexes.map((index) => { const point = points[index]; return point ? <text className="chart-label chart-x-label" key={point.item.id} x={point.x} y={HEIGHT - 18} textAnchor="middle">{point.item.id.slice(6, 8)}시</text> : null })}
          <text className="chart-unit" x="12" y={PADDING.top - 8}>{metric.unit}</text><text className="chart-unit" x={WIDTH - PADDING.right} y={HEIGHT - 2} textAnchor="end">예측 시간</text>
        </svg> : <p className="empty-state">표시할 {metric.unit} 예측 데이터가 없습니다.</p>}
      </div>
    </section>
  )
}

const MAE_METRICS = [
  { key: 'power', label: '전력 MAE' },
  { key: 'bill', label: '전기요금 MAE' },
  { key: 'carbon', label: '탄소배출량 MAE' },
] as const

function ForecastMaeSummary({ mae }: { mae: ForecastMae }) {
  return <section className="panel" aria-labelledby="forecast-mae-title">
    <div className="panel-heading"><div><p className="eyebrow">FORECAST ACCURACY</p><h2 id="forecast-mae-title">예측 평균 절대 오차 (MAE)</h2><p className="panel-description">예측값과 실제값의 평균 절대 오차</p></div><span className="panel-date">{mae.totalValidSampleCount.toLocaleString('ko-KR')}개 유효 행</span></div>
    <div className="metric-grid">
      {MAE_METRICS.map(({ key, label }) => {
        const metric = mae[key]
        return <div className="metric-card" key={key}><span className="metric-label">{label}</span>{metric ? <><strong>{formatNumber(metric.mae, key === 'bill' ? 0 : 2)} <small>{metric.unit}</small></strong><span className="metric-caption">{metric.sampleCount.toLocaleString('ko-KR')}개 유효 쌍 기준</span></> : <><strong>데이터 없음</strong><span className="metric-caption">유효한 실제값·예측값 쌍이 없습니다.</span></>}</div>
      })}
    </div>
  </section>
}

export function ForecastPage() {
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: '', endDate: '' })
  const dateValidation = getDateRangeValidation(dateRange)
  const forecast = getForecastData().filter((item) => isDateInRange(item.hour || item.id, dateValidation))
  const forecastMae = getForecastMae((time) => isDateInRange(time, dateValidation))
  const aggregatePower = forecast[0]?.aggregatePowerKwh
  const totalBill = forecast.length ? forecast.reduce((total, item) => total + item.billWon, 0) : undefined
  const totalCarbon = forecast.length ? forecast.reduce((total, item) => total + item.carbonKg, 0) : undefined

  return <div className="dashboard-page forecast-page">
    <section className="dashboard-intro"><div><p className="eyebrow">ELECTRICITY & CARBON FORECAST</p><h2>전기요금 및 탄소배출량 예측</h2><p>시간별 예측 전력 사용량을 바탕으로 예상 요금과 탄소배출량을 확인합니다.</p></div><span className="mock-badge">CSV FORECAST DATA</span></section>
    <DateRangeFilter {...dateRange} onChange={setDateRange} error={dateValidation.error} resultCount={forecast.length} />
    {forecast.length && !dateValidation.error ? <>
      <section className="metric-grid forecast-metric-grid" aria-label="예측 요약"><div className="metric-card"><span className="metric-label">예측 누적 전력</span><strong>{formatNumber(aggregatePower, 0)} <small>kWh</small></strong><span className="metric-caption">{forecast.length.toLocaleString('ko-KR')}개 유효 예측 시간 합계</span></div><div className="metric-card"><span className="metric-label">예측 전기요금 합계</span><strong>{formatNumber(totalBill, 0)} <small>원</small></strong><span className="metric-caption">시간별 예상 요금 합계</span></div><div className="metric-card"><span className="metric-label">예측 탄소배출량 합계</span><strong>{formatNumber(totalCarbon, 2)} <small>kgCO2</small></strong><span className="metric-caption">시간별 예상 배출량 합계</span></div><div className="metric-card"><span className="metric-label">예측 시간 수</span><strong>{forecast.length.toLocaleString('ko-KR')} <small>시간</small></strong><span className="metric-caption">CSV 유효 행 기준</span></div></section>
      <div className="forecast-chart-grid">{METRICS.map((metric) => <ForecastChart key={metric.key} data={forecast} metric={metric} />)}</div>
      <ForecastMaeSummary mae={forecastMae} />
    </> : <section className="panel forecast-empty-panel"><p className="eyebrow">FORECAST DATA</p><h2>예측 데이터를 불러올 수 없습니다.</h2><p className="empty-state">유효한 시간별 예측 행이 없어 표시할 데이터가 없습니다.</p></section>}
  </div>
}
