import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ForecastChart, type ChartMetric } from '../components/dashboard/ForecastChart'
import { ForecastPeriodPicker } from '../components/dashboard/ForecastPeriodPicker'
import { getForecastData, getForecastMae } from '../services/powerService'
import { getDateRangeValidation, isDateInRange, type DateRange } from '../utils/dateRange'
import type { ForecastMae } from '../types/forecast'

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

const FORECAST_METRICS: ChartMetric[] = [
  { key: 'billWon', title: '시간대별 예상 전기요금', eyebrow: 'HOURLY BILL FORECAST', unit: '원', color: '#36b9a6', areaColor: '#dff7f2', description: '예측 시간별 전기요금을 원 단위로 나타낸 그래프' },
  { key: 'carbonKg', title: '시간대별 예상 탄소배출량', eyebrow: 'HOURLY CARBON FORECAST', unit: 'kgCO2', color: '#7589d8', areaColor: '#e9edff', description: '예측 시간별 탄소배출량을 kgCO2 단위로 나타낸 그래프' },
]

const MAE_METRICS = [{ key: 'power', label: '전력 MAE' }, { key: 'bill', label: '전기요금 MAE' }, { key: 'carbon', label: '탄소배출량 MAE' }] as const
function ForecastMaeSummary({ mae }: { mae: ForecastMae }) {
  return <section className="panel dashboard-mae-panel" aria-labelledby="dashboard-forecast-mae-title"><div className="panel-heading"><div><p className="eyebrow">FORECAST ACCURACY</p><h2 id="dashboard-forecast-mae-title">정확도 (MAE)</h2><p className="panel-description">선택 기간의 검증 CSV 예측값과 실제값으로 계산</p></div><span className="panel-date">{mae.totalValidSampleCount.toLocaleString('ko-KR')}개 유효 행</span></div><div className="metric-grid">{MAE_METRICS.map(({ key, label }) => { const metric = mae[key]; return <div className="metric-card" key={key}><span className="metric-label">{label}</span>{metric ? <><strong>{formatNumber(metric.mae, key === 'bill' ? 0 : 2)} <small>{metric.unit}</small></strong><span className="metric-caption">{metric.sampleCount.toLocaleString('ko-KR')}개 유효 쌍 기준</span></> : <><strong>데이터 없음</strong><span className="metric-caption">해당 기간 검증 데이터 없음</span></>}</div> })}</div></section>
}

export function DashboardPage() {
  const [activeHour, setActiveHour] = useState<string | null>(null)
  const [metricTab, setMetricTab] = useState<MetricTab>('bill')
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: '', endDate: '' })

  const dateValidation = useMemo(() => getDateRangeValidation(dateRange), [dateRange])
  const allForecast = useMemo(() => getForecastData(), [])
  const forecastDates = useMemo(() => allForecast.map(item => { const compact = /^(\d{4})(\d{2})(\d{2})/.exec(item.hour || item.id); return compact ? `${compact[1]}-${compact[2]}-${compact[3]}` : (item.hour || item.id).slice(0, 10) }).filter(value => /^\d{4}-\d{2}-\d{2}$/.test(value)).sort(), [allForecast])
  const forecast = useMemo(() => allForecast.filter(item => isDateInRange(item.hour || item.id, dateValidation)), [allForecast, dateValidation])
  const mae = useMemo(() => getForecastMae(time => isDateInRange(time, dateValidation)), [dateValidation])
  const forecastValues = { bill: { label: '예측 전기요금', unit: '원', value: forecast.length ? forecast.reduce((sum, item) => sum + item.billWon, 0) : undefined, mae: mae.bill }, power: { label: '예측 전력량', unit: 'kWh', value: forecast.length ? forecast.reduce((sum, item) => sum + item.hourlyPowKwh, 0) : undefined, mae: mae.power }, carbon: { label: '예측 탄소배출량', unit: 'kgCO2', value: forecast.length ? forecast.reduce((sum, item) => sum + item.carbonKg, 0) : undefined, mae: mae.carbon } } as const
  const selectedForecast = forecastValues[metricTab]

  return <div className="dashboard-page">

    <section className="dashboard-forecast-section" aria-labelledby="dashboard-forecast-visualization-title"><div className="dashboard-section-heading dashboard-forecast-heading"><div><p className="eyebrow">FORECAST VISUALIZATION</p><h2 id="dashboard-forecast-visualization-title">시간대별 전기요금 및 탄소배출량 예측 시각화</h2><p className="panel-description">실제 forecast CSV의 유효 예측 행 기준</p></div><ForecastPeriodPicker range={dateRange} onChange={range => { setDateRange(range); setActiveHour(null) }} firstDate={forecastDates[0]} lastDate={forecastDates.at(-1)} resultCount={forecast.length} error={dateValidation.error} /></div><div className="forecast-chart-grid dashboard-forecast-charts">{FORECAST_METRICS.map((metric) => <ForecastChart key={metric.key} data={forecast} metric={metric} activeHour={activeHour} onActiveHour={setActiveHour} />)}</div></section>
    <div className="dashboard-insights-grid"><ForecastMaeSummary mae={mae} />
    <section className="panel dashboard-wire-card dashboard-forecast" aria-labelledby="forecast-title"><div className="panel-heading"><div><p className="eyebrow">FORECAST SUMMARY</p><h2 id="forecast-title">예측 전력·요금·탄소 요약</h2><p className="panel-description">실제 forecast CSV의 유효 예측 행 기준</p></div><span className="panel-date">{forecast.length ? `${forecast.length.toLocaleString('ko-KR')}개 행` : '예측 데이터 없음'}</span></div><div className="forecast-tabs">{(['bill', 'power', 'carbon'] as const).map((tab) => <button className={metricTab === tab ? 'active' : ''} onClick={() => setMetricTab(tab)} key={tab}>{tab === 'bill' ? '전기요금' : tab === 'power' ? '전력량' : '탄소'}</button>)}</div><strong className="forecast-value">{formatReadableMetric(selectedForecast.value, selectedForecast.unit)}</strong><span className="metric-caption">{selectedForecast.label} · CSV 유효 행 기준</span><div className="forecast-mae"><span>MAE</span><strong>{formatReadableMetric(selectedForecast.mae?.mae, selectedForecast.mae?.unit ?? selectedForecast.unit)}</strong><small>{selectedForecast.mae ? `${selectedForecast.mae.sampleCount.toLocaleString('ko-KR')}개 검증 샘플` : '검증값 없음'}</small></div></section>
    </div><section className="panel dashboard-wire-card dashboard-summary" aria-labelledby="summary-title"><div><p className="eyebrow">AT A GLANCE</p><h2 id="summary-title">실제 장비 KPI 및 링크</h2><p>{forecast.length ? `${selectedForecast.label}은 ${formatReadableMetric(selectedForecast.value, selectedForecast.unit)}입니다.` : '예측 CSV 데이터가 없어 예측값을 표시할 수 없습니다.'}</p><small>모델 이상 결과와 점검 안내는 이상탐지·점검 화면에서 확인합니다.</small></div><Link className="dashboard-alert-link" to="/alerts">이상탐지 화면 이동 <span>→</span></Link></section>
    <div className="dashboard-related-links"><Link to="/equipment-power">설비별 전력·설비 분석</Link><Link to="/factory-layout">공장 배치도</Link><Link to="/alerts">모델 이상 결과·점검</Link></div>
    <footer className="page-source-note">실제 전력 데이터와 예측 검증 결과로 공장 운영의 흐름을 확인합니다.</footer>
  </div>
}
