import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const port = 4174
const baseUrl = `http://127.0.0.1:${port}`
const vitePath = resolve('node_modules/vite/bin/vite.js')
const equipmentFiles = [
  ['compressor-01', 'equipment_1(PM-3).csv', '01_PM-3.json'],
  ['compressor-02', 'equipment_2(L-1전등).csv', '02_L-1전등.json'],
  ['motor-01', 'equipment_3(분쇄기(2)).csv', '03_분쇄기(2).json'],
  ['motor-02', 'equipment_4(분쇄기(1)).csv', '04_분쇄기(1).json'],
  ['conveyor-01', 'equipment_5(좌측분전반).csv', '05_좌측분전반.json'],
  ['robot-01', 'equipment_11(우측분전반1).csv', '11_우측분전반1.json'],
  ['robot-02', 'equipment_12(4호기).csv', '12_4호기.json'],
  ['robot-03', 'equipment_13(3호기).csv', '13_3호기.json'],
  ['cooling-01', 'equipment_14(2호기).csv', '14_2호기.json'],
  ['cooling-02', 'equipment_15(예비건조기).csv', '15_예비건조기.json'],
  ['pump-01', 'equipment_16(호이스트).csv', '16_호이스트.json'],
  ['pump-02', 'equipment_17(6호기).csv', '17_6호기.json'],
  ['transformer-01', 'equipment_18(우측분전반2).csv', '18_우측분전반2.json'],
]

function expectedTime(value) {
  const text = String(value).trim().replace(/\.0+$/, '')
  return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)} ${text.slice(8, 10)}:${text.slice(10, 12)}`
}

const dataRoot = resolve(process.env.TEST_DATA_DIR || 'test_data')
const rootJsonFiles = (await readdir(dataRoot, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
  .map((entry) => entry.name)
  .sort()
assert.deepEqual(rootJsonFiles, [...equipmentFiles.map(([, , json]) => json), 'events.json'].sort(), 'only the 13 mixed files and events.json may be at the test_data root')

const server = spawn(process.execPath, [vitePath, '--configLoader', 'runner', '--host', '127.0.0.1', '--port', String(port)], {
  stdio: 'inherit',
  env: { ...process.env, TEST_DATA_DIR: dataRoot },
})
try {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${baseUrl}/`)).ok) break
    } catch { /* Vite is still starting. */ }
    await delay(250)
  }

  for (const [equipmentId, csvFile, jsonFile] of equipmentFiles) {
    const source = JSON.parse(await readFile(resolve(dataRoot, jsonFile), 'utf8'))
    const response = await fetch(`${baseUrl}/api/equipment-data/${encodeURIComponent(csvFile)}`)
    assert.equal(response.status, 200, `${equipmentId} did not resolve ${csvFile}`)
    const payload = await response.json()
    assert.equal(payload.samples.length, 96, `${equipmentId} should preserve the 96-sample API boundary`)
    const first = payload.samples[0]
    const sourceFirst = source[0]
    assert.equal(first.time, expectedTime(sourceFirst.localtime), `${equipmentId} localtime was not normalized`)
    assert.ok(Math.abs(first.powerKw - Number(sourceFirst.activePower) / 1000) < 1e-9, `${equipmentId} activePower was not converted from test_data`)
    assert.ok(Math.abs(first.energyKwh - Number(sourceFirst.accumActiveEnergy) / 1000) < 1e-9, `${equipmentId} accumActiveEnergy was not converted from test_data`)
    assert.match(equipmentId, /^(compressor|motor|conveyor|robot|cooling|pump|transformer)-\d+$/)
  }
  console.log('test_data power API mapping for all 13 stable equipment IDs: passed')
} finally {
  server.kill()
}
