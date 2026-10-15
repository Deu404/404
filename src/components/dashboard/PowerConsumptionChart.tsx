import type { DashboardPowerPoint } from '../../types/power'

const WIDTH = 760
const HEIGHT = 280
const PADDING = { top: 24, right: 24, bottom: 48, left: 58 }
const MAX_VALUE = 1600

type PowerConsumptionChartProps = { series: DashboardPowerPoint[] }

export function PowerConsumptionChart({ series }: PowerConsumptionChartProps) {
  const chartWidth = WIDTH - PADDING.left - PADDING.right
  const chartHeight = HEIGHT - PADDING.top - PADDING.bottom
  const points = series.flatMap((item, index) => item.value === undefined ? [] : [{
    ...item,
    x: PADDING.left + (index * chartWidth) / Math.max(series.length - 1, 1),
    y: PADDING.top + chartHeight - (item.value / MAX_VALUE) * chartHeight,
  }])
  const linePoints = points.map(({ x, y }) => `${x},${y}`).join(' ')
  const areaPoints = `${PADDING.left},${PADDING.top + chartHeight} ${linePoints} ${PADDING.left + chartWidth},${PADDING.top + chartHeight}`

  return (
    <section className="panel chart-panel" aria-labelledby="power-chart-title">
      <div className="panel-heading">
        <div><p className="eyebrow">POWER TREND</p><h2 id="power-chart-title">시간대별 전력 소비</h2></div>
        <span className="chart-legend"><i className="legend-line" />공장 전체 (kW)</span>
      </div>
      <div className="chart-wrap">
        {points.length ? <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="00시부터 21시까지 시간대별 공장 전력 소비 그래프">
          {[0, 400, 800, 1200, 1600].map((value) => {
            const y = PADDING.top + chartHeight - (value / MAX_VALUE) * chartHeight
            return <g key={value}><line className="chart-grid" x1={PADDING.left} x2={WIDTH - PADDING.right} y1={y} y2={y} /><text className="chart-label" x={PADDING.left - 10} y={y + 4} textAnchor="end">{value}</text></g>
          })}
          <line className="chart-axis" x1={PADDING.left} x2={WIDTH - PADDING.right} y1={PADDING.top + chartHeight} y2={PADDING.top + chartHeight} />
          <polygon className="chart-area" points={areaPoints} />
          <polyline className="chart-line" points={linePoints} />
          {points.map(({ time, value, x, y }) => <g key={time}><circle className="chart-point" cx={x} cy={y} r="4" /><text className="chart-label chart-x-label" x={x} y={HEIGHT - 18} textAnchor="middle">{time}</text><title>{`${time}: ${value} kW`}</title></g>)}
          <text className="chart-unit" x="12" y={PADDING.top - 8}>kW</text>
          <text className="chart-unit" x={WIDTH - PADDING.right} y={HEIGHT - 2} textAnchor="end">시간</text>
        </svg> : <p className="empty-state">표시할 전력 시계열 데이터가 없습니다.</p>}
      </div>
    </section>
  )
}
