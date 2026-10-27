import { spawn } from 'node:child_process'
import { watch } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { syncStore } from './sync-shared.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const store = process.argv[2]
const action = process.argv[3] ?? 'dev'
const forwarded = process.argv.slice(4)

if (!store || !/^[a-z0-9-]+$/i.test(store)) {
  console.error('Usage: node scripts/run.mjs <store-name> <dev|build> [shopify flags]')
  process.exit(1)
}

await syncStore(store)

const env = process.env
const viteConfig = `stores/${store}/vite.config.js`
const children = []

function start(command, args) {
  const child = spawn(command, args, {
    cwd: repoRoot,
    env,
    stdio: 'inherit',
    shell: true,
  })
  children.push(child)
  return child
}

function stopAll() {
  for (const child of children) {
    if (!child.killed) child.kill()
  }
}

function watchSharedPackages() {
  let timer
  const onChange = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      syncStore(store).catch((error) => console.error(error))
    }, 150)
  }

  const watchers = []
  for (const folder of ['sections', 'snippets']) {
    try {
      watchers.push(watch(path.join(repoRoot, 'packages', folder), { recursive: true }, onChange))
    } catch {
      // The package folder is created when the first shared file is added.
    }
  }

  return () => {
    clearTimeout(timer)
    for (const watcher of watchers) watcher.close()
  }
}

if (action === 'build') {
  const build = start('pnpm', ['exec', 'vite', 'build', '--config', viteConfig])
  build.on('exit', (code) => process.exit(code ?? 1))
} else if (action === 'dev') {
  const stopWatch = watchSharedPackages()
  const stopAllAndWatch = () => {
    stopWatch()
    stopAll()
  }
  start('pnpm', ['--filter', '@repo/frontend', 'dev'])
  const shopify = start('pnpm', [
    'exec',
    'shopify',
    'theme',
    'dev',
    '--path',
    `stores/${store}`,
    ...forwarded,
  ])
  const vite = start('pnpm', ['exec', 'vite', '--config', viteConfig])

  for (const child of [shopify, vite]) {
    child.on('exit', (code) => {
      stopAllAndWatch()
      process.exit(code ?? 1)
    })
  }

  process.on('SIGINT', () => {
    stopAllAndWatch()
    process.exit(0)
  })
} else {
  console.error(`Unknown action "${action}". Use dev or build.`)
  process.exit(1)
}
