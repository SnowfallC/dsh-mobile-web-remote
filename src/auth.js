import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export const sessionCookieName = 'dsh_mobile_session'

function randomToken() {
  return randomBytes(32).toString('base64url')
}

function tokenDigest(token) {
  return createHash('sha256').update(token).digest()
}

function safeTokenEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false
  return timingSafeEqual(tokenDigest(left), tokenDigest(right))
}

export function parseCookies(header) {
  if (typeof header !== 'string' || header.length === 0) return new Map()
  const cookies = new Map()
  for (const entry of header.split(';')) {
    const separator = entry.indexOf('=')
    if (separator === -1) continue
    const name = entry.slice(0, separator).trim()
    const value = entry.slice(separator + 1).trim()
    if (name.length > 0) cookies.set(name, value)
  }
  return cookies
}

export function createSessionCookie(token, secure, maxAgeSeconds) {
  const parts = [
    `${sessionCookieName}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${String(maxAgeSeconds)}`,
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export function clearSessionCookie(secure) {
  const parts = [
    `${sessionCookieName}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=0',
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export function createAuthState({ pairingTtlMs, sessionTtlMs, now = () => Date.now() }) {
  let pairingToken
  let pairingExpiresAt
  let sessionToken
  let sessionExpiresAt
  let revoked = false

  function rotate() {
    revoked = false
    pairingToken = randomToken()
    pairingExpiresAt = now() + pairingTtlMs
    sessionToken = undefined
    sessionExpiresAt = 0
  }

  function revoke() {
    revoked = true
    pairingToken = undefined
    pairingExpiresAt = 0
    sessionToken = undefined
    sessionExpiresAt = 0
  }

  function ensureFreshPairing() {
    if (sessionToken !== undefined) return
    if (revoked) return
    if (pairingToken === undefined || now() >= pairingExpiresAt) rotate()
  }

  function pair(candidate) {
    ensureFreshPairing()
    if (sessionToken !== undefined || now() >= pairingExpiresAt) return undefined
    if (!safeTokenEqual(candidate, pairingToken)) return undefined
    sessionToken = randomToken()
    sessionExpiresAt = now() + sessionTtlMs
    pairingToken = undefined
    pairingExpiresAt = 0
    return sessionToken
  }

  function isAuthorized(cookieHeader) {
    if (sessionToken === undefined || now() >= sessionExpiresAt) return false
    const candidate = parseCookies(cookieHeader).get(sessionCookieName)
    return safeTokenEqual(candidate, sessionToken)
  }

  function pairingSnapshot() {
    ensureFreshPairing()
    return {
      paired: sessionToken !== undefined && now() < sessionExpiresAt,
      revoked,
      pairingToken,
      pairingExpiresAt,
      sessionExpiresAt,
    }
  }

  rotate()
  return { rotate, revoke, pair, isAuthorized, pairingSnapshot }
}
