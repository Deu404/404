import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { alertTypeLabels, getAlertById, getEquipmentName, listAlerts, priorityLabels, priorityOrder, severityLabels, severityOrder } from '../services/alertService'
import type { Alert } from '../types/alert'
import { DateRangeFilter } from '../components/common/DateRangeFilter'
import { getDateRangeValidation, isDateInRange, type DateRange } from '../utils/dateRange'
import { listModelAnomalies } from '../services/anomalyService'
import { listEquipment } from '../services/equipmentService'
import { AgentPanel } from '../components/alerts/AgentPanel'

type SortMode = 'priority' | 'severity' | 'latest'

type FilterValue = 'all' | string

const acknowledgementLabels: Record<Alert['acknowledgement'], string> = {
  acknowledged: '확인됨',
  unacknowledged: '미확인',
}

const measurementUnits: Record<Alert['type'], string> = {
  overcurrent: 'A',
  'low-power-factor': '역률',
  'power-consumption-increase': 'kW',
  'phase-current-imbalance': '%',
}

const changeUnits: Record<Alert['type'], string> = {
  overcurrent: 'A',
  'low-power-factor': '역률',
  'power-consumption-increase': '%',
  'phase-current-imbalance': '%',
}

function formatValue(value: number | undefined, unit = '') {
  return value === undefined ? '데이터 없음' : `${value.toLocaleString('ko-KR')}${unit ? ` ${unit}` : ''}`
}

function formatSignedValue(value: number | undefined, unit = '') {
  if (value === undefined) return '데이터 없음'
  return `${value > 0 ? '+' : ''}${value.toLocaleString('ko-KR')}${unit ? ` ${unit}` : ''}`
}

function formatAlertChange(alert: Alert) {
  return alert.change === undefined
    ? formatSignedValue(alert.powerChangeKw, 'kW')
    : formatSignedValue(alert.change, changeUnits[alert.type])
}

