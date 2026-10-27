import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import shopify from 'vite-plugin-shopify'
import shopifyClean from '@driver-digital/vite-plugin-shopify-clean'

const themeRootAbs = path.dirname(fileURLToPath(import.meta.url))
const frontendAbs = path.resolve(themeRootAbs, '../../packages/frontend')

// fast-glob does not match absolute Windows paths, so pass cwd-relative paths.
const fromCwd = (absolutePath) => path.relative(process.cwd(), absolutePath).split(path.sep).join('/')

const themeRoot = fromCwd(themeRootAbs)
const frontendRoot = fromCwd(frontendAbs)

export default defineConfig({
  // Keep the repo root so entry globs and assets output stay relative to it.
  root: process.cwd(),
  build: {
    emptyOutDir: false,
    rollupOptions: {
      input: [`${frontendRoot}/src/index.ts`, `${frontendRoot}/src/theme.css`],
    },
  },
  plugins: [
    shopifyClean({ themeRoot }),
    shopify({
      themeRoot,
      sourceCodeDir: frontendRoot,
      entrypointsDir: `${frontendRoot}/src`,
    }),
  ],
})
