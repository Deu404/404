import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EQUIPMENT_DATA_MAP } from '../../src/config/equipmentDataMap.ts'
import type { EquipmentDataId } from '../../src/config/equipmentDataMap.ts'
import { decideModelAnomaly } from '../../src/shared/modelDecision.ts'
import type { ModelAnomalyInput } from '../../src/shared/modelDecision.ts'
import type { Decision } from '../../src/shared/decision.ts'
import type { AlertType } from './types.ts'
import { assessNormalPattern, PATTERN_FIELDS, PATTERN_GUIDE_TYPES } from '../../src/shared/normalPattern.ts'
import type { PatternPolicy } from '../../src/shared/normalPattern.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const RULE_TYPES: AlertType[] = ['overcurrent', 'low-power-factor', 'power-consumption-increase', 'phase-current-imbalance']
export const GUIDE_TYPES = [...RULE_TYPES, ...PATTERN_GUIDE_TYPES]
export type PolicyRule = {
  id: string; equipmentId: string; type: AlertType; threshold: number; source: string
  priority: NonNullable<Decision['priority']>; actions: string[]; reportConditions: string[]
  reference?: { value: number; unit: 'kW'; source: string; period: string }
}
export type InspectionPolicy = { version: string; units: Record<string, string>; rules: PolicyRule[]; normalPatternFile?: string; normalPattern?: PatternPolicy }
export function loadPolicy(): InspectionPolicy {
  const policyPath = process.env.INSPECTION_POLICY_FILE || resolve(root, 'server/config/inspection-policy.json')
  const policy = JSON.parse(readFileSync(policyPath, 'utf8')) as InspectionPolicy
  if (!policy || typeof policy.version !== 'string' || !policy.version || !policy.units || typeof policy.units !== 'object' || Array.isArray(policy.units) || !Array.isArray(policy.rules)) throw new Error('판정 설정 형식을 확인하세요.')
  const keys = new Set<string>()
  for (const r of policy.rules) {
    if (!r || !Object.hasOwn(EQUIPMENT_DATA_MAP, r.equipmentId) || !RULE_TYPES.includes(r.type) || typeof r.id !== 'string' || !r.id.trim() || typeof r.source !== 'string' || !r.source.trim() || !Number.isFinite(r.threshold) || r.threshold < 0 || !['high', 'medium', 'low'].includes(r.priority) || !Array.isArray(r.actions) || !r.actions.length || !Array.isArray(r.reportConditions) || [...r.actions, ...r.reportConditions].some(s => typeof s !== 'string' || !s.trim())) throw new Error('판정 기준의 설비·출처·수치·안내를 확인하세요.')
    const key = `${r.equipmentId}:${r.type}`
    if (keys.has(key)) throw new Error('동일 설비·유형의 판정 기준이 중복되었습니다.')
    keys.add(key)
    if (r.reference && (!Number.isFinite(r.reference.value) || r.reference.value <= 0 || r.reference.unit !== 'kW' || !r.reference.source?.trim() || !r.reference.period?.trim())) throw new Error('비교 전력의 단위·출처·기간을 확인하세요.')
    if (r.type === 'low-power-factor' && r.threshold > 1) throw new Error('역률 기준은 0~1 비율이어야 합니다.')
  }
  delete policy.normalPattern
  if (policy.normalPatternFile) {
    const patterns = JSON.parse(readFileSync(resolve(dirname(policyPath), policy.normalPatternFile), 'utf8')) as PatternPolicy
    if (patterns.kind !== 'empirical-normal-range' || typeof patterns.version !== 'string' || !patterns.version || !patterns.equipment || typeof patterns.equipment !== 'object' || Array.isArray(patterns.equipment)) throw new Error('정상 참조 설정 형식을 확인하세요.')
    for (const [id, profile] of Object.entries(patterns.equipment)) {
      if (!Object.hasOwn(EQUIPMENT_DATA_MAP, id) || !profile.source || !profile.sha256 || !Array.isArray(profile.fitPeriod) || !Array.isArray(profile.calibrationPeriod) || !profile.states || !Object.keys(profile.states).length) throw new Error('정상 참조 설비·출처·기간을 확인하세요.')
      for (const [state, config] of Object.entries(profile.states)) {
        if (!Number.isFinite(Number(state)) || Number(state) < 0 || !config.bounds) throw new Error('정상 참조 운전상태를 확인하세요.')
        for (const field of PATTERN_FIELDS) {
          const bound = config.bounds[field]
          if (!bound || !Number.isFinite(bound.lower) || !Number.isFinite(bound.upper) || bound.lower < 0 || bound.lower > bound.upper || typeof bound.unit !== 'string') throw new Error('정상 참조 상·하한을 확인하세요.')
        }
      }
    }
    policy.normalPattern = patterns
  }
  return policy
}

