import assert from 'node:assert/strict'
import test from 'node:test'
import { injectRemoteMobileRestrictions } from '../src/remote-ui.js'

test('远程限制脚本只注入桥接页面一次', () => {
  const original = '<html><head></head><body><div id="root"></div></body></html>'
  const once = injectRemoteMobileRestrictions(original)
  const twice = injectRemoteMobileRestrictions(once)
  assert.match(once, /name="dsh-mobile-web-remote"/u)
  assert.match(once, /data-dsh-mobile-restrictions/u)
  assert.equal(twice, once)
})

test('远程限制脚本隐藏添加工作区与设置入口', () => {
  const html = injectRemoteMobileRestrictions('<html><head></head><body></body></html>')
  assert.match(html, /添加工作区/u)
  assert.match(html, /设置/u)
  assert.match(html, /MutationObserver/u)
  assert.doesNotMatch(html, /workspace\.create/u)
  assert.doesNotMatch(html, /fs\/list/u)
})
