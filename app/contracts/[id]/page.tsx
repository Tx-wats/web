'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { WatchedContract, AlertPayload, AlertRule } from '@/types'
import { getContract, getAlerts } from '@/lib/storage'
import { syncSaveContract, syncDeleteContract } from '@/lib/contractSync'
import { getContract, deleteContract, getAlerts, saveContract, seedMockAlerts } from '@/lib/storage'
import { truncateId, explorerContractUrl, isValidUrl } from '@/lib/stellar'
import { formatDate, formatRuleSummary } from '@/lib/format'
import { useAnalytics } from '@/lib/useAnalytics'
import NetworkBadge from '@/components/NetworkBadge'
import AlertRuleBadge from '@/components/AlertRuleBadge'
import WebhookLog from '@/components/WebhookLog'
import RuleBuilder from '@/components/RuleBuilder'
import CopyButton from '@/components/CopyButton'
import NotificationToggle from '@/components/NotificationToggle'
import Modal from '@/components/Modal'
import { notifyNewAlerts } from '@/lib/notifications'
import { useAlertSync } from '@/hooks/useAlertSync'

export default function ContractDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { trackEvent } = useAnalytics()
  const [contract, setContract] = useState<WatchedContract | null>(null)
  const [alerts, setAlerts] = useState<AlertPayload[]>([])
  const [mounted, setMounted] = useState(false)
  const [contractNotFound, setContractNotFound] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showEditRules, setShowEditRules] = useState(false)
  const [editedRules, setEditedRules] = useState<AlertRule[]>([])
  const [rulesError, setRulesError] = useState<string | null>(null)
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false)
  
  // Metadata editing state
  const [showEditMetadata, setShowEditMetadata] = useState(false)
  const [editedLabel, setEditedLabel] = useState('')
  const [editedWebhookUrl, setEditedWebhookUrl] = useState('')
  const [metadataError, setMetadataError] = useState<string | null>(null)

  const sync = useAlertSync(contract?.contract_id, contract?.network, (fresh) => {
    setAlerts(getAlerts(contract?.contract_id ?? params.id))
    notifyNewAlerts(fresh, contract?.label ?? params.id, `/contracts/${params.id}`)
  })

  useEffect(() => {
    const c = getContract(params.id)
    if (!c) { 
      setContractNotFound(true)
      setMounted(true)
      return 
    }
    setContract(c)
    setAlerts(getAlerts(params.id))
    setMounted(true)
  }, [params.id, router])

  function handleDelete() {
    void syncDeleteContract(params.id)
    router.push('/contracts')
  }

  function openEditRules() {
    setEditedRules(contract!.rules)
    setRulesError(null)
    setShowEditRules(true)
    trackEvent('rule_edit_opened', { contractId: params.id, ruleCount: contract!.rules.length })
  }

  function saveRules() {
    if (editedRules.length === 0) { setRulesError('Add at least one rule'); return }
    const updated = { ...contract!, rules: editedRules }
    void syncSaveContract(updated, false)
    if (!saveContract(updated)) {
      setRulesError('Could not save: browser storage is full or unavailable')
      return
    }
    setContract(updated)
    setShowEditRules(false)
    trackEvent('rule_edit_saved', { contractId: params.id, ruleCount: editedRules.length })
  }

  function hasUnsavedChanges(): boolean {
    return JSON.stringify(editedRules) !== JSON.stringify(contract?.rules ?? [])
  }

  function handleCancelEdit() {
    if (hasUnsavedChanges()) {
      setShowUnsavedWarning(true)
    } else {
      setShowEditRules(false)
    }
  }

  function confirmDiscard() {
    setShowUnsavedWarning(false)
    setShowEditRules(false)
  }

  // Metadata editing functions
  function openEditMetadata() {
    setEditedLabel(contract!.label)
    setEditedWebhookUrl(contract!.webhook_url)
    setMetadataError(null)
    setShowEditMetadata(true)
    trackEvent('metadata_edit_opened', { contractId: params.id })
  }

  function saveMetadata() {
    // Validation
    const trimmedLabel = editedLabel.trim()
    const trimmedWebhookUrl = editedWebhookUrl.trim()

    if (!trimmedLabel) {
      setMetadataError('Label is required')
      return
    }

    if (trimmedLabel.length > 100) {
      setMetadataError('Label must be 100 characters or less')
      return
    }

    if (!trimmedWebhookUrl) {
      setMetadataError('Webhook URL is required')
      return
    }

    if (!isValidUrl(trimmedWebhookUrl)) {
      setMetadataError('Please enter a valid HTTP or HTTPS URL')
      return
    }

    // Save changes
    const updated = { 
      ...contract!, 
      label: trimmedLabel,
      webhook_url: trimmedWebhookUrl
    }
    void syncSaveContract(updated, false)
    if (!saveContract(updated)) {
      setMetadataError('Could not save: browser storage is full or unavailable')
      return
    }
    setContract(updated)
    setShowEditMetadata(false)
    trackEvent('metadata_edit_saved', { contractId: params.id })
  }

  function hasMetadataChanges(): boolean {
    return editedLabel !== contract?.label || editedWebhookUrl !== contract?.webhook_url
  }

  function handleCancelMetadataEdit() {
    if (hasMetadataChanges()) {
      setShowUnsavedWarning(true)
    } else {
      setShowEditMetadata(false)
    }
  }

  if (!mounted) return null

  if (contractNotFound) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4 max-w-sm">
          <div className="flex justify-center">
            <svg className="w-16 h-16 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-zinc-100">Contract Not Found</h2>
          <p className="text-sm text-zinc-400">
            The contract you&apos;re looking for doesn&apos;t exist or has been deleted.
          </p>
          <button
            onClick={() => router.push('/contracts')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Contracts
          </button>
        </div>
      </div>
    )
  }

  if (!contract) return null

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-zinc-100">{contract.label}</h1>
            <NetworkBadge network={contract.network} />
          </div>
          <div className="flex items-center gap-2">
            <a
              href={explorerContractUrl(contract.network, contract.contract_id)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-mono text-indigo-400 hover:text-indigo-300 transition-colors break-all"
            >
              {truncateId(contract.contract_id, 12)}
            </a>
            <CopyButton text={contract.contract_id} />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <button
            onClick={openEditMetadata}
            className="px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500 text-sm text-zinc-300 hover:text-zinc-100 transition-colors"
          >
            Edit Details
          </button>
          <button
            onClick={openEditRules}
            className="px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500 text-sm text-zinc-300 hover:text-zinc-100 transition-colors"
          >
            Edit Rules
          </button>
          <button
            onClick={() => setShowDelete(true)}
            className="px-3 py-1.5 rounded-lg border border-red-900/60 hover:border-red-700 text-sm text-red-400 hover:text-red-300 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Edit Details Modal */}
      <Modal
        open={showEditMetadata}
        onClose={handleCancelMetadataEdit}
        title="Edit Details"
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="edit-label" className="block text-sm font-medium text-zinc-300">
              Label
            </label>
            <input
              id="edit-label"
              type="text"
              value={editedLabel}
              onChange={(e) => setEditedLabel(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-950 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="edit-webhook" className="block text-sm font-medium text-zinc-300">
              Webhook URL
            </label>
            <input
              id="edit-webhook"
              type="text"
              value={editedWebhookUrl}
              onChange={(e) => setEditedWebhookUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-950 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
          {metadataError && (
            <p className="text-sm text-red-400">{metadataError}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={handleCancelMetadataEdit}
              className="px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500 text-sm text-zinc-300 hover:text-zinc-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveMetadata}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Rules Modal */}
      <Modal
        open={showEditRules}
        onClose={handleCancelEdit}
        title="Edit Rules"
      >
        <div className="space-y-4">
          <RuleBuilder rules={editedRules} onChange={setEditedRules} />
          {rulesError && (
            <p className="text-sm text-red-400">{rulesError}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={handleCancelEdit}
              className="px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500 text-sm text-zinc-300 hover:text-zinc-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveRules}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </Modal>

      {/* Discard Changes Modal */}
      <Modal
        open={showUnsavedWarning}
        onClose={() => setShowUnsavedWarning(false)}
        title="Discard Changes?"
        destructive
      >
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            You have unsaved changes. Are you sure you want to discard them?
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowUnsavedWarning(false)}
              className="px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500 text-sm text-zinc-300 hover:text-zinc-100 transition-colors"
            >
              Keep Editing
            </button>
            <button
              onClick={confirmDiscard}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-medium text-white transition-colors"
            >
              Discard
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        title="Delete Contract"
        destructive
      >
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            Are you sure you want to delete <span className="font-medium text-zinc-200">{contract.label}</span>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowDelete(false)}
              className="px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500 text-sm text-zinc-300 hover:text-zinc-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-medium text-white transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>

      {/* Alerts */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">Alerts</h2>
          <NotificationToggle contractId={contract.contract_id} />
        </div>
        {alerts.length === 0 ? (
          <p className="text-sm text-zinc-500">No alerts yet.</p>
        ) : (
          <ul className="space-y-2">
            {alerts.map((a) => (
              <li key={a.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                <div className="flex items-center justify-between gap-2">
                  <AlertRuleBadge rule={a.rule} />
                  <span className="text-xs text-zinc-500">{formatDate(a.created_at)}</span>
                </div>
                <p className="mt-1 text-sm text-zinc-300">{formatRuleSummary(a.rule)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Webhook Log */}
      <WebhookLog contractId={contract.contract_id} />
    </div>
  )
}
