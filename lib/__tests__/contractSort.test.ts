import { sortContracts, SortOption, WatchedContract } from '../contractSort';

const make = (id: string, label: string, network: string): WatchedContract => ({
  id, label, network,
});

describe('sortContracts', () => {
  it('sorts mainnet before testnet', () => {
    const input = [make('2', 'Alpha', 'testnet'), make('1', 'Alpha', 'mainnet')];
    const sorted = sortContracts(input, 'network');
    expect(sorted[0].network).toBe('mainnet');
    expect(sorted[1].network).toBe('testnet');
  });

  it('sorts by label A–Z within same network', () => {
    const input = [make('2', 'Zebra', 'mainnet'), make('1', 'Apple', 'mainnet')];
    const sorted = sortContracts(input, 'label');
    expect(sorted[0].label).toBe('Apple');
    expect(sorted[1].label).toBe('Zebra');
  });

  it('label sort is case-insensitive', () => {
    const input = [make('2', 'beta', 'mainnet'), make('1', 'Alpha', 'mainnet')];
    const sorted = sortContracts(input, 'label');
    expect(sorted[0].label).toBe('Alpha');
  });

  it('uses id as tiebreaker for identical label + network', () => {
    const input = [make('z', 'Same', 'mainnet'), make('a', 'Same', 'mainnet')];
    const sorted = sortContracts(input, 'label');
    expect(sorted[0].id).toBe('a');
    expect(sorted[1].id).toBe('z');
  });

  it('does not mutate the input array', () => {
    const input = [make('2', 'B', 'mainnet'), make('1', 'A', 'mainnet')];
    const original = [...input];
    sortContracts(input, 'label');
    expect(input).toEqual(original);
  });

  it('returns empty array for empty input', () => {
    expect(sortContracts([], 'label')).toEqual([]);
  });

  it('returns single-element array unchanged', () => {
    const input = [make('1', 'Solo', 'mainnet')];
    expect(sortContracts(input, 'label')).toEqual(input);
  });

  it('is idempotent — sorting twice gives same result', () => {
    const input = [
      make('c', 'Charlie', 'testnet'),
      make('a', 'Alpha',   'mainnet'),
      make('b', 'Beta',    'mainnet'),
    ];
    const once  = sortContracts(input, 'label');
    const twice = sortContracts(once, 'label');
    expect(twice).toEqual(once);
  });

  it('supports the four sort options used by the page', () => {
    const options: SortOption[] = ['label', 'network', 'label-desc', 'network-desc'];
    const input = [
      make('c', 'Charlie', 'testnet'),
      make('a', 'Alpha',   'mainnet'),
      make('b', 'Beta',    'mainnet'),
    ];
    for (const option of options) {
      expect(sortContracts(input, option)).toHaveLength(input.length);
    }
  });
});
