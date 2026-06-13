export type ReleaseReadinessInput = {
  packageJson: {
    scripts?: Record<string, string>
  }
  developmentDoc: string
  acceptanceEvidence?: unknown
}

export type ReleaseReadinessResult = {
  ok: boolean
  failures: string[]
  checked: {
    scripts: string[]
    documentGates: string[]
    acceptanceGates: string[]
  }
}

export const requiredReleaseScripts = [
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
] as const

const requiredDocumentGates = [
  {
    label: '性能',
    pattern: /性能/,
    failure: 'DEVELOPMENT.md 缺少性能上线门禁。',
  },
  {
    label: '可访问性',
    pattern: /可访问性/,
    failure: 'DEVELOPMENT.md 缺少可访问性上线门禁。',
  },
  {
    label: '安全',
    pattern: /安全|限流|日志脱敏/,
    failure: 'DEVELOPMENT.md 缺少安全上线门禁。',
  },
  {
    label: '内容导入校验',
    pattern: /内容导入校验|词库内容通过导入校验/,
    failure: 'DEVELOPMENT.md 缺少内容导入校验上线门禁。',
  },
  {
    label: '备份恢复',
    pattern: /备份.*恢复|恢复.*备份|backup.*restore/i,
    failure: 'DEVELOPMENT.md 缺少备份恢复上线门禁。',
  },
  {
    label: 'staging',
    pattern: /staging/i,
    failure: 'DEVELOPMENT.md 缺少 staging 上线门禁。',
  },
  {
    label: '隐私政策',
    pattern: /隐私政策/,
    failure: 'DEVELOPMENT.md 缺少隐私政策上线门禁。',
  },
  {
    label: '用户协议',
    pattern: /用户协议/,
    failure: 'DEVELOPMENT.md 缺少用户协议上线门禁。',
  },
  {
    label: '账号注销',
    pattern: /账号注销|注销流程/,
    failure: 'DEVELOPMENT.md 缺少账号注销上线门禁。',
  },
] as const

const requiredAcceptanceGates = [
  {
    label: '性能预算',
    failure: 'Stage 4 验收证据缺少合格的性能预算记录。',
    isSatisfied: (evidence: ReleaseAcceptanceEvidence) =>
      evidence.performance?.mobileLcpBudgetMs === 2500 &&
      evidence.performance.initialJsGzipBudgetKb === 250 &&
      evidence.performance.routeLazyLoadingChecked === true,
  },
  {
    label: '可访问性',
    failure: 'Stage 4 验收证据缺少可访问性检查记录。',
    isSatisfied: (evidence: ReleaseAcceptanceEvidence) =>
      evidence.accessibility?.wcagAaContrastChecked === true &&
      evidence.accessibility.keyboardNavigationChecked === true &&
      evidence.accessibility.reducedMotionChecked === true,
  },
  {
    label: '备份恢复演练',
    failure: 'Stage 4 验收证据缺少备份恢复演练记录。',
    isSatisfied: (evidence: ReleaseAcceptanceEvidence) =>
      evidence.backupRestore?.backupCommandDocumented === true &&
      evidence.backupRestore.restoreCommandDocumented === true &&
      evidence.backupRestore.drillRequiredBeforeProduction === true,
  },
  {
    label: 'staging 验收',
    failure: 'Stage 4 验收证据缺少 staging 验收记录。',
    isSatisfied: (evidence: ReleaseAcceptanceEvidence) =>
      evidence.staging?.newUserE2eReady === true &&
      evidence.staging.returningUserReviewReady === true &&
      evidence.staging.mobileSpellingReady === true,
  },
  {
    label: '合规入口',
    failure: 'Stage 4 验收证据缺少隐私、协议和账号注销入口记录。',
    isSatisfied: (evidence: ReleaseAcceptanceEvidence) =>
      evidence.legal?.privacyRoute === '/privacy' &&
      evidence.legal.termsRoute === '/terms' &&
      evidence.legal.accountDeletionRoute === '/account/delete',
  },
] as const

export function checkReleaseReadiness(
  input: ReleaseReadinessInput,
): ReleaseReadinessResult {
  const failures: string[] = []
  const scripts = input.packageJson.scripts ?? {}

  for (const scriptName of requiredReleaseScripts) {
    if (!scripts[scriptName]) {
      failures.push(`缺少根命令 ${scriptName}。`)
    }
  }

  for (const gate of requiredDocumentGates) {
    if (!gate.pattern.test(input.developmentDoc)) {
      failures.push(gate.failure)
    }
  }

  const acceptanceEvidence = parseAcceptanceEvidence(input.acceptanceEvidence)
  for (const gate of requiredAcceptanceGates) {
    if (!acceptanceEvidence || !gate.isSatisfied(acceptanceEvidence)) {
      failures.push(gate.failure)
    }
  }

  return {
    ok: failures.length === 0,
    failures,
    checked: {
      scripts: [...requiredReleaseScripts],
      documentGates: requiredDocumentGates.map((gate) => gate.label),
      acceptanceGates: requiredAcceptanceGates.map((gate) => gate.label),
    },
  }
}

type ReleaseAcceptanceEvidence = {
  performance?: {
    mobileLcpBudgetMs?: number
    initialJsGzipBudgetKb?: number
    routeLazyLoadingChecked?: boolean
  }
  accessibility?: {
    wcagAaContrastChecked?: boolean
    keyboardNavigationChecked?: boolean
    reducedMotionChecked?: boolean
  }
  backupRestore?: {
    backupCommandDocumented?: boolean
    restoreCommandDocumented?: boolean
    drillRequiredBeforeProduction?: boolean
  }
  staging?: {
    newUserE2eReady?: boolean
    returningUserReviewReady?: boolean
    mobileSpellingReady?: boolean
  }
  legal?: {
    privacyRoute?: string
    termsRoute?: string
    accountDeletionRoute?: string
  }
}

function parseAcceptanceEvidence(
  value: unknown,
): ReleaseAcceptanceEvidence | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  return value
}
