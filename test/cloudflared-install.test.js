import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  cloudflaredAsset,
  installCloudflared,
  resolveCloudflaredExecutable,
} from '../src/cloudflared-install.js'

function fixtureAsset(bytes) {
  return {
    archive: false,
    name: 'cloudflared-linux-amd64',
    sha256: createHash('sha256').update(bytes).digest('hex'),
    size: bytes.length,
    url: 'https://example.test/cloudflared-linux-amd64',
  }
}

test('自动安装只接受明确支持的平台', () => {
  assert.equal(cloudflaredAsset('win32', 'x64').name, 'cloudflared-windows-amd64.exe')
  assert.throws(() => cloudflaredAsset('aix', 'ppc64'), /暂不支持自动安装/u)
})

test('显式路径与系统命令优先于自动下载', async () => {
  assert.equal(await resolveCloudflaredExecutable({
    configuredPath: 'D:/tools/cloudflared.exe',
    environmentPath: '',
    isSystemAvailable: async () => false,
  }), 'D:/tools/cloudflared.exe')
  assert.equal(await resolveCloudflaredExecutable({
    configuredPath: 'auto',
    environmentPath: '',
    isSystemAvailable: async () => true,
  }), 'cloudflared')
})

test('下载文件通过校验后写入缓存并被复用', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-cloudflared-'))
  const bytes = Buffer.from('verified cloudflared fixture')
  const selectedAsset = fixtureAsset(bytes)
  let downloads = 0
  const fetchImpl = async () => {
    downloads += 1
    return new Response(bytes, { headers: { 'content-length': String(bytes.length) } })
  }
  try {
    const first = await installCloudflared({
      cacheRoot: root,
      fetchImpl,
      platform: 'linux',
      selectedAsset,
    })
    const second = await installCloudflared({
      cacheRoot: root,
      fetchImpl,
      platform: 'linux',
      selectedAsset,
    })
    assert.equal(first, second)
    assert.equal(downloads, 1)
    assert.deepEqual(await readFile(first), bytes)
  } finally {
    await rm(root, { force: true, recursive: true })
  }
})

test('校验失败时不会留下可执行文件', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-cloudflared-'))
  const bytes = Buffer.from('unexpected bytes')
  const selectedAsset = { ...fixtureAsset(bytes), sha256: '0'.repeat(64) }
  try {
    await assert.rejects(() => installCloudflared({
      cacheRoot: root,
      fetchImpl: async () => new Response(bytes, { headers: { 'content-length': String(bytes.length) } }),
      platform: 'linux',
      selectedAsset,
    }), /SHA-256 校验失败/u)
    await assert.rejects(() => readFile(join(root, 'cloudflared')))
  } finally {
    await rm(root, { force: true, recursive: true })
  }
})
