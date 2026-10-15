// OpenAI function-calling 실행 루프.
// 외부 SDK 없이 Node 기본 fetch를 사용하므로 npm 설치 없이 실행할 수 있다.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { TOOLS } from './tools.ts'

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'
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
  dataSource: 'synthetic'
  demoOnly: true
  toolTrace: ToolTrace[]
  error?: string
}

type ChatMessage = { role: string; content?: string | null; tool_call_id?: string; name?: string; tool_calls?: unknown[] }
const conversations = new Map<string, ChatMessage[]>()

const toolDefinitions = [
  { type: 'function', function: { name: 'get_anomaly_case', description: '사례 ID로 설비, 측정값, 단위, 비교 기준을 조회한다. 측정값이 필요할 때 사용한다.', parameters: { type: 'object', properties: { caseId: { type: 'string' } }, required: ['caseId'], additionalProperties: false } } },
  { type: 'function', function: { name: 'classify_anomaly', description: '사례의 네 가지 이상 유형을 규칙으로 평가한다. 어떤 이상인지 물을 때 사용한다.', parameters: { type: 'object', properties: { caseId: { type: 'string' } }, required: ['caseId'], additionalProperties: false } } },
  { type: 'function', function: { name: 'evaluate_priority', description: '사례에서 확인된 이상 유형의 우선순위와 근거를 조회한다.', parameters: { type: 'object', properties: { caseId: { type: 'string' } }, required: ['caseId'], additionalProperties: false } } },
  { type: 'function', function: { name: 'get_inspection_guide', description: '이상 유형의 등록된 초기 점검 및 보고 가이드를 조회한다.', parameters: { type: 'object', properties: { alertType: { type: 'string', enum: ['overcurrent', 'low-power-factor', 'power-consumption-increase', 'phase-current-imbalance'] } }, required: ['alertType'], additionalProperties: false } } },
]

function getPrompt() {
  return readFileSync(promptPath, 'utf8')
}

function toolTarget(name: string, args: Record<string, unknown>) {
  return String(args.caseId ?? args.alertType ?? '-')
}

function runTool(name: string, args: Record<string, unknown>) {
  const tool = TOOLS[name as keyof typeof TOOLS]
  if (!tool) return { status: 'error', message: `지원하지 않는 도구입니다: ${name}` }
  return tool(args as never)
}

function parseReply(content: string | null | undefined) {
  const text = content?.trim() || '도구 결과를 확인했지만 설명을 생성하지 못했습니다.'
  const lines = text.split('\n').filter(Boolean)
  return { summary: lines.slice(0, 3).join('\n'), detail: text }
}

function collectStructured(toolResults: Array<{ name: string; result: any }>) {
  const evidence = toolResults.flatMap(({ result }) => {
    if (Array.isArray(result?.evaluations)) return result.evaluations.filter((e: any) => e.result === 'matched')
    if (Array.isArray(result?.priorities)) return result.priorities
    if (result?.measurements) return [{ measurements: result.measurements, measuredAt: result.measuredAt, equipmentId: result.equipmentId }]
    return []
  })
  const steps = toolResults.flatMap(({ result }) => result?.steps ?? [])
  const reportConditions = toolResults.flatMap(({ result }) => result?.reportConditions ?? [])
  const missingFields = [...new Set(toolResults.flatMap(({ result }) => result?.missingFields ?? []).filter(Boolean))]
  const statuses = toolResults.map(({ result }) => result?.status).filter(Boolean)
  const status = statuses.includes('not_found') ? 'not_found' : statuses.includes('partial') || statuses.includes('insufficient_data') ? 'insufficient_data' : 'completed'
  return { evidence, steps, reportConditions, missingFields, status }
}

export async function runAgent(request: AgentRequest): Promise<AgentResponse> {
  if (!request.message?.trim()) throw new Error('message가 필요합니다.')
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY가 설정되지 않았습니다. 서버 환경변수에 키를 설정하세요.')

  const conversationId = request.conversationId || crypto.randomUUID()
  const history = conversations.get(conversationId) ?? []
  if (!history.length) history.push({ role: 'system', content: getPrompt() })
  const context = request.caseId ? `\n현재 선택 사례 ID: ${request.caseId}` : '\n현재 선택 사례 ID가 없습니다. 대상이 필요하면 사용자에게 사례 ID를 물어보세요.'
  history.push({ role: 'user', content: request.message + context })

  const traces: ToolTrace[] = []
  const toolResults: Array<{ name: string; result: any }> = []
  let finalContent = ''

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: MODEL, messages: history, tools: toolDefinitions, tool_choice: 'auto', temperature: 0.1 }),
    })
    if (!response.ok) throw new Error(`OpenAI API 오류(${response.status}): ${await response.text()}`)
    const payload = await response.json()
    const message = payload.choices?.[0]?.message
    if (!message) throw new Error('OpenAI 응답에 message가 없습니다.')
    history.push(message)

    if (!message.tool_calls?.length) {
      finalContent = message.content ?? ''
      break
    }

    for (const call of message.tool_calls) {
      const name = call.function?.name
      let args: Record<string, unknown> = {}
      try { args = JSON.parse(call.function?.arguments || '{}') } catch { args = {} }
      const result = runTool(name, args)
      toolResults.push({ name, result })
      traces.push({ name, status: result?.status ?? 'error', target: toolTarget(name, args) })
      history.push({ role: 'tool', tool_call_id: call.id, name, content: JSON.stringify(result) })
    }
  }

  conversations.set(conversationId, history.slice(-30))
  const structured = collectStructured(toolResults)
  const reply = parseReply(finalContent)
  return { ...structured, conversationId, reply, dataSource: 'synthetic', demoOnly: true, toolTrace: traces }
}
