const allowedPreferences = new Set(['light', 'dark', 'system'])

export async function readDshThemePreference(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${String(port)}/`, { cache: 'no-store' })
    if (!response.ok) return 'system'
    const html = await response.text()
    const match = html.match(/const preference = ("(?:light|dark|system)")/)
    if (match === null) return 'system'
    const preference = JSON.parse(match[1])
    return allowedPreferences.has(preference) ? preference : 'system'
  } catch {
    return 'system'
  }
}

export async function readDshLocale(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${String(port)}/api/settings.describe`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'client-request',
        rpcId: `mobile-locale-${String(Date.now())}`,
        method: 'settings.describe',
        payload: {},
      }),
      cache: 'no-store',
    })
    if (!response.ok) return 'zh'
    const envelope = await response.json()
    const namespaces = envelope?.result?.ok === true ? envelope.result.value?.namespaces : undefined
    const locale = Array.isArray(namespaces) ? namespaces.find(entry => entry?.ns === 'locale') : undefined
    return locale?.value?.preference === 'en' ? 'en' : 'zh'
  } catch {
    return 'zh'
  }
}
