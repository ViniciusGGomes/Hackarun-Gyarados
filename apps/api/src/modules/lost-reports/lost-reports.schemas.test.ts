import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CreateLostReportSchema } from './lost-reports.schemas'

// Monday 2026-11-16, 09:00 in America/Araguaina (UTC-3).
const NOW = new Date('2026-11-16T12:00:00Z')
const LOCATION_ID = '9b1d2c3e-1111-4a2b-8c3d-5e6f7a8b9c0d'

const valid = {
  category: 'wallet_bag',
  description: 'Carteira preta de couro',
  identificationDetail: 'Foto de um cachorro dentro da carteira',
  locationId: LOCATION_ID,
  lostDate: '2026-11-12',
  lostPeriod: 'afternoon',
  name: 'João Lima',
  phone: '63988887777',
  consent: { accepted: true, privacyNoticeVersion: '1.0' },
}

const parse = (overrides: Record<string, unknown> = {}) => CreateLostReportSchema.safeParse({ ...valid, ...overrides })

/** Fields named by the issues of a failed parse. */
function failedFields(result: ReturnType<typeof parse>) {
  return result.success ? [] : result.error.issues.map((issue) => String(issue.path[0]))
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('CreateLostReportSchema', () => {
  it('accepts the example of the contract', () => {
    expect(parse().success).toBe(true)
  })

  it('each missing required field is rejected', () => {
    for (const field of ['category', 'description', 'lostDate', 'name', 'phone', 'consent']) {
      const { [field]: _removed, ...rest } = valid as Record<string, unknown>
      const result = CreateLostReportSchema.safeParse(rest)

      expect(result.success, field).toBe(false)
      expect(failedFields(result), field).toContain(field)
    }
  })

  it('category and lostPeriod accept only the enum values', () => {
    for (const category of ['documents', 'wallet_bag', 'phone_electronics', 'keys', 'clothing_accessories', 'glasses_jewelry', 'other']) {
      expect(parse({ category }).success, category).toBe(true)
    }
    for (const lostPeriod of ['morning', 'afternoon', 'night', 'unknown']) {
      expect(parse({ lostPeriod }).success, lostPeriod).toBe(true)
    }

    expect(failedFields(parse({ category: 'toys' }))).toContain('category')
    expect(failedFields(parse({ lostPeriod: 'evening' }))).toContain('lostPeriod')
  })

  it('phone accepts only ten or eleven digits', () => {
    expect(parse({ phone: '6399999888' }).success).toBe(true)
    expect(parse({ phone: '63999998888' }).success).toBe(true)

    for (const phone of ['639999988', '639999988889', '(63) 99999-8888', 'abcdefghij', '']) {
      expect(failedFields(parse({ phone })), phone).toContain('phone')
    }
  })

  it('email must be valid and at most 255 characters', () => {
    const base = `${'a'.repeat(60)}@${'b'.repeat(60)}.${'c'.repeat(60)}.${'d'.repeat(60)}.`
    const at255 = `${base}${'x'.repeat(255 - base.length)}`
    const at256 = `${at255}x`

    expect(parse({ email: 'maria@email.com' }).success).toBe(true)
    expect(parse({ email: at255 }).success).toBe(true)
    expect(failedFields(parse({ email: 'not-an-email' }))).toContain('email')
    expect(failedFields(parse({ email: at256 }))).toContain('email')

    const absent = parse({ email: null })
    expect(absent.success && absent.data.email).toBeUndefined()
  })

  it('text limits accept the exact size and reject one more', () => {
    const url = (length: number) => `https://e.com/${'a'.repeat(length - 14)}`
    const limits: [string, (length: number) => string, number][] = [
      ['name', (length) => 'n'.repeat(length), 120],
      ['description', (length) => 'd'.repeat(length), 500],
      ['identificationDetail', (length) => 'i'.repeat(length), 300],
      ['photoUrl', url, 500],
    ]

    for (const [field, make, limit] of limits) {
      expect(parse({ [field]: make(limit) }).success, `${field} at ${limit}`).toBe(true)
      expect(failedFields(parse({ [field]: make(limit + 1) })), `${field} at ${limit + 1}`).toContain(field)
    }
  })

  it('name and description reject empty and whitespace only', () => {
    for (const field of ['name', 'description']) {
      for (const value of ['', '   ', '\t\n ']) {
        expect(failedFields(parse({ [field]: value })), `${field} ${JSON.stringify(value)}`).toContain(field)
      }
    }
  })

  it('photoUrl accepts only http and https URIs', () => {
    expect(parse({ photoUrl: 'https://cdn.example.com/a.png' }).success).toBe(true)
    expect(parse({ photoUrl: 'http://localhost:3333/uploads/a.webp' }).success).toBe(true)

    for (const photoUrl of ['ftp://example.com/a.png', 'javascript:alert(1)', 'not a url', 'data:image/png;base64,AAAA']) {
      expect(failedFields(parse({ photoUrl })), photoUrl).toContain('photoUrl')
    }
  })

  it('lostDate rejects dates that do not exist', () => {
    expect(parse({ lostDate: '2026-02-28' }).success).toBe(true)

    for (const lostDate of ['2026-02-30', '2026-13-01', '2026-11-1', '16/11/2026', 'ontem']) {
      expect(failedFields(parse({ lostDate })), lostDate).toContain('lostDate')
    }
  })

  it('lostDate rejects tomorrow in the local time zone', () => {
    expect(failedFields(parse({ lostDate: '2026-11-17' }))).toContain('lostDate')
    expect(parse({ lostDate: '2026-11-16' }).success).toBe(true)
  })

  it('lostDate accepts today in the local time zone even when UTC is tomorrow', () => {
    // 2026-11-17T01:00Z is still 22:00 of 2026-11-16 in America/Araguaina.
    vi.setSystemTime(new Date('2026-11-17T01:00:00Z'))

    expect(parse({ lostDate: '2026-11-16' }).success).toBe(true)
    expect(failedFields(parse({ lostDate: '2026-11-17' }))).toContain('lostDate')
  })

  it('location is rejected when neither locationId nor unknownLocation is sent', () => {
    const { locationId: _removed, ...withoutLocation } = valid

    expect(failedFields(CreateLostReportSchema.safeParse(withoutLocation))).toContain('locationId')
    expect(failedFields(CreateLostReportSchema.safeParse({ ...withoutLocation, unknownLocation: false }))).toContain('locationId')
  })

  it('location is rejected when both locationId and unknownLocation are sent', () => {
    expect(failedFields(parse({ unknownLocation: true }))).toContain('locationId')

    // The other combinations are valid: a location alone, or "não sei" alone.
    expect(parse({ unknownLocation: false }).success).toBe(true)
    const { locationId: _removed, ...withoutLocation } = valid
    expect(CreateLostReportSchema.safeParse({ ...withoutLocation, unknownLocation: true }).success).toBe(true)
  })

  it('text fields are trimmed and control characters removed', () => {
    const result = parse({
      name: '  Maria\u0000 Souza\n ',
      description: ' linha 1\nlinha\u0007 2\r\n ',
      identificationDetail: '\u0001marca\tvermelha ',
      email: '  maria@email.com ',
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.name).toBe('Maria Souza')
    expect(result.data.description).toBe('linha 1\nlinha 2')
    expect(result.data.identificationDetail).toBe('marcavermelha')
    expect(result.data.email).toBe('maria@email.com')

    // The limit counts the cleaned text.
    expect(parse({ description: `  ${'d'.repeat(500)}\u0000 ` }).success).toBe(true)
  })

  it('every control character is removed and only the line break survives in long texts', () => {
    const codes = [...Array.from({ length: 32 }, (_, i) => i), 0x7f, ...Array.from({ length: 32 }, (_, i) => 0x80 + i)]

    for (const code of codes.filter((value) => value !== 0x0a)) {
      const char = String.fromCharCode(code)
      const cleaned = parse({ name: `Ma${char}ria`, description: `a${char}b` })

      expect(cleaned.success && [cleaned.data.name, cleaned.data.description], `U+${code.toString(16)}`).toEqual(['Maria', 'ab'])
    }

    const kept = parse({ name: 'Maria Antônia', description: 'a\nb ¡¢ ã' })
    expect(kept.success && [kept.data.name, kept.data.description]).toEqual(['Maria Antônia', 'a\nb ¡¢ ã'])

    const shortName = parse({ name: 'Ma\nria' })
    expect(shortName.success && shortName.data.name).toBe('Maria') // short texts lose the line break too
  })

  it('limits count characters, so an emoji counts as one', () => {
    expect(parse({ name: `${'a'.repeat(119)}😀` }).success).toBe(true)
    expect(parse({ description: `${'d'.repeat(499)}😀` }).success).toBe(true)
    expect(failedFields(parse({ name: `${'a'.repeat(120)}😀` }))).toContain('name')
    expect(failedFields(parse({ description: `${'d'.repeat(500)}😀` }))).toContain('description')
  })

  it('invisible zero-width name is rejected as empty', () => {
    expect(failedFields(parse({ name: '​​' }))).toContain('name')
    expect(failedFields(parse({ description: '﻿ ⁠' }))).toContain('description')
  })

  it('lostDate accepts early years that Date.UTC would shift', () => {
    expect(parse({ lostDate: '0050-01-01' }).success).toBe(true)
    expect(parse({ lostDate: '0001-01-01' }).success).toBe(true)
    expect(failedFields(parse({ lostDate: '0050-02-30' }))).toContain('lostDate')
  })

  it('empty optional strings are treated as absent', () => {
    const result = parse({ identificationDetail: '   ', email: '', photoUrl: ' ' })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.identificationDetail).toBeUndefined()
    expect(result.data.email).toBeUndefined()
    expect(result.data.photoUrl).toBeUndefined()
  })

  it('unknown fields are stripped', () => {
    const result = parse({ status: 'delivered', protocol: 'CAP-AAAA-BBBB', id: 'x', reason: 'saúde', foundItemId: 'y' })

    expect(result.success).toBe(true)
    if (!result.success) return
    for (const field of ['status', 'protocol', 'id', 'reason', 'foundItemId']) {
      expect(result.data).not.toHaveProperty(field)
    }
  })
})
