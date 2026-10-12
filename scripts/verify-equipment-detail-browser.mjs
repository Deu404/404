import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const port = 4173
const baseUrl = `http://127.0.0.1:${port}`
const vitePath = resolve('node_modules/vite/bin/vite.js')
const browserCandidates = [
  process.env.CHROME_PATH,
  `${process.env.ProgramFiles ?? ''}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env['ProgramFiles(x86)'] ?? ''}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env.ProgramFiles ?? ''}\\Microsoft\\Edge\\Application\\msedge.exe`,
  `${process.env['ProgramFiles(x86)'] ?? ''}\\Microsoft\\Edge\\Application\\msedge.exe`,
].filter(Boolean)
const browserPath = browserCandidates.find((candidate) => existsSync(candidate))

assert.ok(browserPath, 'Chrome or Edge is required for the rendered browser verification')

async function getFreePort() {
  const server = createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : undefined
  await new Promise((resolve) => server.close(resolve))
  assert.ok(port, 'Could not allocate a browser debugging port')
  return port
}

async function waitForDebugEndpoint(port) {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`)
      if (response.ok) {
        const targets = await response.json()
        const page = targets.find(({ type }) => type === 'page')
        if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
      }
    } catch {
      // The browser may need another moment to expose the debugging endpoint.
    }
    await delay(100)
  }
  throw new Error(`Chromium did not expose a page DevTools endpoint on port ${port}`)
}

async function connectToBrowser(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl)
  const pending = new Map()
  let nextId = 0
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(String(data))
    if (!message.id || !pending.has(message.id)) return
    const { resolve, reject } = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) reject(new Error(message.error.message))
    else resolve(message.result)
  })
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? 'Browser evaluation failed')
    return result.result?.value
  }
  return { send, evaluate, close: () => socket.close() }
}

async function waitForCondition(browser, expression) {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    try {
      if (await browser.evaluate(expression)) return
    } catch {
      // React may be replacing the document while navigation is in progress.
    }
    await delay(100)
  }
  throw new Error(`Browser condition timed out: ${expression}`)
}

async function navigate(browser, path) {
  await browser.evaluate(`window.location.href = ${JSON.stringify(`${baseUrl}${path}`)}`)
  await waitForCondition(browser, "document.readyState === 'complete' && Boolean(document.querySelector('.dashboard-page, .layout-page'))")
  await delay(250)
}

async function dispatchSelect(browser, selector, index, value, listStateExpression) {
  await waitForCondition(browser, `document.querySelectorAll(${JSON.stringify(selector)}).length > ${index}`)
  await browser.evaluate(`(() => {
    const element = document.querySelectorAll(${JSON.stringify(selector)})[${index}]
    if (!element) throw new Error('Missing select: ' + ${JSON.stringify(selector)} + '[' + ${index} + ']')
    element.value = ${JSON.stringify(value)}
    element.dispatchEvent(new Event('change', { bubbles: true }))
  })()`)
  await waitForCondition(browser, `(() => {
    const element = document.querySelectorAll(${JSON.stringify(selector)})[${index}]
    return element?.value === ${JSON.stringify(value)} && (${listStateExpression})
  })()`)
}

async function clickElement(browser, expression) {
  await browser.evaluate(`(() => {
    const element = ${expression}
    if (!element) throw new Error('Missing clickable element')
    element.click()
  })()`)
  await delay(150)
}

async function waitForServer() {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/equipment-power`)
      if (response.ok) return
    } catch {
      // The Vite process may need another moment to start.
    }
    await delay(250)
  }
  throw new Error(`Vite did not start at ${baseUrl}`)
}

function readRenderedDom(path, userDataDir) {
  const result = spawnSync(browserPath, [
    '--headless=new',
    '--disable-gpu',
    '--disable-extensions',
    '--no-first-run',
    '--no-default-browser-check',
    '--virtual-time-budget=3000',
    `--user-data-dir=${userDataDir}`,
    '--dump-dom',
    `${baseUrl}${path}`,
  ], { encoding: 'utf8', timeout: 30_000 })

  assert.equal(result.status, 0, `${browserPath} failed for ${path}: ${result.stderr}`)
  return result.stdout
}

const server = spawn(process.execPath, [vitePath, '--host', '127.0.0.1', '--port', String(port)], {
  stdio: 'ignore',
})
const userDataDir = await mkdtemp(resolve('node_modules/.tmp/equipment-detail-browser-'))
const interactionUserDataDir = await mkdtemp(resolve('node_modules/.tmp/equipment-detail-browser-interactions-'))
let interactionProcess
let interactionBrowser

