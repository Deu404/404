export type DateRange = {
  startDate: string
  endDate: string
}

export type DateRangeValidation = {
  start: Date | undefined
  endExclusive: Date | undefined
  error?: string
}

function parseDateParts(value: string): Date | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (dateOnly) {
    const date = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    return date.getFullYear() === Number(dateOnly[1]) && date.getMonth() === Number(dateOnly[2]) - 1 && date.getDate() === Number(dateOnly[3]) ? date : undefined
  }

  const compact = /^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?$/.exec(trimmed.replace(/\s/g, ''))
  if (compact) {
    const date = new Date(Number(compact[1]), Number(compact[2]) - 1, Number(compact[3]), Number(compact[4] ?? 0), Number(compact[5] ?? 0))
    return Number.isNaN(date.getTime()) ? undefined : date
  }

  const normalized = trimmed.replace('T', ' ').replace(/-/g, '/')
  const match = /^(\d{4})\/(\d{2})\/(\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(normalized)
  if (!match) return undefined
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4] ?? 0), Number(match[5] ?? 0), Number(match[6] ?? 0))
  return Number.isNaN(date.getTime()) ? undefined : date
}

export function getDateRangeValidation({ startDate, endDate }: DateRange): DateRangeValidation {
  const start = startDate ? parseDateParts(startDate) : undefined
  const end = endDate ? parseDateParts(endDate) : undefined
  if (startDate && !start || endDate && !end) return { start, endExclusive: undefined, error: '날짜 형식이 올바르지 않습니다.' }
  if (start && end && start.getTime() > end.getTime()) return { start, endExclusive: undefined, error: '시작일은 종료일보다 늦을 수 없습니다.' }

  const endExclusive = end ? new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1) : undefined
  return { start, endExclusive }
}

export function isDateInRange(value: string, range: DateRangeValidation): boolean {
  if (range.start === undefined && range.endExclusive === undefined && !range.error) return true
  const timestamp = parseDateParts(value)?.getTime()
  if (timestamp === undefined || Number.isNaN(timestamp) || range.error) return false
  return (range.start === undefined || timestamp >= range.start.getTime()) && (range.endExclusive === undefined || timestamp < range.endExclusive.getTime())
}