export type Observation = {
  status: 'ok' | 'not_found' | 'invalid_input' | 'lookup_limit' | 'ambiguous'
  message: string; source?: string; observedAt?: string; values?: Record<string, string>
}
function localKey(value: string): string | undefined {
  // CSV localtime 자체를 사용한다. timezone이 명시된 시각은 KST로 정규화한다.
  let text = value
  if (/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    const time = Date.parse(value)
    if (!Number.isFinite(time)) return undefined
    text = new Date(time + 9 * 3600_000).toISOString().slice(0, 19)
  }
  const m = /^(\d{4})-?(\d{2})-?(\d{2})[ T]?(\d{2}):?(\d{2})(?::?(\d{2}))?$/.exec(text)
  if (!m) return undefined
  const [, y, mo, d, h, mi, s = '00'] = m
  const canonical = `${y}-${mo}-${d}T${h}:${mi}:${s}`
  const parsed = new Date(canonical + 'Z')
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 19) === canonical ? `${y}${mo}${d}${h}${mi}${s}` : undefined
}
async function jsonObservation(input: ModelAnomalyInput, time: string, csvFile: string): Promise<Observation | undefined> {
  if (process.env.EQUIPMENT_DATA_DIR && !process.env.ANOMALY_OBSERVATION_DIR) return undefined
  const parts = /^equipment_(\d+)\((.*)\)\.csv$/.exec(csvFile)!
  const file = `${parts[1].padStart(2, '0')}_${parts[2]}.json`
  const folder = process.env.ANOMALY_OBSERVATION_DIR || resolve(root, '../test_data')
  const path = resolve(folder, file)
  if (!existsSync(path)) return undefined
  const source = `test_data/${file}`
  try {
    if (statSync(path).size > 64 * 1024 * 1024) return { status: 'lookup_limit', source, message: '관측 JSON 파일이 조회 크기 제한을 초과합니다.' }
    const rows: unknown = JSON.parse(await readFile(path, 'utf8'))
    if (!Array.isArray(rows)) throw new Error('관측 배열 형식 오류')
    let found: Record<string, string> | undefined
    for (const candidate of rows) {
      if (!candidate || typeof candidate !== 'object') continue
      const row = candidate as Record<string, unknown>
      if (String(row.localtime).replace(/\.0+$/, '') !== time) continue
      if (found) return { status: 'ambiguous', source, message: '같은 시각의 JSON 관측이 중복되어 선택하지 않았습니다.' }
      // 정답·감사 메타데이터를 추론에 전달하지 않는다.
      found = Object.fromEntries(Object.entries(row).filter(([key]) => !['is_anomaly', 'anomaly_type', 'fault_fields', 'event_id', 'reference_localtime'].includes(key)).map(([key, value]) => [key, value === null ? '' : String(value)]))
    }
    if (!found) return undefined
    if (found['module(equipment)'] !== `${parts[1]}(${parts[2]})`) return { status: 'invalid_input', source, message: 'JSON 관측의 설비 식별값이 연결 대상과 다릅니다.' }
    return { status: 'ok', source, observedAt: time, values: found, message: '알림 시각에 정확히 일치하는 프로젝트 오류 주입 관측입니다. 정답 라벨은 판정에 사용하지 않았습니다.' }
  } catch {
    return { status: 'lookup_limit', source, message: '관측 JSON의 형식 또는 파일 상태를 확인하세요.' }
  }
}
export async function getObservation(input: ModelAnomalyInput): Promise<Observation> {
  const time = localKey(input.occurredAt)
  if (!time || !Object.hasOwn(EQUIPMENT_DATA_MAP, input.equipmentId)) return { status: 'invalid_input', message: '설비와 발생 시각을 확인하세요.' }
  const file = EQUIPMENT_DATA_MAP[input.equipmentId as EquipmentDataId]
  const json = await jsonObservation(input, time, file)
  if (json) return json
  const local = resolve(root, '장비별 Data')
  const folder = process.env.EQUIPMENT_DATA_DIR || (existsSync(resolve(local, file)) ? local : resolve(root, '../장비별 Data'))
  const path = resolve(folder, file)
  if (!existsSync(path)) return { status: 'not_found', source: file, message: '해당 설비의 원시 CSV가 연결되지 않았습니다.' }
  const stream = createReadStream(path, { encoding: 'utf8' })
  const lines = createInterface({ input: stream, crlfDelay: Infinity })
  const timer = setTimeout(() => stream.destroy(new Error('lookup_limit')), 5000)
  let headers: string[] | undefined
  let found: Record<string, string> | undefined
  let duplicates = false
  try {
    // 전체 파일을 확인하여 같은 시각의 중복을 판정한다. 시간 근삿값으로 대체하지 않는다.
    for await (const line of lines) {
      if (!headers) { headers = line.replace(/^\uFEFF/, '').split(','); continue }
      const columns = line.split(',')
      if (columns[headers.indexOf('localtime')] !== time) continue
      if (found) { duplicates = true; break }
      found = Object.fromEntries(headers.map((key, i) => [key, columns[i] ?? '']))
    }
    if (duplicates) return { status: 'ambiguous', source: file, message: '같은 발생 시각의 관측이 중복되어 하나를 선택하지 않았습니다.' }
    return found ? { status: 'ok', source: file, observedAt: time, values: found, message: '알림 발생 시각과 정확히 일치하는 원시 관측입니다. 단위는 등록 설정을 확인합니다.' }
      : { status: 'not_found', source: file, message: '알림 발생 시각과 일치하는 원시 관측이 없습니다.' }
  } catch {
    return { status: 'lookup_limit', source: file, message: '원시 데이터 조회를 완료하지 못했습니다. 조회 제한 또는 파일 상태를 확인하세요.' }
  } finally { clearTimeout(timer); lines.close(); stream.destroy() }
}

