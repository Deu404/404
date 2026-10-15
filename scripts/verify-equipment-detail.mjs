import assert from 'node:assert/strict'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import * as ts from 'typescript'

const sourcePath = resolve('src/mocks/mockPowerData.ts')
const alertsPath = resolve('src/mocks/mockAlerts.ts')
const guidesPath = resolve('src/mocks/mockGuides.ts')
const adapterPath = resolve('src/adapters/mockDataAdapter.ts')
const normalizationPath = resolve('src/services/dataNormalization.ts')
const equipmentMapPath = resolve('src/config/equipmentDataMap.ts')
const servicePath = resolve('src/services/equipmentService.ts')
const providerPath = resolve('src/adapters/dataProvider.ts')
const compiledPath = resolve('node_modules/.tmp/equipment-detail-mockPowerData.test.mjs')
const alertsCompiledPath = resolve('node_modules/.tmp/equipment-detail-mockAlerts.test.mjs')
const guidesCompiledPath = resolve('node_modules/.tmp/equipment-detail-mockGuides.test.mjs')
const adapterCompiledPath = resolve('node_modules/.tmp/equipment-detail-mockDataAdapter.test.mjs')
const providerCompiledPath = resolve('node_modules/.tmp/equipment-detail-dataProvider.test.mjs')
const normalizationCompiledPath = resolve('node_modules/.tmp/equipment-detail-dataNormalization.test.mjs')
const equipmentMapCompiledPath = resolve('node_modules/.tmp/equipment-detail-equipmentDataMap.test.mjs')
const serviceCompiledPath = resolve('node_modules/.tmp/equipment-detail-equipmentService.test.mjs')
const source = await readFile(sourcePath, 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const providerSource = await readFile(providerPath, 'utf8')
const providerCompiled = ts.transpileModule(providerSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText.replace(/from ['"]\.\/mockDataAdapter['"]/, "from './equipment-detail-mockDataAdapter.test.mjs'")
const normalizationSource = await readFile(normalizationPath, 'utf8')
const normalizationCompiled = ts.transpileModule(normalizationSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const equipmentMapSource = await readFile(equipmentMapPath, 'utf8')
const equipmentMapCompiled = ts.transpileModule(equipmentMapSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const alertsSource = await readFile(alertsPath, 'utf8')
const alertsCompiled = ts.transpileModule(alertsSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const guidesSource = await readFile(guidesPath, 'utf8')
const guidesCompiled = ts.transpileModule(guidesSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText

const adapterSource = await readFile(adapterPath, 'utf8')
const adapterCompiled = ts.transpileModule(adapterSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
  .replace(/from ['"]\.\.\/mocks\/mockPowerData['"]/, "from './equipment-detail-mockPowerData.test.mjs'")
  .replace(/from ['"]\.\.\/mocks\/mockAlerts['"]/, "from './equipment-detail-mockAlerts.test.mjs'")
  .replace(/from ['"]\.\.\/mocks\/mockGuides['"]/, "from './equipment-detail-mockGuides.test.mjs'")
const serviceSource = await readFile(servicePath, 'utf8')
const serviceCompiled = ts.transpileModule(serviceSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
  .replace(/from ['"]\.\.\/adapters\/dataProvider['"]/, "from './equipment-detail-dataProvider.test.mjs'")
  .replace(/from ['"]\.\.\/config\/equipmentDataMap['"]/, "from './equipment-detail-equipmentDataMap.test.mjs'")
  .replace(/from ['"]\.\/dataNormalization['"]/, "from './equipment-detail-dataNormalization.test.mjs'")

await mkdir(dirname(compiledPath), { recursive: true })
await writeFile(compiledPath, compiled, 'utf8')
await writeFile(alertsCompiledPath, alertsCompiled, 'utf8')
await writeFile(guidesCompiledPath, guidesCompiled, 'utf8')
await writeFile(adapterCompiledPath, adapterCompiled, 'utf8')
await writeFile(providerCompiledPath, providerCompiled, 'utf8')
await writeFile(normalizationCompiledPath, normalizationCompiled, 'utf8')
await writeFile(equipmentMapCompiledPath, equipmentMapCompiled, 'utf8')
await writeFile(serviceCompiledPath, serviceCompiled, 'utf8')

try {
  const mockData = await import(`${pathToFileURL(compiledPath).href}?test=${Date.now()}`)
  await import(`${pathToFileURL(adapterCompiledPath).href}?test=${Date.now()}`)
  const service = await import(`${pathToFileURL(serviceCompiledPath).href}?test=${Date.now()}`)
  const { MOCK_EQUIPMENT, MOCK_EQUIPMENT_DETAIL_BY_ID } = mockData
  const { normalizeEquipmentList, resolveMockEquipment } = service

  assert.equal(MOCK_EQUIPMENT.length, 13)
  assert.equal(resolveMockEquipment(null).id, 'conveyor-01')
  assert.equal(resolveMockEquipment('compressor-02').id, 'compressor-02')
  assert.equal(resolveMockEquipment('not-real').id, 'conveyor-01')

  const normalized = normalizeEquipmentList([
    null,
    { id: 'partial-equipment', status: 'unexpected', powerKw: 'not-a-number', x: null },
    { name: 'missing-id' },
  ])
  assert.deepEqual(normalized, [{
    id: 'partial-equipment',
    name: 'partial-equipment',
    zone: '',
    status: 'normal',
    x: 0,
    y: 0,
    message: '',
  }])
  assert.equal(normalized.length, 1)
  assert.equal('powerKw' in normalized[0], false)

  for (const equipment of MOCK_EQUIPMENT) {
    assert.equal(MOCK_EQUIPMENT_DETAIL_BY_ID[equipment.id].equipmentId, equipment.id)
  }

  console.log('equipment detail selection, normalization, and invalid-query fallback: passed')
} finally {
  await rm(compiledPath, { force: true })
  await rm(alertsCompiledPath, { force: true })
  await rm(guidesCompiledPath, { force: true })
  await rm(adapterCompiledPath, { force: true })
  await rm(providerCompiledPath, { force: true })
  await rm(normalizationCompiledPath, { force: true })
  await rm(equipmentMapCompiledPath, { force: true })
  await rm(serviceCompiledPath, { force: true })
}
