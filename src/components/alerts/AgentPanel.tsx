import { decideModelAnomaly } from '../../shared/modelDecision.ts'
import type { ModelAnomalyInput } from '../../shared/modelDecision.ts'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Decision } from '../../shared/decision.ts'
import type { Alert } from '../../types/alert'
import { decideAlert } from '../../shared/decision.ts'
import { DecisionCard } from './DecisionCard'
import { InspectionReport } from './InspectionReport'

const agentBaseUrl =
  import.meta.env.VITE_AGENT_API_URL?.trim().replace(/\/+$/, '')

const API_URL = agentBaseUrl
  ? `${agentBaseUrl}/api/agent`
  : '/api/agent'
const INSPECTION_URL = agentBaseUrl
  ? `${agentBaseUrl}/api/inspection`
  : '/api/inspection'
const suggestions = [
  { label: '쉽게 설명해줘', message: '선택한 알림을 쉽게 설명해줘.', intent: 'anomaly' },
  { label: '우선순위·근거', message: '어느 정도로 급하고 판단 근거는 뭐야?', intent: 'anomaly' },
  { label: '점검·보고 조건', message: '점검 순서와 보고 조건을 짧게 알려줘.', intent: 'anomaly' },
  { label: '5월 예상 요금·탄소', message: '2025년 5월 10일~31일 예상 요금과 탄소배출량을 알려줘.', intent: 'forecast' },
  { label: '경영진 종합 리포트', message: '경영자용 종합 리포트를 작성해줘.', intent: 'executive' },
] as const

type Trace = { name: string; status: string; trigger?: string }
const traceLabels: Record<string, string> = { get_anomaly_case: '알림·원시 관측 조회', classify_anomaly: '등록 기준 판정', evaluate_priority: '우선순위 확인', get_inspection_guide: '점검·보고 안내 조회', get_forecast_summary: '예측 CSV 조회', get_executive_report_data: '경영 요약 조회', shared_decision: '공통 기준 판정' }
type Message = { role: 'user' | 'assistant'; text: string; notice?: string; trace?: Trace[]; evidence?: unknown[] }
export function AgentPanel({ alert, anomaly, collapsed = false, onExpand, composerContext }: { alert?: Alert; anomaly?: ModelAnomalyInput; collapsed?: boolean; onExpand?: () => void; composerContext?: ReactNode }) {
  const [serverDecision, setServerDecision] = useState<Decision>()
  const [inspectionNotice, setInspectionNotice] = useState('')
  const decision = serverDecision ?? (alert ? decideAlert(alert) : anomaly ? decideModelAnomaly(anomaly) : undefined)
  const conversationId = useRef<string | undefined>(undefined)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [reportOpen, setReportOpen] = useState(false)
  const busy = useRef(false)

  useEffect(() => {
    if (!anomaly) return
    const controller = new AbortController()
    setInspectionNotice('발생 시점의 측정값과 설비별 정상 참조 범위를 확인하고 있어요.')
    fetch(INSPECTION_URL, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anomaly }) })
      .then(async response => {
        if (!response.ok) throw new Error('조회 실패')
        const result = await response.json()
        if (!result.decision) throw new Error('판정 없음')
        if (!controller.signal.aborted) { setServerDecision(result.decision); setInspectionNotice('') }
      }).catch(() => { if (!controller.signal.aborted) setInspectionNotice('서버의 기준 조회를 완료하지 못했어요. 모델의 의심 항목과 연결 상태를 확인하세요.') })
    return () => controller.abort()
  }, [anomaly])

  async function ask(message: string, intent?: string) {
    if (!message.trim() || busy.current) return
    onExpand?.()
    busy.current = true
    setMessages(current => [...current, { role: 'user', text: message }])
    setInput(''); setError(''); setLoading(true)
    try {
      const response = await fetch(API_URL, {
        method: 'POST', signal: AbortSignal.timeout(40000), headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, alert, anomaly, intent, conversationId: conversationId.current }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error('설명 서비스에 연결하지 못했어요.')
      conversationId.current = result.conversationId
      if (result.decision) setServerDecision(result.decision)
      setMessages(current => [...current, { role: 'assistant', text: result.reply?.detail ?? '설명을 확인하지 못했어요.', notice: result.explanationNotice, trace: result.toolTrace, evidence: result.evidence }])
    } catch {
      setError('설명 서비스에 연결하지 못했어요. 위의 판정·할 일·보고 안내는 그대로 확인할 수 있어요.')
    } finally { busy.current = false; setLoading(false) }
  }
  return <section className="panel agent-panel" aria-label="AI 점검 안내">
    {reportOpen && decision && <InspectionReport decision={decision} fields={anomaly?.fields} onClose={() => setReportOpen(false)} />}
    <div className="agent-panel-body" hidden={collapsed}>
    <div className="panel-heading agent-heading"><div>
      <p className="eyebrow">AI INSPECTION AGENT</p><h2>AI 점검 안내</h2>
      <p className="agent-context" style={{ lineHeight: 1.6 }}>왼쪽에서 알림을 선택한 뒤, 아래 버튼을 누르거나 궁금한 점을 입력하세요.<br />이상 유형, 얼마나 급한지, 점검 순서와 보고가 필요한 상황을 알려드려요.</p>
    </div><span className="mock-badge">{decision?.demoOnly ? '연습용 자료' : '모델 자료'}</span></div>
    {inspectionNotice && <p role="status">{inspectionNotice}</p>}
    <>{decision ? <DecisionCard decision={decision} /> : <p className="agent-empty">선택된 모델 결과가 없어 알림 점검 버튼을 사용할 수 없어요. 아래 알림 목록에서 알림을 선택해 주세요. 목록이 비어 있으면 모델 결과 연결이 필요해요.</p>}</>
    <div className="agent-suggestions">
      {suggestions.map(s => <button type="button" key={s.label} disabled={loading || (!decision && s.intent === 'anomaly')} onClick={() => void ask(s.message, s.intent)}>{s.label}</button>)}
      <button type="button" disabled={!decision} onClick={() => setReportOpen(true)}>점검 보고서 작성</button>
    </div>
    <div className="agent-messages" aria-live="polite">
      {!messages.length && <p className="agent-empty">위 안내는 룰로 판단한 결과예요. 궁금한 부분을 질문하면 쉽게 설명해 드려요.</p>}
      {messages.map((message, index) => <div className={`agent-message ${message.role}`} key={index}>
        <strong>{message.role === 'user' ? '질문' : '설명·보고 초안'}</strong><p>{message.text}</p>{message.notice && <p>{message.notice}</p>}
        {!!message.trace?.length && <details><summary>실행 근거 보기</summary><ul>{message.trace.map((trace, i) => <li key={i}>{traceLabels[trace.name] ?? '미등록 도구'} · {trace.status} · {trace.trigger === 'ai' ? 'AI 선택' : '서버 확인'}</li>)}</ul><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(message.evidence, null, 2)}</pre></details>}
      </div>)}
      {loading && <p className="agent-loading">확인된 결과를 쉽게 설명하는 중이에요...</p>}
      {error && <p className="agent-error" role="alert">{error}</p>}
    </div>
    </div>
    <form className="agent-input" onSubmit={event => { event.preventDefault(); void ask(input) }}>
      {composerContext && <div className="agent-input-context">{composerContext}</div>}
      <input aria-label="선택한 알림에 대한 질문" value={input} onChange={event => setInput(event.target.value)} placeholder="궁금한 점을 입력하세요" disabled={loading} />
      <button type="submit" disabled={loading || !input.trim()}>전송</button>
    </form>
  </section>
}
