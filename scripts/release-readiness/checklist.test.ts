import { describe, expect, it } from 'vitest'
import { checkReleaseReadiness } from './checklist.js'

describe('checkReleaseReadiness', () => {
  it('fails when required release scripts are missing', () => {
    const result = checkReleaseReadiness({
      packageJson: {
        scripts: {
          lint: 'eslint .',
          test: 'pnpm -r test',
        },
      },
      developmentDoc: completeDevelopmentDoc,
      acceptanceEvidence: completeAcceptanceEvidence,
    })

    expect(result.ok).toBe(false)
    expect(result.failures).toEqual(
      expect.arrayContaining([
        '缺少根命令 typecheck。',
        '缺少根命令 vocabulary:validate。',
        '缺少根命令 release:audit。',
        '缺少根命令 release:check。',
      ]),
    )
  })

  it('passes when scripts and Stage 4 document gates are present', () => {
    expect(
      checkReleaseReadiness({
        packageJson: {
          scripts: Object.fromEntries(
            requiredScriptNames.map((scriptName) => [scriptName, 'echo ok']),
          ),
        },
        developmentDoc: completeDevelopmentDoc,
        acceptanceEvidence: completeAcceptanceEvidence,
      }),
    ).toEqual({
      ok: true,
      failures: [],
      checked: {
        scripts: requiredScriptNames,
        documentGates: [
          '性能',
          '可访问性',
          '安全',
          '内容导入校验',
          '备份恢复',
          'staging',
          '隐私政策',
          '用户协议',
          '账号注销',
        ],
        acceptanceGates: [
          '性能预算',
          '可访问性',
          '备份恢复演练',
          'staging 验收',
          '合规入口',
        ],
      },
    })
  })

  it('fails when Stage 4 release gates are not documented', () => {
    const result = checkReleaseReadiness({
      packageJson: {
        scripts: Object.fromEntries(
          requiredScriptNames.map((scriptName) => [scriptName, 'echo ok']),
        ),
      },
      developmentDoc: '阶段 4：上线准备\n- 性能检查',
      acceptanceEvidence: completeAcceptanceEvidence,
    })

    expect(result.ok).toBe(false)
    expect(result.failures).toEqual(
      expect.arrayContaining([
        'DEVELOPMENT.md 缺少可访问性上线门禁。',
        'DEVELOPMENT.md 缺少备份恢复上线门禁。',
        'DEVELOPMENT.md 缺少 staging 上线门禁。',
        'DEVELOPMENT.md 缺少隐私政策上线门禁。',
        'DEVELOPMENT.md 缺少用户协议上线门禁。',
        'DEVELOPMENT.md 缺少账号注销上线门禁。',
      ]),
    )
  })

  it('fails when Stage 4 acceptance evidence is missing or incomplete', () => {
    const result = checkReleaseReadiness({
      packageJson: {
        scripts: Object.fromEntries(
          requiredScriptNames.map((scriptName) => [scriptName, 'echo ok']),
        ),
      },
      developmentDoc: completeDevelopmentDoc,
      acceptanceEvidence: {
        performance: {
          mobileLcpBudgetMs: 3_000,
          initialJsGzipBudgetKb: 250,
          routeLazyLoadingChecked: false,
        },
        accessibility: {
          wcagAaContrastChecked: true,
          keyboardNavigationChecked: false,
          reducedMotionChecked: true,
        },
      },
    })

    expect(result.ok).toBe(false)
    expect(result.failures).toEqual(
      expect.arrayContaining([
        'Stage 4 验收证据缺少合格的性能预算记录。',
        'Stage 4 验收证据缺少可访问性检查记录。',
        'Stage 4 验收证据缺少备份恢复演练记录。',
        'Stage 4 验收证据缺少 staging 验收记录。',
        'Stage 4 验收证据缺少隐私、协议和账号注销入口记录。',
      ]),
    )
  })
})

const requiredScriptNames = [
  'lint',
  'typecheck',
  'test',
  'test:e2e',
  'build',
  'db:deploy',
  'db:seed',
  'vocabulary:validate',
  'vocabulary:import',
  'release:audit',
  'release:check',
]

const completeDevelopmentDoc = `
### 阶段 4：上线准备
- 性能和可访问性检查；
- 安全、限流和日志脱敏；
- 内容导入校验；
- 数据备份和恢复演练；
- staging 端到端验收；
- 隐私政策、用户协议和注销流程；
`

const completeAcceptanceEvidence = {
  performance: {
    mobileLcpBudgetMs: 2_500,
    initialJsGzipBudgetKb: 250,
    routeLazyLoadingChecked: true,
  },
  accessibility: {
    wcagAaContrastChecked: true,
    keyboardNavigationChecked: true,
    reducedMotionChecked: true,
  },
  backupRestore: {
    backupCommandDocumented: true,
    restoreCommandDocumented: true,
    drillRequiredBeforeProduction: true,
  },
  staging: {
    newUserE2eReady: true,
    returningUserReviewReady: true,
    mobileSpellingReady: true,
  },
  legal: {
    privacyRoute: '/privacy',
    termsRoute: '/terms',
    accountDeletionRoute: '/account/delete',
  },
}
