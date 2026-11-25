'use client'

import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react'
import { AlertRule, AlertRuleType, isRuleEnabled } from '@/types'
import { formatRuleAccessibleName, formatRuleSummary } from '@/lib/format'
import { isValidContractId } from '@/lib/stellar'
import { formatRuleSummary } from '@/lib/format'
import { MAX_XLM_DECIMALS, validateThreshold } from '@/lib/formatAmount'
import { getRuleMeta } from '@/lib/ruleMeta'
import { findOverlappingRule } from '@/lib/ruleOverlap'
import { isValidFunctionName, sanitizeAdminFunctionNames } from '@/lib/soroban'
import { MAX_RULES_PER_CONTRACT } from '@/lib/storage'
import AlertRuleBadge from './AlertRuleBadge'

const RULE_TYPES: AlertRuleType[] = [
  'AnyTransaction',
  'LargeTransfer',
  'FunctionCalled',
  'AdminFunctionCalled',
  'TransactionFailed',
]

/** Common Soroban patterns that add one or more rules in a single click. */
const RULE_PRESETS: { name: string; rules: AlertRule[] }[] = [
  {
    name: 'Token transfers',
    rules: [{ type: 'FunctionCalled', function_name: 'transfer' }],
  },
  {
    name: 'Mint & burn',
    rules: [
      { type: 'FunctionCalled', function_name: 'mint' },
      { type: 'FunctionCalled', function_name: 'burn' },
    ],
  },
  {
    name: 'Admin & upgrades',
    rules: [
      { type: 'AdminFunctionCalled', function_names: ['set_admin', 'upgrade'] },
    ],
  },
  {
    name: 'All failures',
    rules: [{ type: 'TransactionFailed' }],
  },
]

/** Formats a number with thousands separators, preserving up to 7 decimals. */
function formatXlm(value: number): string {
  return value.toLocaleString('en-US', {
    maximumFractionDigits: MAX_XLM_DECIMALS,
  })
}

/** Plain decimal string (no exponent notation) with trailing zeros trimmed. */
function plainDecimal(value: number): string {
  const fixed = value.toFixed(MAX_XLM_DECIMALS)
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed
}

