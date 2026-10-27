import { spawnSync } from 'node:child_process'
import { access, cp, mkdir, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const store = process.argv[2]
const themeDirs = ['assets', 'blocks', 'config', 'layout', 'locales', 'sections', 'snippets', 'templates']

if (!store || !/^[a-z0-9-]+$/i.test(store)) {
  console.error('Usage: node scripts/publish-theme.mjs <store-name>')
  process.exit(1)
}

const storeRoot = path.join(repoRoot, 'stores', store)
const themeRepo = path.join(repoRoot, '.theme-repos', store)
const pkg = JSON.parse(await readFile(path.join(storeRoot, 'package.json'), 'utf8'))
const remote = pkg.themeRepository

if (!remote) {
  console.error(`Set "themeRepository" in stores/${store}/package.json`)
  process.exit(1)
}

function git(args, cwd = themeRepo) {
  const result = spawnSync('git', args, { cwd, stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function gitOutput(args, cwd = themeRepo) {
  return spawnSync('git', args, { cwd, encoding: 'utf8' })
}

const build = spawnSync(process.execPath, [path.join(repoRoot, 'scripts/run.mjs'), store, 'build'], {
  cwd: repoRoot,
  stdio: 'inherit',
})
if (build.status !== 0) process.exit(build.status ?? 1)

await mkdir(themeRepo, { recursive: true })
if (!(await pathExists(path.join(themeRepo, '.git')))) {
  git(['init', '-b', 'main'])
}

const origin = gitOutput(['remote', 'get-url', 'origin'])
if (origin.status !== 0) {
  git(['remote', 'add', 'origin', remote])
} else if (origin.stdout.trim() !== remote) {
  git(['remote', 'set-url', 'origin', remote])
}

for (const dir of themeDirs) {
  const source = path.join(storeRoot, dir)
  const target = path.join(themeRepo, dir)
  await rm(target, { recursive: true, force: true })
  if (!(await pathExists(source))) continue
  await cp(source, target, {
    recursive: true,
    force: true,
    filter: (sourcePath) => {
      const parts = sourcePath.split(path.sep)
      return !parts.includes('.vite') && !parts.includes('node_modules')
    },
  })
}

git(['add', '-A'])
const pending = gitOutput(['status', '--porcelain'])
if (pending.stdout.trim() === '') {
  console.log(`${store} theme repo is already up to date.`)
} else {
  git(['commit', '-m', `Publish ${store} theme for Shopify GitHub.`])
}

const push = gitOutput(['push', '-u', 'origin', 'main'])
if (push.status !== 0) {
  console.error(push.stderr || push.stdout)
  console.error(`\nLocal theme repo: ${themeRepo}`)
  console.error(`Create an empty GitHub repository at ${remote} with no README, then run this command again.`)
  process.exit(push.status ?? 1)
}

console.log(`\nPushed ${store} to ${remote}`)
console.log('In Shopify admin: Online Store → Themes → Add theme → Connect from GitHub.')
console.log(`Choose this repository and the main branch.`)

async function pathExists(target) {
  try {
    await access(target)
    return true
  } catch {
    return false
  }
}
