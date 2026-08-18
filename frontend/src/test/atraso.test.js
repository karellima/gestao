import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAtrasoInfo } from '../services/atraso';

describe('getAtrasoInfo', () => {
  afterEach(() => vi.useRealTimers());

  it('labels yesterday as 1d atraso', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-16 09:00:00'));

    expect(getAtrasoInfo({ due_date: '2026-08-15 09:00:00' })).toEqual({ diff: 1, label: '1d atraso' });
  });

  it('labels today as hoje', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-16 09:00:00'));

    expect(getAtrasoInfo({ due_date: '2026-08-16 09:00:00' })).toEqual({ diff: 0, label: 'hoje' });
  });

  it('keeps a late-today due date as hoje when opened early', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-16 01:00:00'));

    expect(getAtrasoInfo({ due_date: '2026-08-16T23:00:00' })).toEqual({ diff: 0, label: 'hoje' });
  });

  it('labels a due date in three days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-16 09:00:00'));

    expect(getAtrasoInfo({ due_date: '2026-08-19 09:00:00' })).toEqual({ diff: -3, label: 'em 3d' });
  });

  it('treats a missing due date as today', () => {
    expect(getAtrasoInfo({})).toEqual({ diff: 0, label: 'hoje' });
  });

  it('preserves equivalent parsing for T and space separators', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-16 12:00:00'));

    expect(getAtrasoInfo({ due_date: '2026-08-10T00:00:00' })).toEqual(
      getAtrasoInfo({ due_date: '2026-08-10 00:00:00' }),
    );
  });
});
