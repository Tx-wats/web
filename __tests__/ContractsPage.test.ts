/**
 * Tests for pagination logic used in the contracts page (issue #80)
 * and responsive filter bar behaviour (issue #81).
 */

const PAGE_SIZE = 12

function paginate<T>(items: T[], page: number): T[] {
  return items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
}

function totalPages(count: number): number {
  return Math.max(1, Math.ceil(count / PAGE_SIZE))
}

describe('contracts page — pagination (issue #80)', () => {
  it('returns first PAGE_SIZE items on page 1', () => {
    const items = Array.from({ length: 30 }, (_, i) => i)
    expect(paginate(items, 1)).toHaveLength(PAGE_SIZE)
    expect(paginate(items, 1)[0]).toBe(0)
  })

  it('returns correct slice on page 2', () => {
    const items = Array.from({ length: 30 }, (_, i) => i)
    const result = paginate(items, 2)
    expect(result).toHaveLength(PAGE_SIZE)
    expect(result[0]).toBe(PAGE_SIZE)
  })

  it('returns remaining items on last page', () => {
    const items = Array.from({ length: 25 }, (_, i) => i)
    const result = paginate(items, 3)
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(24)
  })

  it('totalPages is 1 for empty list', () => {
    expect(totalPages(0)).toBe(1)
  })

  it('totalPages is 1 when items fit on one page', () => {
    expect(totalPages(PAGE_SIZE)).toBe(1)
  })

  it('totalPages rounds up correctly', () => {
    expect(totalPages(PAGE_SIZE + 1)).toBe(2)
    expect(totalPages(PAGE_SIZE * 3)).toBe(3)
    expect(totalPages(PAGE_SIZE * 3 + 1)).toBe(4)
  })

  it('page 1 of a single-item list returns that item', () => {
    expect(paginate(['only'], 1)).toEqual(['only'])
  })
})

describe('contracts page — network filter (issue #81)', () => {
  type Item = { network: string }
  const items: Item[] = [
    { network: 'mainnet' },
    { network: 'mainnet' },
    { network: 'testnet' },
    { network: 'futurenet' },
  ]

  function applyFilter(list: Item[], filter: string): Item[] {
    if (filter === 'all') return list
    return list.filter((c) => c.network === filter)
  }

  it('all filter returns every item', () => {
    expect(applyFilter(items, 'all')).toHaveLength(4)
  })

  it('mainnet filter returns only mainnet items', () => {
    const result = applyFilter(items, 'mainnet')
    expect(result).toHaveLength(2)
    expect(result.every((c) => c.network === 'mainnet')).toBe(true)
  })

  it('testnet filter returns only testnet items', () => {
    const result = applyFilter(items, 'testnet')
    expect(result).toHaveLength(1)
    expect(result[0].network).toBe('testnet')
  })

  it('futurenet filter returns only futurenet items', () => {
    const result = applyFilter(items, 'futurenet')
    expect(result).toHaveLength(1)
    expect(result[0].network).toBe('futurenet')
  })

  it('filter with no matches returns empty array', () => {
    expect(applyFilter([], 'mainnet')).toHaveLength(0)
  })
})

describe('contracts page — search', () => {
  type ContractItem = { label: string; contract_id: string }
  const items: ContractItem[] = [
    { label: 'Escrow Manager', contract_id: 'ABC123' },
    { label: 'Payment Router', contract_id: 'DEF456' },
    { label: 'token service', contract_id: 'ghi789' },
  ]

  function applySearch(list: ContractItem[], query: string): ContractItem[] {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return list
    return list.filter((item) => {
      return (
        item.label.toLowerCase().includes(normalized) ||
        item.contract_id.toLowerCase().includes(normalized)
      )
    })
  }

  it('returns all contracts when search is empty', () => {
    expect(applySearch(items, '')).toHaveLength(3)
  })

  it('searches by label case-insensitively', () => {
    expect(applySearch(items, 'ESCROW')).toEqual([{ label: 'Escrow Manager', contract_id: 'ABC123' }])
  })

  it('searches by contract id substring', () => {
    expect(applySearch(items, '456')).toEqual([{ label: 'Payment Router', contract_id: 'DEF456' }])
  })

  it('returns no matches when search does not match any contract', () => {
    expect(applySearch(items, 'missing')).toHaveLength(0)
  })
})

