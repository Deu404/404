import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const port = await getFreePort()
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
  throw new Error(`Browser condition timed out: ${expression}; state=${JSON.stringify(await browser.evaluate("({url:location.href,text:document.body.innerText.slice(0,1200)})"))}`)
}

async function clickElement(browser, expression) {
  await waitForCondition(browser, `Boolean(${expression})`)
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

await mkdir(resolve('node_modules/.tmp'), { recursive: true })
const profile = await mkdtemp(resolve('node_modules/.tmp/model-agent-browser-'))
const server = spawn(process.execPath, [vitePath, '--configLoader', 'runner', '--host', '127.0.0.1', '--port', String(port)], { stdio: 'ignore', env: { ...process.env, VITE_ANOMALY_API_URL: '/__test_anomalies', EQUIPMENT_DATA_DIR: resolve('tests/fixtures/equipment') } })
let processBrowser
let browser
try {
  await waitForServer()
  const csvResponse = await fetch(`${baseUrl}/api/equipment-data/${encodeURIComponent('equipment_1(PM-3).csv')}`)
  assert.equal(csvResponse.status, 200)
  const csvData = await csvResponse.json()
  assert.equal(csvData.samples.length, 96)
  assert.ok(csvData.samples.every(sample => Number.isFinite(sample.powerKw)))
  const debugPort = await getFreePort()
  processBrowser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--disable-extensions', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, baseUrl], { stdio: 'ignore' })
  browser = await connectToBrowser(await waitForDebugEndpoint(debugPort))
  await browser.send('Page.enable')
  await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (url, options) => {
      if (String(url).includes('/__test_anomalies')) return new Response(JSON.stringify([{id:'real-test-001',equipmentId:'robot-02',occurredAt:'2025-05-10 00:00',fields:['currentR']}]), {status:200, headers:{'Content-Type':'application/json'}});
      if (String(url).includes('/api/agent')) throw new Error('test offline');
      return originalFetch(url, options);
    };
  ` })
  await browser.send('Page.navigate', {url: baseUrl+'/alerts'})
  await waitForCondition(browser, "document.querySelector('.decision-card')?.textContent.includes('4호기')")
  const real = await browser.evaluate("document.querySelector('.decision-card').innerText")
  assert.match(real, /확인 필요/)
  assert.doesNotMatch(real, /연습용 기준|우선 확인|과전류 의심/)
  await clickElement(browser, "Array.from(document.querySelectorAll('.agent-suggestions button')).find(b => b.textContent.includes('보고 문구'))")
  await waitForCondition(browser, "document.querySelector('.agent-messages')?.textContent.includes('보고 초안')")
  await browser.send('Page.navigate', {url: baseUrl+'/alerts?anomaly=does-not-exist'})
  await waitForCondition(browser, "document.querySelector('.agent-empty')?.textContent.includes('선택된 모델 결과가 없어요')")
  assert.equal(await browser.evaluate("document.querySelector('.decision-card') === null"), true)
  await browser.send('Page.navigate', {url: baseUrl+'/agent-demo'})
  await waitForCondition(browser, "document.querySelector('.decision-card')?.textContent.includes('분쇄기(1)')")
  assert.match(await browser.evaluate("document.querySelector('.decision-card').innerText"), /우선 확인/)
  await clickElement(browser, "Array.from(document.querySelectorAll('.agent-suggestions button')).find(b => b.textContent.includes('보고 문구'))")
  await waitForCondition(browser, "document.querySelector('.agent-messages')?.textContent.includes('연습용 사례 보고 초안')")
  await clickElement(browser, "document.querySelector('.agent-suggestions button')")
  await waitForCondition(browser, "document.querySelector('.agent-error')?.textContent.includes('연결하지 못했어요')")
  assert.match(await browser.evaluate("document.querySelector('.decision-card').innerText"), /보고/)
  console.log('PASS 실제 모델 자료 부족·잘못된 알림 대체 금지·데모 에이전트 유지·보고 초안·AI 연결 실패 복구')
} finally {
  browser?.close(); processBrowser?.kill(); server.kill()
  await delay(1000)
  await rm(profile, {recursive:true,force:true,maxRetries:10,retryDelay:250})
}
