export function nearestChartIndex(x: number, left: number, width: number, count: number): number | undefined {
  if (!Number.isFinite(x) || !Number.isFinite(left) || !Number.isFinite(width) || width <= 0 || count < 1) return undefined
  return Math.max(0, Math.min(count - 1, Math.round(((x - left) / width) * (count - 1))))
}

export function formatForecastHour(hour: string): string {
  return /^\d{10}$/.test(hour) ? `${hour.slice(0, 4)}.${hour.slice(4, 6)}.${hour.slice(6, 8)} ${hour.slice(8, 10)}:00` : hour
}
