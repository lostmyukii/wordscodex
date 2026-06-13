import { readFile } from 'node:fs/promises'
import { validateVocabularyCsv } from './validator.js'

type Command = 'validate' | 'import'

async function main() {
  const [command, filePath] = process.argv.slice(2)

  if (!isCommand(command) || !filePath) {
    printUsage()
    process.exitCode = 1
    return
  }

  const csv = await readFile(filePath, 'utf8')
  const result = validateVocabularyCsv(csv)

  if (!result.valid) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          mode: command,
          stats: result.stats,
          errors: result.errors,
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
        mode: command,
        dryRun: command === 'import',
        message:
          command === 'import'
            ? '词库校验通过。当前导入命令为 dry-run，不会写入生产数据库。'
            : '词库校验通过。',
        stats: result.stats,
      },
      null,
      2,
    ),
  )
}

function isCommand(value: string | undefined): value is Command {
  return value === 'validate' || value === 'import'
}

function printUsage() {
  console.error(`用法:
  pnpm vocabulary:validate <csv-file>
  pnpm vocabulary:import <csv-file>
`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
