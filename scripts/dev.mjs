import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
if (!existsSync(new URL('../index.html', import.meta.url))) {
  console.error('이 폴더는 변경 파일 묶음입니다. 기존 대시보드 프로젝트에 파일을 합친 뒤 그 프로젝트에서 npm run dev:all을 실행하세요.')
  process.exit(1)
}

const children = [
  spawn(process.execPath, ['--env-file-if-exists=server/.env', 'server/src/server.ts'], { cwd: projectRoot, stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--configLoader', 'runner', '--host', '127.0.0.1', '--strictPort', ...process.argv.slice(2)], { cwd: projectRoot, stdio: 'inherit' }),
]
let stopping = false
function stop(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill()
  process.exitCode = code
}
for (const child of children) {
  child.on('error', (error) => { console.error(error.message); stop(1) })
  child.on('exit', (code) => stop(code ?? 1))
}
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
