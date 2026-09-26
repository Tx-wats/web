import { AlertRule } from '@/types'

/**
 * Shared formatting helpers for dates used across the app.
 * For ID truncation use truncateId() from @/lib/stellar.
 */

/** XLM supports at most 7 decimal places (stroops). */
export const XLM_DECIMALS = 7

/** Total XLM supply — a reasonable upper bound for a transfer threshold. */
export const MAX_XLM_THRESHOLD = 50_000_000_000

/**
 * Validates a LargeTransfer threshold in XLM.
 * Rejects non-finite values, values with more than 7 decimal places,
 * and values above the total XLM supply.
 * Returns an error message, or null when the value is valid.
 */
export function validateXlmThreshold(value: number): string | null {
  if (!Number.isFinite(value)) {
    return 'Threshold must be a finite number'
  }
  if (value <= 0) {
    return 'Threshold must be greater than 0'
  }
  if (value > MAX_XLM_THRESHOLD) {
    return `Threshold cannot exceed ${MAX_XLM_THRESHOLD.toLocaleString()} XLM`
  }
  const decimals = (String(value).split('.')[1] || '').length
  if (decimals > XLM_DECIMALS) {
    return `Threshold supports at most ${XLM_DECIMALS} decimal places`
  }
  return null
}

/** Formats a Unix ms timestamp as a locale date string (e.g. "5/29/2026"). */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString()
}

/** Formats a Unix ms timestamp as a locale date+time string. */
export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['week', 7 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
  ['second', 1000],
]

/**
 * Formats a Unix ms timestamp as a relative time string (e.g. "3 minutes ago").
 * Uses Intl.RelativeTimeFormat for locale-aware output.
 */
export function formatRelativeTime(
  timestamp: number,
  now: number = Date.now(),
): string {
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  const diff = timestamp - now
  const absDiff = Math.abs(diff)

  for (const [unit, ms] of RELATIVE_UNITS) {
    if (absDiff >= ms || unit === 'second') {
      return formatter.format(Math.round(diff / ms), unit)
    }
  }

  return formatter.format(0, 'second')
}

/**
 * Formats an alert rule as a human-readable summary string.
 *
 * The LargeTransfer operator matches tx-watch-core, which fires when a
 * transfer strictly exceeds the threshold (amount > threshold_xlm).
 */
export function formatRuleSummary(rule: AlertRule): string {
  switch (rule.type) {
    case 'LargeTransfer':
      return `> ${rule.threshold_xlm.toLocaleString()} XLM`
    case 'FunctionCalled':
      return rule.function_name || 'function'
    case 'AdminFunctionCalled':
      return rule.function_names?.join(', ') || 'admin functions'
    default:
      return ''
  }
}
