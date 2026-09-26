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
