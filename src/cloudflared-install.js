import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { promisify } from 'node:util'
import * as tar from 'tar'

const execFileAsync = promisify(execFile)
const releaseVersion = '2026.8.2'
const maximumDownloadBytes = 80 * 1024 * 1024

const releaseAssets = new Map([
  ['win32-x64', asset('cloudflared-windows-amd64.exe', 54_893_480, 'c29eee2b121f5436a642eed69fd9767da7e7b8c510fa50aaa130337f931357b5')],
  ['win32-ia32', asset('cloudflared-windows-386.exe', 37_369_480, '6acb072357618fa16c53c43e05438ed728aacd47119f1c6c3aa1a668c3299b43')],
  ['linux-x64', asset('cloudflared-linux-amd64', 39_799_316, 'fcfb02b575a52ca1af2e3267af4e1517bcdeb30ac48c834c69abaed3c0576ad2')],
  ['linux-ia32', asset('cloudflared-linux-386', 37_102_345, '39845d980a4b74b9c84530a28d8fea1fe6c476de26460275602162b349f1cbef')],
  ['linux-arm', asset('cloudflared-linux-arm', 36_288_720, '19809425f60a6261241dfa66a42b4115bab07c295396a3c4d5d7c247fc4e1412')],
  ['linux-arm64', asset('cloudflared-linux-arm64', 37_404_344, '7747d94570fb390cf47dcb4f9555c193c6355cda9793f0d878d9049e5d6a7790')],
  ['darwin-x64', asset('cloudflared-darwin-amd64.tgz', 21_116_242, 'f1727723c586500e2092368ae21871b3df7ddfd2cb097f22d81bee4a9c458bb4', true)],
  ['darwin-arm64', asset('cloudflared-darwin-arm64.tgz', 19_214_189, '9042c2c5d8b2de78e60f313d5fb31b6c5c1cebde787a3caf1f2c9588084ac442', true)],
])

function asset(name, size, sha256, archive = false) {
  return {
    archive,
    name,
    sha256,
    size,
    url: `https://github.com/cloudflare/cloudflared/releases/download/${releaseVersion}/${name}`,
  }
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

async function sha256File(path) {
  return sha256(await readFile(path))
}

function executableName(platform) {
  return platform === 'win32' ? 'cloudflared.exe' : 'cloudflared'
}

export function cloudflaredAsset(platform = process.platform, architecture = process.arch) {
  const selected = releaseAssets.get(`${platform}-${architecture}`)
  if (selected === undefined) {
    throw new Error(`暂不支持自动安装 cloudflared：${platform}/${architecture}`)
  }
  return selected
}

export function cloudflaredCacheRoot({ dshHome, platform = process.platform, architecture = process.arch } = {}) {
  const root = dshHome ?? process.env.DSH_HOME ?? join(homedir(), '.dsh')
  return join(root, 'cache', 'dsh-mobile-web-remote', 'cloudflared', releaseVersion, `${platform}-${architecture}`)
}

async function systemCloudflaredAvailable(command = 'cloudflared') {
  try {
    await execFileAsync(command, ['--version'], { timeout: 5000, windowsHide: true })
    return true
  } catch {
    return false
  }
}

async function cachedExecutableIsValid(executablePath, manifestPath, selected) {
  try {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    if (manifest.assetSha256 !== selected.sha256 || manifest.version !== releaseVersion) return false
    return await sha256File(executablePath) === manifest.executableSha256
  } catch {
    return false
  }
}

async function downloadAsset(selected, fetchImpl) {
  const response = await fetchImpl(selected.url, {
    headers: { 'user-agent': 'dsh-mobile-web-remote' },
    redirect: 'follow',
  })
  if (!response.ok) throw new Error(`下载 cloudflared 失败：HTTP ${response.status}`)
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > maximumDownloadBytes) {
    throw new Error(`cloudflared 下载体积异常：${contentLength} bytes`)
  }
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length > maximumDownloadBytes || bytes.length !== selected.size) {
    throw new Error(`cloudflared 下载体积不匹配：期望 ${selected.size}，实际 ${bytes.length}`)
  }
  const digest = sha256(bytes)
  if (digest !== selected.sha256) throw new Error('cloudflared SHA-256 校验失败')
  return bytes
}

async function installArchive(archivePath, stagingRoot, executablePath) {
  const extractRoot = join(stagingRoot, 'extract')
  await mkdir(extractRoot, { recursive: true })
  await tar.x({
    cwd: extractRoot,
    file: archivePath,
    filter: (path, entry) => entry.type === 'File' && basename(path) === 'cloudflared',
    preservePaths: false,
    strict: true,
  })
  const extracted = join(extractRoot, 'cloudflared')
  await rename(extracted, executablePath)
}

export async function installCloudflared({
  architecture = process.arch,
  cacheRoot,
  fetchImpl = fetch,
  platform = process.platform,
  selectedAsset,
} = {}) {
  const selected = selectedAsset ?? cloudflaredAsset(platform, architecture)
  const root = cacheRoot ?? cloudflaredCacheRoot({ platform, architecture })
  const executablePath = join(root, executableName(platform))
  const manifestPath = join(root, 'install.json')
  if (await cachedExecutableIsValid(executablePath, manifestPath, selected)) return executablePath

  await mkdir(root, { recursive: true })
  const stagingRoot = join(root, `.install-${process.pid}-${Date.now()}`)
  const stagedExecutable = join(stagingRoot, executableName(platform))
  const archivePath = join(stagingRoot, selected.name)
  await mkdir(stagingRoot, { recursive: true })
  try {
    const bytes = await downloadAsset(selected, fetchImpl)
    await writeFile(archivePath, bytes, { flag: 'wx' })
    if (selected.archive) await installArchive(archivePath, stagingRoot, stagedExecutable)
    else await writeFile(stagedExecutable, bytes, { flag: 'wx' })
    if (platform !== 'win32') await chmod(stagedExecutable, 0o755)
    const executableSha256 = await sha256File(stagedExecutable)
    await rm(executablePath, { force: true })
    await rename(stagedExecutable, executablePath)
    await writeFile(manifestPath, `${JSON.stringify({
      asset: selected.name,
      assetSha256: selected.sha256,
      executableSha256,
      source: selected.url,
      version: releaseVersion,
    }, null, 2)}\n`, 'utf8')
    return executablePath
  } finally {
    await rm(stagingRoot, { force: true, recursive: true })
  }
}

export async function resolveCloudflaredExecutable({
  configuredPath,
  environmentPath = process.env.DSH_CLOUDFLARED_PATH,
  isSystemAvailable = systemCloudflaredAvailable,
  ...installOptions
} = {}) {
  if (environmentPath !== undefined && environmentPath !== '') return environmentPath
  if (configuredPath !== undefined && configuredPath !== '' && configuredPath !== 'auto') return configuredPath
  if (await isSystemAvailable('cloudflared')) return 'cloudflared'
  return installCloudflared(installOptions)
}

export const cloudflaredReleaseVersion = releaseVersion
