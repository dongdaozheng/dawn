import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const roots = ['snippets', 'sections']

async function copyThemeFiles(sourceDir, targetDir) {
  let entries
  try {
    entries = await readdir(sourceDir, { withFileTypes: true })
  } catch {
    return
  }

  await mkdir(targetDir, { recursive: true })

  for (const entry of entries) {
    if (!entry.isFile() || entry.name === '.gitkeep' || entry.name === 'package.json') continue
    await cp(path.join(sourceDir, entry.name), path.join(targetDir, entry.name))
  }
}

async function listSharedNames(packageDir) {
  const names = new Set()

  for (const sourceDir of [packageDir, path.join(packageDir, 'src')]) {
    let entries
    try {
      entries = await readdir(sourceDir, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (!entry.isFile() || entry.name === '.gitkeep' || entry.name === 'package.json') continue
      names.add(entry.name)
    }
  }

  return names
}

async function hideSyncedFiles() {
  let stores
  try {
    stores = await readdir(path.join(repoRoot, 'stores'), { withFileTypes: true })
  } catch {
    return
  }

  const synced = {}
  for (const store of stores) {
    if (!store.isDirectory()) continue
    for (const root of roots) {
      const names = await listSharedNames(path.join(repoRoot, 'packages', root))
      for (const name of names) {
        synced[`stores/${store.name}/${root}/${name}`] = true
      }
    }
  }

  const settingsPath = path.join(repoRoot, '.vscode', 'settings.json')
  let settings = {}
  try {
    settings = JSON.parse(await readFile(settingsPath, 'utf8'))
  } catch {
    settings = {}
  }

  const exclude = {}
  for (const [key, value] of Object.entries(settings['files.exclude'] ?? {})) {
    if (!key.startsWith('stores/')) exclude[key] = value
  }
  Object.assign(exclude, synced)
  settings['files.exclude'] = exclude

  await mkdir(path.dirname(settingsPath), { recursive: true })
  await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`)
}

export async function syncStore(store) {
  for (const root of roots) {
    const packageDir = path.join(repoRoot, 'packages', root)
    const targetDir = path.join(repoRoot, 'stores', store, root)
    await copyThemeFiles(packageDir, targetDir)
    await copyThemeFiles(path.join(packageDir, 'src'), targetDir)
  }

  await hideSyncedFiles()
}

const store = process.argv[2]
if (store) {
  await syncStore(store)
}
