import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as ts from 'typescript'

const sourceRoot = 'src'
const sourceFiles = [
  'adapters/dataProvider.ts',
  'adapters/realDataAdapter.ts',
  'adapters/csvDataAdapter.ts',
  'services/equipmentService.ts',
  'services/powerService.ts',
  'services/alertService.ts',
  'services/guideService.ts',
]

for (const relativePath of sourceFiles) {
  const source = await readFile(`${sourceRoot}/${relativePath}`, 'utf8')
  ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } })
  assert.doesNotMatch(source, /mock(?:Alerts|Guides|PowerData|DataAdapter)/i, `${relativePath} imports a mock boundary`)
}

for (const relativePath of ['pages/DashboardPage.tsx', 'pages/FactoryLayoutPage.tsx', 'pages/EquipmentPowerPage.tsx', 'pages/AlertsPage.tsx', 'pages/InspectionGuidePage.tsx']) {
  const source = await readFile(`${sourceRoot}/${relativePath}`, 'utf8')
  assert.doesNotMatch(source, /from ['"].*\/(?:data|mocks)\//, `${relativePath} imports fixture data directly`)
}

const anomalyServiceSource = await readFile(`${sourceRoot}/services/anomalyService.ts`, 'utf8')
assert.doesNotMatch(anomalyServiceSource, /anomaly-results\.json/)
assert.match(anomalyServiceSource, /return \[\]/)
console.log('runtime data boundary uses real adapters, CSV/API data, and an empty model-result boundary: passed')
