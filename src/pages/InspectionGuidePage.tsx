import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { alertTypeLabels, getAlertById, getEquipmentName } from '../services/alertService'
import { listConnectedGuides, resolveConnectedGuide } from '../services/guideService'
import { listModelAnomalies } from '../services/anomalyService'
import type { Alert } from '../types/alert'

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

function formatAlertValue(value: number | undefined, unit = '') {
  return value === undefined ? '데이터 없음' : `${value.toLocaleString('ko-KR')}${unit ? ` ${unit}` : ''}`
}

export function InspectionGuidePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const guides = listConnectedGuides()
  const guide = resolveConnectedGuide(searchParams.get('guide'))
  const alertId = searchParams.get('alert')
  const requestedAlert = getAlertById(alertId)
  const sourceAlert = requestedAlert && requestedAlert.guideKey === guide?.guideKey ? requestedAlert : undefined
  const [modelAnomalies, setModelAnomalies] = useState<Awaited<ReturnType<typeof listModelAnomalies>>>([])
  useEffect(() => {
    let cancelled = false
    listModelAnomalies().then((results) => { if (!cancelled) setModelAnomalies(results) })
    return () => { cancelled = true }
  }, [])
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  useEffect(() => setChecked({}), [guide?.guideKey])
  const steps = guide?.steps ?? []
  const completed = steps.filter(({ id }) => checked[id]).length
  const selectGuide = (guideKey: string) => setSearchParams(alertId && sourceAlert?.guideKey === guideKey ? { guide: guideKey, alert: alertId } : { guide: guideKey })

  return <div className="dashboard-page inspection-page"><section className="dashboard-intro"><div><p className="eyebrow">INSPECTION / FIRST RESPONSE</p><h2>점검 가이드</h2><p>실제 가이드 데이터가 연결되면 모델 결과에 맞는 초기 대응 절차를 제공합니다.</p></div><span className="data-badge">LIVE GUIDE DATA</span></section>
    {!guides.length && <section className="panel"><p className="empty-state">실제 가이드 데이터 연결 대기</p><p className="panel-description">현재 연결된 모델 결과와 실제 가이드 데이터가 없어 안내를 표시하지 않습니다.</p></section>}
    <section className="guide-selector panel" aria-label="가이드 선택"><div><p className="eyebrow">GUIDE TYPES</p><h2>이상 유형별 가이드</h2></div><div className="guide-buttons">{guides.map((item) => <button type="button" className={item.guideKey === guide?.guideKey ? 'active' : ''} key={item.guideKey} onClick={() => selectGuide(item.guideKey)}>{item.type}<small>{item.title}</small></button>)}</div></section>
    {sourceAlert ? <div className="guide-context"><strong>알림에서 이동함</strong> · {getEquipmentName(sourceAlert.equipmentId)} ({sourceAlert.equipmentId})의 {sourceAlert.summary}<div className="guide-context-metrics"><span>측정값: {formatAlertValue(sourceAlert.measurement, measurementUnits[sourceAlert.type])}</span><span>기준값: {formatAlertValue(sourceAlert.reference, measurementUnits[sourceAlert.type])}</span><span>데모 기준: {formatAlertValue(sourceAlert.ruleResult.demoThreshold, sourceAlert.ruleResult.thresholdUnit)}</span><span>변화량: {formatAlertValue(sourceAlert.change, changeUnits[sourceAlert.type])}</span><span>전력 변화: {formatAlertValue(sourceAlert.powerChangeKw, 'kW')}</span></div><Link to={`/alerts?alert=${sourceAlert.id}`}>알림 상세로 돌아가기</Link></div> : requestedAlert ? <div className="guide-context guide-context-invalid"><strong>알림 유형과 가이드가 일치하지 않습니다.</strong> · 선택한 가이드와 관련된 알림 문맥만 표시합니다.<Link to={`/alerts?alert=${requestedAlert.id}`}>알림 상세로 돌아가기</Link></div> : alertId ? <div className="guide-context guide-context-invalid"><strong>알림을 찾을 수 없습니다.</strong> · 요청한 알림 ID가 유효하지 않아 알림 문맥을 표시하지 않습니다.<Link to="/alerts">알림 목록으로 돌아가기</Link></div> : null}
    <div className="guide-grid">{guide ? <section className="panel guide-main"><p className="eyebrow">{guide.type}</p><h2>{guide.title}</h2><p className="guide-summary">{guide.symptomSummary}</p><section className="guide-info-section"><h3>알림 발생 이유</h3><p>{guide.triggerReason}</p></section>{modelAnomalies.length > 0 && <section className="guide-info-section alert-context-detail"><h3>모델 감지 의심 항목</h3><p>아래 항목은 고장 확정이 아닌 모델 출력입니다. 해당 설비의 실제 측정값과 현장 상태를 함께 확인하세요.</p><dl>{modelAnomalies.map((anomaly) => <div key={anomaly.id}><dt><Link to={`/equipment-power?equipment=${anomaly.equipmentId}`}>{getEquipmentName(anomaly.equipmentId)} ({anomaly.equipmentId})</Link></dt><dd>{anomaly.fields.join(', ')} · {anomaly.source}</dd></div>)}</dl></section>}{sourceAlert && <section className="guide-info-section alert-context-detail"><h3>표시된 알림 측정값</h3><dl><div><dt>이상 유형</dt><dd>{alertTypeLabels[sourceAlert.type]}</dd></div><div><dt>측정값</dt><dd>{formatAlertValue(sourceAlert.measurement, measurementUnits[sourceAlert.type])}</dd></div><div><dt>기준값</dt><dd>{formatAlertValue(sourceAlert.reference, measurementUnits[sourceAlert.type])}</dd></div><div><dt>데모 기준</dt><dd>{formatAlertValue(sourceAlert.ruleResult.demoThreshold, sourceAlert.ruleResult.thresholdUnit)}</dd></div><div><dt>변화량</dt><dd>{formatAlertValue(sourceAlert.change, changeUnits[sourceAlert.type])}</dd></div><div><dt>전력 변화</dt><dd>{formatAlertValue(sourceAlert.powerChangeKw, 'kW')}</dd></div></dl></section>}<section className="guide-info-section"><h3>작업자가 확인할 항목</h3><ul className="guide-bullet-list">{guide.operatorChecks.map((item) => <li key={item}>{item}</li>)}</ul></section><div className="guide-callout"><strong>안전한 초기 대응</strong><p>{guide.initialResponse}</p></div><div className="guide-check-heading"><div><p className="eyebrow">CHECKLIST</p><h3>단계별 점검 목록</h3></div><span>{completed}/{steps.length} 완료</span></div><div className="guide-checklist">{steps.map((step) => <label className={checked[step.id] ? 'checked' : ''} key={step.id}><input type="checkbox" checked={Boolean(checked[step.id])} onChange={(event) => setChecked((current) => ({ ...current, [step.id]: event.target.checked }))} /><span>{step.label}</span></label>)}</div></section> : <section className="panel guide-main"><p className="empty-state">표시할 점검 가이드가 없습니다.</p></section>}{guide && <aside className="panel guide-related"><p className="eyebrow">RELATED EQUIPMENT</p><h2>관련 설비</h2>{guide.relatedEquipmentIds.map((id) => <Link className="related-equipment" key={id} to={`/equipment-power?equipment=${id}`}><span>{getEquipmentName(id)} <small>({id})</small></span><b>→</b></Link>)}<section className="guide-report"><h3>담당자에게 보고해야 하는 상황</h3><ul className="guide-bullet-list">{guide.reportConditions.map((item) => <li key={item}>{item}</li>)}</ul></section><p className="guide-disclaimer">본 가이드는 개발용 참고 절차이며, 실제 작업 전 현장 안전 규정과 담당자 지시를 우선하세요.</p></aside>}</div>
  </div>
}
