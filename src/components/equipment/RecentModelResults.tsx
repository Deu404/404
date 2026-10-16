import { Link } from 'react-router-dom'
import { anomalyFieldLabel, summarizeEquipment } from '../../services/equipmentOverview'
import type { AnomalyDetection } from '../../types/anomaly'

type Props = {
  equipmentId: string
  equipmentName: string
  anomalies: readonly AnomalyDetection[]
  loading: boolean
}

export function RecentModelResults({ equipmentId, equipmentName, anomalies, loading }: Props) {
  const summary = summarizeEquipment([{ id: equipmentId, name: equipmentName }], anomalies)[0]
  const recent = [...anomalies].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 5)
  const fields = summary.fields.map(anomalyFieldLabel)
  const shortFields = (values: readonly string[]) => `${values.slice(0, 2).join(' · ')}${values.length > 2 ? ` 외 ${values.length - 2}개` : ''}`

  return <section className="panel equipment-alerts-panel recent-model-results" aria-labelledby="equipment-alerts-title" aria-busy={loading}>
    <div className="panel-heading"><div><p className="eyebrow">MODEL RESULTS / TEST DATA</p><h2 id="equipment-alerts-title">관련 모델 결과</h2><p className="panel-description">{equipmentName} · 선택한 날짜 범위의 탐지 결과</p></div>
      <Link className="detail-link" to={`/alerts?equipment=${encodeURIComponent(equipmentId)}`}>설비 전체 결과 보기 →</Link>
    </div>
    <dl className="equipment-model-summary">
      <div><dt>조회 기간 탐지</dt><dd>{loading ? '조회 중' : `${summary.count.toLocaleString('ko-KR')}건`}</dd></div>
      <div><dt>최근 발생 시각</dt><dd>{loading ? '조회 중' : summary.latest?.occurredAt ?? '기록 없음'}</dd></div>
      <div><dt>주요 의심 항목</dt><dd title={fields.join(' · ')}>{loading ? '조회 중' : fields.length ? shortFields(fields) : '기록 없음'}</dd></div>
    </dl>
    {loading ? <p className="empty-state" role="status">모델 결과를 불러오고 있습니다.</p> : recent.length ? <>
      <h3 className="recent-model-heading">최근 {recent.length}건</h3>
      <div className="equipment-alert-list">{recent.map(anomaly => {
        const labels = anomaly.fields.map(anomalyFieldLabel)
        return <Link className="equipment-alert-row" key={anomaly.id} to={`/alerts?equipment=${encodeURIComponent(equipmentId)}&anomaly=${encodeURIComponent(anomaly.id)}`}>
          <i className="equipment-status-dot unknown" aria-hidden="true" />
          <span><strong title={labels.join(' · ')}>{shortFields(labels)}</strong><small>{anomaly.occurredAt}</small></span><b>점검 안내 →</b>
        </Link>
      })}</div>
    </> : <p className="empty-state">선택한 기간에 표시할 모델 결과가 없습니다.</p>}
    <p className="panel-description recent-model-note">같은 설비의 여러 시점 알림을 포함합니다. 고장 확정·심각도·처리 완료를 뜻하지 않습니다.</p>
  </section>
}
