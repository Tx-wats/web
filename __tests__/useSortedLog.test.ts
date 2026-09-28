import { renderHook, act } from '@testing-library/react';
import { useSortedLog } from '../hooks/useSortedLog';

const entries = [
  { timestamp: '2024-03-01T12:00:00Z', id: 'b' },
  { timestamp: '2024-03-03T12:00:00Z', id: 'c' },
  { timestamp: '2024-03-02T12:00:00Z', id: 'a' },
];

describe('useSortedLog', () => {
  it('defaults to descending (newest first)', () => {
    const { result } = renderHook(() => useSortedLog(entries));
    expect(result.current.sortedEntries.map(e => e.id)).toEqual(['c', 'a', 'b']);
  });

  it('sorts ascending when initialDir is asc', () => {
    const { result } = renderHook(() => useSortedLog(entries, 'asc'));
    expect(result.current.sortedEntries.map(e => e.id)).toEqual(['b', 'a', 'c']);
  });

  it('toggleSort flips direction', () => {
    const { result } = renderHook(() => useSortedLog(entries, 'desc'));
    act(() => result.current.toggleSort());
    expect(result.current.sortDirection).toBe('asc');
    expect(result.current.sortedEntries.map(e => e.id)).toEqual(['b', 'a', 'c']);
  });

  it('toggleSort flips back to desc', () => {
    const { result } = renderHook(() => useSortedLog(entries, 'asc'));
    act(() => result.current.toggleSort());
    expect(result.current.sortDirection).toBe('desc');
  });

  it('setSortDirection sets asc explicitly', () => {
    const { result } = renderHook(() => useSortedLog(entries));
    act(() => result.current.setSortDirection('asc'));
    expect(result.current.sortDirection).toBe('asc');
  });

  it('does not mutate original array', () => {
    const original = [...entries];
    const { result } = renderHook(() => useSortedLog(entries));
    act(() => result.current.toggleSort());
    expect(entries).toEqual(original);
  });

  it('handles empty entries gracefully', () => {
    const { result } = renderHook(() => useSortedLog([]));
    expect(result.current.sortedEntries).toEqual([]);
  });

  it('handles malformed timestamps without throwing', () => {
    const bad = [{ timestamp: 'not-a-date', id: 'x' }];
    const { result } = renderHook(() => useSortedLog(bad));
    expect(() => result.current.sortedEntries).not.toThrow();
  });

  it('sinks invalid timestamps to the end in descending order', () => {
    // invalid entry in the middle — valid entries must appear first, in correct order
    const mixed = [
      { timestamp: '2024-03-01T12:00:00Z', id: 'b' },
      { timestamp: 'invalid', id: 'bad' },
      { timestamp: '2024-03-03T12:00:00Z', id: 'c' },
    ];
    const { result } = renderHook(() => useSortedLog(mixed, 'desc'));
    expect(result.current.sortedEntries.map((e) => e.id)).toEqual(['c', 'b', 'bad']);
  });

  it('sinks invalid timestamps to the end in ascending order', () => {
    const mixed = [
      { timestamp: 'bad-date', id: 'bad' },
      { timestamp: '2024-03-03T12:00:00Z', id: 'c' },
      { timestamp: '2024-03-01T12:00:00Z', id: 'b' },
    ];
    const { result } = renderHook(() => useSortedLog(mixed, 'asc'));
    expect(result.current.sortedEntries.map((e) => e.id)).toEqual(['b', 'c', 'bad']);
  });

  it('keeps multiple invalid timestamps at the end, stable among themselves', () => {
    const mixed = [
      { timestamp: '2024-03-02T12:00:00Z', id: 'a' },
      { timestamp: 'bad1', id: 'x' },
      { timestamp: 'bad2', id: 'y' },
    ];
    const { result } = renderHook(() => useSortedLog(mixed, 'desc'));
    const ids = result.current.sortedEntries.map((e) => e.id);
    // valid entry first
    expect(ids[0]).toBe('a');
    // both invalid entries at the end (order among them doesn't matter)
    expect(ids.slice(1).sort()).toEqual(['x', 'y']);
  });
});
