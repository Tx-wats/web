'use client'

import { useState } from 'react'

export function maskWebhookUrl(url: string): string {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    const segments = parsed.pathname.split('/').filter(Boolean)
    const last = segments.length > 0 ? segments[segments.length - 1] : ''
    const maskedPath = last ? `${parsed.pathname.slice(0, parsed.pathname.length - last.length)}****` : parsed.pathname
    return `${parsed.origin}${maskedPath}${parsed.search ? '?****' : ''}`
  } catch {
    return url.replace(/[^/]+$/, '****')
  }
}

export default function CopyButton({ text, className = '' }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      onClick={copy}
      title="Copy to clipboard"
      className={`text-zinc-500 hover:text-zinc-300 transition-colors ${className}`}
    >
      {copied ? (
        <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  )
}
