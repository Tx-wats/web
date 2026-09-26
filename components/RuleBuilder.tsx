'use client'

import { useState } from 'react'
import { AlertRule, AlertRuleType } from '@/types'
import { formatRuleSummary } from '@/lib/format'
import { getRuleMeta } from '@/lib/ruleMeta'
import AlertRuleBadge from './AlertRuleBadge'

const RULE_TYPES: AlertRuleType[] = [
  'AnyTransaction',
  'LargeTransfer',
  'FunctionCalled',
  'AdminFunctionCalled',
  'TransactionFailed',
]

/** XLM supports at most 7 decimal places (stroops). */
const MAX_XLM_DECIMALS = 7
/** Total XLM supply — a reasonable upper bound for a transfer threshold. */
const MAX_XLM_THRESHOLD = 50_000_000_000

/** Returns true when the value has no more than 7 decimal places. */
function hasValidPrecision(value: number): boolean {
  if (!isFinite(value)) return false
  const decimals = (String(value).split('.')[1] ?? '').length
  return decimals <= MAX_XLM_DECIMALS
}

/** Formats a number with thousands separators, preserving up to 7 decimals. */
function formatXlm(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: MAX_XLM_DECIMALS })
}

interface RuleBuilderProps {
  rules: AlertRule[]
  onChange: (rules: AlertRule[]) => void
  /** Optional callback fired whenever a rule is added, updated, or removed.
   *  Intended as an analytics hook point — no behavior depends on it. */
  onRulesChanged?: (rules: AlertRule[], action: 'add' | 'update' | 'remove') => void
}

const emptyRule = (): AlertRule => ({ type: 'AnyTransaction' })

function parseFunctionNames(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export default function RuleBuilder({ rules, onChange, onRulesChanged }: RuleBuilderProps) {
  const [draft, setDraft] = useState<AlertRule>(emptyRule())
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  // Raw text for the AdminFunctionCalled input so commas are not eaten while typing.
  const [functionNamesText, setFunctionNamesText] = useState('')
  // Raw text for the LargeTransfer threshold so values like "0.5" can be typed
  // without being coerced/cleared mid-edit. Parsed only on add.
  const [thresholdText, setThresholdText] = useState('')

  function updateDraft(patch: Partial<AlertRule>) {
    setDraft((prev) => ({ ...prev, ...patch }))
    setError(null)
    setWarning(null)
  }

  function handleTypeChange(type: AlertRuleType) {
    setDraft({ type })
    setFunctionNamesText('')
    setThresholdText('')
    setError(null)
    setWarning(null)
  }

  function isDuplicateLabel(newRule: AlertRule, ignoreIndex: number | null = null): boolean {
    return rules.some((rule, index) => {
      if (ignoreIndex !== null && index === ignoreIndex) return false
      if (newRule.type !== rule.type) return false
      if (newRule.type === 'LargeTransfer') return newRule.threshold_xlm === rule.threshold_xlm
      if (newRule.type === 'FunctionCalled') {
        return newRule.function_name?.trim() === rule.function_name?.trim()
      }
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
    let newRule: AlertRule = { ...draft }
    if (draft.type === 'LargeTransfer') {
      // Only an empty string is treated as undefined; otherwise parse the raw text.
      const parsed = thresholdText.trim() === '' ? undefined : parseFloat(thresholdText)
      if (parsed === undefined || isNaN(parsed)) {
        setError('Enter a valid XLM threshold')
        return
      }
      if (parsed <= 0) {
        setError('Threshold must be greater than 0')
        return
      }
      if (!hasValidPrecision(draft.threshold_xlm)) {
        setError('Threshold supports at most 7 decimal places')
        return
      }
      if (draft.threshold_xlm > MAX_XLM_THRESHOLD) {
        setError(`Threshold cannot exceed ${formatXlm(MAX_XLM_THRESHOLD)} XLM`)
        return
      }
      newRule = { ...newRule, threshold_xlm: parsed }
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
      const names = parseFunctionNames(functionNamesText)
      if (!names.length) {
        setError('Enter at least one function name')
        return
      }
      // Sort function names for consistency, building a new rule immutably.
      newRule = { ...newRule, function_names: [...names].sort() }
    }
    const newRule = { ...draft }
    if (newRule.type === 'FunctionCalled' && newRule.function_name) {
      newRule.function_name = newRule.function_name.trim()
    }
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
    setFunctionNamesText('')
    setThresholdText('')
    setError(null)
    setWarning(null)
  }

  function startEdit(index: number) {
    const rule = rules[index]
    setDraft(rule)
    setFunctionNamesText(rule.function_names?.join(', ') ?? '')
    setThresholdText(rule.threshold_xlm !== undefined ? String(rule.threshold_xlm) : '')
    setEditingIndex(index)
    setError(null)
  }

  function cancelEdit() {
    setDraft(emptyRule())
    setFunctionNamesText('')
    setThresholdText('')
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
              <option key={t} value={t}>{getRuleMeta(t).label}</option>
            ))}
          </select>
          <p className="text-xs text-zinc-500 mt-1">{getRuleMeta(draft.type).description}</p>
        </div>

        {draft.type === 'LargeTransfer' && (
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Threshold (XLM)</label>
            <input
              type="number"
              min="0"
              step="any"
              placeholder="e.g. 10000"
              value={thresholdText}
              onChange={(e) => {
                setThresholdText(e.target.value)
                setError(null)
                setWarning(null)
              }}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
            />
            {draft.threshold_xlm !== undefined && draft.threshold_xlm !== null && !isNaN(draft.threshold_xlm) && (
              <p className="text-xs text-zinc-500 mt-1">
                Threshold: {formatXlm(draft.threshold_xlm)} XLM
              </p>
            )}
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
              value={functionNamesText}
              onChange={(e) => {
                setFunctionNamesText(e.target.value)
                setError(null)
                setWarning(null)
              }}
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
            className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
          >
            className="px-3 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            <svg c

/* … truncated 2751 chars — edit only what you need near the top … */
            {editingIndex !== null ? 'Save Rule' : 'Add Rule'}
          </button>
          {editingIndex !== null && (
            <button
              type="button"
              onClick={cancelEdit}
              className="px-3 py-1.5 text-sm bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg transition-colors"
              className="px-3 py-2 text-sm rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-100"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {rules.length > 0 && (
        <ul className="space-y-2">
          {rules.map((rule, index) => (
            <li
              key={index}
              className="flex items-center justify-between bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <AlertRuleBadge rule={rule} />
                <span className="text-sm text-zinc-300 truncate">{formatRuleSummary(rule)}</span>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => startEdit(index)}
                  className="text-xs text-zinc-400 hover:text-zinc-100 transition-colors"
          {rules.map((rule, i) => (
            <li
              key={i}
              className="flex items-center justify-between bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <AlertRuleBadge type={rule.type} />
                <span className="text-sm text-zinc-300">{formatRuleSummary(rule)}</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(i)}
                  className="text-xs text-indigo-400 hover:text-indigo-300"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => removeRule(index)}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  onClick={() => removeRule(i)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
