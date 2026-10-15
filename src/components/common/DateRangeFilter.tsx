import type { DateRange } from '../../utils/dateRange'

type DateRangeFilterProps = DateRange & {
  onChange: (range: DateRange) => void
  error?: string
  resultCount?: number
}

export function DateRangeFilter({ startDate, endDate, onChange, error, resultCount }: DateRangeFilterProps) {
  return <section className="date-range-filter panel" aria-label="날짜 범위 필터">
    <div className="date-range-heading"><div><p className="eyebrow">DATE RANGE</p><h2>날짜 범위</h2></div>{resultCount !== undefined ? <span className="equipment-count">{resultCount.toLocaleString('ko-KR')}건</span> : null}</div>
    <div className="date-range-fields">
      <label>시작일<input type="date" value={startDate} max={endDate || undefined} onChange={(event) => onChange({ startDate: event.target.value, endDate })} /></label>
      <span className="date-range-separator">~</span>
      <label>종료일<input type="date" value={endDate} min={startDate || undefined} onChange={(event) => onChange({ startDate, endDate: event.target.value })} /></label>
      <button type="button" className="date-range-reset" onClick={() => onChange({ startDate: '', endDate: '' })}>초기화</button>
    </div>
    {error ? <p className="date-range-error" role="alert">{error}</p> : <p className="control-help">시작일과 종료일은 모두 해당 날짜 전체를 포함합니다.</p>}
  </section>
}
