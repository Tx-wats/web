import { vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import WebhookLog from '@/components/WebhookLog'
import { AlertPayload } from '@/types'

vi.mock('@/lib/stellar', () => ({
  explorerTxUrl: (_network: string, hash: string) => `https://stellar.expert/explorer/testnet/tx/${hash}`,
  // WebhookLog also calls truncateId; omitting it made every render throw.
  truncateId: (id: string, chars = 8) =>
    id.length <= chars * 2 + 3 ? id : `${id.slice(0, chars)}...${id.slice(-chars)}`,
}))

const baseAlert: AlertPayload = {
  label: 'Test Contract',
  contract_id: 'C123',
  network: 'testnet',
  rule_triggered: 'LargeTransfer',
  transaction_hash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  timestamp: new Date('2024-01-15T12:00:00Z').getTime(),
  horizon_link: 'https://horizon-testnet.stellar.org/transactions/abcdef',
}

describe('WebhookLog', () => {
  it('renders empty state when there are no alerts', () => {
    render(<WebhookLog alerts={[]} network="testnet" />)
    expect(screen.getByText('No alerts yet')).toBeInTheDocument()
  })

  it('renders alert rows when alerts are provided', () => {
    render(<WebhookLog alerts={[baseAlert]} network="testnet" />)
    expect(screen.getByText('Large Transfer')).toBeInTheDocument()
  })

  it('renders explorer link with shortened tx hash', () => {
    render(<WebhookLog alerts={[baseAlert]} network="testnet" />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', expect.stringContaining(baseAlert.transaction_hash))
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('renders timestamp', () => {
    render(<WebhookLog alerts={[baseAlert]} network="testnet" />)
    expect(screen.getByText(/2024|Jan|15/)).toBeInTheDocument()
  })

  it('shows N/A for missing function_name', () => {
    render(<WebhookLog alerts={[{ ...baseAlert, function_name: undefined }]} network="testnet" />)
    expect(screen.getAllByText('N/A').length).toBeGreaterThan(0)
  })

  it('shows function_name when present', () => {
    render(<WebhookLog alerts={[{ ...baseAlert, function_name: 'transfer' }]} network="testnet" />)
    expect(screen.getByText('transfer')).toBeInTheDocument()
  })

  it('shows N/A for missing amount', () => {
    render(<WebhookLog alerts={[{ ...baseAlert, amount: undefined }]} network="testnet" />)
    expect(screen.getAllByText('N/A').length).toBeGreaterThanOrEqual(1)
  })

  it('shows formatted amount when present', () => {
    render(<WebhookLog alerts={[{ ...baseAlert, amount: 100 }]} network="testnet" />)
    expect(screen.getByText('100 XLM')).toBeInTheDocument()
  })

  it('shows export CSV button', () => {
    render(<WebhookLog alerts={[baseAlert]} network="testnet" />)
    expect(screen.getByText('Export CSV')).toBeInTheDocument()
  })

  it('renders a copy button for the transaction hash', () => {
    render(<WebhookLog alerts={[baseAlert]} network="testnet" />)
    const copyBtn = screen.getByTitle('Copy to clipboard')
    expect(copyBtn).toBeInTheDocument()
  })

  it('opens the alert detail drawer when a row is clicked', () => {
    render(<WebhookLog alerts={[baseAlert]} network="testnet" />)
    fireEvent.click(screen.getByText('Large Transfer'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/Test Contract/)).toBeInTheDocument()
  })

  it('shows the full payload JSON in the drawer', () => {
    render(<WebhookLog alerts={[baseAlert]} network="testnet" />)
    fireEvent.click(screen.getByText('Large Transfer'))
    expect(screen.getByText(/horizon_link/)).toBeInTheDocument()
    expect(screen.getByText(/rule_triggered/)).toBeInTheDocument()
  })

  it('renders Copy JSON and Open in explorer actions in the drawer', () => {
    render(<WebhookLog alerts={[baseAlert]} network="testnet" />)
    fireEvent.click(screen.getByText('Large Transfer'))
    expect(screen.getByText('Copy JSON')).toBeInTheDocument()
    expect(screen.getByText('Open in explorer')).toBeInTheDocument()
  })

  it('closes the drawer when Escape is pressed', () => {
    render(<WebhookLog alerts={[baseAlert]} network="testnet" />)
    fireEvent.click(screen.getByText('Large Transfer'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