function parseFunctionNames(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Key identifying a rule's configuration, ignoring the enabled flag.
 *
 * Soroban function names are case-sensitive symbols, so "transfer" and
 * "Transfer" are distinct rules. No case normalization is applied here —
 * the caller is responsible for using the exact casing from the contract.
 */
function ruleKey(rule: AlertRule): string {
  switch (rule.type) {
    case 'LargeTransfer':
      return `${rule.type}:${rule.threshold_xlm}:${rule.asset?.trim() ?? 'XLM'}`
    case 'FunctionCalled':
      return `${rule.type}:${rule.function_name.trim()}`
    case 'AdminFunctionCalled':
      return `${rule.type}:${[...rule.function_names].sort().join(',')}`
    case 'AnyTransaction':
    case 'TransactionFailed':
      return rule.type
  }
}

interface RuleBuilderProps {
  rules: AlertRule[]
  onChange: (rules: AlertRule[]) => void
  /** Optional callback fired whenever a rule is added, updated, or removed.
   *  Intended as an analytics hook point — no behavior depends on it. */
  onRulesChanged?: (
    rules: AlertRule[],
    action: 'add' | 'update' | 'remove'
  ) => void
}

export default function RuleBuilder({
  rules,
  onChange,
  onRulesChanged,
}: RuleBuilderProps) {
  const idPrefix = useId()
  // Draft fields are held as raw text per type, so switching type never leaves stale fields.
  const [draftType, setDraftType] = useState<AlertRuleType>('AnyTransaction')
  const [thresholdText, setThresholdText] = useState('')
  const [assetText, setAssetText] = useState('XLM')
  const [decimalsText, setDecimalsText] = useState('')
  const [functionName, setFunctionName] = useState('')
  const [functionNamesText, setFunctionNamesText] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [showPresets, setShowPresets] = useState(false)
  const thresholdInputRef = useRef<HTMLInputElement>(null)
  const functionNameInputRef = useRef<HTMLInputElement>(null)
  const functionNamesInputRef = useRef<HTMLInputElement>(null)
  const presetsButtonRef = useRef<HTMLButtonElement>(null)
  const presetsContainerRef = useRef<HTMLDivElement>(null)
  const presetItemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const messageId = `${idPrefix}-message`
  const typeHintId = `${idPrefix}-type-hint`
  const thresholdHintId = `${idPrefix}-threshold-hint`
  const errorId = `${idPrefix}-error`
  const warningId = `${idPrefix}-warning`
  const hasThresholdHint = !isNaN(parseFloat(thresholdText))
  const thresholdDescribedBy = [error ? errorId : null, hasThresholdHint ? thresholdHintId : null].filter(Boolean).join(' ')
  const thresholdDescribedBy = [error ? errorId : null, thresholdHintId]
    .filter(Boolean)
    .join(' ')
  const functionNameDescribedBy = error ? errorId : undefined
  const functionNamesDescribedBy = error ? errorId : undefined
  const typeDescribedBy = [error ? errorId : null, typeHintId]
    .filter(Boolean)
    .join(' ')

  useEffect(() => {
    if (!showPresets) return

    presetItemRefs.current[0]?.focus()

    function handlePointerDown(event: PointerEvent) {
      if (!presetsContainerRef.current?.contains(event.target as Node)) {
        setShowPresets(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [showPresets])

  function clearMessages() {
    setError(null)
    setWarning(null)
  }

  function resetDraft() {
    setDraftType('AnyTransaction')
    setThresholdText('')
    setAssetText('XLM')
    setDecimalsText('')
    setFunctionName('')
    setFunctionNamesText('')
    clearMessages()
  }

  function handleTypeChange(type: AlertRuleType) {
    setDraftType(type)
    setThresholdText('')
    setAssetText('XLM')
    setDecimalsText('')
    setFunctionName('')
    setFunctionNamesText('')
    clearMessages()
  }

  function isDuplicate(
    newRule: AlertRule,
    existing: AlertRule[],
    ignoreIndex: number | null = null
  ): boolean {
    const key = ruleKey(newRule)
    return existing.some(
      (rule, index) => index !== ignoreIndex && ruleKey(rule) === key
    )
  }

  /** Builds a rule from the draft, or sets an error and returns null. */
  function buildRule(): AlertRule | null {
    switch (draftType) {
      case 'LargeTransfer': {
        // Validate the raw text: a parsed number loses precision information.
        const result = validateThreshold(thresholdText)
        if (!result.ok) {
          setError(result.error)
          return null
        }
        const asset = assetText.trim()
        if (!asset || asset.toUpperCase() === 'XLM') {
          return { type: 'LargeTransfer', threshold_xlm: result.value }
        }
        if (!/^[A-Za-z0-9]{1,12}$/.test(asset) && !isValidContractId(asset)) {
          setError(
            'Asset must be a code (1-12 letters/digits) or a token contract ID'
          )
          return null
        }
        const decimals =
          decimalsText.trim() === '' ? undefined : Number(decimalsText)
        if (
          decimals !== undefined &&
          (!Number.isInteger(decimals) || decimals < 0 || decimals > 18)
        ) {
          setError('Decimals must be a whole number from 0 to 18')
          return null
        }
        return {
          type: 'LargeTransfer',
          threshold_xlm: result.value,
          asset,
          ...(decimals !== undefined ? { decimals } : {}),
        }
      }
      case 'FunctionCalled': {
        const name = functionName.trim()
        if (!name) {
          setError('Enter a function name')
          return null
        }
        if (!isValidFunctionName(name)) {
          setError(
            'Function name must start with a letter or underscore, contain only alphanumeric characters and underscores, and be at most 32 characters'
          )
          return null
        }
        return { type: 'FunctionCalled', function_name: name }
      }
      case 'AdminFunctionCalled': {
        const names = parseFunctionNames(functionNamesText)
        if (!names.length) {
          setError('Enter at least one function name')
          return null
        }
        const { valid, invalid } = sanitizeAdminFunctionNames(names)
        if (invalid.length) {
          setError(`Invalid function names: ${invalid.join(', ')}`)
          return null
        }
        // Build a local copy and sort it — never mutates the source array or any draft state.
        const sortedNames = [...valid].sort()
        return {
          type: 'AdminFunctionCalled',
          function_names: sortedNames,
        }
      }
      case 'AnyTransaction':
      case 'TransactionFailed':
        return { type: draftType }
    }
  }

  function addRule() {
    const built = buildRule()
    if (!built) {
      if (draftType === 'LargeTransfer') thresholdInputRef.current?.focus()
      if (draftType === 'FunctionCalled') functionNameInputRef.current?.focus()
      if (draftType === 'AdminFunctionCalled')
        functionNamesInputRef.current?.focus()
      return
    }
    const overlap = findOverlappingRule(built, rules, editingIndex)
    if (editingIndex !== null) {
      if (isDuplicate(built, rules, editingIndex)) {
        setWarning('This rule already exists')
        return
      }
      const previous = rules[editingIndex]
      const newRule: AlertRule =
        previous.enabled === undefined
          ? built
          : { ...built, enabled: previous.enabled }
      const updated = [...rules]
      updated[editingIndex] = newRule
      onChange(updated)
      onRulesChanged?.(updated, 'update')
      setEditingIndex(null)
    } else {
      if (rules.length >= MAX_RULES_PER_CONTRACT) {
        setError(
          `Maximum of ${MAX_RULES_PER_CONTRACT} rules per contract. Remove some rules before adding more.`
        )
        return
      }
      if (isDuplicate(built, rules)) {
        setWarning('This rule already exists')
        return
      }
      const updated = [...rules, built]
      onChange(updated)
      onRulesChanged?.(updated, 'add')
    }
    resetDraft()
    // Non-blocking: the rule is saved, but tell the user it overlaps another (#446)
    if (overlap) {
      setWarning(
        `Added, but this overlaps with existing rule "${[getRuleMeta(overlap.type).label, formatRuleSummary(overlap)].filter(Boolean).join(': ')}" - the same transaction may trigger both alerts`
      )
    }
  }

  function applyPreset(presetRules: AlertRule[]) {
    setShowPresets(false)
    presetsButtonRef.current?.focus()
    clearMessages()
    const toAdd: AlertRule[] = []
    for (const rule of presetRules) {
      if (!isDuplicate(rule, [...rules, ...toAdd])) toAdd.push(rule)
    }
    if (!toAdd.length) {
      setWarning('These rules already exist')
      return
    }
    if (rules.length + toAdd.length > MAX_RULES_PER_CONTRACT) {
      setError(
        `Maximum of ${MAX_RULES_PER_CONTRACT} rules per contract. This preset would add ${toAdd.length} rule(s), exceeding the limit.`
      )
      return
    }
    const updated = [...rules, ...toAdd]
    onChange(updated)
    onRulesChanged?.(updated, 'add')
  }

  function startEdit(index: number) {
    const rule = rules[index]
    setDraftType(rule.type)
    setThresholdText(
      rule.type === 'LargeTransfer' ? plainDecimal(rule.threshold_xlm) : ''
    )
    setAssetText(rule.type === 'LargeTransfer' ? (rule.asset ?? 'XLM') : 'XLM')
    setDecimalsText(
      rule.type === 'LargeTransfer' && rule.decimals !== undefined
        ? String(rule.decimals)
        : ''
    )
    setFunctionName(rule.type === 'FunctionCalled' ? rule.function_name : '')
    setFunctionNamesText(
      rule.type === 'AdminFunctionCalled' ? rule.function_names.join(', ') : ''
    )
    setEditingIndex(index)
    clearMessages()
  }

  function cancelEdit() {
    resetDraft()
    setEditingIndex(null)
  }

  function toggleRule(index: number) {
    const updated = rules.map((r, i) =>
      i === index ? { ...r, enabled: !isRuleEnabled(r) } : r
    )
    onChange(updated)
    onRulesChanged?.(updated, 'update')
  }

  function removeRule(index: number) {
    const updated = rules.filter((_, i) => i !== index)
    onChange(updated)
    onRulesChanged?.(updated, 'remove')
    // Keep editingIndex pointing at the same logical rule after removal.
    // Removing the edited rule itself cancels the edit to avoid a stale index.
    if (editingIndex === null) return
    if (editingIndex === index) cancelEdit()
    else if (editingIndex > index) setEditingIndex(editingIndex - 1)
  }

  function closePresetsAndReturnFocus() {
    setShowPresets(false)
    presetsButtonRef.current?.focus()
  }

  function handlePresetKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const currentIndex = presetItemRefs.current.findIndex(
      (item) => item === document.activeElement
    )
    let nextIndex: number | null = null

    switch (event.key) {
      case 'ArrowDown':
        nextIndex = (currentIndex + 1) % RULE_PRESETS.length
        break
      case 'ArrowUp':
        nextIndex =
          (currentIndex - 1 + RULE_PRESETS.length) % RULE_PRESETS.length
        break
      case 'Home':
        nextIndex = 0
        break
      case 'End':
        nextIndex = RULE_PRESETS.length - 1
        break
      case 'Escape':
        event.preventDefault()
        closePresetsAndReturnFocus()
        return
      default:
        return
    }

    event.preventDefault()
    presetItemRefs.current[nextIndex]?.focus()
  }

  const thresholdPreview = parseFloat(thresholdText)

  return (
    <div className="space-y-4">
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 space-y-3">
        <div>
          <label
            htmlFor={`${idPrefix}-type`}
            className="block text-xs font-medium text-zinc-400 mb-1"
          >
            Rule Type
          </label>
          <select
            id={`${idPrefix}-type`}
            value={draftType}
            aria-invalid={error ? true : undefined}
            aria-describedby={typeDescribedBy}
            onChange={(e) => handleTypeChange(e.target.value as AlertRuleType)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
          >
            {RULE_TYPES.map((t) => (
              <option key={t} value={t}>
                {getRuleMeta(t).label}
              </option>
            ))}
          </select>
          <p id={typeHintId} className="text-xs text-zinc-500 mt-1">{getRuleMeta(draftType).description}</p>
          <p id={typeHintId} className="text-xs text-zinc-500 mt-1">
            {getRuleMeta(draftType).description}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            {getRuleMeta(draftType).description}
          </p>
        </div>

        {draftType === 'LargeTransfer' && (
          <div>
            <label
              htmlFor={`${idPrefix}-threshold`}
              className="block text-xs font-medium text-zinc-400 mb-1"
            >
              Threshold ({assetText.trim() || 'XLM'})
            </label>
            <input
              ref={thresholdInputRef}
              id={`${idPrefix}-threshold`}
              type="number"
              min="0"
              step="any"
              placeholder="e.g. 10000"
              value={thresholdText}
              aria-invalid={error ? true : undefined}
              aria-describedby={thresholdDescribedBy}
              onChange={(e) => {
                setThresholdText(e.target.value)
                clearMessages()
              }}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
            />
            {hasThresholdHint && (
              <p id={thresholdHintId} className="text-xs text-zinc-500 mt-1">
                Threshold: {formatXlm(thresholdPreview)}{' '}
                {assetText.trim() || 'XLM'}
              </p>
            )}
            <label
              htmlFor={`${idPrefix}-asset`}
              className="block text-xs font-medium text-zinc-400 mt-2 mb-1"
            >
              Asset
            </label>
            <input
              id={`${idPrefix}-asset`}
              type="text"
              list={`${idPrefix}-asset-options`}
              placeholder="XLM, USDC, or token contract ID"
              value={assetText}
              onChange={(e) => {
                setAssetText(e.target.value)
                clearMessages()
              }}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
            />
            <datalist id={`${idPrefix}-asset-options`}>
              <option value="XLM" />
              <option value="USDC" />
            </datalist>
            {assetText.trim() && assetText.trim().toUpperCase() !== 'XLM' && (
              <input
                aria-label="Asset decimals"
                type="number"
                min="0"
                max="18"
                step="1"
                placeholder="Decimals (optional, e.g. 7)"
                value={decimalsText}
                onChange={(e) => {
                  setDecimalsText(e.target.value)
                  clearMessages()
                }}
                className="mt-2 w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
              />
            )}
          </div>
        )}

        {draftType === 'FunctionCalled' && (
          <div>
            <label
              htmlFor={`${idPrefix}-function-name`}
              className="block text-xs font-medium text-zinc-400 mb-1"
            >
              Function Name
            </label>
            <input
              ref={functionNameInputRef}
              id={`${idPrefix}-function-name`}
              type="text"
              placeholder="e.g. transfer"
              value={functionName}
              aria-invalid={error ? true : undefined}
              aria-describedby={functionNameDescribedBy}
              onChange={(e) => {
                setFunctionName(e.target.value)
                clearMessages()
              }}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}

        {draftType === 'AdminFunctionCalled' && (
          <div>
            <label
              htmlFor={`${idPrefix}-function-names`}
              className="block text-xs font-medium text-zinc-400 mb-1"
            >
              Function Names{' '}
              <span className="text-zinc-600">(comma separated)</span>
            </label>
            <input
              ref={functionNamesInputRef}
              id={`${idPrefix}-function-names`}
              type="text"
              placeholder="e.g. set_admin, upgrade, migrate"
              value={functionNamesText}
              aria-invalid={error ? true : undefined}
              aria-describedby={functionNamesDescribedBy}
              onChange={(e) => {
                setFunctionNamesText(e.target.value)
                clearMessages()
              }}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}

        <div id={messageId} aria-live="polite" aria-atomic="true">
          {error && (
            <p id={errorId} className="text-xs text-red-400">
              {error}
            </p>
          )}
          {warning && (
            <p id={warningId} className="text-xs text-amber-400">
              {warning}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={addRule}
            className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
          >
            {editingIndex !== null ? 'Save Rule' : 'Add Rule'}
          </button>
          {editingIndex !== null && (
            <button
              type="button"
              onClick={cancelEdit}
              className="px-3 py-1.5 text-sm bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
          )}
          <div ref={presetsContainerRef} className="relative">
            <button
              ref={presetsButtonRef}
              type="button"
              id={`${idPrefix}-presets-trigger`}
              aria-haspopup="menu"
              aria-controls={`${idPrefix}-presets-menu`}
              aria-expanded={showPresets}
              onClick={() => setShowPresets((v) => !v)}
              className="px-3 py-1.5 text-sm bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg transition-colors"
            >
              Presets
            </button>
            {showPresets && (
              <ul
                id={`${idPrefix}-presets-menu`}
                role="menu"
                aria-labelledby={`${idPrefix}-presets-trigger`}
                onKeyDown={handlePresetKeyDown}
                className="absolute left-0 mt-1 w-48 bg-zinc-900 border border-zinc-700 rounded-lg py-1 z-10"
              >
                {RULE_PRESETS.map((preset, index) => (
                  <li key={preset.name}>
                    <button
                      ref={(element) => {
                        presetItemRefs.current[index] = element
                      }}
                      type="button"
                      role="menuitem"
                      onClick={() => applyPreset(preset.rules)}
                      className="w-full text-left px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800"
                    >
                      {preset.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {rules.length > 0 && (
        <ul className="space-y-2">
          {rules.map((rule, index) => {
            const enabled = isRuleEnabled(rule)
            return (
              <li
                key={index}
                className={`flex items-center justify-between bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 ${enabled ? '' : 'opacity-50'}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <AlertRuleBadge type={rule.type} />
                  <span className="text-sm text-zinc-300 truncate">
                    {formatRuleSummary(rule)}
                  </span>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    aria-label={`${enabled ? 'Disable' : 'Enable'} ${formatRuleAccessibleName(rule)}`}
                    onClick={() => toggleRule(index)}
                    className="text-xs text-zinc-400 hover:text-zinc-100 transition-colors"
                  >
                    {enabled ? 'On' : 'Off'}
                  </button>
                  <button
                    type="button"
                    aria-label={`Edit ${formatRuleAccessibleName(rule)}`}
                    onClick={() => startEdit(index)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${formatRuleAccessibleName(rule)}`}
                    onClick={() => removeRule(index)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
