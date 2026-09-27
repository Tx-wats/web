import type { AlertPayload, WatchedContract } from '@/types'
import {
  saveContract,
  deleteContract,
  getContracts,
  addAlert,
  getAlerts,
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

describe('corrupted / non-array storage values', () => {
  const cases: Array<[string, string]> = [
    ['object', '{}'],
    ['string', '"x"'],
    ['number', '42'],
    ['null', 'null'],
  ];

  for (const [name, raw] of cases) {
    it(`returns [] for a stored ${name} value`, () => {
      localStorage.setItem('txwatch_contracts', raw);
      expect(getContracts()).toEqual([]);
    });
  }

  it('drops array entries that fail the minimal shape check', () => {
    localStorage.setItem(
      'txwatch_contracts',
      JSON.stringify([contract1, { id: 'bad' }, null, 'nope', 7]),
    );
    const contracts = getContracts();
    expect(contracts).toHaveLength(1);
    expect(contracts[0].id).toBe('c1');
  });

  it('reports corrupted and dropped entries via storageLogger', () => {
    const events: unknown[] = [];
    const off = onStorageError((e) => events.push(e));
    localStorage.setItem('txwatch_contracts', '{}');
    getContracts();
    localStorage.setItem('txwatch_contracts', JSON.stringify([contract1, { id: 'bad' }]));
    getContracts();
    off();
    clearStorageErrorHandlers();
    expect(events.length).toBeGreaterThan(0);
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

describe('addAlert / getAlerts — insertion order', () => {
  it('returns alerts in insertion order', () => {
    addAlert(alert1);
    addAlert(alert2);
    addAlert(alert3);
    const alerts = getAlerts('c1', 'testnet');
    expect(alerts.map((a) => (a as { id?: string }).id)).toEqual(['a1', 'a2', 'a3']);
  });

  it('returns empty array when no alerts exist for a contract (empty fallback)', () => {
    expect(getAlerts('no-such-contract', 'testnet')).toEqual([]);
  });
});

describe('deleteAlert', () => {
  it('removes only the specified alert', () => {
    addAlert(alert1);
    addAlert(alert2);
    deleteAlert('a1');
    const alerts = getAlerts('c1', 'testnet');
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
    expect(s.getAlerts('CX', 'testnet')).toHaveLength(1)
  })

  it('honours configurable retention', async () => {
    const s = await import('../storage')
    localStorage.setItem('txwatch_alerts', JSON.stringify([alert(10), alert(1)]))
    s.setRetentionDays(5)
    expect(s.getRetentionDays()).toBe(5)
    expect(s.getAlerts('CX', 'testnet')).toHaveLength(1)
  })
})

describe('per-contract alert cap', () => {
  const makeAlert = (i: number) => ({
    label: 'a', contract_id: 'CX', network: 'testnet', rule_triggered: 'AnyTransaction',
    transaction_hash: `h${i}`, timestamp: i, horizon_link: '',
  })

  it('keeps the newest 500 alerts and drops the oldest when the cap is exceeded', () => {
    for (let i = 1; i <= 501; i++) addAlert(makeAlert(i))
    const alerts = getAlerts('CX', 'testnet')
    expect(alerts).toHaveLength(500)
    expect(alerts.some((a) => a.transaction_hash === 'h501')).toBe(true)
    expect(alerts.some((a) => a.transaction_hash === 'h1')).toBe(false)
  })
})

describe('seedMockAlerts', () => {
  it('uses the network Horizon host, 64-hex hashes, and chronological order', () => {
    seedMockAlerts('c1', 'futurenet', 3);
    const alerts = getAlerts('c1', 'futurenet');
    expect(alerts).toHaveLength(3);
    for (const a of alerts) {
      expect(a.transaction_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(a.horizon_link.startsWith('https://horizon-futurenet.stellar.org/')).toBe(true);
    }
    expect(alerts[0].timestamp).toBeLessThan(alerts[2].timestamp);
  });

  it('respects the per-contract alert cap', () => {
    seedMockAlerts('c1', 'testnet', 600);
    expect(getAlerts('c1', 'testnet')).toHaveLength(500);
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

describe('alerts keyed by (contract_id, network)', () => {
  const 

/* … truncated 1606 chars — edit only what you need near the top … */
