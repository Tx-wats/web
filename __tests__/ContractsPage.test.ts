import { render, screen, act, fireEvent } from '@testing-library/react';
import ContractsPage from '../app/contracts/page';
import { getContracts } from '../lib/contracts';

jest.mock('../lib/contracts', () => ({
  getContracts: jest.fn(),
}));

const contractA = { id: 'a', name: 'Alpha', highlight: false };
const contractB = { id: 'b', name: 'Beta', highlight: true };

const makeContracts = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `c${i}`,
    name: `Contract ${i}`,
    highlight: false,
  }));

describe('ContractsPage cross-tab updates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getContracts as jest.Mock).mockReturnValue([contractA]);
  });

  it('renders the initial contracts list', () => {
    render(<ContractsPage />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('updates the list when a contract is added in another tab', () => {
    render(<ContractsPage />);
    expect(screen.queryByText('Beta')).not.toBeInTheDocument();

    (getContracts as jest.Mock).mockReturnValue([contractA, contractB]);
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'contracts' })
      );
    });

    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('updates the list when a contract is deleted in another tab', () => {
    (getContracts as jest.Mock).mockReturnValue([contractA, contractB]);
    render(<ContractsPage />);
    expect(screen.getByText('Beta')).toBeInTheDocument();

    (getContracts as jest.Mock).mockReturnValue([contractA]);
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'contracts' })
      );
    });

    expect(screen.queryByText('Beta')).not.toBeInTheDocument();
  });

  it('keeps the highlight logic working after a cross-tab update', () => {
    render(<ContractsPage />);

    (getContracts as jest.Mock).mockReturnValue([contractA, contractB]);
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'contracts' })
      );
    });

    expect(screen.getByText('Beta')).toHaveClass('highlight');
  });
});

describe('ContractsPage pagination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resets to page 1 when the sort changes', () => {
    (getContracts as jest.Mock).mockReturnValue(makeContracts(30));
    render(<ContractsPage />);

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText('Contract 10')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/sort/i), {
      target: { value: 'name' },
    });

    expect(screen.getByText('Contract 0')).toBeInTheDocument();
  });

  it('resets to page 1 when the view mode changes', () => {
    (getContracts as jest.Mock).mockReturnValue(makeContracts(30));
    render(<ContractsPage />);

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText('Contract 10')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /by network/i }));

    expect(screen.getByText('Contract 0')).toBeInTheDocument();
  });

  it('paginates the grouped By Network view', () => {
    (getContracts as jest.Mock).mockReturnValue(makeContracts(30));
    render(<ContractsPage />);

    fireEvent.click(screen.getByRole('button', { name: /by network/i }));

    expect(screen.getByText('Contract 0')).toBeInTheDocument();
    expect(screen.queryByText('Contract 10')).not.toBeInTheDocument();
  });

  it('shows the pager in the grouped By Network view', () => {
    (getContracts as jest.Mock).mockReturnValue(makeContracts(30));
    render(<ContractsPage />);

    fireEvent.click(screen.getByRole('button', { name: /by network/i }));

    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
  });
});

describe('ContractsPage network filter counts and heading', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const networkContracts = [
    { id: 'a', name: 'Alpha', highlight: false, network: 'mainnet' },
    { id: 'b', name: 'Beta', highlight: false, network: 'mainnet' },
    { id: 'c', name: 'Gamma', highlight: false, network: 'testnet' },
  ];

  it('computes network pill counts from the search-filtered set', () => {
    (getContracts as jest.Mock).mockReturnValue(networkContracts);
    render(<ContractsPage />);

    fireEvent.change(screen.getByLabelText(/search/i), {
      target: { value: 'Alpha' },
    });

    const mainnetPill = screen.getByRole('button', { name: /mainnet/i });
    const testnetPill = screen.getByRole('button', { name: /testnet/i });

    expect(mainnetPill).toHaveTextContent('1');
    expect(testnetPill).toHaveTextContent('0');
  });

  it('shows "Showing X of Y contracts" when a search filter is active', () => {
    (getContracts as jest.Mock).mockReturnValue(networkContracts);
    render(<ContractsPage />);

    fireEvent.change(screen.getByLabelText(/search/i), {
      target: { value: 'Alpha' },
    });

    expect(
      screen.getByText(/showing 1 of 3 contracts/i)
    ).toBeInTheDocument();
  });

  it('keeps the plain registered heading when no filter is active', () => {
    (getContracts as jest.Mock).mockReturnValue(networkContracts);
    render(<ContractsPage />);

    expect(screen.getByText(/3 registered/i)).toBeInTheDocument();
    expect(screen.queryByText(/showing/i)).not.toBeInTheDocument();
  });
});
