import { useState } from 'react'
import type { Alert } from '../../types/alert'
import type { AnomalyDetection } from '../../types/anomaly'

const API_URL = 'http://localhost:8787/api/agent'

const suggestions = [
  { label: '⭐ 한 번에 다 알려줘', message: '한 번에 다 알려줘. 어떤 이상인지, 우선순위와 근거, 무엇부터 점검하고 언제 보고해야 하는지 알려줘.' },
  { label: '어떤 이상인지', message: '선택한 설비의 이상 사례를 확인해서 어떤 이상인지 알려줘.' },
  { label: '우선순위·근거', message: '이 이상을 어느 우선순위로 확인해야 하고, 판단 근거는 뭐야?' },
  { label: '점검·보고 조건', message: '이 상황에서는 무엇부터 점검하고 어떤 조건에서 담당자에게 보고해야 해?' },
]

type AgentResult = {
  status: string
  conversationId?: string
  reply?: { summary?: string; detail?: string }
  evidence?: Array<Record<string, unknown>>
  steps?: Array<{ id?: string; label?: string }>
  reportConditions?: string[]
  missingFields?: string[]
  dataSource?: string
  demoOnly?: boolean
  toolTrace?: Array<{ name: string; status: string; target: string }>
  message?: string
}

export function AgentPanel({ alert, anomaly }: { alert?: Alert; anomaly?: AnomalyDetection }) {
  const selected = anomaly ?? alert
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string; result?: AgentResult }>>([])
  const [input, setInput] = useState('')
  const [conversationId, setConversationId] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const current = selected
  const isModelResult = current ? 'fields' in current : false

  async function ask(message: string) {
    if (!current || !message.trim() || loading) return
    setMessages((current) => [...current, { role: 'user', text: message }])
    setInput('')
    setError('')
    setLoading(true)
    try {
      const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, conversationId, alertId: current.id, equipmentId: current.equipmentId, alertType: isModelResult ? 'model-anomaly' : ('type' in current ? current.type : undefined) }) })
      const result: AgentResult = await response.json()
      if (!response.ok || result.status === 'error') throw new Error(result.message || '에이전트 요청에 실패했습니다.')
      setConversationId(result.conversationId)
      setMessages((current) => [...current, { role: 'assistant', text: result.reply?.detail || '응답을 받았습니다.', result }])
    } catch (caught) {
      const messageText = caught instanceof Error ? caught.message : '에이전트 요청에 실패했습니다.'
      setError(`${messageText} 에이전트 연결 대기 중입니다.`)
    } finally {
      setLoading(false)
    }
  }

  return <section className="panel agent-panel" aria-label="AI 점검 안내">
    <div className="panel-heading agent-heading"><div><p className="eyebrow">AI INSPECTION AGENT</p><h2>AI 점검 안내</h2><p className="agent-context">{current ? `${current.equipmentId} · ${isModelResult && 'fields' in current ? `의심 항목 ${current.fields.join(', ')}` : 'type' in current ? current.type : '모델 결과'}` : '선택된 모델 결과 없음'}</p></div><span className="data-badge">AGENT API</span></div>
    <p className="agent-demo-notice">에이전트가 연결되기 전에는 안내·점검 순서·보고 조건을 생성하지 않습니다. 현재 연결 대기 상태입니다.</p>
    <div className="agent-suggestions">{suggestions.map((suggestion) => <button type="button" key={suggestion.label} onClick={() => void ask(suggestion.message)} disabled={loading || !current}>{suggestion.label}</button>)}</div>
    <div className="agent-messages" aria-live="polite">
      {!messages.length && <p className="agent-empty">추천 질문을 선택하면 선택된 알림의 이상 유형, 우선순위, 점검 방법을 확인합니다.</p>}
      {messages.map((message, index) => <div className={`agent-message ${message.role}`} key={`${message.role}-${index}`}><strong>{message.role === 'user' ? '질문' : '에이전트'}</strong><p>{message.text}</p>{message.result && <AgentEvidence result={message.result} />}</div>)}
      {loading && <p className="agent-loading">도구를 조회하고 답변을 만드는 중입니다...</p>}
      {error && <div className="agent-error"><strong>실행 실패</strong><p>{error}</p><button type="button" onClick={() => void ask(messages.at(-1)?.text || suggestions[0].message)}>다시 시도</button></div>}
    </div>
    <form className="agent-input" onSubmit={(event) => { event.preventDefault(); void ask(input) }}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder={current ? '선택한 사례에 대해 질문하세요' : '모델 결과 연결 대기 중'} disabled={loading || !current} /><button type="submit" disabled={loading || !current || !input.trim()}>전송</button></form>
  </section>
}

function AgentEvidence({ result }: { result: AgentResult }) {
  return <details className="agent-evidence"><summary>확인된 값·미확인 항목·근거 보기</summary><div className="agent-evidence-block"><strong>확인된 값</strong>{result.evidence?.length ? <ul>{result.evidence.map((item, index) => <li key={index}>{JSON.stringify(item)}</li>)}</ul> : <p>도구가 확인한 값이 없습니다.</p>}</div><div className="agent-evidence-block agent-missing"><strong>미확인·보류</strong>{result.missingFields?.length ? <ul>{result.missingFields.map((field) => <li key={field}>{field}</li>)}</ul> : <p>없음</p>}</div>{result.steps?.length ? <div className="agent-evidence-block"><strong>점검 순서</strong><ol>{result.steps.map((step) => <li key={step.id}>{step.label}</li>)}</ol></div> : null}{result.reportConditions?.length ? <div className="agent-evidence-block"><strong>보고 조건</strong><ul>{result.reportConditions.map((condition) => <li key={condition}>{condition}</li>)}</ul></div> : null}<div className="agent-trace"><strong>근거 보기</strong>{result.toolTrace?.map((trace, index) => <span key={`${trace.name}-${index}`}>{trace.name} · {trace.status} · {trace.target}</span>)}</div></details>
}
