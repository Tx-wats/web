import { AlertRuleType, isAlertRuleType } from '@/types'

export interface RuleMeta {
  label: string
  description: string
  style: string
}

export const RULE_META: Record<AlertRuleType, RuleMeta> = {
  AnyTransaction: {
    label: 'Any Transaction',
    description: 'Alert on every transaction',
    style: 'bg-zinc-700/50 text-zinc-300 border-zinc-600',
  },
  LargeTransfer: {
    label: 'Large Transfer',
    description: 'Alert when transfer amount exceeds threshold',
    style: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  },
  FunctionCalled: {
    label: 'Function Called',
    description: 'Alert when a specific function is called',
    style: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
  },
  AdminFunctionCalled: {
    label: 'Admin Function',
    description: 'Alert when admin functions are called',
    style: 'bg-red-500/10 text-red-400 border-red-500/30',
  },
  TransactionFailed: {
    label: 'Tx Failed',
    description: 'Alert on failed transactions',
    style: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  },
}

const UNKNOWN_STYLE = 'bg-zinc-800 text-zinc-400 border-zinc-600'

/** Returns metadata for a rule type, falling back to a neutral style and the raw string for unknown types. */
export function getRuleMeta(type: AlertRuleType | string): RuleMeta {
  if (isAlertRuleType(type)) return RULE_META[type]
  return { label: type || 'Unknown', description: `Unknown rule type: ${type || '(empty)'}`, style: UNKNOWN_STYLE }
}
