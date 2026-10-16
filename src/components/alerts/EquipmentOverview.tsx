import type { EquipmentSummary } from '../../services/equipmentOverview'

type Props = {
  equipment: EquipmentSummary[]
  loading: boolean
  hasSourceData: boolean
  activeEquipment: string
  onSelect: (equipment: EquipmentSummary) => void
  onShowAll: () => void
}

export function EquipmentOverview({ equipment, loading, hasSourceData, activeEquipment, onSelect, onShowAll }: Props) {
  return <section className="panel equipment-overview" aria-labelledby="equipment-overview-title" aria-busy={loading}>
    <div className="panel-heading equipment-overview-heading">
      <h2 id="equipment-overview-title">설비별 요약</h2>
      <button type="button" className="equipment-overview-reset" onClick={onShowAll}>전체 보기</button>
    </div>
    <div className="equipment-status-legend" aria-label="상태 색상 기준">
      <span><i className="equipment-status-dot fault" aria-hidden="true" />고장 확인</span>
      <span><i className="equipment-status-dot normal" aria-hidden="true" />정상 확인</span>
      <span><i className="equipment-status-dot unknown" aria-hidden="true" />확인 필요</span>
    </div>
    <p className="equipment-overview-note">현장 확인 정보가 없어 현재 상태는 확인 필요입니다.</p>
    <div className="equipment-overview-grid">
      {equipment.map(item => {
        const status = loading ? '조회 중' : !hasSourceData ? '자료 미확인' : item.count ? '이상 알림 있음 · 고장 여부 확인 필요' : '조회 기간 알림 없음 · 현장 상태 확인 필요'
        return <button type="button" key={item.id}
          className={`equipment-overview-card ${activeEquipment === item.id ? 'selected' : ''}`}
          aria-pressed={activeEquipment === item.id} disabled={loading || !item.latest}
          aria-label={`${item.name} · ${status} · ${item.latest ? '최근 알림 확인' : '최근 알림 없음'}`}
          onClick={() => onSelect(item)}>
          <span className="equipment-overview-card-top"><strong>{item.name}</strong><span className="equipment-status-dot unknown" role="img" aria-label={status} title={status} /></span>
          <span className="equipment-overview-action">{loading ? '조회 중' : item.latest ? '최근 알림 확인 →' : '최근 알림 없음'}</span>
        </button>
      })}
    </div>
  </section>
}
