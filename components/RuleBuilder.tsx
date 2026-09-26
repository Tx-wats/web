'use client'

import { useState } from 'react'
import { AlertRule, AlertRuleType } from '@/types'
import { formatRuleSummary } from '@/lib/format'
import AlertRuleBadge from './AlertRuleBadge'

const RULE_TYPES: AlertRuleType[] = [
  'AnyTransaction',
  'LargeTransfer',
  'FunctionCalled',
  'AdminFunctionCalled',
  'TransactionFailed',
]

const RULE_EXAMPLES: Record<AlertRuleType, string> = {
  'AnyTransaction': 'Alert on every transaction',
  'LargeTransfer': 'Alert when transfer amount exceeds threshold',
  'FunctionCalled': 'Alert when a specific function is called',
  'AdminFunctionCalled': 'Alert when admin functions are called',
  'TransactionFailed': 'Alert on failed transactions',
}

interface RuleBuilderProps {
  rules: AlertRule[]
  onChange: (rules: AlertRule[]) => void
  /** Optional callback fired whenever a rule is added, updated, or removed.
   *  Intended as an analytics hook point — no behavior depends on it. */
  onRulesChanged?: (rules: AlertRule[], action: 'add' | 'update' | 'remove') => void
}

const emptyRule = (): AlertRule => ({ type: 'AnyTransaction' })

export default function RuleBuilder({ rules, onChange, onRulesChanged }: RuleBuilderProps) {
  const [draft, setDraft] = useState<AlertRule>(emptyRule())
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  function updateDraft(patch: Partial<AlertRule>) {
    setDraft((prev) => ({ ...prev, ...patch }))
    setError(null)
    setWarning(null)
  }

  function handleTypeChange(type: AlertRuleType) {
    setDraft({ type })
    setError(null)
    setWarning(null)
  }

  function isDuplicateLabel(newRule: AlertRule, ignoreIndex: number | null = null): boolean {
    return rules.some((rule, index) => {
      if (ignoreIndex !== null && index === ignoreIndex) return false
      if (newRule.type !== rule.type) return false
      if (newRule.type === 'LargeTransfer') return newRule.threshold_xlm === rule.threshold_xlm
      if (newRule.type === 'FunctionCalled') return newRule.function_name === rule.function_name
      if (newRule.type === 'AdminFunctionCalled') {
        const newNames = [...(newRule.function_names ?? [])].sort().join(',')
        const existingNames = [...(rule.function_names ?? [])].sort().join(',')
        return newNames === existingNames
      }
      return true // AnyTransaction and TransactionFailed
    })
  }

  function isValidFunctionName(name: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)
  }

  function addRule() {
    if (draft.type === 'LargeTransfer') {
      if (draft.threshold_xlm === undefined || draft.threshold_xlm === null || isNaN(draft.threshold_xlm)) {
        setError('Enter a valid XLM threshold')
        return
      }
      if (draft.threshold_xlm <= 0) {
        setError('Threshold must be greater than 0')
        return
      }
    }
    if (draft.type === 'FunctionCalled') {
      if (!draft.function_name?.trim()) {
        setError('Enter a function name')
        return
      }
      if (!isValidFunctionName(draft.function_name.trim())) {
        setError('Function name must start with a letter or underscore, contain only alphanumeric characters and underscores')
        return
      }
    }
    if (draft.type === 'AdminFunctionCalled') {
      if (!draft.function_names?.length) {
        setError('Enter at least one function name')
        return
      }
      // Sort function names for consistency
      draft.function_names = [...draft.function_names].sort()
    }
    const newRule = { ...draft }
    if (editingIndex !== null) {
      if (isDuplicateLabel(newRule, editingIndex)) {
        setWarning('This rule already exists')
        return
      }
      const updated = [...rules]
      updated[editingIndex] = newRule
      onChange(updated)
      onRulesChanged?.(updated, 'update')
      setEditingIndex(null)
    } else {
      if (isDuplicateLabel(newRule)) {
        setWarning('This rule already exists')
        return
      }
      const updated = [...rules, newRule]
      onChange(updated)
      onRulesChanged?.(updated, 'add')
    }
    setDraft(emptyRule())
    setError(null)
    setWarning(null)
  }

  function startEdit(index: number) {
    setDraft(rules[index])
    setEditingIndex(index)
    setError(null)
  }

  function cancelEdit() {
    setDraft(emptyRule())
    setEditingIndex(null)
    setError(null)
  }

  function removeRule(index: number) {
    const updated = rules.filter((_, i) => i !== index)
    onChange(updated)
    onRulesChanged?.(updated, 'remove')
    // Keep editingIndex pointing at the same logical rule after removal.
    // Removing a rule before the edited one shifts it down by one; removing
    // the edited rule itself cancels the edit to avoid targeting a stale index.
    setEditingIndex((prev) => {
      if (prev === null) return null
      if (prev === index) {
        setDraft(emptyRule())
        setError(null)
        setWarning(null)
        return null
      }
      return prev > index ? prev - 1 : prev
    })
  }

  return (
    <div className="space-y-4">
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1">Rule Type</label>
          <select
            value={draft.type}
            onChange={(e) => handleTypeChange(e.target.value as AlertRuleType)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
          >
            {RULE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <p className="text-xs text-zinc-500 mt-1">{RULE_EXAMPLES[draft.type]}</p>
        </div>

        {draft.type === 'LargeTransfer' && (
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Threshold (XLM)</label>
            <input
              type="number"
              min="0"
              step="any"
              placeholder="e.g. 10000"
              value={draft.threshold_xlm ?? ''}
              onChange={(e) => updateDraft({ threshold_xlm: parseFloat(e.target.value) || undefined })}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}

        {draft.type === 'FunctionCalled' && (
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Function Name</label>
            <input
              type="text"
              placeholder="e.g. transfer"
              value={draft.function_name ?? ''}
              onChange={(e) => updateDraft({ function_name: e.target.value })}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}

        {draft.type === 'AdminFunctionCalled' && (
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Function Names <span className="text-zinc-600">(comma separated)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. set_admin, upgrade, migrate"
              value={draft.function_names?.join(', ') ?? ''}
              onChange={(e) =>
                updateDraft({
                  function_names: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}
        {warning && <p className="text-xs text-amber-400">{warning}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={addRule}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition-colors"
          >
            <svg c

/* … truncated 2751 chars — edit only what you need near the top … */
