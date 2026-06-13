import { gzipSync } from 'node:zlib'
import { readFile, readdir, stat } from 'node:fs/promises'
import { join, basename } from 'node:path'

const defaultInitialJsGzipKbBudget = 250
const defaultMaxChunkGzipKbBudget = 500
const requiredLazyChunks = [
  'LegalPage',
  'AccountDeletionPage',
  'StudySessionPage',
] as const

export type ReleaseAuditInput = {
  distDir: string
  initialJsGzipKbBudget?: number
  maxChunkGzipKbBudget?: number
}

export type ReleaseAuditResult = {
  ok: boolean
  failures: string[]
  checked: {
    accessibility: string[]
    lazyChunks: string[]
    performance: {
      initialJsGzipKbBudget: number
      maxChunkGzipKbBudget: number
    }
    pwa: string[]
  }
}

export async function auditWebBuild(
  input: ReleaseAuditInput,
): Promise<ReleaseAuditResult> {
  const initialJsGzipKbBudget =
    input.initialJsGzipKbBudget ?? defaultInitialJsGzipKbBudget
  const maxChunkGzipKbBudget =
    input.maxChunkGzipKbBudget ?? defaultMaxChunkGzipKbBudget
  const failures: string[] = []
  const indexHtml = await readFile(join(input.distDir, 'index.html'), 'utf8')
  const assetFiles = await listAssetFiles(join(input.distDir, 'assets'))
  const jsFiles = assetFiles.filter((file) => file.endsWith('.js'))
  const cssFiles = assetFiles.filter((file) => file.endsWith('.css'))

  const initialScriptPaths = extractAssetPaths(
    indexHtml,
    /<script[^>]+src="([^"]+\.js)"/g,
  )
  const preloadScriptPaths = extractAssetPaths(
    indexHtml,
    /<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g,
  )
  const initialJsPaths = [
    ...new Set([...initialScriptPaths, ...preloadScriptPaths]),
  ]
  const initialJsGzipKb = await sumGzipKb(
    initialJsPaths.map((path) => join(input.distDir, path)),
  )

  if (initialJsGzipKb > initialJsGzipKbBudget) {
    failures.push(
      `首屏 JavaScript gzip 预算超限：${initialJsGzipKb.toFixed(1)}KB > ${initialJsGzipKbBudget}KB。`,
    )
  }

  for (const file of jsFiles) {
    const gzipKb = await fileGzipKb(file)
    if (gzipKb > maxChunkGzipKbBudget) {
      failures.push(
        `JS chunk gzip 预算超限：${basename(file)} ${gzipKb.toFixed(1)}KB > ${maxChunkGzipKbBudget}KB。`,
      )
    }
  }

  const jsBasenames = jsFiles.map((file) => basename(file))
  for (const chunkName of requiredLazyChunks) {
    if (!jsBasenames.some((file) => file.includes(chunkName))) {
      failures.push(`缺少页面级 lazy chunk：${chunkName}。`)
    }
  }

  if (!/<link[^>]+rel="manifest"[^>]+href="[^"]+"/.test(indexHtml)) {
    failures.push('index.html 缺少 PWA manifest 链接。')
  }

  const cssText = (
    await Promise.all(cssFiles.map((file) => readFile(file, 'utf8')))
  ).join('\n')
  if (!cssText.includes('prefers-reduced-motion')) {
    failures.push('CSS 缺少 prefers-reduced-motion 规则。')
  }
  if (!cssText.includes('focus-visible')) {
    failures.push('CSS 缺少 focus-visible 键盘焦点样式。')
  }

  return {
    ok: failures.length === 0,
    failures,
    checked: {
      accessibility: ['focus-visible', 'prefers-reduced-motion'],
      lazyChunks: [...requiredLazyChunks],
      performance: {
        initialJsGzipKbBudget,
        maxChunkGzipKbBudget,
      },
      pwa: ['manifest'],
    },
  }
}

async function listAssetFiles(assetsDir: string) {
  const entries = await readdir(assetsDir)
  const files: string[] = []

  for (const entry of entries) {
    const path = join(assetsDir, entry)
    const stats = await stat(path)
    if (stats.isFile()) files.push(path)
  }

  return files
}

function extractAssetPaths(html: string, pattern: RegExp) {
  const paths: string[] = []

  for (const match of html.matchAll(pattern)) {
    const src = match[1]
    if (!src) continue
    paths.push(src.startsWith('/') ? src.slice(1) : src)
  }

  return paths
}

async function sumGzipKb(files: string[]) {
  const sizes = await Promise.all(files.map((file) => fileGzipKb(file)))
  return sizes.reduce((sum, size) => sum + size, 0)
}

async function fileGzipKb(file: string) {
  const content = await readFile(file)
  return gzipSync(content).byteLength / 1024
}
