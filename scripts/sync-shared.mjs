import { cp, mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const roots = ['snippets', 'sections']

export async function syncStore(store) {
  for (const root of roots) {
    const sourceDir = path.join(repoRoot, 'packages', root)
    let entries
    try {
      entries = await readdir(sourceDir, { withFileTypes: true })
    } catch {
      continue
    }

    const targetDir = path.join(repoRoot, 'stores', store, root)
    await mkdir(targetDir, { recursive: true })

    for (const entry of entries) {
      if (!entry.isFile() || entry.name === '.gitkeep' || entry.name === 'package.json') continue
      await cp(path.join(sourceDir, entry.name), path.join(targetDir, entry.name))
    }
  }
}

const store = process.argv[2]
if (store) {
  await syncStore(store)
}
