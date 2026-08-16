import QRCode from 'qrcode'
import { createAuthState } from './src/auth.js'
import { startCloudflared, stopCloudflared } from './src/cloudflared.js'
import { startMobileBridge } from './src/mobile-bridge.js'
import { injectMobileControlButton, managementPage } from './src/pages.js'
import { readDshLocale, readDshThemePreference } from './src/theme.js'

export const name = 'mobile-cloudflare'
export const inject = ['webServer']

const controlPath = '/__dsh_mobile'

function positiveNumber(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

function pairingUrlFor(publicUrl, auth) {
  const snapshot = auth.pairingSnapshot()
  if (snapshot.paired || snapshot.pairingToken === undefined) return undefined
  return `${publicUrl}/#token=${encodeURIComponent(snapshot.pairingToken)}`
}

async function printPairingDetails(publicUrl, auth) {
  const pairingUrl = pairingUrlFor(publicUrl, auth)
  if (pairingUrl === undefined) return
  const terminalQr = await QRCode.toString(pairingUrl, { type: 'terminal', small: true, margin: 1 })
  console.log('\n[DSH 手机远程] 请用手机浏览器扫码：')
  console.log(terminalQr)
  console.log(pairingUrl)
  console.log('该链接只能配对一次，默认 15 分钟后失效。\n')
}

export function apply(ctx, config = {}) {
  const pairingTtlMinutes = positiveNumber(config.pairingTtlMinutes, 15)
  const sessionTtlHours = positiveNumber(config.sessionTtlHours, 12)
  const bridgePort = Number.isInteger(config.bridgePort) && config.bridgePort >= 0
    ? config.bridgePort
    : 0
  const auth = createAuthState({
    pairingTtlMs: pairingTtlMinutes * 60 * 1000,
    sessionTtlMs: sessionTtlHours * 60 * 60 * 1000,
  })
  const sessionTtlMs = sessionTtlHours * 60 * 60 * 1000

  const runtime = {
    publicUrl: undefined,
    bridgePort: undefined,
    tunnelError: undefined,
    cloudflared: undefined,
    bridge: undefined,
    disposed: false,
  }

  const renderManagement = async () => {
    const snapshot = auth.pairingSnapshot()
    const pairingUrl = runtime.publicUrl === undefined
      ? undefined
      : pairingUrlFor(runtime.publicUrl, auth)
    const qrSvg = pairingUrl === undefined
      ? ''
      : await QRCode.toString(pairingUrl, { type: 'svg', margin: 1, width: 300 })
    const [themePreference, locale] = await Promise.all([
      readDshThemePreference(ctx.webServer.port),
      readDshLocale(ctx.webServer.port),
    ])
    return managementPage({
      publicUrl: runtime.publicUrl,
      pairingUrl,
      paired: snapshot.paired,
      revoked: snapshot.revoked,
      expiresAt: snapshot.paired ? snapshot.sessionExpiresAt : snapshot.pairingExpiresAt,
      qrSvg,
      error: runtime.tunnelError,
      themePreference,
      locale,
    })
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: controlPath,
    handler: async (req, res) => {
      const url = new URL(req.url ?? controlPath, 'http://localhost')
      if (req.method === 'GET' && url.pathname === `${controlPath}/theme`) {
        const preference = await readDshThemePreference(ctx.webServer.port)
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        res.end(JSON.stringify({ preference }))
        return
      }
      if (req.method === 'POST' && url.pathname === `${controlPath}/rotate`) {
        auth.rotate()
        res.writeHead(303, { location: controlPath, 'cache-control': 'no-store' })
        res.end()
        if (runtime.publicUrl !== undefined) void printPairingDetails(runtime.publicUrl, auth)
        return
      }
      if (req.method === 'POST' && url.pathname === `${controlPath}/revoke`) {
        auth.revoke()
        res.writeHead(303, { location: controlPath, 'cache-control': 'no-store' })
        res.end()
        return
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405)
        res.end()
        return
      }
      const html = await renderManagement()
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      })
      res.end(req.method === 'HEAD' ? undefined : html)
    },
  }), 'mobile-cloudflare: 管理页面')

  ctx.effect(() => ctx.webServer.tapIndex(injectMobileControlButton), 'mobile-cloudflare: 本地悬浮入口')

  const startup = (async () => {
    try {
      runtime.bridge = await startMobileBridge({
        auth,
        sessionTtlMs,
        getThemePreference: () => readDshThemePreference(ctx.webServer.port),
        getLocale: () => readDshLocale(ctx.webServer.port),
        upstreamPort: ctx.webServer.port,
        listenPort: bridgePort,
        logger: ctx.logger,
      })
      runtime.bridgePort = runtime.bridge.port
      if (runtime.disposed) {
        await runtime.bridge.close()
        return
      }
      const localUrl = `http://127.0.0.1:${String(runtime.bridge.port)}`
      ctx.logger.info(`手机桥接已监听 ${localUrl}`)
      runtime.cloudflared = startCloudflared({
        executable: config.cloudflaredPath ?? process.env.DSH_CLOUDFLARED_PATH ?? 'cloudflared',
        localUrl,
        onPublicUrl(publicUrl) {
          runtime.publicUrl = publicUrl
          runtime.tunnelError = undefined
          ctx.logger.info(`手机远程入口：${publicUrl}`)
          void printPairingDetails(publicUrl, auth)
        },
        onError(error) {
          runtime.tunnelError = error.message
          ctx.logger.error(`Cloudflared 启动失败：${error.message}`)
        },
        onExit({ code, signal, publicUrl }) {
          if (runtime.disposed) return
          runtime.publicUrl = undefined
          runtime.tunnelError = `Cloudflared 已退出（code=${String(code)}, signal=${String(signal)}, url=${String(publicUrl)}）`
          ctx.logger.warn(runtime.tunnelError)
        },
      })
    } catch (error) {
      runtime.tunnelError = error instanceof Error ? error.message : String(error)
      ctx.logger.error(`手机远程插件启动失败：${runtime.tunnelError}`)
    }
  })()

  ctx.effect(() => async () => {
    runtime.disposed = true
    await startup
    await stopCloudflared(runtime.cloudflared)
    await runtime.bridge?.close()
  }, 'mobile-cloudflare: 释放桥接与隧道')
}
