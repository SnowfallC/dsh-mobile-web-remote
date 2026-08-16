import { createServer } from 'node:http'
import httpProxy from 'http-proxy'
import { createSessionCookie } from './auth.js'
import { pairingBootstrapPage } from './pages.js'
import { injectRemoteMobileRestrictions } from './remote-ui.js'

const maxPairingBodyBytes = 4096

function isSecureRequest(req) {
  const forwardedProto = req.headers['x-forwarded-proto']
  return forwardedProto === 'https' || req.socket.encrypted === true
}

async function readJsonBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > maxPairingBodyBytes) throw new Error('请求体过大')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function writeHtml(res, status, html) {
  res.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  })
  res.end(html)
}

function writeJson(res, status, value) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  res.end(JSON.stringify(value))
}

function rewriteUpstreamHeaders(proxyRequest, upstreamOrigin, upstreamAuthority) {
  proxyRequest.setHeader('host', upstreamAuthority)
  if (proxyRequest.hasHeader('origin')) proxyRequest.setHeader('origin', upstreamOrigin)
}

export async function startMobileBridge({ auth, sessionTtlMs, getThemePreference, getLocale, upstreamPort, listenPort = 0, logger }) {
  const upstreamOrigin = `http://127.0.0.1:${String(upstreamPort)}`
  const upstreamAuthority = `127.0.0.1:${String(upstreamPort)}`
  const proxy = httpProxy.createProxyServer({
    target: upstreamOrigin,
    ws: true,
    changeOrigin: true,
    xfwd: true,
  })

  proxy.on('proxyReq', (proxyRequest) => {
    rewriteUpstreamHeaders(proxyRequest, upstreamOrigin, upstreamAuthority)
  })
  proxy.on('proxyReqWs', (proxyRequest) => {
    rewriteUpstreamHeaders(proxyRequest, upstreamOrigin, upstreamAuthority)
  })
  proxy.on('error', (error, _req, resOrSocket) => {
    logger.warn(`代理请求失败：${error.message}`)
    if (resOrSocket && 'writeHead' in resOrSocket) {
      if (!resOrSocket.headersSent) resOrSocket.writeHead(502)
      resOrSocket.end('DSH upstream unavailable')
      return
    }
    resOrSocket?.destroy()
  })

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://bridge.local')
    if (req.method === 'POST' && url.pathname === '/__dsh_mobile/pair') {
      try {
        const body = await readJsonBody(req)
        const sessionToken = auth.pair(body?.token)
        if (sessionToken === undefined) {
          res.writeHead(401, { 'cache-control': 'no-store' })
          res.end('pairing rejected')
          return
        }
        const sessionTtlSeconds = Math.max(1, Math.floor(sessionTtlMs / 1000))
        res.writeHead(204, {
          'set-cookie': createSessionCookie(sessionToken, isSecureRequest(req), sessionTtlSeconds),
          'cache-control': 'no-store',
        })
        res.end()
      } catch {
        res.writeHead(400, { 'cache-control': 'no-store' })
        res.end('invalid pairing request')
      }
      return
    }

    if (!auth.isAuthorized(req.headers.cookie)) {
      const themePreference = await getThemePreference?.() ?? 'system'
      const locale = await getLocale?.() ?? 'zh'
      writeHtml(res, 200, pairingBootstrapPage(themePreference, locale))
      return
    }

    if (req.method === 'GET' && url.pathname === '/') {
      try {
        const upstream = await fetch(`${upstreamOrigin}/`, { cache: 'no-store' })
        if (!upstream.ok) throw new Error(`DSH 首页返回 ${String(upstream.status)}`)
        writeHtml(res, 200, injectRemoteMobileRestrictions(await upstream.text()))
      } catch (error) {
        logger.warn(`远程页面注入失败：${error instanceof Error ? error.message : String(error)}`)
        res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
        res.end('DSH upstream unavailable')
      }
      return
    }

    proxy.web(req, res)
  })

  server.on('upgrade', (req, socket, head) => {
    if (!auth.isAuthorized(req.headers.cookie)) {
      socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
      return
    }
    proxy.ws(req, socket, head)
  })

  const sockets = new Set()
  server.on('connection', (socket) => {
    sockets.add(socket)
    socket.once('close', () => sockets.delete(socket))
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(listenPort, '127.0.0.1', () => {
      server.off('error', reject)
      resolve()
    })
  })

  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('无法读取桥接监听端口')

  return {
    port: address.port,
    async close() {
      const closed = new Promise((resolve) => server.close(resolve))
      server.closeAllConnections()
      for (const socket of sockets) socket.destroy()
      await closed
    },
  }
}
