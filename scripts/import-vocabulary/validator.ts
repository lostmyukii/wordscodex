export type VocabularyValidationErrorCode =
  | 'MISSING_REQUIRED_FIELD'
  | 'DUPLICATE_LEMMA'
  | 'INVALID_ASSET_URL'
  | 'MISSING_SOURCE'
  | 'EMPTY_FILE'

export type VocabularyValidationError = {
  rowNumber: number
  code: VocabularyValidationErrorCode
  field: string
  message: string
}

export type VocabularyValidationStats = {
  totalRows: number
  validRows: number
  invalidRows: number
  newCount: number
  updateCount: number
  skippedCount: number
  failedCount: number
}

export type VocabularyValidationResult = {
  valid: boolean
  stats: VocabularyValidationStats
  errors: VocabularyValidationError[]
}

type CsvRecord = {
  rowNumber: number
  values: Record<string, string>
}

const requiredFields = [
  'book_slug',
  'lemma',
  'part_of_speech',
  'definition_zh',
] as const

const assetFields = ['audio_us_url', 'audio_uk_url', 'image_url'] as const

export function validateVocabularyCsv(csv: string): VocabularyValidationResult {
  const records = parseVocabularyCsv(csv)
  const errors: VocabularyValidationError[] = []
  const seenLemmasByBook = new Set<string>()
  let validRows = 0

  if (records.length === 0) {
    return {
      valid: false,
      stats: createStats({ totalRows: 0, validRows: 0 }),
      errors: [
        {
          rowNumber: 1,
          code: 'EMPTY_FILE',
          field: 'file',
          message: '词库文件不能为空。',
        },
      ],
    }
  }

  for (const record of records) {
    const rowErrors: VocabularyValidationError[] = []

    for (const field of requiredFields) {
      if (!valueFor(record, field)) {
        rowErrors.push({
          rowNumber: record.rowNumber,
          code: 'MISSING_REQUIRED_FIELD',
          field,
          message: `${field} 不能为空。`,
        })
      }
    }

    const bookSlug = valueFor(record, 'book_slug').toLowerCase()
    const lemma = valueFor(record, 'lemma').toLowerCase()
    if (bookSlug && lemma) {
      const lemmaKey = `${bookSlug}:${lemma}`
      if (seenLemmasByBook.has(lemmaKey)) {
        rowErrors.push({
          rowNumber: record.rowNumber,
          code: 'DUPLICATE_LEMMA',
          field: 'lemma',
          message: '同一词库内 lemma 不允许重复。',
        })
      } else {
        seenLemmasByBook.add(lemmaKey)
      }
    }

    for (const field of assetFields) {
      const url = valueFor(record, field)
      if (!url) continue

      if (!url.startsWith('https://')) {
        rowErrors.push({
          rowNumber: record.rowNumber,
          code: 'INVALID_ASSET_URL',
          field,
          message: `${field} 必须使用 HTTPS URL。`,
        })
      }
    }

    if (
      (valueFor(record, 'audio_us_url') || valueFor(record, 'audio_uk_url')) &&
      !valueFor(record, 'audio_source')
    ) {
      rowErrors.push({
        rowNumber: record.rowNumber,
        code: 'MISSING_SOURCE',
        field: 'audio_source',
        message: '音频资源必须填写 audio_source。',
      })
    }

    if (valueFor(record, 'image_url') && !valueFor(record, 'image_source')) {
      rowErrors.push({
        rowNumber: record.rowNumber,
        code: 'MISSING_SOURCE',
        field: 'image_source',
        message: '图片资源必须填写 image_source。',
      })
    }

    if (
      (valueFor(record, 'example') || valueFor(record, 'example_zh')) &&
      !valueFor(record, 'example_source')
    ) {
      rowErrors.push({
        rowNumber: record.rowNumber,
        code: 'MISSING_SOURCE',
        field: 'example_source',
        message: '例句资源必须填写 example_source。',
      })
    }

    if (rowErrors.length === 0) {
      validRows += 1
    } else {
      errors.push(...rowErrors)
    }
  }

  return {
    valid: errors.length === 0,
    stats: createStats({
      totalRows: records.length,
      validRows,
    }),
    errors,
  }
}

function parseVocabularyCsv(csv: string): CsvRecord[] {
  const rows = parseCsvRows(csv).filter((row) =>
    row.some((cell) => cell.trim().length > 0),
  )
  const [headers, ...dataRows] = rows
  if (!headers) return []

  const normalizedHeaders = headers.map((header) => header.trim())

  return dataRows.map((row, index) => {
    const values: Record<string, string> = {}
    normalizedHeaders.forEach((header, headerIndex) => {
      values[header] = (row[headerIndex] ?? '').trim()
    })

    return {
      rowNumber: index + 2,
      values,
    }
  })
}

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentCell = ''
  let inQuotes = false

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index]
    const nextChar = csv[index + 1]

    if (char === '"' && inQuotes && nextChar === '"') {
      currentCell += '"'
      index += 1
      continue
    }

    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentCell)
      currentCell = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') index += 1
      currentRow.push(currentCell)
      rows.push(currentRow)
      currentRow = []
      currentCell = ''
      continue
    }

    currentCell += char
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell)
    rows.push(currentRow)
  }

  return rows
}

function valueFor(record: CsvRecord, field: string) {
  return record.values[field]?.trim() ?? ''
}

function createStats(input: {
  totalRows: number
  validRows: number
}): VocabularyValidationStats {
  const invalidRows = input.totalRows - input.validRows

  return {
    totalRows: input.totalRows,
    validRows: input.validRows,
    invalidRows,
    newCount: input.validRows,
    updateCount: 0,
    skippedCount: 0,
    failedCount: invalidRows,
  }
}
