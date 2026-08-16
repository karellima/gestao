import { afterEach, describe, expect, it, vi } from 'vitest';
import { dueDaysInfo } from '../components/financeiro/dueDaysInfo';

const dateAtOffset = offset => {
  const date = new Date('2026-08-16T12:00:00');
  date.setDate(date.getDate() + offset);
  return date.toISOString();
};

describe('dueDaysInfo', () => {
  afterEach(() => vi.useRealTimers());

  it('marks yesterday as overdue', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-16T09:00:00'));

    expect(dueDaysInfo({ due_date: dateAtOffset(-1), status: 'pendente' })).toMatchObject({
      isOverdue: true,
      label: '1d atrasado',
    });
  });

  it('does not mark today as overdue and labels it 0d', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-16T09:00:00'));

    expect(dueDaysInfo({ due_date: dateAtOffset(0), status: 'pendente' })).toMatchObject({
      isOverdue: false,
      label: '0d',
    });
  });

  it('marks three days as near and four days as outside the window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-16T09:00:00'));

    expect(dueDaysInfo({ due_date: dateAtOffset(3), status: 'pendente' })).toMatchObject({
      isOverdue: false,
      cls: 'text-orange-700 bg-orange-100',
      label: '3d',
    });
    expect(dueDaysInfo({ due_date: dateAtOffset(4), status: 'pendente' })).toBeNull();
  });

  it('ignores paid and received transactions even when overdue', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-16T09:00:00'));

    expect(dueDaysInfo({ due_date: dateAtOffset(-1), status: 'pago' })).toBeNull();
    expect(dueDaysInfo({ due_date: dateAtOffset(-1), status: 'recebido' })).toBeNull();
  });

  it('returns null without a due date', () => {
    expect(dueDaysInfo({ status: 'pendente' })).toBeNull();
  });
});
