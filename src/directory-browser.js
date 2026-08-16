import { access, mkdir, readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, isAbsolute, join, resolve, win32 } from 'node:path'

const maxEntries = 1000

export async function listFilesystemRoots() {
  if (process.platform !== 'win32') return ['/']
  const candidates = Array.from({ length: 26 }, (_, index) => `${String.fromCharCode(65 + index)}:\\`)
  const checks = await Promise.all(candidates.map(async (path) => {
    try {
      await access(path)
      return path
    } catch {
      return null
    }
  }))
  return checks.filter(path => path !== null)
}

function isFullyQualified(path) {
  if (process.platform !== 'win32') return isAbsolute(path)
  return win32.isAbsolute(path) && /^(?:[A-Za-z]:[\\/]|[\\/]{2}[^\\/]+[\\/]+[^\\/]+)/.test(path)
}

function safeTarget(path) {
  if (path === undefined) return homedir()
  if (typeof path !== 'string' || !isFullyQualified(path)) throw new Error('路径必须是绝对路径')
  return resolve(path)
}

export async function listDirectories(path) {
  const target = safeTarget(path)
  const dirents = await readdir(target, { withFileTypes: true })
  const candidates = dirents
    .filter(entry => entry.isDirectory() || entry.isSymbolicLink())
    .sort((left, right) => left.name.localeCompare(right.name))
    .slice(0, maxEntries)
  const entries = []
  for (const entry of candidates) {
    const childPath = join(target, entry.name)
    if (entry.isSymbolicLink()) {
      try {
        if (!(await stat(childPath)).isDirectory()) continue
      } catch {
        continue
      }
    }
    entries.push({ name: entry.name, path: childPath, hidden: entry.name.startsWith('.') })
  }
  const parent = dirname(target)
  return {
    path: target,
    home: homedir(),
    parent: parent === target ? null : parent,
    name: basename(target) || target,
    entries,
    truncated: dirents.length > maxEntries,
  }
}

export async function createDirectory(parentPath, name) {
  const parent = safeTarget(parentPath)
  if (typeof name !== 'string' || name.trim() === '' || name === '.' || name === '..' || /[\\/]/.test(name)) {
    throw new Error('文件夹名称必须是单个非空名称')
  }
  const target = join(parent, name)
  await mkdir(target)
  return target
}
