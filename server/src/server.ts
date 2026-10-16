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
  for await (const chunk of req) {
    raw += chunk
    if (Buffer.byteLength(raw) > 32_768) throw new Error('요청이 너무 큽니다.')
  }
  return JSON.parse(raw || '{}')
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {})
  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    return send(res, 200, {
      status: 'ok',
      message: '에이전트 서버가 실행 중입니다. 화면은 Vite 터미널에 표시된 주소 뒤에 /agent-demo를 붙여 접속하세요.',
      defaultScreenUrl: 'http://localhost:5173/alerts',
      endpoint: 'POST /api/agent',
    })
  }
  if (req.method !== 'POST' || !['/api/agent', '/api/inspection'].includes(req.url ?? '')) return send(res, 404, { status: 'error', message: '지원하는 API 경로를 확인하세요.' })
  try {
    const body = await readBody(req)
    if (req.url === '/api/inspection' && !body?.anomaly) throw new Error('선택한 모델 알림을 전달하세요.')
    // 화면 선택 시 기준·측정값만 조회한다. 이 경로에서는 외부 AI를 호출하지 않는다.
    const result = await runAgent(req.url === '/api/inspection' ? { message: '선택한 모델 알림의 판정 근거를 확인합니다.', anomaly: body.anomaly, intent: 'report' } : body)
    return send(res, 200, result)
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 서버 오류입니다.'
    return send(res, 400, { status: 'error', message })
  }
})

server.listen(port, '0.0.0.0', () => console.log(`PlantEye agent API listening on http://localhost:${port}`))
