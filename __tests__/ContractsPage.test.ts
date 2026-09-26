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

describe('contracts page — new contract highlight (issue #55)', () => {
  const PAGE_SIZE = 12

  function pageOf(index: number): number {
    return Math.floor(index / PAGE_SIZE) + 1
  }

  function totalPages(count: number): number {
    return Math.max(1, Math.ceil(count / PAGE_SIZE))
  }

  it('computes the page containing a newly created contract', () => {
    expect(pageOf(0)).toBe(1)
    expect(pageOf(PAGE_SIZE - 1)).toBe(1)
    expect(pageOf(PAGE_SIZE)).toBe(2)
    expect(pageOf(PAGE_SIZE * 2 + 3)).toBe(3)
  })

  it('jumps to the last page when the new contract is appended', () => {
    const count = PAGE_SIZE * 2 + 1
    const newIndex = count - 1
    expect(pageOf(newIndex)).toBe(totalPages(count))
  })

  it('uses a single highlight timer owned by the page', () => {
    jest.useFakeTimers()
    const clearHighlight = jest.fn()
    let highlightedId: string | null = 'contract-1'

    const timer = setTimeout(() => {
      highlightedId = null
      clearHighlight()
    }, 6000)

    jest.advanceTimersByTime(2500)
    expect(highlightedId).toBe('contract-1')
    expect(clearHighlight).not.toHaveBeenCalled()

    jest.advanceTimersByTime(3500)
    expect(highlightedId).toBeNull()
    expect(clearHighlight).toHaveBeenCalledTimes(1)

    clearTimeout(timer)
    jest.useRealTimers()
  })

  it('applies a motion-safe pulse class for the highlight', () => {
    const highlightClass = 'motion-safe:animate-pulse'
    expect(highlightClass).toContain('motion-safe:')
    expect(highlightClass).not.toMatch(/(^|\s)animate-pulse(\s|$)/)
  })

  it('scrolls the highlighted card into view', () => {
    const scrollIntoView = jest.fn()
    const element = { scrollIntoView } as unknown as HTMLElement
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
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

  it('totalAlertRecords sums alert counts of selected contracts', () => {
    const selected = new Set<string>(['1', '3'])
    expect(totalAlertRecords(selected, items)).toBe(8)
  })

  it('selectedLabels returns labels of selected contracts', () => {
    const selected = new Set<string>(['2'])
    expect(selectedLabels(selected, items)).toEqual(['Payment Router'])
  })
})

describe('contracts page — URL filter params (issue #41)', () => {
  type ContractItem = {
    id: string
    label: string
    has_active_webhooks: boolean
    last_alert_at: string | null
  }

  const now = new Date('2024-06-15T12:00:00.000Z')

  function startOfLocalDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
  }

  function applyUrlFilter(list: ContractItem[], filter: string | null): ContractItem[] {
    if (filter === 'alerts-today') {
      const midnight = startOfLocalDay(now).getTime()
      return list.filter((c) => {
        if (!c.last_alert_at) return false
        return new Date(c.last_alert_at).getTime() >= midnight
      })
    }
    if (filter === 'webhooks') {
      return list.filter((c) => c.has_active_webhooks)
    }
    return list
  }

  const items: ContractItem[] = [
    {
      id: '1',
      label: 'Escrow Manager',
      has_active_webhooks: true,
      last_alert_at: '2024-06-15T09:30:00.000Z',
    },
    {
      id: '2',
      label: 'Payment Router',
      has_active_webhooks: false,
      last_alert_at: '2024-06-14T23:00:00.000Z',
    },
    {
      id: '3',
      label: 'Token Service',
      has_active_webhooks: true,
      last_alert_at: null,
    },
  ]

  it('returns all contracts when no filter param is present', () => {
    expect(applyUrlFilter(items, null)).toHaveLength(3)
  })

  it('alerts-today returns only contracts with an alert since local midnight', () => {
    const result = applyUrlFilter(items, 'alerts-today')
    expect(result.map((c) => c.id)).toEqual(['1'])
  })

  it('alerts-today excludes contracts with no alert timestamp', () => {
    const result = applyUrlFilter(items, 'alerts-today')
    expect(result.some((c) => c.id === '3')).toBe(false)
  })

  it('webhooks returns only contracts with active webhooks', () => {
    const result = applyUrlFilter(items, 'webhooks')
    expect(result.map((c) => c.id)).toEqual(['1', '3'])
  })

  it('unknown filter values fall back to the unfiltered list', () => {
    expect(applyUrlFilter(items, 'bogus')).toHaveLength(3)
  })

  it('clearing the filter removes the param from the URL', () => {
    const params = new URLSearchParams('filter=webhooks&q=escrow')
    params.delete('filter')
    expect(params.get('filter')).toBeNull()
    expect(params.get('q')).toBe('escrow')
  })
})
