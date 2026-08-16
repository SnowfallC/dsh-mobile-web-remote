import assert from 'node:assert/strict'
import test from 'node:test'
import { injectDriveShortcuts } from '../src/drive-shortcuts.js'

test('磁盘快捷入口只注入一次', () => {
  const html = '<html><body><div id="root"></div></body></html>'
  const once = injectDriveShortcuts(html)
  const twice = injectDriveShortcuts(once)
  assert.match(once, /data-dsh-drive-shortcuts/)
  assert.equal(twice, once)
})

test('磁盘快捷入口包含我的电脑和盘符接口', () => {
  const html = injectDriveShortcuts('<html><body></body></html>')
  assert.match(html, /我的电脑/)
  assert.match(html, /\/__dsh_mobile\/fs\/roots/)
})
