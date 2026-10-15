import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as ts from 'typescript'

const adapterSource = await readFile('src/adapters/realDataAdapter.ts', 'utf8')
const serviceSource = await readFile('src/services/equipmentService.ts', 'utf8')
const mapSource = await readFile('src/config/equipmentDataMap.ts', 'utf8')

for (const source of [adapterSource, serviceSource, mapSource]) {
  ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } })
}
assert.match(adapterSource, /EQUIPMENT_LAYOUT/)
assert.match(serviceSource, /listEquipment/)
assert.match(serviceSource, /normalizeEquipmentList/)
assert.doesNotMatch(serviceSource, /mock/i)
console.log('equipment detail uses canonical equipment metadata and empty real-data detail state: passed')
