import { auditWebBuild } from './audit.js'

async function main() {
  const distDir = process.argv[2] ?? 'apps/web/dist'
  const result = await auditWebBuild({ distDir })

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
        message: '发布构建审计通过。',
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
