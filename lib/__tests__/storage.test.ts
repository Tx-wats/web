import type { AlertPayload, WatchedContract } from '@/types'
import {
  saveContract,
  deleteContract,
  getContracts,
  addAlert,
  getAlerts,
  getLatestAlert,
  deleteAlert,
  seedMockAlerts,
  addContract,
  DuplicateContractError,
} from '../storage';
import { onStorageError, clearStorageErrorHandlers } from '../storageLogger';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem:   (key: string) => store[key] ?? null,
    setItem:   (key: string, value: string) => { store[key] = value; },
    removeItem:(key: string) => { delete store[key]; },
    clear:     () => { store = {}; },
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Fixtures previously used an `address` field that WatchedContract does not
// have, and omitted every required one.
const contract1: WatchedContract = {
  id: 'c1',
  label: 'Contract Alpha',
  contract_id: 'CDSO4GGZH7KBUQYKOIQDCMCFSRYEPOVDUX7Z4IB5TWNTLT2GDRKDQOYR',
  network: 'mainnet',
  rules: [],
  webhook_url: 'https://hooks.example.com/alpha',
  created_at: 1,
  updated_at: 1,
};
const contract2: WatchedContract = {
  id: 'c2',
  label: 'Contract Beta',
  contract_id: 'CCSHRYACRNVSLC5NP3V2DL6LGID57TQT2TJXVUVXBBZX6SED6N3F7X6J',
  network: 'testnet',
  rules: [],
  webhook_url: 'https://hooks.example.com/beta',
  created_at: 2,
  updated_at: 2,
};

const alert1: AlertPayload & { id?: string; contractId?: string } = {
  id: 'a1',
  contractId: 'c1',
  label: 'Contract Alpha',
  contract_id: 'c1',
  network: 'testnet',
  rule_triggered: 'LargeTransfer',
  transaction_hash: 'tx1',
  timestamp: 1,
  horizon_link: 'https://horizon-testnet.stellar.org/transactions/tx1',
};
const alert2: AlertPayload & { id?: string; contractId?: string } = {
  id: 'a2',
  contractId: 'c1',
  label: 'Contract Alpha',
  contract_id: 'c1',
  network: 'testnet',
  rule_triggered: 'FunctionCalled',
  transaction_hash: 'tx2',
  timestamp: 2,
  horizon_link: 'https://horizon-testnet.stellar.org/transactions/tx2',
};
const alert3: AlertPayload & { id?: string; contractId?: string } = {
  id: 'a3',
  contractId: 'c1',
  label: 'Contract Alpha',
  contract_id: 'c1',
  network: 'testnet',
  rule_triggered: 'AnyTransaction',
  transaction_hash: 'tx3',
  timestamp: 3,
  horizon_link: 'https://horizon-testnet.stellar.org/transactions/tx3',
};

beforeEach(() => localStorageMock.clear());

describe('saveContract / getContracts', () => {
  it('saves a contract and retrieves it', () => {
    saveContract(contract1);
    const contracts = getContracts();
    expect(contracts).toHaveLength(1);
    expect(contracts[0].id).toBe('c1');
  });

  it('retrieves multiple saved contracts', () => {
    saveContract(contract1);
    saveContract(contract2);
    expect(getContracts()).toHaveLength(2);
  });

  it('returns empty array when no contracts saved (empty fallback)', () => {
    expect(getContracts()).toEqual([]);
  });
});

describe('deleteContract', () => {
  it('removes the correct contract by id', () => {
    saveContract(contract1);
    saveContract(contract2);
    deleteContract('c1');
    const remaining = getContracts();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('c2');
  });

  it('is a no-op when deleting a non-existent id', () => {
    saveContract(contract1);
    deleteContract('does-not-exist');
    expect(getContracts()).toHaveLength(1);
  });

  it('results in empty array after deleting the only contract', () => {
    saveContract(contract1);
    deleteContract('c1');
    expect(getContracts()).toEqual([]);
  });
});

describe('duplicate contract handling', () => {
  it('does not create a duplicate when saving the same id twice', () => {
    saveContract(contract1);
    saveContract({ ...contract1, label: 'Updated Label' });
    const contracts = getContracts();
    expect(contracts).toHaveLength(1);
  });

  it('updates the existing entry when saving a duplicate id', () => {
    saveContract(contract1);
    saveContract({ ...contract1, label: 'Updated Label' });
    expect(getContracts()[0].label).toBe('Updated Label');
  });
});

