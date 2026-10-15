import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EQUIPMENT_DATA_MAP, EQUIPMENT_LAYOUT } from '../config/equipmentDataMap'
import { listEquipment } from '../services/equipmentService'
import type { Equipment } from '../types/equipment'
import { listModelAnomalies } from '../services/anomalyService'

const statusLabels = { normal: '정상', warning: '주의', critical: '이상' }

const layoutEquipment = EQUIPMENT_LAYOUT

export function FactoryLayoutPage() {
  const equipment = listEquipment()
  const [anomalies, setAnomalies] = useState<Awaited<ReturnType<typeof listModelAnomalies>>>([])
  useEffect(() => {
    let cancelled = false
    listModelAnomalies().then((results) => { if (!cancelled) setAnomalies(results) })
    return () => { cancelled = true }
  }, [])
  const positionedEquipment = layoutEquipment.flatMap((layoutItem) => {
    const equipmentId = Object.entries(EQUIPMENT_DATA_MAP).find(([, fileName]) => fileName === layoutItem.fileName)?.[0]
    const item = equipment.find(({ id }) => id === equipmentId)
    return item ? [{ ...item, status: anomalies.some(({ equipmentId }) => equipmentId === item.id) ? 'warning' as const : item.status, name: layoutItem.name, layoutName: layoutItem.name, x: layoutItem.x, y: layoutItem.y }] : []
  })
  const [selected, setSelected] = useState<Equipment | undefined>(() => positionedEquipment[0])

  return <div className="layout-page"><section className="dashboard-intro"><div><p className="eyebrow">FACTORY MAP / EQUIPMENT POSITION</p><h2>공장 2D 배치도</h2><p>설비를 선택하면 상태와 전력 상세를 확인할 수 있습니다.</p></div><span className="mock-badge">VIRTUAL FACTORY LAYOUT</span></section><div className="layout-grid"><section className="panel factory-panel"><div className="panel-heading"><div><h2>공장 구역 및 설비 위치</h2><p className="panel-description">실제 공장 배치도에서 설비 상태를 확인할 수 있습니다.</p></div><span className="equipment-count">{positionedEquipment.length}개 설비</span></div><div className="factory-map" aria-label="가상 공장 설비 배치도"><img className="factory-layout-image" src="/factory-layout.png" alt="가상 공장 배치도" /><div className="factory-equipment-overlay">{positionedEquipment.length ? positionedEquipment.map((item) => <button type="button" className={`equipment-marker ${item.status} ${selected?.id === item.id ? 'selected' : ''}`} style={{ left: `${item.x}%`, top: `${item.y}%` }} key={item.id} onClick={() => setSelected(item)} aria-label={`${item.layoutName}, ${statusLabels[item.status]}, ${item.powerKw === undefined ? '데이터 없음' : `${item.powerKw} kW`}`}><span className="marker-pulse" /><span className="marker-name">{item.layoutName}</span></button>) : <p className="empty-state">표시할 설비가 없습니다.</p>}</div></div><div className="map-legend" aria-label="설비 상태 범례"><span><i className="status-dot-large normal" />정상</span><span><i className="status-dot-large warning" />주의</span><span><i className="status-dot-large critical" />이상</span></div></section><aside className="panel equipment-detail">{selected ? <><p className="eyebrow">SELECTED EQUIPMENT</p><h2>{selected.name}</h2><span className={`detail-status ${selected.status}`}>{statusLabels[selected.status]} 운전</span><dl><div><dt>설비 ID</dt><dd>{selected.id}</dd></div><div><dt>구역</dt><dd>{selected.zone}</dd></div><div><dt>현재 전력</dt><dd>{selected.powerKw === undefined ? '데이터 없음' : `${selected.powerKw} kW`}</dd></div></dl><p className="detail-message">{selected.message}</p><Link className="detail-link" to={`/equipment-power?equipment=${selected.id}`}>상세 전력 분석 보기 <span>→</span></Link><p className="empty-state">모델 결과 없음 · 실제 모델 결과 API 연결 대기 중입니다.</p></> : <p className="empty-state">선택할 설비가 없습니다.</p>}</aside></div></div>
}
