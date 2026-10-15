import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const pageSource = await readFile('src/pages/EquipmentPowerPage.tsx', 'utf8')
const serviceSource = await readFile('src/services/powerService.ts', 'utf8')

assert.match(pageSource, /이 설비의 상세 분석 데이터가 없습니다/)
assert.match(pageSource, /데이터 없음/)
assert.match(serviceSource, /getEquipmentCsvDetailById/)
assert.doesNotMatch(pageSource, /mock/i)
console.log('equipment detail render preserves real-data loading and empty states: passed')
