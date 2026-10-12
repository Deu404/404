import assert from 'node:assert/strict'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import * as ts from 'typescript'

const sourceRoot = resolve('src')
const tempRoot = resolve('node_modules/.tmp/canonical-fixtures')

async function compile(sourcePath, outputPath) {
  const source = await readFile(sourcePath, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, output, 'utf8')
}

function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function recordFingerprints(records, key) {
  return Object.fromEntries(records.map((record) => [record[key], fingerprint(record)]))
}

const expected = {
  equipment: {
    'compressor-01': 'e8d53bc88f7be57deff6e7a124db3b992d78ec92273fde21206c7f7a54e5acf0',
    'compressor-02': '98992e6bbfd520960bf25ee34eb91ff187c6036299f64f339c8ef079e2cf4f19',
    'motor-01': '9bcfc53a87666c515374dcd60c36f6508c2bf659bc12210632d8731eb466021d',
    'motor-02': '240cd15e9721363bc999b96eaac08179dc98c16c70f953e2bcdf94e15c42a485',
    'conveyor-01': 'df986013e7e0d77996437d722ce41ab2ebfe1fb94aa436fbfd284eb97d2ba3c5',
    'robot-01': '27fffe9550549d43cd7d0d1b2417a7802e228ba7d4a52f4dcffd42e6b76a3d0f',
    'robot-02': '5baacc7983cfb5b88cdbcda303a1d3f9b7f329a4981fc476647424af3642b7c5',
    'robot-03': 'b12456e7d81ad9b820f89e36ebd5bb3434faf2f6e63a4a3c2efa08321cc1cd85',
    'cooling-01': 'a6f61a38912ac5340fc4c3ff9260f60fa0297fdd345f163b9eaa5b0fb0a6f81b',
    'cooling-02': '8b222de5a43f2afab2d52f246ac07830d7021485719deb4a0a91a4346239dfba',
    'pump-01': '233bb7682f6a5a1e257cd895efb3ef141e3fd9fd2f627e51c7842c53a48086f7',
    'pump-02': '333cc51b507d49f197fa534cf934f147669d347a751683de5c273ed14123610c',
    'transformer-01': '3eeeeaa74611bd0998ff0ccace8bd646075bbcf8d560096d1f5c51c6bee674ce'
  },
  equipmentDetails: {
    'compressor-01': 'e1e0df7ac0032447d3d593460669e883f45080997775fc611df329e695adfa3c',
    'compressor-02': 'a4a8de8517e3e06ca8849d0c12916092354d4fb5c40dd94c9c1950b43afe4a4f',
    'motor-01': 'c1f5e6ce113c05abac6c615db31e499eb875b6f99d0d2eedc88100c32f606c02',
    'motor-02': 'd6028b97d09eff917bee1c7851edb1d818e7df4ba4c1abae049efcec3310eac7',
    'conveyor-01': '94092e0f54b14b9a155bc804262a6c521807c531fea26c04970cd1b8c6c38cf0',
    'robot-01': 'c39d578d13b82c495feae02e3dfd81532e366bbb610bc4eeb84ec57f0f48cb80',
    'robot-02': '6aa0b47d246ce920b78853af6d7fa52746b2caa91a80a07d6dc7bfaae47223e5',
    'robot-03': '93030c20899ce06f26afc19efe2f9f7dfdada2646d71a179e5dc02bee80a1136',
    'cooling-01': '086658cbd2412a345e9efeb24784c46e00808910cab2a887462d36dda2b7cd48',
    'cooling-02': '4137581680f70c99dd478448e8d960685768b54b99f82408bfb8d4b18d6ca83f',
    'pump-01': '307cbe725d14079b45e396509437b86a4f794b95631cd873a1b65073ffc86526',
    'pump-02': '1d7d635ae11c042b5102ef1ceed4f23841ea9ff9f33cf84eed56d4168805b45d',
    'transformer-01': 'aecb2fc109b5a20d10668a767bc608037c3651c6ce8d4c4cf941da81e546da4e'
  },
  alerts: {
    'alert-20240822-001': '9cb2be7de1fb6ddfc8a13a687ba338b270748a6cdf0895db896f57534f41d12f',
    'alert-20240822-002': '199060963b4f2c67be6530a7d46d1df0def4b93395843dffe2b0c89a87dc40b7',
    'alert-20240821-001': '68ccc44ce7c62c4881ea8956d33877203114e0323151f50a8c240ba0b53deb2e',
    'alert-20240820-001': '706561def151d8e1fe0073f9eca50b6a4b06a817e1898b406ede0f553b7142a7',
    'alert-20240819-001': 'b995263562c694f41524adc7cd4721d07d363ec63160f33e8e7c809328156dbc'
  },
  guides: {
    overcurrent: '9f5661a8b4342d3895ca9985326ea74891e6843a62d95cb285196eb4e50081fb',
    'low-power-factor': '8823bb82231053e684a21c00ab70f280c05af6480170453c1f361cbae7977d4b',
    'power-consumption-increase': 'cc812f507059d6beae8079d86470ac4fb91abc28cdd75273ae463ad4e9501177',
    'phase-current-imbalance': '538739da12f0c142d6a8ef8813a5a28d96c8d35dcc76463d13696338de3ef88e'
  },
  powerSeries: '0eeb9baab5a1917342f498017af67874f4c64c110507be44453899ba977a9a29',
  alertSummary: '5a4e57754ed1582a1a09916a2eea16ee743cd8c958eef56d1e9695fbcf9c278c',
  attentionEquipment: '423e3ebb8884576d90aea8805338ab13d0d42567d443fdcc522b323782c2a810',
}

