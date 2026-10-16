import type { KeyboardEvent, PointerEvent } from 'react'
import type { ForecastPoint } from '../../types/forecast'
import { formatForecastHour, nearestChartIndex } from '../../utils/chartInteraction'

export type ChartMetric = { key: 'billWon' | 'carbonKg'; title: string; eyebrow: string; unit: string; color: string; areaColor: string; description: string }
type Props = { data: ForecastPoint[]; metric: ChartMetric; activeHour: string | null; onActiveHour: (hour: string | null) => void }
const WIDTH = 760
const HEIGHT = 280
const PADDING = { top: 28, right: 24, bottom: 48, left: 70 }
const formatValue = (value: number, digits = 2) => value.toLocaleString('ko-KR', { maximumFractionDigits: digits })

export function ForecastChart({ data, metric, activeHour, onActiveHour }: Props) {
  const chartWidth = WIDTH - PADDING.left - PADDING.right
  const chartHeight = HEIGHT - PADDING.top - PADDING.bottom
  const values = data.map(item => item[metric.key]).filter(Number.isFinite)
  const max = values.length ? Math.max(...values) : 0
  const min = values.length ? Math.min(...values) : 0
  const range = Math.max(max - min, max * 0.08, 1)
  const domainMin = Math.max(0, min - range * 0.1)
  const domainMax = max + range * 0.1
  const points = data.flatMap((item, index) => Number.isFinite(item[metric.key]) ? [{
    item, index, value: item[metric.key],
    x: PADDING.left + (index * chartWidth) / Math.max(data.length - 1, 1),
    y: PADDING.top + chartHeight - ((item[metric.key] - domainMin) / (domainMax - domainMin)) * chartHeight,
  }] : [])
  const active = points.find(point => point.item.hour === activeHour)
  const activeIndex = active?.index ?? 0
  const line = points.map(({ x, y }) => `${x},${y}`).join(' ')
  const labels = data.length > 2 ? [0, Math.floor((data.length - 1) / 2), data.length - 1] : data.map((_, index) => index)

  function trackPointer(event: PointerEvent<SVGSVGElement>) {
    const matrix = event.currentTarget.getScreenCTM()
    if (!matrix) return
    // Convert browser pixels into SVG coordinates, including responsive scaling.
    const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    const index = nearestChartIndex(local.x, PADDING.left, chartWidth, data.length)
    if (index !== undefined) onActiveHour(data[index].hour)
  }
  function trackKeyboard(event: KeyboardEvent<SVGSVGElement>) {
    const index = event.key === 'ArrowRight' ? Math.min(data.length - 1, activeIndex + 1)
      : event.key === 'ArrowLeft' ? Math.max(0, activeIndex - 1)
      : event.key === 'Home' ? 0 : event.key === 'End' ? data.length - 1 : undefined
    if (index === undefined) return
    event.preventDefault()
    onActiveHour(data[index].hour)
  }

  return <section className="panel forecast-chart-panel" aria-labelledby={`${metric.key}-dashboard-title`}>
    <div className="panel-heading"><div><p className="eyebrow">{metric.eyebrow}</p><h2 id={`${metric.key}-dashboard-title`}>{metric.title}</h2><p className="panel-description">예측 시간별 {metric.unit} 흐름</p></div><span className="chart-legend"><i className="legend-line" style={{ background: metric.color }} />예측 ({metric.unit})</span></div>
    <div className={`forecast-hover-readout ${active ? 'is-active' : ''}`}>
      {active ? <><time dateTime={`${active.item.hour.slice(0, 4)}-${active.item.hour.slice(4, 6)}-${active.item.hour.slice(6, 8)}T${active.item.hour.slice(8, 10)}:00:00+09:00`}>{formatForecastHour(active.item.hour)} <small>한국 시간</small></time><strong style={{ color: metric.color }}>{formatValue(active.value)} <small>{metric.unit}</small></strong></> : <span>그래프에 마우스를 올리거나 터치해 시간별 값을 확인하세요.</span>}
    </div>
    <div className="chart-wrap forecast-chart-wrap">{points.length ? <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} tabIndex={0} role="slider"
      aria-label={`${metric.title} 시간 탐색`} aria-describedby={`${metric.key}-dashboard-description`} aria-valuemin={0} aria-valuemax={Math.max(0, data.length - 1)} aria-valuenow={activeIndex}
      aria-valuetext={active ? `${formatForecastHour(active.item.hour)}, ${formatValue(active.value)} ${metric.unit}` : '방향키로 시간별 예측값을 확인하세요'}
      onPointerMove={trackPointer} onPointerDown={trackPointer}
      onPointerLeave={event => { if (event.pointerType !== 'touch' && document.activeElement !== event.currentTarget) onActiveHour(null) }}
      onFocus={() => { if (!active && data.length) onActiveHour(data[0].hour) }} onKeyDown={trackKeyboard}>
      <desc id={`${metric.key}-dashboard-description`}>{metric.description}. 회색 세로선은 두 그래프에서 같은 시간을 표시합니다. 왼쪽·오른쪽 방향키로 한 시간씩 이동할 수 있습니다.</desc>
      {[0, 1, 2, 3, 4].map(index => {
        const value = domainMin + ((domainMax - domainMin) * index) / 4
        const y = PADDING.top + chartHeight - ((value - domainMin) / (domainMax - domainMin)) * chartHeight
        return <g key={index}><line className="chart-grid" x1={PADDING.left} x2={WIDTH - PADDING.right} y1={y} y2={y} /><text className="chart-label" x={PADDING.left - 10} y={y + 4} textAnchor="end">{formatValue(value, metric.key === 'carbonKg' ? 1 : 0)}</text></g>
      })}
      <line className="chart-axis" x1={PADDING.left} x2={WIDTH - PADDING.right} y1={PADDING.top + chartHeight} y2={PADDING.top + chartHeight} />
      <polygon className="forecast-chart-area" style={{ fill: metric.areaColor }} points={`${PADDING.left},${PADDING.top + chartHeight} ${line} ${WIDTH - PADDING.right},${PADDING.top + chartHeight}`} />
      <polyline className="forecast-chart-line" style={{ stroke: metric.color }} points={line} />
      {points.map(({ item, x, y }) => <circle key={item.id} className="forecast-chart-point" style={{ stroke: metric.color }} cx={x} cy={y} r="2.5" />)}
      {active && <g className="forecast-crosshair" pointerEvents="none">
        <line className="forecast-crosshair-vertical" x1={active.x} x2={active.x} y1={PADDING.top} y2={PADDING.top + chartHeight} />
        <line className="forecast-crosshair-horizontal" x1={PADDING.left} x2={WIDTH - PADDING.right} y1={active.y} y2={active.y} />
        <circle className="forecast-crosshair-point" cx={active.x} cy={active.y} r="5.5" style={{ stroke: metric.color }} />
      </g>}
      {labels.map(index => <text className="chart-label chart-x-label" key={data[index].id} x={PADDING.left + (index * chartWidth) / Math.max(data.length - 1, 1)} y={HEIGHT - 18} textAnchor="middle">{`${data[index].hour.slice(4, 6)}.${data[index].hour.slice(6, 8)} ${data[index].hour.slice(8, 10)}시`}</text>)}
      <text className="chart-unit" x="12" y={PADDING.top - 8}>{metric.unit}</text><text className="chart-unit" x={WIDTH - PADDING.right} y={HEIGHT - 2} textAnchor="end">예측 시간</text>
    </svg> : <p className="empty-state">표시할 {metric.unit} 예측 데이터가 없습니다.</p>}</div>
  </section>
}
