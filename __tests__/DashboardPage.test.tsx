import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import DashboardPage from '../app/dashboard/page'
import * as storage from '../lib/storage'
import * as useContractsModule from '../lib/useContracts'

vi.mock('../lib/storage', () => ({
  getAlerts: vi.fn(() => []),
  getNetworkDistribution: vi.fn(() => ({})),
  onAlertsChange: vi.fn(() => () => {}),
}))

vi.mock('../lib/useContracts', () => ({
  useContracts: vi.fn(() => ({
    contracts: [],
    add: vi.fn(),
    remove: vi.fn(),
    update: vi.fn(),
    refresh: vi.fn(),
  })),
}))

describe('DashboardPage Rules of Hooks & Mounted state (#454)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders skeleton initially and transitions to mounted dashboard without hook count mismatch', async () => {
    render(<DashboardPage />)

    // Wait for the mounted state flip
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: 'Dashboard' })
      ).toBeInTheDocument()
    })

    expect(screen.getByText('Contracts Watched')).toBeInTheDocument()
    expect(screen.getByText('Alerts Today')).toBeInTheDocument()
  })
})
