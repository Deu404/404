import { useState } from 'react'
import { AgentPanel } from '../components/alerts/AgentPanel'
import { listDemoAgentAlerts } from '../services/demoAgentService'
import { getEquipmentName } from '../services/alertService'

export function AgentDemoPage() {
  const alerts = listDemoAgentAlerts()
  const [selectedId, setSelectedId] = useState(alerts[0]?.id)
  const selected = alerts.find(a => a.id === selectedId)
  return <div className="dashboard-page">
    <section className="dashboard-intro"><div><h2>에이전트 연습용 화면</h2><p>기존 데모 판정과 보고 문구 기능을 확인하는 전용 화면입니다.</p></div></section>
    <label>연습용 알림 선택 <select value={selectedId} onChange={event => setSelectedId(event.target.value)}>{alerts.map(alert => <option key={alert.id} value={alert.id}>{getEquipmentName(alert.equipmentId)} · {alert.occurredAt}</option>)}</select></label>
    {selected && <AgentPanel key={selected.id} alert={selected} />}
  </div>
}
