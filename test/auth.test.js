import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createAuthState,
  createSessionCookie,
  parseCookies,
  sessionCookieName,
} from '../src/auth.js'

test('一次性配对令牌只能成功使用一次', () => {
  const auth = createAuthState({ pairingTtlMs: 60_000, sessionTtlMs: 60_000 })
  const pairingToken = auth.pairingSnapshot().pairingToken
  const sessionToken = auth.pair(pairingToken)
  assert.equal(typeof sessionToken, 'string')
  assert.equal(auth.pair(pairingToken), undefined)
})

test('会话 Cookie 可授权且错误值被拒绝', () => {
  const auth = createAuthState({ pairingTtlMs: 60_000, sessionTtlMs: 60_000 })
  const pairingToken = auth.pairingSnapshot().pairingToken
  const sessionToken = auth.pair(pairingToken)
  assert.equal(auth.isAuthorized(`${sessionCookieName}=${sessionToken}`), true)
  assert.equal(auth.isAuthorized(`${sessionCookieName}=wrong`), false)
})

test('Cookie 解析保留等号后的完整值', () => {
  const cookies = parseCookies('a=1; token=abc=def; empty=')
  assert.equal(cookies.get('token'), 'abc=def')
  assert.equal(cookies.get('empty'), '')
})

test('公网会话 Cookie 使用安全属性', () => {
  const cookie = createSessionCookie('token', true, 3600)
  assert.match(cookie, /HttpOnly/u)
  assert.match(cookie, /SameSite=Strict/u)
  assert.match(cookie, /Secure/u)
  assert.match(cookie, /Max-Age=3600/u)
})

test('撤销后现有会话和配对链接立即失效，直到手动重新生成', () => {
  const auth = createAuthState({ pairingTtlMs: 60_000, sessionTtlMs: 60_000 })
  const sessionToken = auth.pair(auth.pairingSnapshot().pairingToken)
  auth.revoke()
  assert.equal(auth.isAuthorized(`${sessionCookieName}=${sessionToken}`), false)
  assert.equal(auth.pairingSnapshot().pairingToken, undefined)
  assert.equal(auth.pairingSnapshot().revoked, true)
  auth.rotate()
  assert.equal(typeof auth.pairingSnapshot().pairingToken, 'string')
  assert.equal(auth.pairingSnapshot().revoked, false)
})
