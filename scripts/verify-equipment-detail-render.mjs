import assert from 'node:assert/strict'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import * as ts from 'typescript'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

const sourceRoot = resolve('src')
const tempRoot = resolve('node_modules/.tmp/equipment-detail-render')
const mockPowerDataPath = resolve(sourceRoot, 'mocks/mockPowerData.ts')
const mockAlertsPath = resolve(sourceRoot, 'mocks/mockAlerts.ts')
const mockGuidesPath = resolve(sourceRoot, 'mocks/mockGuides.ts')
const mockAdapterPath = resolve(sourceRoot, 'adapters/mockDataAdapter.ts')
const dataProviderPath = resolve(sourceRoot, 'adapters/dataProvider.ts')
const normalizationPath = resolve(sourceRoot, 'services/dataNormalization.ts')
const alertRulesPath = resolve(sourceRoot, 'services/alertRules.ts')
const equipmentServicePath = resolve(sourceRoot, 'services/equipmentService.ts')
const powerServicePath = resolve(sourceRoot, 'services/powerService.ts')
const alertServicePath = resolve(sourceRoot, 'services/alertService.ts')
const guideServicePath = resolve(sourceRoot, 'services/guideService.ts')
const pagePath = resolve(sourceRoot, 'pages/EquipmentPowerPage.tsx')
const compiled = (name) => resolve(tempRoot, name)

