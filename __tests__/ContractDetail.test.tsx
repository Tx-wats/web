import { formatRuleSummary, formatDate } from '@/lib/format'
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

  it('rejects editing a rule to match another rule label', () => {
    const rules: AlertRule[] = [
      { type: 'LargeTransfer', threshold_xlm: 1000 },
      { type: 'FunctionCalled', function_name: 'transfer' },
    ]
    const editingIndex = 1

    // Duplicate check must run against all rules except the one being edited.
    const isDuplicateLabel = (label: string, index: number | null) =>
      rules.some(
        (rule, i) => i !== index && formatRuleSummary(rule) === label
      )

    const editedLabel = formatRuleSummary(rules[0])
    expect(isDuplicateLabel(editedLabel, editingIndex)).toBe(true)

    // The rule being edited must not collide with itself.
    expect(isDuplicateLabel(formatRuleSummary(rules[1]), editingIndex)).toBe(false)
  })
})

describe('ContractDetail last modified', () => {
  const renderLastModified = (createdAt: string, updatedAt: string) => {
    const showLastModified = updatedAt !== createdAt
    return showLastModified ? `Last modified: ${formatDate(updatedAt)}` : null
  }

  it('shows the last modified time when updated_at differs from created_at', () => {
    const created = '2024-01-01T00:00:00.000Z'
    const updated = '2024-02-01T00:00:00.000Z'
    expect(renderLastModified(created, updated)).toBe(
      `Last modified: ${formatDate(updated)}`
    )
  })

  it('hides the last modified row when updated_at equals created_at', () => {
    const created = '2024-01-01T00:00:00.000Z'
    expect(renderLastModified(created, created)).toBeNull()
  })
})
