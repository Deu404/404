import { existsSync, lstatSync, readFileSync, writeFileSync, copyFileSync, mkdirSync, realpathSync, unlinkSync } from 'node:fs'
import { resolve, dirname, sep, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { createInterface } from 'node:readline/promises'
import { spawn } from 'node:child_process'

const payload = fileURLToPath(new URL('../', import.meta.url))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const json = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))
const encode = value => Buffer.from(JSON.stringify(value, null, 2) + '\n')

function safePath(root, name) {
  const path = resolve(root, name)
  if (!path.startsWith(root + sep)) throw new Error(`허용되지 않은 경로: ${name}`)
  let ancestor = path
  while (ancestor !== root) {
    if (existsSync(ancestor) && lstatSync(ancestor).isSymbolicLink()) throw new Error(`연결 경로에는 자동 적용하지 않습니다: ${name}`)
    ancestor = dirname(ancestor)
  }
  return path
}

async function execute(command, args, cwd, shell = false) {
  const child = spawn(command, args, { cwd, stdio: 'inherit', shell })
  return await new Promise((resolveCode, reject) => {
    const stop = () => child.kill()
    const cleanup = () => { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop) }
    process.once('SIGINT', stop)
    process.once('SIGTERM', stop)
    child.once('error', error => { cleanup(); reject(error) })
    child.once('exit', code => { cleanup(); resolveCode(code ?? 1) })
  })
}