export function AlertsPage() {
  const alertData = listAlerts()
  const modelAnomalies = listModelAnomalies()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedAlertId = searchParams.get('alert')
  const requestedAlert = getAlertById(requestedAlertId)
  const [query, setQuery] = useState('')
  const [alertType, setAlertType] = useState<FilterValue>('all')
  const [severity, setSeverity] = useState<FilterValue>('all')
  const [equipment, setEquipment] = useState<FilterValue>('all')
  const [acknowledgement, setAcknowledgement] = useState<FilterValue>('all')
  const [sortMode, setSortMode] = useState<SortMode>('priority')
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: '', endDate: '' })
  const dateValidation = getDateRangeValidation(dateRange)
  const [selectedId, setSelectedId] = useState(alertData[0]?.id ?? '')
  const equipmentOptions = useMemo(() => listEquipment(), [])
  const alerts = useMemo(() => [...alertData]
    .filter((alert) => {
      const searchableText = `${alert.id} ${alert.equipmentId} ${getEquipmentName(alert.equipmentId)} ${alert.summary} ${alertTypeLabels[alert.type]}`.toLowerCase()
      return isDateInRange(alert.occurredAt, dateValidation)
        && (alertType === 'all' || alert.type === alertType)
        && (severity === 'all' || alert.severity === severity)
        && (equipment === 'all' || alert.equipmentId === equipment)
        && (acknowledgement === 'all' || alert.acknowledgement === acknowledgement)
        && searchableText.includes(query.toLowerCase())
    })
    .sort((a, b) => sortMode === 'latest'
      ? b.occurredAt.localeCompare(a.occurredAt)
      : sortMode === 'severity'
        ? severityOrder[b.severity] - severityOrder[a.severity] || priorityOrder[b.priority] - priorityOrder[a.priority]
        : priorityOrder[b.priority] - priorityOrder[a.priority] || severityOrder[b.severity] - severityOrder[a.severity]), [alertData, alertType, severity, equipment, acknowledgement, query, sortMode, dateValidation])

  useEffect(() => {
    if (requestedAlertId) setSelectedId(requestedAlert?.id ?? '')
  }, [requestedAlertId, requestedAlert?.id])

  const selected = requestedAlertId
    ? alerts.find(({ id }) => id === requestedAlertId) ?? alerts[0]
    : alerts.find(({ id }) => id === selectedId) ?? alerts[0]
  const selectAlert = (id: string) => {
    setSelectedId(id)
    setSearchParams({ alert: id })
  }

  return <div className="dashboard-page alerts-page">
    <section className="dashboard-intro"><div><p className="eyebrow">POWER ALERTS / REVIEW QUEUE</p><h2>이상 알림</h2><p>전력 변화가 관찰된 항목을 우선순위에 따라 검토합니다.</p></div><span className="mock-badge">DEVELOPMENT MOCK DATA</span></section>
    <p className="mock-notice">개발용 가상 데이터 · 실제 진단 결과가 아닌 검토용 시뮬레이션입니다.</p>
    <section className="panel" aria-labelledby="model-anomaly-title"><div className="panel-heading"><div><p className="eyebrow">MODEL OUTPUT / REVIEW</p><h2 id="model-anomaly-title">모델 감지 결과</h2></div><span className="equipment-count">{modelAnomalies.length}건</span></div>{modelAnomalies.length ? <div className="alert-detail-list">{modelAnomalies.map((anomaly) => <div className="alert-detail-row" key={anomaly.id}><span className="status-dot-large warning" /><div className="alert-row-main"><Link className="alert-equipment-link" to={`/equipment-power?equipment=${anomaly.equipmentId}`}><strong>{anomaly.equipmentName}</strong> <small>({anomaly.equipmentId})</small></Link><small>source: {anomaly.source}</small><p>의심 항목: {anomaly.fields.join(', ')}</p></div><span className="alert-badge warning">모델 감지</span></div>)}</div> : <p className="empty-state">모델 감지 결과가 없습니다.</p>}<p className="muted">모델 출력은 이상 의심 항목이며 fault 확정이나 심각도·우선순위를 의미하지 않습니다.</p></section>
    <DateRangeFilter {...dateRange} onChange={setDateRange} error={dateValidation.error} resultCount={alerts.length} />
    <section className="alert-controls panel" aria-label="알림 검색 및 필터"><label>검색<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="설비명, 요약, 알림 ID" /></label><label>이상 유형<select value={alertType} onChange={(event) => setAlertType(event.target.value)}><option value="all">전체</option>{Object.entries(alertTypeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>심각도<select value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="all">전체</option><option value="critical">이상</option><option value="warning">주의</option><option value="normal">정상 참고</option></select></label><label>설비<select value={equipment} onChange={(event) => setEquipment(event.target.value)}><option value="all">전체</option>{equipmentOptions.map((item) => <option value={item.id} key={item.id}>{item.name} ({item.id})</option>)}</select></label><label>확인 상태<select value={acknowledgement} onChange={(event) => setAcknowledgement(event.target.value)}><option value="all">전체</option><option value="unacknowledged">미확인</option><option value="acknowledged">확인됨</option></select></label><label>정렬<select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}><option value="priority">우선순위 우선</option><option value="severity">심각도 우선</option><option value="latest">최신순</option></select></label><span className="control-help">우선순위가 높은 항목을 먼저 표시합니다.</span></section>
    <div className="alerts-content"><section className="panel alert-table-panel" aria-labelledby="alert-list-title"><div className="panel-heading"><div><p className="eyebrow">ALERT LIST</p><h2 id="alert-list-title">검토 대기 알림</h2></div><span className="equipment-count">{alerts.length}건</span></div>{alerts.length ? <div className="alert-detail-list">{alerts.map((alert) => <button type="button" className={`alert-detail-row ${selected?.id === alert.id ? 'selected' : ''}`} key={alert.id} onClick={() => selectAlert(alert.id)} aria-pressed={selected?.id === alert.id}><span className={`status-dot-large ${alert.severity}`} /><div className="alert-row-main"><strong>{getEquipmentName(alert.equipmentId)} <small className="alert-equipment-id">({alert.equipmentId})</small></strong><small>{alert.occurredAt} · {alert.id}</small><p>{alertTypeLabels[alert.type]} · {alert.summary}</p></div><span className={`alert-badge ${alert.severity}`}>{severityLabels[alert.severity]}</span><span className={`priority-badge ${alert.priority}`}>우선순위 {priorityLabels[alert.priority]}</span><span className={`ack-badge ${alert.acknowledgement}`}>{acknowledgementLabels[alert.acknowledgement]}</span><span className="alert-change">{formatAlertChange(alert)}<br /><small>{formatSignedValue(alert.changeRatePercent, '%')}</small></span></button>)}</div> : <p className="empty-state">조건에 맞는 알림이 없습니다.</p>}</section>
      <section className="panel alert-selected-panel" aria-live="polite">{requestedAlertId && !requestedAlert ? <><p className="eyebrow">ALERT NOT FOUND</p><h2>알림을 찾을 수 없습니다.</h2><p className="selected-detail">요청한 알림 ID를 확인하고 알림 목록에서 다시 선택하세요.</p></> : selected ? <><p className="eyebrow">SELECTED ALERT</p><h2>{selected.summary}</h2><p className="selected-equipment">{getEquipmentName(selected.equipmentId)} · 설비 번호 {selected.equipmentId} · {selected.occurredAt}</p><div className="selected-badges"><span className={`alert-badge ${selected.severity}`}>{severityLabels[selected.severity]}</span><span className={`priority-badge ${selected.priority}`}>우선순위 {priorityLabels[selected.priority]}</span><span className={`ack-badge ${selected.acknowledgement}`}>{acknowledgementLabels[selected.acknowledgement]}</span></div><p className="selected-detail">{selected.detail}</p><div className="alert-fact-grid"><span>알림 ID<strong>{selected.id}</strong></span><span>이상 유형<strong>{alertTypeLabels[selected.type]}</strong></span><span>발생 시각<strong>{selected.occurredAt}</strong></span><span>반복 횟수<strong>{selected.repeatCount ?? '데이터 없음'}회</strong></span></div><div className="selected-metrics"><span>측정값<strong>{formatValue(selected.measurement, measurementUnits[selected.type])}</strong></span><span>기준값<strong>{formatValue(selected.reference, measurementUnits[selected.type])}</strong></span><span>변화량<strong>{formatSignedValue(selected.change, changeUnits[selected.type])}</strong></span><span>전력 변화<strong>{formatSignedValue(selected.powerChangeKw, 'kW')}</strong></span><span>변화율<strong>{formatSignedValue(selected.changeRatePercent, '%')}</strong></span></div><div className="rule-reason"><strong>판단 근거</strong><p>{selected.ruleResult.reason}</p><small>데모용 기준값: {formatValue(selected.ruleResult.demoThreshold, selected.ruleResult.thresholdUnit)} · 실제 안전 기준이 아닙니다.</small></div><div className="detail-actions"><Link className="detail-link" to={`/equipment-power?equipment=${selected.equipmentId}`}>설비 상세 보기 <span>→</span></Link><Link className="detail-link" to={`/inspection-guide?guide=${selected.guideKey}&alert=${selected.id}`}>관련 점검 가이드 <span>→</span></Link></div></> : <p className="empty-state">알림을 선택하면 상세 정보가 표시됩니다.</p>}</section></div>
    {selected && <AgentPanel alert={selected} />}
  </div>
}
