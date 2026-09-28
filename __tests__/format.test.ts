/**
 * Tests for lib/format date helpers.
 *
 * We pin the timezone to UTC so assertions are environment-independent.
 * Vitest exposes process.env.TZ; set it before importing the module so the
 * cached Intl.DateTimeFormat instances are created in UTC.
 */

// Fix the timezone before the module is evaluated and caches formatters.
process.env.TZ = 'UTC'

import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime, formatTime } from '../lib/format'

// 2026-05-29T15:04:00Z  →  Unix ms
const TS = new Date('2026-05-29T15:04:00Z').getTime()

describe('formatDate', () => {
  it('returns a human-readable date without a time component', () => {
    const result = formatDate(TS)
    // Should contain the year and day; exact locale string varies
    expect(result).toMatch(/2026/)
    expect(result).toMatch(/29/)
    // Must NOT contain hours/minutes
    expect(result).not.toMatch(/15:04/)
  })

  it('does not include a timezone abbreviation', () => {
    // formatDate shows date only — no TZ suffix expected
    const result = formatDate(TS)
    expect(result).not.toMatch(/UTC|GMT/)
  })
})

describe('formatDateTime', () => {
  it('includes the year, day, hour, and minute', () => {
    const result = formatDateTime(TS)
    expect(result).toMatch(/2026/)
    expect(result).toMatch(/29/)
    // hour/minute present (locale-specific separators)
    expect(result).toMatch(/\d{1,2}[:.]\d{2}/)
  })

  it('includes a short timezone name', () => {
    // In UTC the abbreviation is "UTC"
    const result = formatDateTime(TS)
    expect(result).toMatch(/UTC|GMT/)
  })
})

describe('formatTime', () => {
  it('does not include the date', () => {
    const result = formatTime(TS)
    expect(result).not.toMatch(/2026/)
    expect(result).not.toMatch(/May/)
  })

  it('includes a time component', () => {
    const result = formatTime(TS)
    expect(result).toMatch(/\d{1,2}[:.]\d{2}/)
  })

  it('includes a short timezone name', () => {
    const result = formatTime(TS)
    expect(result).toMatch(/UTC|GMT/)
  })
})
