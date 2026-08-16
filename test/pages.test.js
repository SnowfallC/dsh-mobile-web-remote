import assert from 'node:assert/strict'
import test from 'node:test'
import { injectMobileControlButton, managementPage, pairingBootstrapPage } from '../src/pages.js'

test('本地悬浮入口以内嵌窗口打开管理页', () => {
  const original = '<html><body><main>DSH</main></body></html>'
  const once = injectMobileControlButton(original)
  const twice = injectMobileControlButton(once)
  assert.match(once, /data-dsh-mobile-control/u)
  assert.match(once, /createElement\("iframe"\)/u)
  assert.match(once, /frame\.src="\/__dsh_mobile"/u)
  assert.match(once, /height:min\(560px/u)
  assert.match(once, /toolbar\.append\(close\)/u)
  assert.match(once, /data-mobile-locale/u)
  assert.match(once, /body:has\(button\[aria-label="New session"\]/u)
  assert.doesNotMatch(once, /setInterval/u)
  assert.match(once, /dsh-mobile-size/u)
  assert.doesNotMatch(once, /window\.open/u)
  assert.equal(twice, once)
})

test('配对页从 URL 片段读取令牌并通过请求体提交', () => {
  const html = pairingBootstrapPage('dark')
  assert.match(html, /location\.hash/u)
  assert.match(html, /JSON\.stringify\(\{token\}\)/u)
  assert.doesNotMatch(html, /\?token=/u)
  assert.match(html, /preference="dark"/u)
})

test('管理页跟随 DSH 主题并保持精简文案', () => {
  const html = managementPage({
    publicUrl: 'https://example.test',
    pairingUrl: 'https://example.test/#token=test',
    paired: false,
    expiresAt: 0,
    qrSvg: '<svg></svg>',
    themePreference: 'light',
  })
  assert.match(html, /preference="light"/u)
  assert.match(html, />手机远程</u)
  assert.match(html, />等待扫码</u)
  assert.doesNotMatch(html, /二维码只用于一次性配对/u)
  assert.match(html, /background:#fff!important/u)
  assert.match(html, /path:first-child\{fill:#fff!important;stroke:none!important\}/u)
  assert.match(html, />重新生成</u)
  assert.match(html, />撤销链接</u)
  assert.match(html, /min-height:36px/u)
  assert.match(html, /data-embed="true"/u)
  assert.doesNotMatch(html, /linear-gradient\(180deg,var\(--accent2\)/u)
  assert.match(html, /实验性功能 · 流量经 Cloudflare 中转/u)
})

test('管理页与配对页跟随 DSH 英文设置', () => {
  const management = managementPage({
    publicUrl: 'https://example.test',
    pairingUrl: 'https://example.test/#token=test',
    paired: false,
    qrSvg: '<svg></svg>',
    locale: 'en',
  })
  const pairing = pairingBootstrapPage('system', 'en')
  assert.match(management, /<html lang="en">/u)
  assert.match(management, />Mobile remote</u)
  assert.match(management, />Regenerate</u)
  assert.match(management, />Revoke link</u)
  assert.match(pairing, />Connecting…</u)
  assert.doesNotMatch(management, />重新生成</u)
})
