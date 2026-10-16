import { DateRangeFilter } from '../common/DateRangeFilter'
import type { DateRange } from '../../utils/dateRange'

type Props = {
  query: string
  onQueryChange: (value: string) => void
  equipment: string
  equipmentOptions: { id: string; name: string }[]
  onEquipmentChange: (value: string) => void
  dateRange: DateRange
  onDateChange: (range: DateRange) => void
  latestDate?: string
  error?: string
  resultCount: number
  loading: boolean
  onReset: () => void
}

const emptyRange = { startDate: '', endDate: '' }

export function AlertFilterBar(props: Props) {
  const { query, equipment, dateRange, latestDate } = props
  const hasDate = Boolean(dateRange.startDate || dateRange.endDate)
  const hasFilters = Boolean(query || equipment !== 'all' || hasDate)
  const periodLabel = hasDate ? `${dateRange.startDate || '시작일 제한 없음'} ~ ${dateRange.endDate || '종료일 제한 없음'}` : '전체 기간'
  function setPreset(days: number) {
    if (!latestDate) return
    const [year, month, day] = latestDate.split('-').map(Number)
    const start = new Date(year, month - 1, day - days + 1)
    const startDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
    props.onDateChange({ startDate, endDate: latestDate })
  }
  return <section className="panel alert-filter-bar" aria-label="이상 알림 조회 조건">
    <div className="alert-filter-toolbar">
      <label className="alert-filter-search"><span>검색</span><input type="search" value={query} onChange={event => props.onQueryChange(event.target.value)} placeholder="설비명·의심 항목 검색" /></label>
      <label className="alert-filter-equipment"><span>설비</span><select value={equipment} onChange={event => props.onEquipmentChange(event.target.value)}><option value="all">전체 설비</option>{props.equipmentOptions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <details className="alert-filter-period" onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus() } }}>
        <summary>기간: {periodLabel}<span aria-hidden="true">▾</span></summary>
        <div className="alert-period-popover">
          <div className="alert-period-presets"><button type="button" onClick={() => props.onDateChange(emptyRange)}>전체 기간</button><button type="button" disabled={!latestDate} onClick={() => setPreset(1)}>데이터 마지막 날</button><button type="button" disabled={!latestDate} onClick={() => setPreset(7)}>마지막 7일</button></div>
          <DateRangeFilter {...dateRange} onChange={props.onDateChange} error={props.error} resultCount={props.resultCount} />
          <p className="control-help">{latestDate ? `데이터 마지막 날짜: ${latestDate} · 시작일과 종료일을 포함합니다.` : '데이터 날짜를 확인 중입니다.'}</p>
          <button type="button" className="alert-period-done" onClick={event => event.currentTarget.closest('details')?.removeAttribute('open')}>닫기</button>
        </div>
      </details>
      <button type="button" className="alert-filter-reset" disabled={!hasFilters} onClick={props.onReset}>초기화</button>
    </div>
    <div className="alert-filter-status"><div className="alert-filter-tags" aria-label="적용 조건">
      {equipment !== 'all' && <button type="button" onClick={() => props.onEquipmentChange('all')} aria-label="설비 조건 해제">{props.equipmentOptions.find(item => item.id === equipment)?.name ?? equipment}<span aria-hidden="true">×</span></button>}
      {hasDate && <button type="button" onClick={() => props.onDateChange(emptyRange)} aria-label="기간 조건 해제">{periodLabel}<span aria-hidden="true">×</span></button>}
      {query && <button type="button" onClick={() => props.onQueryChange('')} aria-label="검색 조건 해제">검색: {query}<span aria-hidden="true">×</span></button>}
      {!hasFilters && <span>전체 설비 · 전체 기간</span>}
    </div><span role="status">{props.loading ? '불러오는 중…' : `조회 ${props.resultCount.toLocaleString('ko-KR')}건`}</span></div>
    {props.error && <p className="date-range-error" role="alert">{props.error}</p>}
  </section>
}
