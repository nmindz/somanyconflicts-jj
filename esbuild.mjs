import * as esbuild from 'esbuild'
import { copyFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const production = process.argv.includes('--production')
const watch = process.argv.includes('--watch')

// Copy WASM files that can't be bundled
function copyWasmFiles() {
  const wasmDir = join('dist', 'parsers')
  if (!existsSync(wasmDir)) {
    mkdirSync(wasmDir, { recursive: true })
  }
  const parsers = ['java', 'javascript', 'python', 'typescript']
  for (const p of parsers) {
    const src = join('parsers', `${p}.wasm`)
    const dest = join(wasmDir, `${p}.wasm`)
    if (existsSync(src)) {
      copyFileSync(src, dest)
    }
  }

  // Also copy web-tree-sitter.wasm from node_modules
  const wtsSrc = join('node_modules', 'web-tree-sitter', 'web-tree-sitter.wasm')
  const wtsDest = join('dist', 'web-tree-sitter.wasm')
  if (existsSync(wtsSrc)) {
    copyFileSync(wtsSrc, wtsDest)
  }
}

/** @type {import('esbuild').Plugin} */
const esbuildProblemMatcherPlugin = {
  name: 'esbuild-problem-matcher',
  setup(build) {
    build.onStart(() => {
      console.log('[watch] build started')
    })
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`)
        if (location) {
          console.error(`    ${location.file}:${location.line}:${location.column}:`)
        }
      })
      console.log('[watch] build finished')
    })
  },
}

const ctx = await esbuild.context({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  format: 'cjs',
  minify: production,
  sourcemap: !production,
  sourcesContent: false,
  platform: 'node',
  outfile: 'dist/extension.js',
  external: ['vscode'],
  logLevel: 'silent',
  plugins: [
    esbuildProblemMatcherPlugin,
  ],
})

copyWasmFiles()

if (watch) {
  await ctx.watch()
} else {
  await ctx.rebuild()
  await ctx.dispose()
}
