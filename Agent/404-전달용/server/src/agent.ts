// OpenAI function-calling 실행 루프.
// 외부 SDK 없이 Node 기본 fetch를 사용하므로 npm 설치 없이 실행할 수 있다.
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { TOOLS } from './tools.ts'

const MODEL = process.env.OPENAI_MODEL || 'gpt-5-mini'
const MAX_TOOL_ROUNDS = 6
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const promptPath = join(process.cwd(), 'prompt.txt')

export type AgentRequest = {
  message: string
  caseId?: string
  conversationId?: string
}

type ToolTrace = { name: string; status: string; target: string }
export type AgentResponse = {
  status: 'completed' | 'insufficient_data' | 'not_found' | 'error'
  conversationId: string
  reply: { summary: string; detail: string }
  evidence: unknown[]
  steps: unknown[]
  reportConditions: unknown[]
  missingFields: string[]
  dataSource: 'synthetic' | 'forecast_model_v1'
  demoOnly: boolean
  toolTrace: ToolTrace[]
  error?: string
}

type ToolCall = {
  id: string
  function?: {
    name?: string
    arguments?: string
  }
}

type ChatMessage = {
  role: string
  content?: string | null
  tool_call_id?: string
  name?: string
  tool_calls?: ToolCall[]
}

const conversations = new Map<string, ChatMessage[]>()