await rm(tempRoot, { recursive: true, force: true })
await compile(resolve(sourceRoot, 'mocks/mockPowerData.ts'), resolve(tempRoot, 'mockPowerData.mjs'))
await compile(resolve(sourceRoot, 'mocks/mockAlerts.ts'), resolve(tempRoot, 'mockAlerts.mjs'))
await compile(resolve(sourceRoot, 'mocks/mockGuides.ts'), resolve(tempRoot, 'mockGuides.mjs'))

try {
  const powerData = await import(`${pathToFileURL(resolve(tempRoot, 'mockPowerData.mjs')).href}?test=${Date.now()}`)
  const alertsData = await import(`${pathToFileURL(resolve(tempRoot, 'mockAlerts.mjs')).href}?test=${Date.now()}`)
  const guidesData = await import(`${pathToFileURL(resolve(tempRoot, 'mockGuides.mjs')).href}?test=${Date.now()}`)
  const {
    MOCK_ALERT_SUMMARY,
    MOCK_ATTENTION_EQUIPMENT,
    MOCK_EQUIPMENT,
    MOCK_EQUIPMENT_DETAILS,
    MOCK_POWER_SERIES,
  } = powerData
  const { MOCK_ALERTS } = alertsData
  const { MOCK_GUIDES } = guidesData

  const actual = {
    equipment: recordFingerprints(MOCK_EQUIPMENT, 'id'),
    equipmentDetails: recordFingerprints(MOCK_EQUIPMENT_DETAILS, 'equipmentId'),
    alerts: recordFingerprints(MOCK_ALERTS, 'id'),
    guides: recordFingerprints(MOCK_GUIDES, 'guideKey'),
    powerSeries: fingerprint(MOCK_POWER_SERIES),
    alertSummary: fingerprint(MOCK_ALERT_SUMMARY),
    attentionEquipment: fingerprint(MOCK_ATTENTION_EQUIPMENT),
  }
  assert.equal(MOCK_EQUIPMENT.length, 13)
  assert.equal(MOCK_ALERTS.length, 5)
  assert.equal(MOCK_GUIDES.length, 4)
  assert.deepEqual(actual.equipment, expected.equipment)
  assert.deepEqual(actual.equipmentDetails, expected.equipmentDetails)
  assert.deepEqual(actual.alerts, expected.alerts)
  assert.deepEqual(actual.guides, expected.guides)
  assert.equal(actual.powerSeries, expected.powerSeries)
  assert.equal(actual.alertSummary, expected.alertSummary)
  assert.equal(actual.attentionEquipment, expected.attentionEquipment)

  const equipmentIds = new Set(MOCK_EQUIPMENT.map(({ id }) => id))
  const guideKeys = new Set(MOCK_GUIDES.map(({ guideKey }) => guideKey))
  for (const detail of MOCK_EQUIPMENT_DETAILS) assert.ok(equipmentIds.has(detail.equipmentId), `missing equipment for ${detail.equipmentId}`)
  for (const alert of MOCK_ALERTS) {
    assert.ok(equipmentIds.has(alert.equipmentId), `missing equipment for ${alert.id}`)
    assert.ok(guideKeys.has(alert.guideKey), `missing guide for ${alert.id}`)
  }
  for (const guide of MOCK_GUIDES) {
    for (const equipmentId of guide.relatedEquipmentIds) assert.ok(equipmentIds.has(equipmentId), `missing related equipment for ${guide.guideKey}`)
  }

  console.log('canonical fixtures preserve the 13-equipment, 5-alert, 4-guide contract: passed')
} finally {
  await rm(tempRoot, { recursive: true, force: true })
}