try {
  await waitForServer()

  const dashboardDom = readRenderedDom('/', userDataDir)
  assert.match(dashboardDom, /공장 전력 운영 현황/)
  assert.match(dashboardDom, /공기압축기 02/)
  assert.match(dashboardDom, /href="\/equipment-power\?equipment=compressor-02"/)
  assert.match(dashboardDom, /비교 데이터 없음/)
  assert.doesNotMatch(dashboardDom, /8\.4%|전일 1,682 kW|목표 2,400 kW/)

  const layoutDom = readRenderedDom('/layout', userDataDir)
  assert.match(layoutDom, /공장 2D 배치도/)
  assert.match(layoutDom, /aria-label="공기압축기 02,[^"]*"/)

  const alertsDom = readRenderedDom('/alerts', userDataDir)
  assert.match(alertsDom, /이상 알림/)
  assert.match(alertsDom, /이상 유형/)
  assert.match(alertsDom, /확인 상태/)
  assert.match(alertsDom, /모터 전류가 데모 기준보다 높게 관찰됨/)
  assert.match(alertsDom, /href="\/equipment-power\?equipment=motor-02"/)
  assert.match(alertsDom, /href="\/inspection-guide\?guide=overcurrent&amp;alert=alert-20240822-001"/)

  const powerAlertDom = readRenderedDom('/alerts?alert=alert-20240821-001', userDataDir)
  assert.match(powerAlertDom, /변화량<strong>\+19\.6 %<\/strong>/)
  assert.match(powerAlertDom, /전력 변화<strong>\+36 kW<\/strong>/)

  const invalidAlertDom = readRenderedDom('/alerts?alert=not-real', userDataDir)
  assert.match(invalidAlertDom, /알림을 찾을 수 없습니다/)
  assert.doesNotMatch(invalidAlertDom, /SELECTED ALERT/)

  const guideCases = [
    ['overcurrent', '과전류 초기 점검'],
    ['low-power-factor', '역률 저하 초기 점검'],
    ['power-consumption-increase', '전력 소비 증가 초기 점검'],
    ['phase-current-imbalance', 'R/S/T상 전류 불균형 초기 점검'],
  ]
  for (const [guideKey, title] of guideCases) {
    const guideDom = readRenderedDom(`/inspection-guide?guide=${guideKey}`, userDataDir)
    assert.match(guideDom, /점검 가이드/)
    assert.match(guideDom, new RegExp(title))
    assert.match(guideDom, /type="checkbox"/)
    assert.match(guideDom, /담당자에게 보고해야 하는 상황/)
  }
  const guideContextDom = readRenderedDom('/inspection-guide?guide=power-consumption-increase&alert=alert-20240821-001', userDataDir)
  assert.match(guideContextDom, /알림에서 이동함/)
  assert.match(guideContextDom, /공기압축기 02/)
  assert.match(guideContextDom, /측정값: 224 kW/)
  assert.match(guideContextDom, /변화량: 19\.6 %/)
  assert.match(guideContextDom, /전력 변화: 36 kW/)
  assert.match(guideContextDom, /href="\/equipment-power\?equipment=compressor-02"/)

  const debugPort = await getFreePort()
  interactionProcess = spawn(browserPath, [
    '--headless=new',
    '--disable-gpu',
    '--disable-extensions',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${debugPort}`,
    '--remote-debugging-address=127.0.0.1',
    `--user-data-dir=${interactionUserDataDir}`,
    `${baseUrl}/`,
  ], { stdio: 'ignore' })
  interactionBrowser = await connectToBrowser(await waitForDebugEndpoint(debugPort))
  await interactionBrowser.send('Page.enable')

  await navigate(interactionBrowser, '/layout')
  await clickElement(interactionBrowser, "Array.from(document.querySelectorAll('button')).find((button) => button.getAttribute('aria-label')?.startsWith('공기압축기 02,'))")
  await waitForCondition(interactionBrowser, "location.pathname === '/equipment-power' && new URL(location.href).searchParams.get('equipment') === 'compressor-02' && document.querySelector('#equipment-summary-title')?.textContent === '공기압축기 02'")

  await navigate(interactionBrowser, '/alerts')
  const initialAlertCount = await interactionBrowser.evaluate("document.querySelectorAll('.alert-detail-row').length")
  await dispatchSelect(interactionBrowser, '.alert-controls select', 1, 'critical', `document.querySelectorAll('.alert-detail-row').length < ${initialAlertCount}`)
  const criticalAlertCount = await interactionBrowser.evaluate("document.querySelectorAll('.alert-detail-row').length")
  assert.ok(criticalAlertCount < initialAlertCount, 'severity filter did not change the alert result list')
  await dispatchSelect(interactionBrowser, '.alert-controls select', 1, 'all', `document.querySelectorAll('.alert-detail-row').length === ${initialAlertCount}`)
  await clickElement(interactionBrowser, "Array.from(document.querySelectorAll('.alert-detail-row')).find((row) => row.textContent.includes('alert-20240821-001'))")
  await waitForCondition(interactionBrowser, "document.querySelector('.alert-selected-panel .alert-fact-grid strong')?.textContent === 'alert-20240821-001'")
  const selectedAlertState = await interactionBrowser.evaluate(`(() => {
    const selectedRow = Array.from(document.querySelectorAll('.alert-detail-row')).find((row) => row.textContent.includes('alert-20240821-001'))
    return {
      detailId: document.querySelector('.alert-selected-panel .alert-fact-grid strong')?.textContent,
      rowIsSelected: selectedRow?.getAttribute('aria-pressed'),
    }
  })()`)
  assert.deepEqual(selectedAlertState, { detailId: 'alert-20240821-001', rowIsSelected: 'true' })

  await navigate(interactionBrowser, '/inspection-guide?guide=power-consumption-increase&alert=alert-20240821-001')
  const initialChecklistCount = await interactionBrowser.evaluate("document.querySelectorAll('.guide-checklist input[type=checkbox]').length")
  assert.ok(initialChecklistCount > 0, 'guide checklist is missing')
  await clickElement(interactionBrowser, "document.querySelector('.guide-checklist input[type=checkbox]')")
  await waitForCondition(interactionBrowser, "document.querySelector('.guide-checklist input[type=checkbox]')?.checked === true")
  await clickElement(interactionBrowser, "Array.from(document.querySelectorAll('.guide-buttons button')).find((button) => button.textContent.includes('과전류 초기 점검'))")
  await waitForCondition(interactionBrowser, "document.querySelector('.guide-main h2')?.textContent === '과전류 초기 점검' && !new URL(location.href).searchParams.has('alert')")
  const guideResetState = await interactionBrowser.evaluate(`(() => ({
    checkedCount: Array.from(document.querySelectorAll('.guide-checklist input[type=checkbox]')).filter((input) => input.checked).length,
    hasAlertContext: Boolean(document.querySelector('.guide-context')),
    guideTitle: document.querySelector('.guide-main h2')?.textContent,
  }))()`)
  assert.deepEqual(guideResetState, { checkedCount: 0, hasAlertContext: false, guideTitle: '과전류 초기 점검' })

  const defaultDom = readRenderedDom('/equipment-power', userDataDir)
  assert.match(defaultDom, /id="equipment-summary-title">공기압축기 01<\/h2>/)
  assert.match(defaultDom, /182 <small>kW<\/small>/)
  assert.match(defaultDom, /1,248 <small>kWh<\/small>/)
  assert.match(defaultDom, />현재<\/span>/)
  assert.match(defaultDom, />지난달<\/span>/)
  assert.match(defaultDom, /00시 현재: 154 kW/)
  assert.match(defaultDom, /이상 탐지 이력/)
  assert.match(defaultDom, /순간 전력 상승 감지/)

  const selectedDom = readRenderedDom('/equipment-power?equipment=compressor-02', userDataDir)
  assert.match(selectedDom, /id="equipment-summary-title">공기압축기 02<\/h2>/)
  assert.match(selectedDom, /224 <small>kW<\/small>/)
  assert.match(selectedDom, /1,536 <small>kWh<\/small>/)
  assert.match(selectedDom, /\+252 kWh/)
  assert.match(selectedDom, /00시 현재: 192 kW/)
  assert.match(selectedDom, /지난달 동일 시간대 대비 전력 사용량 증가/)
  assert.match(selectedDom, /관련 알림/)
  assert.match(selectedDom, /alert-20240821-001/)
  assert.doesNotMatch(selectedDom, /id="equipment-summary-title">공기압축기 01<\/h2>/)

  const invalidDom = readRenderedDom('/equipment-power?equipment=not-real', userDataDir)
  assert.match(invalidDom, /설비를 찾을 수 없습니다/)
  assert.match(invalidDom, /not-real/)
  assert.doesNotMatch(invalidDom, /id="equipment-summary-title">공기압축기 01<\/h2>/)
  assert.doesNotMatch(invalidDom, /id="equipment-summary-title">공기압축기 02<\/h2>/)

  console.log('browser DOM verification via Vite dev server: passed')
  console.log('  /equipment-power -> default equipment, chart series, related guide')
  console.log('  /equipment-power?equipment=compressor-02 -> selected equipment, related alerts, changed analysis data')
  console.log('  /equipment-power?equipment=not-real -> exact invalid-ID empty state')
  console.log('  /alerts and /alerts?alert=not-real -> filters, links, and safe invalid alert state')
  console.log('  Chromium interactions -> severity filter result change, selected-alert consistency, checklist check, and guide reset')
  console.log('  four canonical guide routes and alert context -> titles, checklist, report conditions, measurements')
} finally {
  interactionBrowser?.close()
  interactionProcess?.kill()
  server.kill()
  await delay(1000)
  await rm(userDataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 })
  await rm(interactionUserDataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 })
}
