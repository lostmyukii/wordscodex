import { readFile } from 'node:fs/promises'
import { checkReleaseReadiness } from './checklist.js'

async function main() {
  const [packageJsonRaw, developmentDoc, acceptanceEvidence] =
    await Promise.all([
      readFile('package.json', 'utf8'),
      readFile('docs/DEVELOPMENT.md', 'utf8'),
      readAcceptanceEvidence(),
    ])
  const packageJson = JSON.parse(packageJsonRaw) as {
    scripts?: Record<string, string>
  }
  const result = checkReleaseReadiness({
    packageJson,
    developmentDoc,
    acceptanceEvidence,
  })

  if (!result.ok) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          failures: result.failures,
          checked: result.checked,
        },
        null,
        2,
      ),
    )
    process.exitCode = 1
    return
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        message: '发布准备检查通过。',
        checked: result.checked,
      },
      null,
      2,
    ),
  )
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})

async function readAcceptanceEvidence() {
  try {
    const raw = await readFile(
      'scripts/release-readiness/fixtures/stage4-acceptance.json',
      'utf8',
    )
    return JSON.parse(raw) as unknown
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return undefined
    throw error
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}