describe('addAlert / getAlerts — newest-first ordering', () => {
  it('returns alerts sorted newest-first by timestamp', () => {
    addAlert(alert1);
    addAlert(alert2);
    addAlert(alert3);
    const alerts = getAlerts('c1');
    expect(alerts.map((a) => (a as { id?: string }).id)).toEqual(['a3', 'a2', 'a1']);
  });

  it('sorts out-of-order timestamps newest-first', () => {
    addAlert(alert2);
    addAlert(alert3);
    addAlert(alert1);
    const alerts = getAlerts('c1');
    expect(alerts.map((a) => a.timestamp)).toEqual([3, 2, 1]);
  });

  it('returns empty array when no alerts exist for a contract (empty fallback)', () => {
    expect(getAlerts('no-such-contract')).toEqual([]);
  });
});

describe('getLatestAlert', () => {
  it('returns the alert with the maximum timestamp regardless of insertion order', () => {
    addAlert(alert2);
    addAlert(alert1);
    addAlert(alert3);
    const latest = getLatestAlert('c1');
    expect((latest as { id?: string }).id).toBe('a3');
    expect(latest?.timestamp).toBe(3);
  });

  it('returns undefined when no alerts exist for a contract', () => {
    expect(getLatestAlert('no-such-contract')).toBeUndefined();
  });
});

describe('deleteAlert', () => {
  it('removes only the specified alert', () => {
    addAlert(alert1);
    addAlert(alert2);
    deleteAlert('a1');
    const alerts = getAlerts('c1');
    expect(alerts).toHaveLength(1);
    expect((alerts[0] as { id?: string }).id).toBe('a2');
  });
});

describe('alert retention pruning', () => {
  const DAY = 24 * 60 * 60 * 1000
  const alert = (age: number) => ({
    label: 'a', contract_id: 'CX', network: 'testnet', rule_triggered: 'AnyTransaction',
    transaction_hash: `h${age}`, timestamp: Date.now() - age * DAY, horizon_link: '',
  })

  it('prunes on addAlert without any contract save', async () => {
    const s = await import('../storage')
    localStorage.setItem('txwatch_alerts', JSON.stringify([alert(100)]))
    s.addAlert(alert(1))
    expect(s.getAlerts('CX')).toHaveLength(1)
  })

  it('honours configurable retention', async () => {
    const s = await import('../storage')
    localStorage.setItem('txwatch_alerts', JSON.stringify([alert(10), alert(1)]))
    s.setRetentionDays(5)
    expect(s.getRetentionDays()).toBe(5)
    expect(s.getAlerts('CX')).toHaveLength(1)
  })
})
describe('seedMockAlerts', () => {
  it('uses the network Horizon host, 64-hex hashes, and chronological order', () => {
    seedMockAlerts('c1', 'futurenet', 3);
    const alerts = getAlerts('c1');
    expect(alerts).toHaveLength(3);
    for (const a of alerts) {
      expect(a.transaction_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(a.horizon_link.startsWith('https://horizon-futurenet.stellar.org/')).toBe(true);
    }
    expect(alerts[0].timestamp).toBeGreaterThan(alerts[2].timestamp);
  });

  it('respects the per-contract alert cap', () => {
    seedMockAlerts('c1', 'testnet', 600);
    expect(getAlerts('c1')).toHaveLength(500);
  });
});

describe('addContract', () => {
  it('adds a new contract', () => {
    addContract(contract1);
    expect(getContracts()).toHaveLength(1);
  });

  it('rejects the same contract_id on the same network with a typed error', () => {
    addContract(contract1);
    expect(() => addContract({ ...contract1, id: 'other' })).toThrow(DuplicateContractError);
    expect(getContracts()).toHaveLength(1);
  });

  it('allows the same contract_id on a different network', () => {
    addContract(contract1);
    addContract({ ...contract1, id: 'other', network: 'testnet' });
    expect(getContracts()).toHaveLength(2);
  });

  it('leaves saveContract usable for updates by id', () => {
    addContract(contract1);
    saveContract({ ...contract1, label: 'Renamed' });
    expect(getContracts()).toHaveLength(1);
    expect(getContracts()[0].label).toBe('Renamed');
  });
});

describe('corrupted storage', () => {
  it('triggers the registered storage error handler and returns []', () => {
    const keys: string[] = [];
    onStorageError((ctx) => keys.push(ctx.key));
    localStorage.setItem('txwatch_contracts', '{broken');
    expect(getContracts()).toEqual([]);
    expect(keys).toEqual(['txwatch_contracts']);
    clearStorageErrorHandlers();
  });
});

describe('quota handling', () => {
  const realSet = localStorageMock.setItem;
  afterEach(() => { localStorageMock.setItem = realSet; });

  function quotaError() {
    const e = new Error('full');
    e.name = 'QuotaExceededError';
    return e;
  }

  it('returns false instead of throwing when storage always fails', () => {
    localStorageMock.setItem = () => { throw quotaError(); };
    expect(saveContract(contract1)).toBe(false);
  });
});
