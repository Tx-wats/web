'use client'

import { useState } from 'react'
import { getContracts, saveContract, deleteContract } from '@/lib/storage'
import {
  buildSnapshot,
  parseImport,
  planImport,
  type DuplicateStrategy,
  type ImportMode,
  type ImportParseResult,
} from '@/lib/importSchema'

export default function ContractImportExport() {
  const [parsed, setParsed] = useState<ImportParseResult | null>(null)
  const [mode, setMode] = useState<ImportMode>('merge')
  const [dupes, setDupes] = useState<DuplicateStrategy>('skip')
  const [message, setMessage] = useState<string | null>(null)

  function handleExport() {
    const json = JSON.stringify(buildSnapshot(getContracts()), null, 2)
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'txwatch-contracts.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    setMessage(null)
    setParsed(null)
    if (!file) return
    try {
      setParsed(parseImport(await file.text()))
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not read file')
    }
  }

  const plan = parsed ? planImport(getContracts(), parsed.contracts, mode, dupes) : null

  function handleApply() {
    if (!plan) return
    // Replace: remove contracts not being re-saved under the same id.
    const keep = new Set(plan.toSave.map((c) => c.id))
    plan.toDeleteIds.filter((id) => !keep.has(id)).forEach(deleteContract)
    plan.toSave.forEach(saveContract)
    setMessage(`Imported ${plan.toSave.length} contract(s).`)
    setParsed(null)
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Backup &amp; restore</h2>
      <button onClick={handleExport} className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm">
        Export contracts
      </button>
      <div>
        <label className="block text-sm text-zinc-400 mb-1" htmlFor="import-file">
          Import contracts
        </label>
        <input id="import-file" type="file" accept="application/json,.json" onChange={handleFile} />
      </div>

      {parsed && plan && (
        <div className="rounded border border-zinc-800 p-4 space-y-3 text-sm" data-testid="import-preview">
          <p>
            {parsed.contracts.length} valid, {parsed.errors.length} invalid,{' '}
            {plan.duplicates.length} duplicate.
          </p>
          {parsed.errors.length > 0 && (
            <ul className="text-red-400 list-disc pl-5">
              {parsed.errors.map((er) => (
                <li key={er.index}>
                  Entry {er.index + 1}: {er.message}
                </li>
              ))}
            </ul>
          )}
          <label className="block">
            Mode{' '}
            <select value={mode} onChange={(e) => setMode(e.target.value as ImportMode)} className="bg-zinc-900">
              <option value="merge">Merge with existing</option>
              <option value="replace">Replace all existing</option>
            </select>
          </label>
          {mode === 'merge' && (
            <label className="block">
              Duplicates{' '}
              <select value={dupes} onChange={(e) => setDupes(e.target.value as DuplicateStrategy)} className="bg-zinc-900">
                <option value="skip">Skip</option>
                <option value="overwrite">Overwrite</option>
              </select>
            </label>
          )}
          <button
            onClick={handleApply}
            disabled={plan.toSave.length === 0 && plan.toDeleteIds.length === 0}
            className="px-3 py-1.5 rounded bg-indigo-600 text-white disabled:opacity-50"
          >
            Apply import
          </button>
        </div>
      )}
      {message && <p role="status" className="text-sm text-zinc-300">{message}</p>}
    </section>
  )
}
