import { DateRangeFilter } from '../common/DateRangeFilter'
import type { DateRange } from '../../utils/dateRange'

type Props = {
  range: DateRange
  onChange: (range: DateRange) => void
  firstDate?: string
  lastDate?: string
  resultCount: number
  error?: string
}

export function ForecastPeriodPicker({ range, onChange, firstDate, lastDate, resultCount, error }: Props) {
  const label = range.startDate || range.endDate
    ? `${range.startDate || '시작일 제한 없음'} ~ ${range.endDate || '종료일 제한 없음'}`
    : '전체 예측 기간'
  function selectFirstWeek() {
    if (!firstDate || !lastDate) return
    const [year, month, day] = firstDate.split('-').map(Number)
    const end = new Date(year, month - 1, day + 6)
    const endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
    onChange({ startDate: firstDate, endDate: endDate < lastDate ? endDate : lastDate })
  }
  return <div className="forecast-period-picker">
    <details className="alert-filter-period" onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus() } }}>
      <summary aria-label={`예측 조회 기간: ${label}`}>{label}<span aria-hidden="true">▾</span></summary>
      <div className="alert-period-popover">
        <div className="alert-period-presets"><button type="button" onClick={() => onChange({ startDate: '', endDate: '' })}>전체 예측 기간</button><button type="button" disabled={!firstDate} onClick={selectFirstWeek}>예측 시작일부터 7일</button></div>
        <DateRangeFilter {...range} onChange={onChange} error={error} resultCount={resultCount} />
        <p className="control-help">{firstDate && lastDate ? `예측 데이터: ${firstDate} ~ ${lastDate}` : '예측 데이터 없음'}</p>
        <button type="button" className="alert-period-done" onClick={event => event.currentTarget.closest('details')?.removeAttribute('open')}>닫기</button>
      </div>
    </details>
    <span className="forecast-period-count" role="status">{resultCount.toLocaleString('ko-KR')}개 시간 데이터</span>
    {error && <p className="date-range-error" role="alert">{error}</p>}
  </div>
}
