import assert from 'node:assert/strict'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import * as ts from 'typescript'

const sourceRoot = resolve('src')
const tempRoot = resolve('node_modules/.tmp/data-boundary')

async function compile(sourcePath, outputPath, replacements = []) {
  const source = await readFile(sourcePath, 'utf8')
  let compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  for (const [pattern, replacement] of replacements) compiled = compiled.replace(pattern, replacement)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, compiled, 'utf8')
}

await rm(tempRoot, { recursive: true, force: true })
await compile(resolve(sourceRoot, 'adapters/externalDataAdapter.ts'), resolve(tempRoot, 'adapters/externalDataAdapter.mjs'))
await compile(resolve(sourceRoot, 'services/dataNormalization.ts'), resolve(tempRoot, 'services/dataNormalization.mjs'))
await compile(resolve(sourceRoot, 'config/equipmentDataMap.ts'), resolve(tempRoot, 'config/equipmentDataMap.mjs'))
await compile(resolve(sourceRoot, 'adapters/csvDataAdapter.ts'), resolve(tempRoot, 'adapters/csvDataAdapter.mjs'), [
  [/from ['"]\.\.\/config\/equipmentDataMap['"]/, "from '../config/equipmentDataMap.mjs'"],
  [/from ['"]\.\.\/services\/dataNormalization['"]/, "from '../services/dataNormalization.mjs'"],
])
await mkdir(resolve(tempRoot, 'data'), { recursive: true })
await writeFile(resolve(tempRoot, 'data/forecastSource.mjs'), `export default ${JSON.stringify(await readFile(resolve('전기요금 및 탄소배출량 예측', 'may_hourly_predictions_agg_fixed.csv'), 'utf8'))}`)
await writeFile(resolve(tempRoot, 'data/forecastActualsSource.mjs'), `export default ${JSON.stringify(await readFile(resolve('전기요금 및 탄소배출량 예측', 'hourly_prediction_vs_actual.csv'), 'utf8'))}`)
await compile(resolve(sourceRoot, 'data/forecastData.ts'), resolve(tempRoot, 'data/forecastData.mjs'), [
  [/from ['"]\.\.\/\.\.\/전기요금 및 탄소배출량 예측\/may_hourly_predictions_agg_fixed\.csv\?raw['"]/, "from './forecastSource.mjs'"],
  [/from ['"]\.\.\/\.\.\/전기요금 및 탄소배출량 예측\/hourly_prediction_vs_actual\.csv\?raw['"]/, "from './forecastActualsSource.mjs'"],
])
await compile(resolve(sourceRoot, 'services/alertRules.ts'), resolve(tempRoot, 'services/alertRules.mjs'))
await compile(resolve(sourceRoot, 'mocks/mockPowerData.ts'), resolve(tempRoot, 'mocks/mockPowerData.mjs'))
await compile(resolve(sourceRoot, 'mocks/mockAlerts.ts'), resolve(tempRoot, 'mocks/mockAlerts.mjs'))
await compile(resolve(sourceRoot, 'mocks/mockGuides.ts'), resolve(tempRoot, 'mocks/mockGuides.mjs'))
await compile(resolve(sourceRoot, 'adapters/mockDataAdapter.ts'), resolve(tempRoot, 'adapters/mockDataAdapter.mjs'), [
  [/from ['"]\.\.\/mocks\/mockPowerData['"]/, "from '../mocks/mockPowerData.mjs'"],
  [/from ['"]\.\.\/mocks\/mockAlerts['"]/, "from '../mocks/mockAlerts.mjs'"],
  [/from ['"]\.\.\/mocks\/mockGuides['"]/, "from '../mocks/mockGuides.mjs'"],
])
await compile(resolve(sourceRoot, 'adapters/dataProvider.ts'), resolve(tempRoot, 'adapters/dataProvider.mjs'), [
  [/from ['"]\.\/mockDataAdapter['"]/, "from './mockDataAdapter.mjs'"],
])
await compile(resolve(sourceRoot, 'services/equipmentService.ts'), resolve(tempRoot, 'services/equipmentService.mjs'), [
  [/from ['"]\.\.\/adapters\/dataProvider['"]/, "from '../adapters/dataProvider.mjs'"],
  [/from ['"]\.\.\/config\/equipmentDataMap['"]/, "from '../config/equipmentDataMap.mjs'"],
  [/from ['"]\.\/dataNormalization['"]/, "from './dataNormalization.mjs'"],
])
await compile(resolve(sourceRoot, 'services/powerService.ts'), resolve(tempRoot, 'services/powerService.mjs'), [
  [/from ['"]\.\.\/adapters\/dataProvider['"]/, "from '../adapters/dataProvider.mjs'"],
  [/from ['"]\.\.\/data\/forecastData['"]/, "from '../data/forecastData.mjs'"],
  [/from ['"]\.\.\/adapters\/csvDataAdapter['"]/, "from '../adapters/csvDataAdapter.mjs'"],
  [/from ['"]\.\/dataNormalization['"]/, "from './dataNormalization.mjs'"],
  [/from ['"]\.\/equipmentService['"]/, "from './equipmentService.mjs'"],
])
await compile(resolve(sourceRoot, 'services/alertService.ts'), resolve(tempRoot, 'services/alertService.mjs'), [
  [/from ['"]\.\.\/adapters\/dataProvider['"]/, "from '../adapters/dataProvider.mjs'"],
  [/from ['"]\.\/dataNormalization['"]/, "from './dataNormalization.mjs'"],
  [/from ['"]\.\/equipmentService['"]/, "from './equipmentService.mjs'"],
  [/from ['"]\.\/alertRules['"]/, "from './alertRules.mjs'"],
])
await compile(resolve(sourceRoot, 'services/guideService.ts'), resolve(tempRoot, 'services/guideService.mjs'), [
  [/from ['"]\.\.\/adapters\/dataProvider['"]/, "from '../adapters/dataProvider.mjs'"],
  [/from ['"]\.\/dataNormalization['"]/, "from './dataNormalization.mjs'"],
])

try {
  const equipmentService = await import(`${pathToFileURL(resolve(tempRoot, 'services/equipmentService.mjs')).href}?test=${Date.now()}`)
  const externalDataAdapter = await import(`${pathToFileURL(resolve(tempRoot, 'adapters/externalDataAdapter.mjs')).href}?test=${Date.now()}`)
  const powerService = await import(`${pathToFileURL(resolve(tempRoot, 'services/powerService.mjs')).href}?test=${Date.now()}`)
  const alertService = await import(`${pathToFileURL(resolve(tempRoot, 'services/alertService.mjs')).href}?test=${Date.now()}`)
  const guideService = await import(`${pathToFileURL(resolve(tempRoot, 'services/guideService.mjs')).href}?test=${Date.now()}`)

  assert.equal(externalDataAdapter.adaptExternalData({ value: 1 }, () => { throw new Error('provider failure') }, 'fallback'), 'fallback')
  assert.equal(externalDataAdapter.adaptExternalData(null, () => undefined, 'fallback'), 'fallback')
  assert.deepEqual(externalDataAdapter.adaptExternalCollection([1, null, 3], (value) => typeof value === 'number' ? value * 2 : undefined), [2, 6])
  assert.deepEqual(externalDataAdapter.adaptExternalCollection([], (value) => value), [])
  assert.deepEqual(externalDataAdapter.adaptExternalCollection('not-an-array', (value) => value), [])

  assert.deepEqual(equipmentService.normalizeEquipmentList([null, { id: 'partial', status: 'unknown', powerKw: 'bad' }, { name: 'no-id' }]), [{
    id: 'partial', name: 'partial', zone: '', status: 'normal', x: 0, y: 0, message: '',
  }])
  const normalizedPowerDetails = powerService.normalizeEquipmentDetails([{
    equipmentId: 'partial-detail', powerKw: 'bad', energyKwh: { current: 12 },
    currentPowerSeries: [null, { time: '03시', powerKw: 'bad' }, { powerKw: 5 }],
    lastMonthPowerSeries: 'not-an-array', anomalyHistory: [null, { message: '참고 기록' }],
  }])
  assert.deepEqual(normalizedPowerDetails, [{
    equipmentId: 'partial-detail',
    energyKwh: { current: 12 },
    currentPowerSeries: [{ time: '03시' }],
    lastMonthPowerSeries: [],
    anomalyHistory: [{ detectedAt: '', severity: 'normal', message: '참고 기록', state: 'resolved' }],
  }])
  assert.equal('lastMonth' in normalizedPowerDetails[0].energyKwh, false)
  assert.equal('difference' in normalizedPowerDetails[0].energyKwh, false)
  assert.equal('changeRatePercent' in normalizedPowerDetails[0].energyKwh, false)
  assert.equal('powerKw' in normalizedPowerDetails[0].currentPowerSeries[0], false)
  const normalizedDashboardPowerSeries = powerService.normalizeDashboardPowerSeries([null, { time: '09시', value: 'bad' }, { value: 4 }])
  assert.deepEqual(normalizedDashboardPowerSeries, [{ time: '09시' }])
  assert.equal('value' in normalizedDashboardPowerSeries[0], false)
  const normalizedAlertSummary = powerService.normalizeAlertSummary([null, { label: '주의', value: 'bad', status: 'unknown' }, { value: 2 }])
  assert.deepEqual(normalizedAlertSummary, [{ label: '주의', status: 'normal' }])
  assert.equal('value' in normalizedAlertSummary[0], false)
  const normalizedAlerts = alertService.normalizeAlerts([null, { id: 'alert-partial', type: 'overcurrent', severity: 'unknown', priority: 'unknown', powerChangeKw: 'bad' }, { summary: 'no-id' }])
  assert.deepEqual(normalizedAlerts, [{
    id: 'alert-partial', equipmentId: '', occurredAt: '', type: 'overcurrent', severity: 'normal', priority: 'low', summary: '', detail: '', guideKey: '', state: 'resolved', acknowledgement: 'acknowledged',
    ruleResult: { matched: false, reason: '과전류: 판단에 필요한 측정값이 없어 데이터 없음으로 표시합니다.', demoThreshold: 100, thresholdUnit: 'A', demoOnly: true },
  }])
  assert.equal('measurement' in normalizedAlerts[0], false)
  assert.equal('reference' in normalizedAlerts[0], false)
  assert.equal('change' in normalizedAlerts[0], false)
  assert.equal('powerChangeKw' in normalizedAlerts[0], false)
  assert.equal('changeRatePercent' in normalizedAlerts[0], false)
  assert.equal(alertService.getAlertById('not-real'), undefined)
  assert.equal(alertService.getAlertsByEquipmentId('compressor-02').length, 2)
  assert.equal(alertService.getAlertRepeatCount('compressor-02', 'power-consumption-increase'), 2)
  const nonMatchingAlert = alertService.listAlerts().find(({ id }) => id === 'alert-20240819-001')
  assert.deepEqual({ severity: nonMatchingAlert?.severity, priority: nonMatchingAlert?.priority, matched: nonMatchingAlert?.ruleResult.matched }, { severity: 'normal', priority: 'low', matched: false })
  const ruleClassifiedAlert = alertService.normalizeAlerts([{ id: 'rule-authority', type: 'power-consumption-increase', measurement: 212, reference: 196, change: 8.2, severity: 'warning', priority: 'high' }])[0]
  assert.deepEqual({ severity: ruleClassifiedAlert.severity, priority: ruleClassifiedAlert.priority, matched: ruleClassifiedAlert.ruleResult.matched }, { severity: 'normal', priority: 'low', matched: false })
  assert.equal(new Set(alertService.listAlerts().map(({ type }) => type)).size, 4)
  const equipmentIds = new Set(equipmentService.listEquipment().map(({ id }) => id))
  assert.equal(equipmentIds.size, 13)
  const guideKeys = new Set(guideService.listGuides().map(({ guideKey }) => guideKey))
  for (const alert of alertService.listAlerts()) {
    assert.ok(equipmentIds.has(alert.equipmentId), `missing equipment for ${alert.id}`)
    assert.ok(guideKeys.has(alert.guideKey), `missing guide for ${alert.id}`)
  }
  for (const guide of guideService.listGuides()) {
    for (const equipmentId of guide.relatedEquipmentIds) assert.ok(equipmentIds.has(equipmentId), `missing related equipment for ${guide.guideKey}`)
  }
  const normalizedGuides = guideService.normalizeGuides([null, { guideKey: 'guide-partial', alertType: 'overcurrent', steps: [null, { id: 'step-1' }], relatedEquipmentIds: ['equipment-1', 2] }, { title: 'no-key' }])
  assert.deepEqual(normalizedGuides, [{
    guideKey: 'guide-partial', alertType: 'overcurrent', type: 'overcurrent', title: '', symptomSummary: '', triggerReason: '',
    operatorChecks: [], reportConditions: [], initialResponse: '', steps: [{ id: 'step-1', label: '' }], relatedEquipmentIds: ['equipment-1'],
  }])
  assert.equal(guideService.listGuides().length, 4)
  assert.deepEqual(powerService.normalizeEquipmentDetails('not-an-array'), [])
  assert.deepEqual(alertService.normalizeAlerts(undefined), [])
  assert.deepEqual(guideService.normalizeGuides({}), [])

  const uiFiles = [
    'pages/DashboardPage.tsx', 'pages/FactoryLayoutPage.tsx', 'pages/EquipmentPowerPage.tsx',
    'pages/AlertsPage.tsx', 'pages/InspectionGuidePage.tsx', 'components/dashboard/PowerConsumptionChart.tsx',
  ]
  for (const relativePath of uiFiles) {
    const source = await readFile(resolve(sourceRoot, relativePath), 'utf8')
    assert.doesNotMatch(source, /from ['"].*\/(?:data|mocks)\//, `${relativePath} imports fixture data directly`)
  }

  const alertsSource = await readFile(resolve(sourceRoot, 'pages/AlertsPage.tsx'), 'utf8')
  assert.match(alertsSource, /setQuery/)
  assert.match(alertsSource, /setAlertType/)
  assert.match(alertsSource, /setSeverity/)
  assert.match(alertsSource, /setEquipment/)
  assert.match(alertsSource, /setAcknowledgement/)
  assert.match(alertsSource, /setSortMode/)
  assert.match(alertsSource, /setSelectedId/)
  assert.match(alertsSource, /measurement/)
  assert.match(alertsSource, /ruleResult\.reason/)
  assert.match(alertsSource, /equipment-power\?equipment=/)
  assert.match(alertsSource, /inspection-guide\?guide=/)
  const equipmentSource = await readFile(resolve(sourceRoot, 'pages/EquipmentPowerPage.tsx'), 'utf8')
  assert.match(equipmentSource, /listEquipment\(\)/)
  assert.match(equipmentSource, /설비를 찾을 수 없습니다/)
  assert.match(equipmentSource, /getAlertsByEquipmentId/)
  assert.match(equipmentSource, /alerts\?alert=/)
  const guideSource = await readFile(resolve(sourceRoot, 'pages/InspectionGuidePage.tsx'), 'utf8')
  assert.match(guideSource, /setChecked/)
  assert.match(guideSource, /setSearchParams/)
  assert.match(guideSource, /triggerReason/)
  assert.match(guideSource, /operatorChecks/)
  assert.match(guideSource, /reportConditions/)
  assert.match(guideSource, /measurement/)
  assert.match(guideSource, /equipment-power\?equipment=/)

  console.log('data services normalize malformed records, preserve optional alert values, and retain alert/guide interaction wiring: passed')
} finally {
  await rm(tempRoot, { recursive: true, force: true })
}
