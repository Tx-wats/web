import { render, screen, act } from '@testing-library/react';
import ContractsPage from '../app/contracts/page';
import { getContracts } from '../lib/contracts';

jest.mock('../lib/contracts', () => ({
  getContracts: jest.fn(),
}));

const contractA = { id: 'a', name: 'Alpha', highlight: false };
const contractB = { id: 'b', name: 'Beta', highlight: true };

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
