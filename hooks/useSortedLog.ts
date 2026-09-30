import { useState, useMemo, useCallback } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface SortableEntry {
  timestamp: string | number;
}

export interface UseSortedLogReturn<T extends SortableEntry> {
  sortedEntries: T[];
  sortDirection: SortDirection;
  toggleSort: () => void;
  setSortDirection: (dir: SortDirection) => void;
}

function toMillis(value: unknown): number {
  if (typeof value === 'number') return isNaN(value) ? -Infinity : value;
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return isNaN(ms) ? -Infinity : ms;
  }
  return -Infinity;
}

export function useSortedLog<T extends SortableEntry>(
  entries: T[],
  initialDir: SortDirection = 'desc',
  timestampKey: keyof T & string = 'timestamp',
): UseSortedLogReturn<T> {
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialDir);

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      const ta = toMillis(a[timestampKey]);
      const tb = toMillis(b[timestampKey]);
      // Entries with invalid timestamps always sink to the end regardless of direction
      if (ta === -Infinity && tb === -Infinity) return 0;
      if (ta === -Infinity) return 1;
      if (tb === -Infinity) return -1;
      return sortDirection === 'desc' ? tb - ta : ta - tb;
    });
  }, [entries, sortDirection, timestampKey]);

  const toggleSort = useCallback(() => {
    setSortDirection(prev => (prev === 'desc' ? 'asc' : 'desc'));
  }, []);

  return { sortedEntries, sortDirection, toggleSort, setSortDirection };
}
