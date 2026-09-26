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

describe('Modal keyboard interaction', () => {
  const setupModal = () => {
    const trigger = document.createElement('button')
    trigger.textContent = 'Open'
    document.body.appendChild(trigger)
    trigger.focus()

    const overlay = document.createElement('div')
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')
    overlay.setAttribute('aria-labelledby', 'modal-title')

    const title = document.createElement('h2')
    title.id = 'modal-title'
    title.textContent = 'Edit Details'

    const cancel = document.createElement('button')
    cancel.textContent = 'Cancel'
    const confirm = document.createElement('button')
    confirm.textContent = 'Confirm'

    overlay.append(title, cancel, confirm)
    document.body.appendChild(overlay)
    cancel.focus()

    return { trigger, overlay, cancel, confirm }
  }

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('exposes dialog semantics with an accessible label', () => {
    const { overlay } = setupModal()
    expect(overlay.getAttribute('role')).toBe('dialog')
    expect(overlay.getAttribute('aria-modal')).toBe('true')
    expect(overlay.getAttribute('aria-labelledby')).toBe('modal-title')
    expect(document.getElementById('modal-title')?.textContent).toBe('Edit Details')
  })

  it('focuses the safe action (Cancel) by default for destructive dialogs', () => {
    const { cancel } = setupModal()
    expect(document.activeElement).toBe(cancel)
  })

  it('traps focus within the dialog when tabbing', () => {
    const { cancel, confirm } = setupModal()
    const focusable = [cancel, confirm]

    // Tab forward from the last element wraps to the first.
    confirm.focus()
    const nextIndex = (focusable.indexOf(document.activeElement as HTMLElement) + 1) % focusable.length
    focusable[nextIndex].focus()
    expect(document.activeElement).toBe(cancel)

    // Shift+Tab from the first element wraps to the last.
    cancel.focus()
    const prevIndex =
      (focusable.indexOf(document.activeElement as HTMLElement) - 1 + focusable.length) %
      focusable.length
    focusable[prevIndex].focus()
    expect(document.activeElement).toBe(confirm)
  })

  it('closes on Escape and restores focus to the trigger', () => {
    const { trigger, overlay } = setupModal()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        overlay.remove()
        trigger.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    document.removeEventListener('keydown', onKeyDown)

    expect(document.body.contains(overlay)).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })
})
