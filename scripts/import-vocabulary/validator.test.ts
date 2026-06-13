import { describe, expect, it } from 'vitest'
import { validateVocabularyCsv } from './validator.js'

const validCsv = `book_slug,lemma,part_of_speech,definition_zh,phonetic_us,audio_us_url,audio_source,example,example_zh,example_source
cet4-core,ability,n.,能力；才能,/əˈbɪləti/,https://cdn.example.com/ability.mp3,licensed-audio,Reading improves your ability to learn.,阅读会提升你的学习能力。,seed-example
cet4-core,absorb,v.,吸收；理解,/əbˈzɔːrb/,,,,,
`

describe('validateVocabularyCsv', () => {
  it('accepts valid vocabulary CSV and returns import statistics', () => {
    expect(validateVocabularyCsv(validCsv)).toEqual({
      valid: true,
      stats: {
        totalRows: 2,
        validRows: 2,
        invalidRows: 0,
        newCount: 2,
        updateCount: 0,
        skippedCount: 0,
        failedCount: 0,
      },
      errors: [],
    })
  })

  it('reports row-level validation errors for required fields and sources', () => {
    const csv = `book_slug,lemma,part_of_speech,definition_zh,audio_us_url,audio_source,example,example_source,image_url,image_source
cet4-core,,n.,能力,https://cdn.example.com/a.mp3,licensed-audio,,,
cet4-core,ability,,能力,https://cdn.example.com/a.mp3,licensed-audio,,,
cet4-core,ability,n.,,https://cdn.example.com/a.mp3,licensed-audio,,,
cet4-core,adapt,v.,适应,http://cdn.example.com/adapt.mp3,licensed-audio,,,
cet4-core,sourceful,v.,有来源,https://cdn.example.com/sourceful.mp3,,Use it.,
cet4-core,imageful,n.,有图片,,,Use it.,seed-example,https://cdn.example.com/imageful.webp,
`

    const result = validateVocabularyCsv(csv)

    expect(result.valid).toBe(false)
    expect(result.stats).toMatchObject({
      totalRows: 6,
      validRows: 0,
      invalidRows: 6,
      failedCount: 6,
    })
    expect(result.errors).toEqual(
      expect.arrayContaining([
        {
          rowNumber: 2,
          code: 'MISSING_REQUIRED_FIELD',
          field: 'lemma',
          message: 'lemma 不能为空。',
        },
        {
          rowNumber: 3,
          code: 'MISSING_REQUIRED_FIELD',
          field: 'part_of_speech',
          message: 'part_of_speech 不能为空。',
        },
        {
          rowNumber: 4,
          code: 'MISSING_REQUIRED_FIELD',
          field: 'definition_zh',
          message: 'definition_zh 不能为空。',
        },
        {
          rowNumber: 5,
          code: 'INVALID_ASSET_URL',
          field: 'audio_us_url',
          message: 'audio_us_url 必须使用 HTTPS URL。',
        },
        {
          rowNumber: 6,
          code: 'MISSING_SOURCE',
          field: 'audio_source',
          message: '音频资源必须填写 audio_source。',
        },
        {
          rowNumber: 7,
          code: 'MISSING_SOURCE',
          field: 'image_source',
          message: '图片资源必须填写 image_source。',
        },
      ]),
    )
  })

  it('rejects duplicate lemmas within the same vocabulary book', () => {
    const csv = `book_slug,lemma,part_of_speech,definition_zh
cet4-core,ability,n.,能力
cet4-core,Ability,n.,能力
postgraduate-core,ability,n.,能力
`

    const result = validateVocabularyCsv(csv)

    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual({
      rowNumber: 3,
      code: 'DUPLICATE_LEMMA',
      field: 'lemma',
      message: '同一词库内 lemma 不允许重复。',
    })
    expect(result.stats).toMatchObject({
      totalRows: 3,
      validRows: 2,
      invalidRows: 1,
    })
  })

  it('parses quoted CSV fields with commas', () => {
    const csv = `book_slug,lemma,part_of_speech,definition_zh,example,example_source
cet4-core,context,n.,"上下文，语境","Use the word, in context.",seed-example
`

    expect(validateVocabularyCsv(csv).valid).toBe(true)
  })
})
