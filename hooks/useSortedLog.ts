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
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Date.parse(value);
  return NaN;
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
      if (isNaN(ta) || isNaN(tb)) return 0;
      return sortDirection === 'desc' ? tb - ta : ta - tb;
    });
  }, [entries, sortDirection, timestampKey]);

  const toggleSort = useCallback(() => {
    setSortDirection(prev => (prev === 'desc' ? 'asc' : 'desc'));
  }, []);

  return { sortedEntries, sortDirection, toggleSort, setSortDirection };
}
