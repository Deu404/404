import { useState } from 'react'
import type { Alert } from '../../types/alert'

const API_URL = 'http://localhost:8787/api/agent'

// 화면 알림 ID 또는 설비 ID와 에이전트 데모 사례 ID의 명시적 대응표
const DEMO_CASE_BY_ALERT_ID: Record<string, string> = {
  'alert-20240822-001': 'demo-overcurrent-001',
  'alert-20240822-002': 'demo-lowpf-004',
  'alert-20240821-001': 'demo-pm3-005',
  'alert-20240820-001': 'demo-multi-002',
  'alert-20240819-001': 'demo-lowpf-004',
  'model-1-pm-3-currentR': 'demo-pm3-005',
  'model-12-4-current-voltageST': 'demo-multi-002',
}

const DEMO_CASE_BY_EQUIPMENT_ID: Record<string, string> = {
  'robot-03': 'demo-overcurrent-001',
  'pump-02': 'demo-lowpf-004',
  'robot-02': 'demo-multi-002',
  'compressor-01': 'demo-pm3-005',
  'motor-02': 'demo-overcurrent-001',
}

function resolveCaseId(alert: Alert): string {
  return DEMO_CASE_BY_ALERT_ID[alert.id] ?? DEMO_CASE_BY_EQUIPMENT_ID[alert.equipmentId] ?? 'demo-overcurrent-001'
}

const suggestions = [
  { label: '⭐ 한 번에 다 알려줘', message: '한 번에 다 알려줘. 어떤 이상인지, 우선순위와 근거, 무엇부터 점검하고 언제 보고해야 하는지 알려줘.' },
  { label: '어떤 이상인지', message: '선택한 설비의 이상 사례를 확인해서 어떤 이상인지 알려줘.' },
  { label: '우선순위·근거', message: '이 이상을 어느 우선순위로 확인해야 하고, 판단 근거는 뭐야?' },
  { label: '점검·보고 조건', message: '이 상황에서는 무엇부터 점검하고 어떤 조건에서 담당자에게 보고해야 해?' },
  { label: '📊 5월 예상 요금/탄소', message: '2025년 5월 10일~31일 시간대별 예상 전력 사용량, 예상 전기요금 및 탄소배출량 추세와 피크 시간대를 알려줘.' },
  { label: '📑 경영진 종합 리포트', message: '공장의 전력 소비 변화, 예상 비용, 주요 이상 발생 내역을 종합해서 경영자용 분석 리포트를 작성해줘.' },
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

export function AgentPanel({ alert }: { alert: Alert }) {
  const caseId = resolveCaseId(alert)
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string; result?: AgentResult }>>([])
  const [input, setInput] = useState('')
  const [conversationId, setConversationId] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function ask(message: string) {
    if (!message.trim() || loading) return
    setMessages((current) => [...current, { role: 'user', text: message }])
    setInput('')
    setError('')
    const isForecastOrReport = message.includes('요금') || message.includes('탄소') || message.includes('예측') || message.includes('리포트')
    if (!caseId && !isForecastOrReport) {
      setMessages((current) => [...current, { role: 'assistant', text: '이 알림과 연결된 데모 사례가 없어 분석할 수 없습니다.' }])
      return
    }
    setLoading(true)
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, caseId: caseId || undefined, conversationId }),
      })
      const result: AgentResult = await response.json()
      if (!response.ok || result.status === 'error') throw new Error(result.message || '에이전트 요청에 실패했습니다.')
      setConversationId(result.conversationId)
      setMessages((current) => [...current, { role: 'assistant', text: result.reply?.detail || '응답을 받았습니다.', result }])
    } catch (caught) {
      const messageText = caught instanceof Error ? caught.message : '에이전트 요청에 실패했습니다.'
      setError(messageText)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="panel agent-panel" aria-label="AI 점검 안내">
      <div className="panel-heading agent-heading">
        <div>
          <p className="eyebrow">AI INSPECTION AGENT</p>
          <h2>AI 점검 안내</h2>
          <p className="agent-context">{alert.equipmentId} · 사례 {caseId ?? '연결된 사례 없음'}</p>
        </div>
        <span className="mock-badge">DEMO DATA</span>
      </div>
      <div className="agent-suggestions">
        {suggestions.map((suggestion) => (
          <button type="button" key={suggestion.label} onClick={() => void ask(suggestion.message)} disabled={loading}>
            {suggestion.label}
          </button>
        ))}
      </div>
      <div className="agent-messages" aria-live="polite">
        {!messages.length && (
          <p className="agent-empty">
            추천 질문을 선택하거나 직접 질문을 입력하세요. 현장 작업자용 이상 진단·우선순위·점검 가이드뿐 아니라, 5월 전력 요금 예측 및 경영진 종합 리포트 질의도 지원합니다.
          </p>
        )}
        {messages.map((message, index) => (
          <div className={`agent-message ${message.role}`} key={`${message.role}-${index}`}>
            <strong>{message.role === 'user' ? '질문' : '에이전트'}</strong>
            <p style={{ whiteSpace: 'pre-wrap' }}>{message.text}</p>
            {message.result && <AgentEvidence result={message.result} />}
          </div>
        ))}
        {loading && <p className="agent-loading">도구를 조회하고 답변을 만드는 중입니다...</p>}
        {error && (
          <div className="agent-error">
            <strong>실행 실패</strong>
            <p>{error}</p>
            <button type="button" onClick={() => void ask(messages.at(-1)?.text || suggestions[0].message)}>
              다시 시도
            </button>
          </div>
        )}
      </div>
      <form
        className="agent-input"
        onSubmit={(event) => {
          event.preventDefault()
          void ask(input)
        }}
      >
        <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="선택한 사례에 대해 질문하세요" disabled={loading} />
        <button type="submit" disabled={loading || !input.trim()}>전송</button>
      </form>
    </section>
  )
}

function AgentEvidence({ result }: { result: AgentResult }) {
  const [open, setOpen] = useState(false)
  const traces = result.toolTrace ?? []
  return (
    <div className="agent-evidence-box">
      <button type="button" className="agent-evidence-toggle" onClick={() => setOpen(!open)}>
        {open ? '▾ 접기 (확인된 근거 및 도구 호출)' : '▸ 펼치기 (확인된 근거 및 도구 호출)'}
      </button>
      {open && (
        <div className="agent-evidence-detail">
          {traces.length > 0 && (
            <div>
              <p className="agent-evidence-label">호출된 도구:</p>
              <ul>
                {traces.map((trace, idx) => (
                  <li key={idx}>
                    <code>{trace.name}</code> ({trace.status}) - 대상: {trace.target}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.missingFields && result.missingFields.length > 0 && (
            <p className="agent-evidence-missing">누락 필드: {result.missingFields.join(', ')}</p>
          )}
          <p className="agent-evidence-source">
            데이터 소스: {result.dataSource} {result.demoOnly ? '(데모)' : '(시계열 모델)'}
          </p>
        </div>
      )}
    </div>
  )
}
