'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertRule, Network, WatchedContract } from '@/types'
import { isValidContractId, isValidUrl, normalizeContractId, contractExists } from '@/lib/stellar'
import { syncSaveContract } from '@/lib/contractSync'
import { addContract, saveContract, getContracts } from '@/lib/storage'
import { generateWebhookSecret } from '@/lib/webhookSignature'
import { useFreighterConnection } from '@/lib/useFreighterConnection'
import RuleBuilder from '@/components/RuleBuilder'
import FreighterConnect from '@/components/FreighterConnect'
import Toast from '@/components/Toast'
import WebhookTestButton from '@/components/WebhookTestButton'

interface FormErrors {
  label?: string
  contract_id?: string
  webhook_url?: string
  rules?: string
  wallet?: string
  network?: string
}

export default function NewContractPage() {
  const router = useRouter()
  const { isConnected } = useFreighterConnection()
  const [networkWarning, setNetworkWarning] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [contractId, setContractId] = useState('')
  const [network, setNetwork] = useState<Network>('testnet')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [rules, setRules] = useState<AlertRule[]>([])
  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)
  const [isCheckingContract, setIsCheckingContract] = useState(false)
  const [contractNotFoundWarning, setContractNotFoundWarning] = useState<string | null>(null)
  const [overrideNotFound, setOverrideNotFound] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const labelInputRef = useRef<HTMLInputElement>(null)
  const contractIdInputRef = useRef<HTMLInputElement>(null)
  const webhookUrlInputRef = useRef<HTMLInputElement>(null)
  const rulesRef = useRef<HTMLDivElement>(null)

  // Pre-fill from a "Duplicate Contract" action. Data is passed via
  // sessionStorage (never the URL) so the webhook URL is not leaked.
  useEffect(() => {
    let raw: string | null = null
    try {
      raw = sessionStorage.getItem('txwatch_duplicate_contract')
      if (raw) sessionStorage.removeItem('txwatch_duplicate_contract')
    } catch {
      return
    }
    if (!raw) return
    try {
      const data = JSON.parse(raw) as {
        label?: string
        webhook_url?: string
        rules?: AlertRule[]
      }
      if (typeof data.label === 'string') setLabel(data.label)
      if (typeof data.webhook_url === 'string') setWebhookUrl(data.webhook_url)
      if (Array.isArray(data.rules)) setRules(data.rules)
    } catch {
      // ignore malformed pre-fill data
    }
  }, [])

  function handleWalletConnect() {
    setErrors((prev) => ({ ...prev, wallet: undefined }))
  }

  function validate(): FormErrors {
    const e: FormErrors = {}
    const trimmedLabel = label.trim()
    const trimmedContractId = contractId.trim()
    const trimmedWebhookUrl = webhookUrl.trim()

    if (!trimmedLabel) {
      e.label = 'Label is required'
    } else if (trimmedLabel.length > 100) {
      e.label = 'Label must be 100 characters or less'
    }

    if (!trimmedContractId) {
      e.contract_id = 'Contract ID is required'
    } else if (!isValidContractId(trimmedContractId)) {
      e.contract_id = 'Must be a valid Soroban contract address (starts with C, 56 chars)'
    } else {
      // Check for duplicate contract_id + network combination
      const isDuplicate = getContracts().some(
        (c) => c.contract_id === trimmedContractId && c.network === network
      )
      if (isDuplicate) {
        e.contract_id = `This contract is already registered on ${network}`
      }
    }

    if (!trimmedWebhookUrl) {
      e.webhook_url = 'Webhook URL is required'
    } else if (!isValidUrl(trimmedWebhookUrl)) {
      e.webhook_url = 'Must be a valid http/https URL'
    }

    if (rules.length === 0) {
      e.rules = 'Add at least one alert rule'
    }

    return e
  }

  function isFormValid(): boolean {
    return Object.keys(validate()).length === 0
  }

  async function checkContractOnNetwork(id: string, targetNetwork: Network): Promise<boolean> {
    if (!id || !isValidContractId(id)) {
      setContractNotFoundWarning(null)
      return true
    }
    setIsCheckingContract(true)
    try {
      const exists = await contractExists(targetNetwork, id)
      if (!exists) {
        setContractNotFoundWarning(`Contract not found on ${targetNetwork}`)
        return false
      } else {
        setContractNotFoundWarning(null)
        return true
      }
    } catch {
      setContractNotFoundWarning(null)
      return true
    } finally {
      setIsCheckingContract(false)
    }
  }

  function handleContractIdBlur() {
    const norm = normalizeContractId(contractId)
    let updatedId = contractId.trim()
    let targetNetwork = network
    if (norm.contractId && norm.contractId !== contractId) {
      updatedId = norm.contractId
      setContractId(updatedId)
    }
    if (norm.network && norm.network !== network) {
      targetNetwork = norm.network
      setNetwork(targetNetwork)
      checkNetworkMismatch(targetNetwork)
    }
    if (updatedId && isValidContractId(updatedId)) {
      void checkContractOnNetwork(updatedId, targetNetwork)
    }
  }

  function handleContractIdPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData('text')
    if (!pasted) return
    const norm = normalizeContractId(pasted)
    if (norm.contractId) {
      e.preventDefault()
      setContractId(norm.contractId)
      setErrors((prev) => ({ ...prev, contract_id: undefined }))
      let targetNetwork = network
      if (norm.network && norm.network !== network) {
        targetNetwork = norm.network
        setNetwork(targetNetwork)
        checkNetworkMismatch(targetNetwork)
      }
      if (isValidContractId(norm.contractId)) {
        void checkContractOnNetwork(norm.contractId, targetNetwork)
      }
    }
  }

  async function checkNetworkMismatch(selectedNetwork: Network) {
    if (!window.freighter) return
    try {
      const walletNetwork = await window.freighter.getNetwork()
      const networkMap: Record<string, string> = {
        testnet: 'TESTNET',
        mainnet: 'PUBLIC',
        futurenet: 'FUTURENET',
      }
      const expectedNetwork = networkMap[selectedNetwork]
      if (walletNetwork !== expectedNetwork) {
        setNetworkWarning(
          `Your wallet is on ${walletNetwork}, but this contract is on ${selectedNetwork.toUpperCase()}`
        )
      } else {
        setNetworkWarning(null)
      }
    } catch {
      setNetworkWarning(null)
    }
  }

  async function handleSave() {
    const e = validate()
    if (Object.keys(e).length > 0) {
      setErrors(e)
      if (e.label) {
        labelInputRef.current?.focus()
      } else if (e.contract_id) {
        contractIdInputRef.current?.focus()
      } else if (e.webhook_url) {
        webhookUrlInputRef.current?.focus()
      } else if (e.rules) {
        rulesRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
      return
    }

    if (!isConnected) {
      setErrors({ wallet: 'Connect your Freighter wallet to save contracts' })
      return
    }

    // If contract does not exist on network and user has not checked override, prevent saving and warn
    if (!overrideNotFound) {
      setIsCheckingContract(true)
      const exists = await contractExists(network, contractId.trim())
      setIsCheckingContract(false)
      if (!exists) {
        setContractNotFoundWarning(`Contract not found on ${network}`)
        return
      }
    }

    setSaving(true)
    const contract: WatchedContract = {
      id: crypto.randomUUID(),
      label: label.trim(),
      contract_id: contractId.trim(),
      network,
      rules,
      webhook_url: webhookUrl.trim(),
      created_at: Date.now(),
      updated_at: Date.now(),
    }
    await syncSaveContract(contract, true)
    addContract(contract)
    if (!saveContract(contract)) {
      setSaving(false)
      setToast({ message: 'Could not save contract: browser storage is full or unavailable.', type: 'error' })
      return
    }
    try {
      sessionStorage.setItem('txwatch_last_created_contract', contract.id)
    } catch {
      // ignore storage errors
    }
    setToast({ message: `Contract "${contract.label}" saved successfully!`, type: 'success' })
    setTimeout(() => {
      router.push(`/contracts/${contract.id}`)
    }, 1500)
  }

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Add Contract</h1>
          <p className="text-sm text-zinc-500 mt-1">Register a Soroban contract to monitor</p>
        </div>

        <div className="space-y-5">
          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Label</label>
            <input
              ref={labelInputRef}
              type="text"
              placeholder="e.g. My DEX Contract"
              value={label}
              onChange={(e) => { setLabel(e.target.value); setErrors((prev) => ({ ...prev, label: undefined })) }}
              maxLength={100}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <div className="flex justify-between items-start mt-1">
              <div>
                {errors.label && <p className="text-xs text-red-400">{errors.label}</p>}
              </div>
              <p className="text-xs text-zinc-500">{label.length}/100</p>
            </div>
          </div>

          {/* Contract ID */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Contract ID</label>
            <input
              ref={contractIdInputRef}
              type="text"
              placeholder="CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
              value={contractId}
              onChange={(e) => {
                setContractId(e.target.value)
                setErrors((prev) => ({ ...prev, contract_id: undefined }))
                setContractNotFoundWarning(null)
              }}
              onBlur={handleContractIdBlur}
              onPaste={handleContractIdPaste}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
            />
            {errors.contract_id && <p className="text-xs text-red-400 mt-1">{errors.contract_id}</p>}
            {isCheckingContract && (
              <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1.5" data-testid="contract-checking">
                <span className="inline-block w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                Verifying contract on {network}…
              </p>
            )}
            {contractNotFoundWarning && (
              <div className="mt-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300 space-y-2" data-testid="contract-not-found-warning">
                <p>⚠️ Contract not found on {network}. Deployments on other networks or invalid IDs produce zero alerts.</p>
                <label className="flex items-center gap-2 cursor-pointer text-amber-200">
                  <input
                    type="checkbox"
                    checked={overrideNotFound}
                    onChange={(e) => setOverrideNotFound(e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-900 text-indigo-600 focus:ring-0"
                    data-testid="override-not-found-checkbox"
                  />
                  <span>Register anyway (override network check)</span>
                </label>
              </div>
            )}
          </div>

          {/* Network */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Network</label>
            <select
              value={network}
              onChange={(e) => {
                const n = e.target.value as Network
                setNetwork(n)
                checkNetworkMismatch(n)
                setContractNotFoundWarning(null)
                if (isValidContractId(contractId.trim())) {
                  void checkContractOnNetwork(contractId.trim(), n)
                }
              }}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="testnet">Testnet</option>
              <option value="mainnet">Mainnet</option>
              <option value="futurenet">Futurenet</option>
            </select>
            {networkWarning && <p className="text-xs text-amber-400 mt-1">{networkWarning}</p>}
          </div>

          {/* Webhook URL */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Webhook URL</label>
            <input
              ref={webhookUrlInputRef}
              type="text"
              placeholder="https://example.com/webhook"
              value={webhookUrl}
              onChange={(e) => { setWebhookUrl(e.target.value); setErrors((prev) => ({ ...prev, webhook_url: undefined })) }}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            {errors.webhook_url && <p className="text-xs text-red-400 mt-1">{errors.webhook_url}</p>}
          </div>

          {/* Rules */}
          <div ref={rulesRef}>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Alert Rules</label>
            <RuleBuilder rules={rules} onChange={setRules} />
            {errors.rules && <p className="text-xs text-red-400 mt-1">{errors.rules}</p>}
          </div>

          {/* Wallet */}
          {!isConnected && (
            <div>
              <FreighterConnect onConnect={handleWalletConnect} />
              {errors.wallet && <p className="text-xs text-red-400 mt-1">{errors.wallet}</p>}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
            >
              {saving ? 'Saving…' : 'Save Contract'}
            </button>
            <WebhookTestButton
              webhookUrl={webhookUrl}
              contractId={contractId}
              network={network}
              webhookSecret={webhookSecret}
              onError={(field, message) => setErrors((prev) => ({ ...prev, [field]: message }))}
              className="mt-0"
            />
          </div>
        </div>
      </div>
    </>
  )
}
