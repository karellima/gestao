import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDueDaysInfo } from '../services/atraso';

const dateAtOffset = offset => {
  const date = new Date('2026-08-16T12:00:00');
  date.setDate(date.getDate() + offset);
  return date.toISOString();
};

describe('getDueDaysInfo', () => {
  afterEach(() => vi.useRealTimers());

  it('marks yesterday as overdue', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-16T09:00:00'));

    expect(getDueDaysInfo({ due_date: dateAtOffset(-1), status: 'pendente' })).toMatchObject({
      isOverdue: true,
      label: '1d atrasado',
    });
  });

  it('does not mark today as overdue and labels it 0d', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-16T09:00:00'));

    expect(getDueDaysInfo({ due_date: dateAtOffset(0), status: 'pendente' })).toMatchObject({
      isOverdue: false,
      label: '0d',
    });
  });

  it('marks three days as near and four days as outside the window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-16T09:00:00'));

    expect(getDueDaysInfo({ due_date: dateAtOffset(3), status: 'pendente' })).toMatchObject({
      isOverdue: false,
      cls: 'text-orange-700 bg-orange-100',
      label: '3d',
    });
    expect(getDueDaysInfo({ due_date: dateAtOffset(4), status: 'pendente' })).toBeNull();
  });

  it('ignores paid and received transactions even when overdue', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-16T09:00:00'));

    expect(getDueDaysInfo({ due_date: dateAtOffset(-1), status: 'pago' })).toBeNull();
    expect(getDueDaysInfo({ due_date: dateAtOffset(-1), status: 'recebido' })).toBeNull();
  });

  it('returns null without a due date', () => {
    expect(getDueDaysInfo({ status: 'pendente' })).toBeNull();
  });

  it('normalizes the boundary and accepts both date separators', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-16 01:00:00'));

    expect(getDueDaysInfo({ due_date: '2026-08-16T23:00:00', status: 'pendente' })).toMatchObject({
      isOverdue: false,
      label: '0d',
    });
    expect(getDueDaysInfo({ due_date: '2026-08-15T00:00:00', status: 'pendente' })).toEqual(
      getDueDaysInfo({ due_date: '2026-08-15 00:00:00', status: 'pendente' }),
    );
  });
});
