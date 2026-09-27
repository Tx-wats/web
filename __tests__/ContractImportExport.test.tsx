import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ContractImportExport from '@/components/ContractImportExport'
import { getContracts } from '@/lib/storage'

const CID = 'C' + 'A'.repeat(55)
const entry = (over = {}) => ({
  id: 'i1', label: 'A', contract_id: CID, network: 'testnet',
  rules: [{ type: 'AnyTransaction' }], webhook_url: 'https://e.com/h',
  created_at: 1, updated_at: 1, ...over,
})

function upload(json: string) {
  const file = new File([json], 'x.json', { type: 'application/json' })
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(json) })
  fireEvent.change(screen.getByLabelText('Import contracts'), { target: { files: [file] } })
}

beforeEach(() => localStorage.clear())

describe('ContractImportExport', () => {
  it('previews and imports valid entries, listing invalid ones', async () => {
    render(<ContractImportExport />)
    upload(JSON.stringify({ version: 1, contracts: [entry(), { bad: true }] }))
    expect(await screen.findByTestId('import-preview')).toHaveTextContent('1 valid, 1 invalid')
    fireEvent.click(screen.getByText('Apply import'))
    await waitFor(() => expect(getContracts()).toHaveLength(1))
  })

  it('shows an error for malformed files', async () => {
    render(<ContractImportExport />)
    upload('{')
    expect(await screen.findByRole('status')).toHaveTextContent('Invalid JSON')
  })

  it('exports a CSV named txwatch-{label}-{network}-{YYYY-MM-DD}.csv with ISO-8601 UTC timestamps and network/contract columns', async () => {
    const createObjectURL = jest.fn(() => 'blob:mock')
    const revokeObjectURL = jest.fn()
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true })

    let capturedBlob: Blob | undefined
    createObjectURL.mockImplementation((blob: Blob) => {
      capturedBlob = blob
      return 'blob:mock'
    })

    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})

    render(<ContractImportExport />)
    upload(JSON.stringify({ version: 1, contracts: [entry()] }))
    fireEvent.click(await screen.findByText('Apply import'))
    await waitFor(() => expect(getContracts()).toHaveLength(1))

    fireEvent.click(screen.getByText('Export CSV'))

    const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement
    const today = new Date().toISOString().slice(0, 10)
    expect(anchor.download).toBe(`txwatch-A-testnet-${today}.csv`)

    // URL must not be revoked synchronously after click()
    expect(revokeObjectURL).not.toHaveBeenCalled()

    const text = await capturedBlob!.text()
    const [header, row] = text.trim().split('\n')
    expect(header).toContain('network')
    expect(header).toContain('contract_id')
    expect(row).toContain('testnet')
    expect(row).toContain(CID)
    expect(row).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z/)

    clickSpy.mockRestore()
  })
})
