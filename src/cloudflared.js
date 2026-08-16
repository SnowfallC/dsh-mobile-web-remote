import { spawn } from 'node:child_process'

const quickTunnelPattern = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/iu

export function startCloudflared({ executable, localUrl, onPublicUrl, onError, onExit }) {
  const child = spawn(executable, [
    'tunnel',
    '--no-autoupdate',
    '--url',
    localUrl,
  ], {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let combinedOutput = ''
  let publicUrl
  const consume = (chunk) => {
    combinedOutput = `${combinedOutput}${chunk.toString('utf8')}`.slice(-32_768)
    if (publicUrl !== undefined) return
    const match = combinedOutput.match(quickTunnelPattern)
    if (match === null) return
    publicUrl = match[0]
    onPublicUrl(publicUrl)
  }

  child.stdout.on('data', consume)
  child.stderr.on('data', consume)
  child.on('error', onError)
  child.on('exit', (code, signal) => onExit({ code, signal, publicUrl }))

  return child
}

export async function stopCloudflared(child) {
  if (child === undefined || child.exitCode !== null) return
  const exited = new Promise((resolve) => child.once('exit', resolve))
  child.kill()
  await Promise.race([
    exited,
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ])
  if (child.exitCode === null) child.kill('SIGKILL')
}
