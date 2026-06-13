import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { auditWebBuild } from './audit.js'

describe('auditWebBuild', () => {
  it('passes when the production build meets local release gates', async () => {
    const distDir = await createBuildFixture({
      includeManifest: true,
      includeReducedMotion: true,
      includeFocusVisible: true,
      includeLazyChunks: true,
      oversizedInitialJs: false,
    })

    await expect(auditWebBuild({ distDir })).resolves.toEqual({
      ok: true,
      failures: [],
      checked: {
        accessibility: ['focus-visible', 'prefers-reduced-motion'],
        lazyChunks: ['LegalPage', 'AccountDeletionPage', 'StudySessionPage'],
        performance: {
          initialJsGzipKbBudget: 250,
          maxChunkGzipKbBudget: 500,
        },
        pwa: ['manifest'],
      },
    })
  })

  it('fails when build artifacts break performance, lazy route, PWA, or accessibility gates', async () => {
    const distDir = await createBuildFixture({
      includeManifest: false,
      includeReducedMotion: false,
      includeFocusVisible: false,
      includeLazyChunks: false,
      oversizedInitialJs: true,
    })

    const result = await auditWebBuild({ distDir })

    expect(result.ok).toBe(false)
    expect(result.failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining('首屏 JavaScript gzip 预算超限'),
        '缺少页面级 lazy chunk：LegalPage。',
        '缺少页面级 lazy chunk：AccountDeletionPage。',
        '缺少页面级 lazy chunk：StudySessionPage。',
        'index.html 缺少 PWA manifest 链接。',
        'CSS 缺少 prefers-reduced-motion 规则。',
        'CSS 缺少 focus-visible 键盘焦点样式。',
      ]),
    )
  })
})

async function createBuildFixture(options: {
  includeManifest: boolean
  includeReducedMotion: boolean
  includeFocusVisible: boolean
  includeLazyChunks: boolean
  oversizedInitialJs: boolean
}) {
  const distDir = await mkdtemp(join(tmpdir(), 'wordscodex-audit-'))
  const assetsDir = join(distDir, 'assets')
  await mkdir(assetsDir, { recursive: true })
  await writeFile(
    join(distDir, 'index.html'),
    `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    ${options.includeManifest ? '<link rel="manifest" href="/manifest.webmanifest" />' : ''}
    <link rel="stylesheet" href="/assets/index.css" />
    <link rel="modulepreload" href="/assets/router.js" />
    <script type="module" src="/assets/index.js"></script>
  </head>
  <body><div id="root"></div></body>
</html>`,
  )
  await writeFile(
    join(assetsDir, 'index.css'),
    [
      '.primary-action { min-height: 48px; }',
      options.includeFocusVisible
        ? ':focus-visible { outline: 3px solid #f0bd45; }'
        : '',
      options.includeReducedMotion
        ? '@media (prefers-reduced-motion: reduce) { * { transition: none; } }'
        : '',
    ].join('\n'),
  )
  await writeFile(join(assetsDir, 'router.js'), 'export const router = true;')
  await writeFile(
    join(assetsDir, 'index.js'),
    options.oversizedInitialJs
      ? randomBytes(270 * 1024)
      : 'export default true;',
  )

  if (options.includeLazyChunks) {
    await Promise.all([
      writeFile(
        join(assetsDir, 'LegalPage-fixture.js'),
        'export default true;',
      ),
      writeFile(
        join(assetsDir, 'AccountDeletionPage-fixture.js'),
        'export default true;',
      ),
      writeFile(
        join(assetsDir, 'StudySessionPage-fixture.js'),
        'export default true;',
      ),
    ])
  }

  return distDir
}
