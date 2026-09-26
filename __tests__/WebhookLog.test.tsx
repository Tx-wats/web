import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import WebhookLog from '@/components/WebhookLog'
import { AlertPayload } from '@/types'

const explorerTxUrl = vi.fn((network: string, hash: string) => `https://stellar.expert/explorer/${network}/tx/${hash}`)

vi.mock('@/lib/stellar', () => ({
  explorerTxUrl: (network: string, hash: string) => explorerTxUrl(network, hash),
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
  beforeEach(() => {
    explorerTxUrl.mockClear()
  })

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
    const link = screen.getByRole('link', { name: /abcdef12/ })
    expect(link).toHaveAttribute('href', expect.stringContaining(baseAlert.transaction_hash))
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('prefers the alert network over the contract network prop', () => {
    render(<WebhookLog alerts={[{ ...baseAlert, network: 'mainnet' }]} network="testnet" />)
    expect(explorerTxUrl).toHaveBeenCalledWith('mainnet', baseAlert.transaction_hash)
  })

  it('falls back to the contract network prop when alert network is invalid', () => {
    render(<WebhookLog alerts={[{ ...baseAlert, network: 'not-a-network' as AlertPayload['network'] }]} network="testnet" />)
    expect(explorerTxUrl).toHaveBeenCalledWith('testnet', baseAlert.transaction_hash)
  })

  it('renders a secondary Horizon link when horizon_link is provided', () => {
    render(<WebhookLog alerts={[baseAlert]} network="testnet" />)
    const horizon = screen.getByRole('link', { name: /horizon/i })
    expect(horizon).toHaveAttribute('href', baseAlert.horizon_link)
    expect(horizon).toHaveAttribute('target', '_blank')
  })

  it('does not render a Horizon link when horizon_link is missing', () => {
    render(<WebhookLog alerts={[{ ...baseAlert, horizon_link: undefined }]} network="testnet" />)
    expect(screen.queryByRole('link', { name: /horizon/i })).not.toBeInTheDocument()
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
})