export function evaluateProduction(input: ModelAnomalyInput, observation: Observation, policy: InspectionPolicy): Decision {
  const d = decideModelAnomaly(input)
  if (policy.normalPattern) {
    assessNormalPattern(d, observation.status === 'ok' ? observation.values : undefined, policy.normalPattern, input.fields)
    d.source += ` / 관측: ${observation.source ?? '미연결'}`
    if (observation.status !== 'ok') d.missingFields.push(observation.message)
    return d
  }
  d.actions = []
  d.approvalStatus = 'configured'
  d.ruleVersion = policy.version
  d.source = `모델 알림 / ${observation.source ?? '원시 자료 미연결'} / ${policy.version}`
  d.missingFields = []
  if (observation.status !== 'ok') d.missingFields.push(observation.message)
  const raw = observation.values ?? {}
  const number = (key: string, unit: string): number | undefined => {
    const text = raw[key]
    if (policy.units[key] !== unit || text === undefined || !text.trim()) return undefined
    const n = Number(text)
    return Number.isFinite(n) && n >= 0 ? n : undefined
  }
  for (const type of RULE_TYPES) {
    const rule = policy.rules.find(r => r.equipmentId === input.equipmentId && r.type === type)
    if (!rule) { d.missingFields.push(`${type}: 설비별 적용 기준 미등록`); continue }
    let value: number | undefined
    if (observation.status === 'ok') {
      if (type === 'overcurrent' || type === 'phase-current-imbalance') {
        const currents = ['currentR', 'currentS', 'currentT'].map(k => number(k, 'A'))
        const valid = currents.filter((n): n is number => n !== undefined)
        if (type === 'overcurrent' && valid.some(n => n > rule.threshold)) value = Math.max(...valid)
        else if (valid.length === 3) {
          const average = valid.reduce((s, n) => s + n, 0) / 3
          value = type === 'overcurrent' ? Math.max(...valid) : average > 0 ? Math.max(...valid.map(n => Math.abs(n - average))) / average * 100 : undefined
        }
      } else if (type === 'low-power-factor') {
        const ratios = ['powerFactorR', 'powerFactorS', 'powerFactorT'].map(k => {
          const unit = policy.units[k]
          const v = unit === '%' ? number(k, '%') : number(k, 'ratio_0_1')
          const ratio = v === undefined ? undefined : unit === '%' ? v / 100 : v
          return ratio !== undefined && ratio <= 1 ? ratio : undefined
        })
        const valid = ratios.filter((n): n is number => n !== undefined)
        if (valid.some(n => n < rule.threshold) || valid.length === 3) value = Math.min(...valid)
      }
      else if (type === 'power-consumption-increase' && rule.reference) {
        const power = policy.units.activePower === 'W' ? number('activePower', 'W') : number('activePower', 'kW')
        const kw = power === undefined ? undefined : policy.units.activePower === 'W' ? power / 1000 : power
        if (kw !== undefined) value = (kw - rule.reference.value) / rule.reference.value * 100
      }
    }
    const missing = value === undefined ? [`${type}: 측정값·단위 또는 비교 기준 부족`] : []
    if (type === 'overcurrent' && value !== undefined) {
      for (const field of ['currentR', 'currentS', 'currentT']) if (number(field, 'A') === undefined) missing.push(`${field}: 측정값 또는 A 단위 미확인`)
    }
    if (type === 'low-power-factor' && value !== undefined) {
      for (const field of ['powerFactorR', 'powerFactorS', 'powerFactorT']) {
        const unit = policy.units[field]
        const rawValue = unit === '%' ? number(field, '%') : number(field, 'ratio_0_1')
        if (rawValue === undefined || rawValue > (unit === '%' ? 100 : 1)) missing.push(`${field}: 유효한 역률·단위 미확인`)
      }
    }
    const operator = type === 'low-power-factor' ? '<' : '>'
    const matched = value !== undefined && (operator === '<' ? value < rule.threshold : value > rule.threshold)
    d.evaluations.push({ alertType: type, result: value === undefined ? 'insufficient_data' : matched ? 'matched' : 'within_threshold', measurement: value ?? null, unit: type === 'overcurrent' ? 'A' : type === 'low-power-factor' ? 'ratio_0_1' : '%', threshold: rule.threshold, comparisonOperator: operator, ruleId: rule.id, reason: `${rule.source}: ${value === undefined ? '자료 부족으로 보류' : `${value} ${operator} ${rule.threshold} 조건 ${matched ? '충족' : '미충족'}`}`, missingFields: missing })
    d.missingFields.push(...missing)
    if (matched) {
      d.anomalyTypes.push(type)
      d.actions.push(...rule.actions)
      d.reportConditions.push(...rule.reportConditions)
      const order = { low: 0, medium: 1, high: 2 }
      if (d.priority === null || order[rule.priority] > order[d.priority]) d.priority = rule.priority
    }
  }
  d.status = d.evaluations.some(e => e.result === 'matched') ? 'matched' : d.missingFields.length ? 'insufficient_data' : 'within_threshold'
  if (d.status === 'within_threshold') d.priority = 'low'
  d.actions = [...new Set(d.actions)]
  if (!d.actions.length) d.actions.push(d.missingFields.length ? '알림의 측정값·단위와 미등록 기준을 담당자에게 확인하세요.' : '등록된 기준 안의 결과입니다. 관측값과 알림 이력을 함께 확인하세요.')
  d.reportConditions = [...new Set(d.reportConditions)]
  d.reportReason = '등록된 보고 조건과 담당자를 확인하세요. 보고 수행 여부는 확인되지 않았습니다.'
  return d
}
