import { decideModelAnomaly } from '../../shared/modelDecision.ts'
import type { ModelAnomalyInput } from '../../shared/modelDecision.ts'
import { useRef, useState } from 'react'
import type { Alert } from '../../types/alert'
import { decideAlert, reportText } from '../../shared/decision.ts'
import { DecisionCard } from './DecisionCard'

const API_URL = 'http://localhost:8787/api/agent'
const suggestions = [
  { label: '쉽게 설명해줘', message: '선택한 알림을 쉽게 설명해줘.', intent: 'anomaly' },
  { label: '우선순위·근거', message: '어느 정도로 급하고 판단 근거는 뭐야?', intent: 'anomaly' },
  { label: '점검·보고 조건', message: '점검 순서와 보고 조건을 짧게 알려줘.', intent: 'anomaly' },
  { label: '5월 예상 요금·탄소', message: '2025년 5월 10일~31일 예상 요금과 탄소배출량을 알려줘.', intent: 'forecast' },
  { label: '경영진 종합 리포트', message: '경영자용 종합 리포트를 작성해줘.', intent: 'executive' },
] as const

type Message = { role: 'user' | 'assistant'; text: string; notice?: string }
export function AgentPanel({ alert, anomaly }: { alert?: Alert; anomaly?: ModelAnomalyInput }) {
  const decision = alert ? decideAlert(alert) : anomaly ? decideModelAnomaly(anomaly) : undefined
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const busy = useRef(false)

  async function ask(message: string, intent?: string) {
    if (!message.trim() || busy.current) return
    busy.current = true
    setMessages(current => [...current, { role: 'user', text: message }])
    setInput(''); setError(''); setLoading(true)
    try {
      const response = await fetch(API_URL, {
        method: 'POST', signal: AbortSignal.timeout(30000), headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, alert, anomaly, intent }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error('설명 서비스에 연결하지 못했어요.')
      setMessages(current => [...current, { role: 'assistant', text: result.reply?.detail ?? '설명을 확인하지 못했어요.', notice: result.explanationNotice }])
    } catch {
      setError('설명 서비스에 연결하지 못했어요. 위의 판정·할 일·보고 안내는 그대로 확인할 수 있어요.')
    } finally { busy.current = false; setLoading(false) }
  }
  function makeReport() {
    if (!decision) return
    setMessages(current => [...current, { role: 'assistant', text: reportText(decision), notice: '복사해서 사용할 보고 초안이에요. 실제 보고는 직접 진행해 주세요.' }])
  }
  return <section className="panel agent-panel" aria-label="AI 점검 안내">
    <div className="panel-heading agent-heading"><div>
      <p className="eyebrow">AI INSPECTION AGENT</p><h2>AI 점검 안내</h2>
      <p className="agent-context" style={{ lineHeight: 1.6 }}>왼쪽에서 알림을 선택한 뒤, 아래 버튼을 누르거나 궁금한 점을 입력하세요.<br />이상 유형, 얼마나 급한지, 점검 순서와 보고가 필요한 상황을 알려드려요.</p>
    </div><span className="mock-badge">{decision?.demoOnly ? '연습용 자료' : '모델 자료'}</span></div>
    <>{decision ? <DecisionCard decision={decision} /> : <p className="agent-empty">선택된 모델 결과가 없어요. 이상 알림이 연결되면 선택해서 확인할 수 있어요.</p>}</>
    <div className="agent-suggestions">
      {suggestions.map(s => <button type="button" key={s.label} disabled={loading || (!decision && s.intent === 'anomaly')} onClick={() => void ask(s.message, s.intent)}>{s.label}</button>)}
      <button type="button" disabled={!decision} onClick={makeReport}>📋 보고 문구 만들기</button>
    </div>
    <div className="agent-messages" aria-live="polite">
      {!messages.length && <p className="agent-empty">위 안내는 룰로 판단한 결과예요. 궁금한 부분을 질문하면 쉽게 설명해 드려요.</p>}
      {messages.map((message, index) => <div className={`agent-message ${message.role}`} key={index}>
        <strong>{message.role === 'user' ? '질문' : '설명·보고 초안'}</strong><p>{message.text}</p>{message.notice && <p>{message.notice}</p>}
      </div>)}
      {loading && <p className="agent-loading">확인된 결과를 쉽게 설명하는 중이에요...</p>}
      {error && <p className="agent-error" role="alert">{error}</p>}
    </div>
    <form className="agent-input" onSubmit={event => { event.preventDefault(); void ask(input) }}>
      <input aria-label="선택한 알림에 대한 질문" value={input} onChange={event => setInput(event.target.value)} placeholder="궁금한 점을 입력하세요" disabled={loading} />
      <button type="submit" disabled={loading || !input.trim()}>전송</button>
    </form>
  </section>
}