async function main() {
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Node.js 24 이상을 먼저 설치하세요.')
  const args = process.argv.slice(2)
  const portIndex = args.indexOf('--port')
  const port = portIndex < 0 ? 5173 : Number(args[portIndex + 1])
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('화면 포트는 1~65535 사이의 숫자여야 합니다.')
  const targetIndex = args.indexOf('--target')
  let input = targetIndex >= 0 ? args[targetIndex + 1] : undefined
  if (!input) {
    console.log('기존 프로젝트를 백업한 뒤 에이전트를 적용합니다. API 키와 별도 데이터는 보존합니다.')
    const prompt = createInterface({ input: process.stdin, output: process.stdout })
    try { input = await prompt.question('기존 대시보드 폴더 경로를 입력하세요: ') } finally { prompt.close() }
  }
  if (!input?.trim()) throw new Error('프로젝트 폴더 경로가 필요합니다.')
  const root = realpathSync(resolve(input.trim().replace(/^"|"$/g, '')))
  if (root === realpathSync(payload)) throw new Error('전달 폴더가 아니라 index.html이 있는 기존 대시보드 폴더를 선택하세요.')
  for (const name of ['package.json', 'index.html', 'src/App.tsx', 'src/adapters/dataProvider.ts', 'tsconfig.app.json']) {
    if (!existsSync(safePath(root, name))) throw new Error(`기존 대시보드의 ${name}을 찾을 수 없습니다. 최신 전체 프로젝트를 선택하세요.`)
  }
  const manifest = json(resolve(payload, 'docs/apply-manifest.json'))
  const plans = []
  const conflicts = []
  for (const entry of manifest.files) {
    const source = safePath(payload.replace(/[\\/]$/, ''), entry.path)
    const bytes = readFileSync(source)
    if (hash(bytes) !== entry.sha256) throw new Error(`전달 파일이 변경됐습니다: ${entry.path}`)
    const target = safePath(root, entry.path)
    if (existsSync(target)) {
      const current = hash(readFileSync(target))
      if (current === entry.sha256) continue
      if (!entry.acceptedHashes.includes(current)) { conflicts.push(entry.path); continue }
    }
    plans.push({ name: entry.path, target, bytes })
  }

  // 공용 설정은 원래 의존성과 사용자 설정을 유지하며 필요한 항목만 병합한다.
  const packagePath = safePath(root, 'package.json')
  const packageData = json(packagePath)
  packageData.scripts ??= {}
  for (const [key, value] of Object.entries(manifest.scripts)) {
    if (packageData.scripts[key] && packageData.scripts[key] !== value) conflicts.push(`package.json scripts.${key}`)
    else packageData.scripts[key] = value
  }
  const configPath = safePath(root, 'tsconfig.app.json')
  const configData = json(configPath)
  configData.compilerOptions ??= {}
  configData.compilerOptions.allowImportingTsExtensions = true
  for (const [name, target, value] of [['package.json', packagePath, packageData], ['tsconfig.app.json', configPath, configData]]) {
    if (JSON.stringify(json(target)) !== JSON.stringify(value)) plans.push({ name, target, bytes: encode(value) })
  }
  const ignorePath = safePath(root, '.gitignore')
  const originalIgnore = existsSync(ignorePath) ? readFileSync(ignorePath, 'utf8') : ''
  const patterns = ['.agent-backups/', 'node_modules/', 'dist/', '.env', '.env.*', '**/.env', '**/.env.*', '!.env.example', '!**/.env.example']
  const additions = patterns.filter(pattern => !originalIgnore.split(/\r?\n/).includes(pattern))
  if (additions.length) plans.push({ name: '.gitignore', target: ignorePath, bytes: Buffer.from(originalIgnore.trimEnd() + '\n' + additions.join('\n') + '\n') })

  if (conflicts.length) throw new Error('다른 수정 사항이 있어 자동 적용을 중단했습니다. 변경한 파일은 없습니다.\n' + conflicts.map(name => ' - ' + name).join('\n') + '\n담당자에게 이 목록을 전달해 병합을 요청하세요.')
  console.log(`대상: ${root}\n적용할 파일: ${plans.length}개 · 의존성 목록과 실제 .env는 유지합니다.`)
  if (args.includes('--check')) { console.log('사전 검사 통과. 파일은 변경하지 않았습니다.'); return }

  if (plans.length) {
    const backupRoot = safePath(root, '.agent-backups')
    mkdirSync(backupRoot, { recursive: true })
    const backup = safePath(backupRoot, new Date().toISOString().replace(/[:.]/g, '-') + '-' + process.pid)
    mkdirSync(backup)
    const history = plans.map(plan => ({ path: plan.name, existed: existsSync(plan.target) }))
    // 모든 기존 파일 백업을 완료한 뒤 적용을 시작한다.
    for (const item of history) {
      if (!item.existed) continue
      const destination = safePath(backup, 'files/' + item.path)
      mkdirSync(dirname(destination), { recursive: true })
      copyFileSync(safePath(root, item.path), destination)
    }
    writeFileSync(safePath(backup, 'manifest.json'), encode({ target: root, files: history }))
    const touched = []
    try {
      for (const plan of plans) {
        touched.push(plan.name)
        mkdirSync(dirname(plan.target), { recursive: true })
        writeFileSync(plan.target, plan.bytes)
      }
    } catch (error) {
      for (const name of touched.reverse()) {
        const item = history.find(entry => entry.path === name)
        const target = safePath(root, name)
        if (item.existed) copyFileSync(safePath(backup, 'files/' + name), target)
        else if (existsSync(target)) unlinkSync(target)
      }
      throw new Error(`적용 실패로 변경 파일을 복구했습니다. 백업: ${backup}\n${error.message}`)
    }
    console.log(`자동 적용 완료. 백업: ${relative(root, backup)}`)
  } else console.log('이미 최신 파일이 적용되어 있습니다.')
  if (args.includes('--apply-only')) return
  console.log('의존성을 설치한 뒤 로컬 화면과 서버를 실행합니다. 종료하려면 Ctrl+C를 누르세요.')
  const windows = process.platform === 'win32'
  const installCode = await execute(windows ? 'npm.cmd' : 'npm', ['install'], root, windows)
  if (installCode !== 0) throw new Error('파일 적용은 완료됐지만 npm install이 실패했습니다. 네트워크와 Node 환경을 확인한 뒤 프로젝트에서 다시 실행하세요.')
  console.log(`화면: http://localhost:${port}/agent-demo`)
  process.exitCode = await execute(process.execPath, ['scripts/dev.mjs', '--port', String(port)], root)
}

main().catch(error => { console.error('\n' + error.message); process.exitCode = 1 })