async function compile(sourcePath, outputPath, transform = (value) => value) {
  const source = await readFile(sourcePath, 'utf8')
  const extension = sourcePath.endsWith('.tsx') ? ts.JsxEmit.ReactJSX : undefined
  const output = transform(ts.transpileModule(source, {
    compilerOptions: { jsx: extension, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, output, 'utf8')
}

function serviceReplacements(compiledSource, replacements) {
  return replacements.reduce((source, [pattern, replacement]) => source.replace(pattern, replacement), compiledSource)
}

await rm(tempRoot, { recursive: true, force: true })
await compile(mockPowerDataPath, compiled('mocks/mockPowerData.mjs'))
await compile(mockAlertsPath, compiled('mocks/mockAlerts.mjs'))
await compile(mockGuidesPath, compiled('mocks/mockGuides.mjs'))
await compile(mockAdapterPath, compiled('adapters/mockDataAdapter.mjs'), (source) => serviceReplacements(source, [
  [/from ['"]\.\.\/mocks\/mockPowerData['"]/, "from '../mocks/mockPowerData.mjs'"],
  [/from ['"]\.\.\/mocks\/mockAlerts['"]/, "from '../mocks/mockAlerts.mjs'"],
  [/from ['"]\.\.\/mocks\/mockGuides['"]/, "from '../mocks/mockGuides.mjs'"],
]))
await compile(dataProviderPath, compiled('adapters/dataProvider.mjs'), (source) => serviceReplacements(source, [
  [/from ['"]\.\/mockDataAdapter['"]/, "from './mockDataAdapter.mjs'"],
]))
await compile(normalizationPath, compiled('services/dataNormalization.mjs'))
await compile(alertRulesPath, compiled('services/alertRules.mjs'))
await compile(equipmentServicePath, compiled('services/equipmentService.mjs'), (source) => serviceReplacements(source, [
  [/from ['"]\.\.\/adapters\/dataProvider['"]/, "from '../adapters/dataProvider.mjs'"],
  [/from ['"]\.\/dataNormalization['"]/, "from './dataNormalization.mjs'"],
]))
await compile(powerServicePath, compiled('services/powerService.mjs'), (source) => serviceReplacements(source, [
  [/from ['"]\.\.\/adapters\/dataProvider['"]/, "from '../adapters/dataProvider.mjs'"],
  [/from ['"]\.\/dataNormalization['"]/, "from './dataNormalization.mjs'"],
  [/from ['"]\.\/equipmentService['"]/, "from './equipmentService.mjs'"],
]))
await compile(alertServicePath, compiled('services/alertService.mjs'), (source) => serviceReplacements(source, [
  [/from ['"]\.\.\/adapters\/dataProvider['"]/, "from '../adapters/dataProvider.mjs'"],
  [/from ['"]\.\/dataNormalization['"]/, "from './dataNormalization.mjs'"],
  [/from ['"]\.\/equipmentService['"]/, "from './equipmentService.mjs'"],
  [/from ['"]\.\/alertRules['"]/, "from './alertRules.mjs'"],
]))
await compile(guideServicePath, compiled('services/guideService.mjs'), (source) => serviceReplacements(source, [
  [/from ['"]\.\.\/adapters\/dataProvider['"]/, "from '../adapters/dataProvider.mjs'"],
  [/from ['"]\.\/dataNormalization['"]/, "from './dataNormalization.mjs'"],
]))
await writeFile(compiled('services/powerService-empty.mjs'), 'export function getEquipmentDetailById() { return undefined }\n', 'utf8')
await writeFile(compiled('services/powerService-missing.mjs'), `export function getEquipmentDetailById() { return {
  equipmentId: 'compressor-02',
  energyKwh: { current: undefined, lastMonth: undefined, difference: undefined, changeRatePercent: undefined },
  currentPowerSeries: [{ time: '00시', powerKw: undefined }],
  lastMonthPowerSeries: [{ time: '00시', powerKw: undefined }],
  anomalyHistory: [],
} }\n`, 'utf8')

const pageReplacements = (powerModule) => (source) => serviceReplacements(source, [
  [/from ['"]\.\.\/services\/equipmentService['"]/, "from '../services/equipmentService.mjs'"],
  [/from ['"]\.\.\/services\/powerService['"]/, `from '../services/${powerModule}'`],
  [/from ['"]\.\.\/services\/alertService['"]/, "from '../services/alertService.mjs'"],
])
await compile(pagePath, compiled('pages/EquipmentPowerPage.mjs'), pageReplacements('powerService.mjs'))
await compile(pagePath, compiled('pages/EquipmentPowerPage-empty.mjs'), pageReplacements('powerService-empty.mjs'))
await compile(pagePath, compiled('pages/EquipmentPowerPage-missing.mjs'), pageReplacements('powerService-missing.mjs'))

try {
  const pageModule = await import(`${pathToFileURL(compiled('pages/EquipmentPowerPage.mjs')).href}?test=${Date.now()}`)
  const emptyPageModule = await import(`${pathToFileURL(compiled('pages/EquipmentPowerPage-empty.mjs')).href}?test=${Date.now()}`)
  const missingPageModule = await import(`${pathToFileURL(compiled('pages/EquipmentPowerPage-missing.mjs')).href}?test=${Date.now()}`)
  const { EquipmentPowerPage } = pageModule
  const { EquipmentPowerPage: EmptyEquipmentPowerPage } = emptyPageModule
  const { EquipmentPowerPage: MissingEquipmentPowerPage } = missingPageModule

  function renderPage(path, Component = EquipmentPowerPage) {
    return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, createElement(Component)))
  }

  const defaultMarkup = renderPage('/equipment-power')
  assert.match(defaultMarkup, /공기압축기 01/)
  assert.match(defaultMarkup, /182 <small>kW<\/small>/)
  assert.match(defaultMarkup, /1,248 <small>kWh<\/small>/)
  assert.match(defaultMarkup, /전력 \(kW\)/)
  assert.match(defaultMarkup, /현재/)
  assert.match(defaultMarkup, /지난달/)
  assert.match(defaultMarkup, /관련 점검 가이드 보기/)

  const selectedMarkup = renderPage('/equipment-power?equipment=compressor-02')
  assert.match(selectedMarkup, /공기압축기 02/)
  assert.match(selectedMarkup, /224 <small>kW<\/small>/)
  assert.match(selectedMarkup, /1,536 <small>kWh<\/small>/)
  assert.match(selectedMarkup, /\+252 kWh/)
  assert.match(selectedMarkup, /00시 현재: 192 kW/)
  assert.match(selectedMarkup, /alert-20240821-001/)
  assert.match(selectedMarkup, /관련 알림/)
  assert.doesNotMatch(selectedMarkup, /공기압축기 01 전력 분석/)

  const invalidMarkup = renderPage('/equipment-power?equipment=not-real')
  assert.match(invalidMarkup, /설비를 찾을 수 없습니다/)
  assert.match(invalidMarkup, /not-real/)
  assert.doesNotMatch(invalidMarkup, /공기압축기 01/)
  assert.doesNotMatch(invalidMarkup, /공기압축기 02 전력 분석/)

  const emptyDetailMarkup = renderPage('/equipment-power?equipment=compressor-02', EmptyEquipmentPowerPage)
  assert.match(emptyDetailMarkup, /공기압축기 02 전력 분석/)
  assert.match(emptyDetailMarkup, /설비 ID compressor-02/)
  assert.match(emptyDetailMarkup, /이 설비의 상세 분석 데이터가 없습니다/)
  assert.doesNotMatch(emptyDetailMarkup, /공기압축기 01 전력 분석/)
  assert.doesNotMatch(emptyDetailMarkup, /182 <small>kW<\/small>/)

  const missingMeasurementMarkup = renderPage('/equipment-power?equipment=compressor-02', MissingEquipmentPowerPage)
  assert.match(missingMeasurementMarkup, /공기압축기 02 전력 분석/)
  assert.match(missingMeasurementMarkup, /데이터 없음/)
  assert.match(missingMeasurementMarkup, /표시할 전력 비교 데이터가 없습니다\./)
  assert.doesNotMatch(missingMeasurementMarkup, /0 <small>(?:kW|kWh)<\/small>/)

  console.log('equipment detail rendered selection, related alerts, invalid-ID empty state, and missing-detail empty state: passed')
} finally {
  await rm(tempRoot, { recursive: true, force: true })
}