describe('contracts page — bulk selection (issue #52)', () => {
  type ContractItem = { id: string; label: string; alert_count: number }

  const items: ContractItem[] = [
    { id: '1', label: 'Escrow Manager', alert_count: 3 },
    { id: '2', label: 'Payment Router', alert_count: 0 },
    { id: '3', label: 'Token Service', alert_count: 5 },
  ]

  function toggleSelection(selected: Set<string>, id: string): Set<string> {
    const next = new Set(selected)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    return next
  }

  function selectAll(list: ContractItem[]): Set<string> {
    return new Set(list.map((c) => c.id))
  }

  function isAllSelected(selected: Set<string>, list: ContractItem[]): boolean {
    return list.length > 0 && list.every((c) => selected.has(c.id))
  }

  function totalAlertRecords(selected: Set<string>, list: ContractItem[]): number {
    return list
      .filter((c) => selected.has(c.id))
      .reduce((sum, c) => sum + c.alert_count, 0)
  }

  function selectedLabels(selected: Set<string>, list: ContractItem[]): string[] {
    return list.filter((c) => selected.has(c.id)).map((c) => c.label)
  }

  it('starts with nothing selected', () => {
    expect(new Set<string>().size).toBe(0)
  })

  it('toggling an id adds it to the selection', () => {
    const selected = toggleSelection(new Set<string>(), '1')
    expect(selected.has('1')).toBe(true)
  })

  it('toggling a selected id removes it', () => {
    const selected = toggleSelection(new Set<string>(['1']), '1')
    expect(selected.has('1')).toBe(false)
  })

  it('select-all selects every contract in the current filter', () => {
    const selected = selectAll(items)
    expect(selected.size).toBe(3)
    expect(isAllSelected(selected, items)).toBe(true)
  })

  it('isAllSelected is false when only some are selected', () => {
    const selected = new Set<string>(['1'])
    expect(isAllSelected(selected, items)).toBe(false)
  })

  it('isAllSelected is false for an empty list', () => {
    expect(isAllSelected(new Set<string>(), [])).toBe(false)
  })

  it('sums alert records across selected contracts', () => {
    const selected = new Set<string>(['1', '3'])
    expect(totalAlertRecords(selected, items)).toBe(8)
  })

  it('total alert records is 0 when nothing is selected', () => {
    expect(totalAlertRecords(new Set<string>(), items)).toBe(0)
  })

  it('lists the labels of the selected contracts', () => {
    const selected = new Set<string>(['1', '3'])
    expect(selectedLabels(selected, items)).toEqual(['Escrow Manager', 'Token Service'])
  })

  it('selected labels are empty when nothing is selected', () => {
    expect(selectedLabels(new Set<string>(), items)).toEqual([])
describe('contracts page — view mode & sort preference persistence (issue #48)', () => {
  const PREFS_KEY = 'txwatch_prefs'
  type ViewMode = 'flat' | 'grouped'
  type SortBy = 'name' | 'recent'
  type Prefs = { viewMode: ViewMode; sortBy: SortBy }

  const DEFAULT_PREFS: Prefs = { viewMode: 'flat', sortBy: 'recent' }

  function createStorage(initial?: string) {
    const store = new Map<string, string>()
    if (initial !== undefined) store.set(PREFS_KEY, initial)
    return {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
    }
  }

  function readPrefs(storage: ReturnType<typeof createStorage>): Prefs {
    try {
      const raw = storage.getItem(PREFS_KEY)
      if (!raw) return { ...DEFAULT_PREFS }
      const parsed = JSON.parse(raw) as Partial<Prefs>
      return {
        viewMode: parsed.viewMode === 'grouped' ? 'grouped' : 'flat',
        sortBy: parsed.sortBy === 'name' ? 'name' : 'recent',
      }
    } catch {
      return { ...DEFAULT_PREFS }
    }
  }

  function writePrefs(storage: ReturnType<typeof createStorage>, prefs: Prefs): void {
    storage.setItem(PREFS_KEY, JSON.stringify(prefs))
  }

  function resolvePrefs(
    storage: ReturnType<typeof createStorage>,
    params: { view?: string | null; sort?: string | null },
  ): Prefs {
    const stored = readPrefs(storage)
    const viewMode: ViewMode =
      params.view === 'grouped' || params.view === 'flat' ? params.view : stored.viewMode
    const sortBy: SortBy =
      params.sort === 'name' || params.sort === 'recent' ? params.sort : stored.sortBy
    return { viewMode, sortBy }
  }

  it('returns defaults when nothing is stored', () => {
    expect(readPrefs(createStorage())).toEqual(DEFAULT_PREFS)
  })

  it('persists and restores viewMode and sortBy under txwatch_prefs', () => {
    const storage = createStorage()
    writePrefs(storage, { viewMode: 'grouped', sortBy: 'name' })
    expect(storage.getItem(PREFS_KEY)).toBe(JSON.stringify({ viewMode: 'grouped', sortBy: 'name' }))
    expect(readPrefs(storage)).toEqual({ viewMode: 'grouped', sortBy: 'name' })
  })

  it('falls back to defaults on malformed stored JSON', () => {
    expect(readPrefs(createStorage('{not json'))).toEqual(DEFAULT_PREFS)
  })

  it('ignores unknown stored values and keeps defaults', () => {
    const storage = createStorage(JSON.stringify({ viewMode: 'bogus', sortBy: 'bogus' }))
    expect(readPrefs(storage)).toEqual(DEFAULT_PREFS)
  })

  it('uses stored prefs when no URL params are present', () => {
    const storage = createStorage(JSON.stringify({ viewMode: 'grouped', sortBy: 'name' }))
    expect(resolvePrefs(storage, { view: null, sort: null })).toEqual({
      viewMode: 'grouped',
      sortBy: 'name',
    })
  })

  it('URL params take precedence over stored prefs', () => {
    const storage = createStorage(JSON.stringify({ viewMode: 'grouped', sortBy: 'name' }))
    expect(resolvePrefs(storage, { view: 'flat', sort: 'recent' })).toEqual({
      viewMode: 'flat',
      sortBy: 'recent',
    })
  })

  it('URL params override only the values they specify', () => {
    const storage = createStorage(JSON.stringify({ viewMode: 'grouped', sortBy: 'name' }))
    expect(resolvePrefs(storage, { view: 'flat', sort: null })).toEqual({
      viewMode: 'flat',
      sortBy: 'name',
    })
  })

  it('ignores invalid URL params and falls back to stored prefs', () => {
    const storage = createStorage(JSON.stringify({ viewMode: 'grouped', sortBy: 'name' }))
    expect(resolvePrefs(storage, { view: 'bogus', sort: 'bogus' })).toEqual({
      viewMode: 'grouped',
      sortBy: 'name',
    })
  })
})
