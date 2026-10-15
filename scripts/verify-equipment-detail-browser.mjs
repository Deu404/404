import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
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

if (!browserPath) {
  console.log('browser verification skipped: Chrome or Edge is not installed')
  process.exit(0)
}

const server = spawn(process.execPath, [vitePath, '--host', '127.0.0.1', '--port', String(port)], { stdio: 'ignore' })
try {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${baseUrl}/equipment-power`)).ok) break
    } catch { /* Vite is still starting. */ }
    await delay(250)
  }

  const result = spawnSync(browserPath, [
    '--headless=new', '--disable-gpu', '--disable-extensions', '--no-first-run',
    '--no-default-browser-check', '--virtual-time-budget=3000', '--dump-dom', `${baseUrl}/equipment-power`,
  ], { encoding: 'utf8', timeout: 30_000 })
  assert.equal(result.status, 0, `${browserPath} failed: ${result.stderr}`)
  assert.match(result.stdout, /<div id="root"><\/div>|<div id="root">/)
  assert.doesNotMatch(result.stdout, /데모 기준|목업 알림|MOCK_/i)
  console.log('browser DOM verification via Vite dev server: passed')
} finally {
  server.kill()
}