const toolDefinitions = [
  { type: 'function', function: { name: 'get_anomaly_case', description: '사례 ID로 설비, 측정값, 단위, 비교 기준을 조회한다. 측정값이 필요할 때 사용한다.', parameters: { type: 'object', properties: { caseId: { type: 'string' } }, required: ['caseId'], additionalProperties: false } } },
  { type: 'function', function: { name: 'classify_anomaly', description: '사례의 네 가지 이상 유형을 규칙으로 평가한다. 어떤 이상인지 물을 때 사용한다.', parameters: { type: 'object', properties: { caseId: { type: 'string' } }, required: ['caseId'], additionalProperties: false } } },
  { type: 'function', function: { name: 'evaluate_priority', description: '사례에서 확인된 이상 유형의 우선순위와 근거를 조회한다.', parameters: { type: 'object', properties: { caseId: { type: 'string' } }, required: ['caseId'], additionalProperties: false } } },
  { type: 'function', function: { name: 'get_inspection_guide', description: '이상 유형의 등록된 초기 점검 및 보고 가이드를 조회한다.', parameters: { type: 'object', properties: { alertType: { type: 'string', enum: ['overcurrent', 'low-power-factor', 'power-consumption-increase', 'phase-current-imbalance'] } }, required: ['alertType'], additionalProperties: false } } },
  { type: 'function', function: { name: 'get_forecast_summary', description: '2025년 5월 10일~31일의 예상 전력 사용량, 예상 전기요금, 탄소배출량 및 피크 시간대 예측 결과를 조회한다. 경영자 비용 문의나 예측 질문 시 사용한다.', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
  { type: 'function', function: { name: 'get_executive_report_data', description: '이상 알람 내역과 5월 전력 요금·탄소 예측을 결합한 종합 경영 리포트용 데이터를 조회한다. 종합 보고서 작성 요청 시 사용한다.', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
]

function getPrompt() {
  return readFileSync(promptPath, 'utf8')
}

function toolTarget(name: string, args: Record<string, unknown>) {
  return String(args.caseId ?? args.alertType ?? (name.includes('forecast') || name.includes('executive') ? 'May-2025' : '-'))
}

function runTool(name: string, args: Record<string, unknown>): Record<string, unknown> {
  const tool = TOOLS[name as keyof typeof TOOLS]
  if (!tool) return { status: 'error', message: `지원하지 않는 도구입니다: ${name}` }
  return tool(args as never) as unknown as Record<string, unknown>
}

function parseReply(content: string | null | undefined) {
  const text = content?.trim() || '도구 결과를 확인했지만 설명을 생성하지 못했습니다.'
  const lines = text.split('\n').filter(Boolean)
  return { summary: lines.slice(0, 3).join('\n'), detail: text }
}

function collectStructured(toolResults: Array<{ name: string; result: Record<string, unknown> }>) {
  const evidence = toolResults.flatMap(({ result }) => {
    if (Array.isArray(result?.evaluations)) {
      return result.evaluations.filter(
        (e: unknown): e is Record<string, unknown> => typeof e === 'object' && e !== null && (e as Record<string, unknown>).result === 'matched'
      )
    }
    if (Array.isArray(result?.priorities)) return result.priorities
    if (result?.measurements) {
      return [{
        measurements: result.measurements,
        measuredAt: result.measuredAt,
        equipmentId: result.equipmentId,
        equipmentName: result.equipmentName,
        location: result.location,
        detectorResult: result.detectorResult,
      }]
    }
    if (result?.totalPredictedPowerKWh !== undefined) return [{ forecast: result }]
    if (result?.forecastSummary !== undefined) return [{ executiveReport: result }]
    return []
  })
  const steps = toolResults.flatMap(({ result }) => (Array.isArray(result?.steps) ? result.steps : []))
  const reportConditions = toolResults.flatMap(({ result }) => (Array.isArray(result?.reportConditions) ? result.reportConditions : []))
  const missingFields = [
    ...new Set(
      toolResults.flatMap(({ result }) => (Array.isArray(result?.missingFields) ? (result.missingFields as string[]) : [])).filter(Boolean)
    ),
  ]
  const statuses = toolResults.map(({ result }) => (typeof result?.status === 'string' ? result.status : '')).filter(Boolean)
  const status: AgentResponse['status'] = statuses.includes('not_found')
    ? 'not_found'
    : statuses.includes('partial') || statuses.includes('insufficient_data')
      ? 'insufficient_data'
      : 'completed'
  const hasRealForecast = toolResults.some(({ result }) => result?.dataSource === 'forecast_model_v1')
  return {
    evidence,
    steps,
    reportConditions,
    missingFields,
    status,
    dataSource: (hasRealForecast ? 'forecast_model_v1' : 'synthetic') as 'synthetic' | 'forecast_model_v1',
    demoOnly: !hasRealForecast,
  }
}

export async function runAgent(request: AgentRequest): Promise<AgentResponse> {
  if (!request.message?.trim()) throw new Error('message가 필요합니다.')
  if (MODEL !== 'gpt-5-mini') throw new Error('이 에이전트는 GPT-5 mini 사용이 필수입니다. OPENAI_MODEL을 gpt-5-mini로 설정하고 서버를 재시작하세요.')
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY가 설정되지 않았습니다. 서버 환경변수에 키를 설정하세요.')

  const conversationId = request.conversationId || randomUUID()
  const history = conversations.get(conversationId) ?? []
  if (!history.length) history.push({ role: 'system', content: getPrompt() })
  const context = request.caseId ? `\n현재 선택 사례 ID: ${request.caseId}` : '\n현재 선택 사례 ID가 없습니다. 대상이 필요하면 사용자에게 사례 ID를 물어보세요.'
  history.push({ role: 'user', content: request.message + context })

  const traces: ToolTrace[] = []
  const toolResults: Array<{ name: string; result: Record<string, unknown> }> = []
  let finalContent = ''

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: MODEL, messages: history, tools: toolDefinitions, tool_choice: 'auto' }),
    })
    if (!response.ok) throw new Error(`OpenAI API 오류(${response.status}): ${await response.text()}`)
    const payload = (await response.json()) as { choices?: Array<{ message?: ChatMessage }> }
    const message = payload.choices?.[0]?.message
    if (!message) throw new Error('OpenAI 응답에 message가 없습니다.')
    history.push(message)

    if (!message.tool_calls?.length) {
      finalContent = message.content ?? ''
      break
    }

    for (const call of message.tool_calls) {
      const name = call.function?.name ?? ''
      let args: Record<string, unknown>
      try {
        args = JSON.parse(call.function?.arguments || '{}') as Record<string, unknown>
      } catch {
        args = {}
      }
      const result = runTool(name, args)
      toolResults.push({ name, result })
      traces.push({ name, status: typeof result?.status === 'string' ? result.status : 'error', target: toolTarget(name, args) })
      history.push({ role: 'tool', tool_call_id: call.id, name, content: JSON.stringify(result) })
    }
  }

  conversations.set(conversationId, history.slice(-30))
  const structured = collectStructured(toolResults)
  const reply = parseReply(finalContent)
  return { ...structured, conversationId, reply, toolTrace: traces }
}
