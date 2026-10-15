// PlantEye 에이전트 HTTP API.
// 실행: node src/server.ts (server 폴더에서)
import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { runAgent } from './agent.ts'

const port = Number(process.env.PORT || 8787)

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' })
  res.end(JSON.stringify(body))
}

async function readBody(req: IncomingMessage) {
  let raw = ''
  for await (const chunk of req) raw += chunk
  return JSON.parse(raw || '{}')
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {})
  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    return send(res, 200, {
      status: 'ok',
      message: '에이전트 서버가 실행 중입니다. 화면은 Vite 터미널에 표시된 주소 뒤에 /agent-demo를 붙여 접속하세요.',
      defaultScreenUrl: 'http://localhost:5173/agent-demo',
      endpoint: 'POST /api/agent',
    })
  }
  if (req.method !== 'POST' || req.url !== '/api/agent') return send(res, 404, { status: 'error', message: 'POST /api/agent만 지원합니다.' })
  try {
    const body = await readBody(req)
    const result = await runAgent(body)
    return send(res, 200, result)
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 서버 오류입니다.'
    return send(res, 500, { status: 'error', message, demoOnly: true })
  }
})

server.listen(port, '127.0.0.1', () => console.log(`PlantEye agent API listening on http://localhost:${port}`))
