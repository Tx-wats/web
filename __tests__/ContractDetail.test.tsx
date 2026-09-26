import { formatRuleSummary } from '@/lib/format'
import { AlertRule } from '@/types'

describe('formatRuleSummary', () => {
  it('formats LargeTransfer rule with threshold', () => {
    const rule: AlertRule = { type: 'LargeTransfer', threshold_xlm: 1000 }
    expect(formatRuleSummary(rule)).toBe('>= 1000 XLM')
  })

  it('formats FunctionCalled rule with function name', () => {
    const rule: AlertRule = { type: 'FunctionCalled', function_name: 'transfer' }
    expect(formatRuleSummary(rule)).toBe('transfer')
  })

  it('formats AdminFunctionCalled rule with function names', () => {
    const rule: AlertRule = {
      type: 'AdminFunctionCalled',
      function_names: ['set_admin', 'upgrade'],
    }
    expect(formatRuleSummary(rule)).toBe('set_admin, upgrade')
  })

  it('returns empty string for AnyTransaction', () => {
    const rule: AlertRule = { type: 'AnyTransaction' }
    expect(formatRuleSummary(rule)).toBe('')
  })

  it('returns empty string for TransactionFailed', () => {
    const rule: AlertRule = { type: 'TransactionFailed' }
    expect(formatRuleSummary(rule)).toBe('')
  })

  it('handles FunctionCalled with missing function_name', () => {
    const rule: AlertRule = { type: 'FunctionCalled' }
    expect(formatRuleSummary(rule)).toBe('function')
  })

  it('handles AdminFunctionCalled with empty function_names', () => {
    const rule: AlertRule = { type: 'AdminFunctionCalled', function_names: [] }
    expect(formatRuleSummary(rule)).toBe('admin functions')
  })

  it('does not reorder the rules prop array during a duplicate check', () => {
    const rules: AlertRule[] = [
      { type: 'AdminFunctionCalled', function_names: ['upgrade', 'set_admin'] },
      { type: 'AdminFunctionCalled', function_names: ['mint', 'burn'] },
    ]
    const snapshot = rules.map((rule) =>
      rule.function_names ? [...rule.function_names] : undefined
    )

    // Simulate the duplicate check that previously sorted arrays in place.
    rules.forEach((rule) => {
      const names = [...(rule.function_names ?? [])].sort()
      expect(names).toEqual([...names].sort())
    })

    expect(rules.map((rule) => rule.function_names)).toEqual(snapshot)
  })
})
