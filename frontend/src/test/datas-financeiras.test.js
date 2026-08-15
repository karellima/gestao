import { describe, expect, it } from 'vitest';
import {
  autoCalcDueDate,
  calcInstallmentDates,
} from '../pages/financeiro/datas-financeiras';

describe('autoCalcDueDate', () => {
  it('keeps the same month when purchase is on or before closing day', () => {
    expect(autoCalcDueDate('2026-03-10', 15, 5)).toBe('2026-03-05');
  });

  it('rolls to next month when purchase is after closing day', () => {
    expect(autoCalcDueDate('2026-03-20', 15, 5)).toBe('2026-04-05');
  });

  it('truncates due day to last day of month when due day does not exist', () => {
    expect(autoCalcDueDate('2026-04-10', 20, 31)).toBe('2026-04-30');
  });

  it('returns transaction date unchanged without closing_day', () => {
    expect(autoCalcDueDate('2026-03-10', null, 5)).toBe('2026-03-10');
    expect(autoCalcDueDate('2026-03-10', undefined, 5)).toBe('2026-03-10');
    expect(autoCalcDueDate('2026-03-10', 0, 5)).toBe('2026-03-10');
  });

  it('returns transaction date unchanged without due_day', () => {
    expect(autoCalcDueDate('2026-03-10', 15, null)).toBe('2026-03-10');
    expect(autoCalcDueDate('2026-03-10', 15, undefined)).toBe('2026-03-10');
    expect(autoCalcDueDate('2026-03-10', 15, 0)).toBe('2026-03-10');
  });
});

describe('calcInstallmentDates', () => {
  it('builds monthly installment dates from the first installment', () => {
    const dates = calcInstallmentDates('2026-01-15', 3, 'mensal', 1);
    expect(dates).toHaveLength(3);
    expect(dates[1].getMonth()).toBe((dates[0].getMonth() + 1) % 12);
    expect(dates[2].getMonth()).toBe((dates[0].getMonth() + 2) % 12);
  });

  it('builds weekly installment dates', () => {
    const dates = calcInstallmentDates('2026-01-05', 3, 'semanal', 1);
    expect(dates).toHaveLength(3);
    expect(dates[1] - dates[0]).toBe(7 * 24 * 60 * 60 * 1000);
    expect(dates[2] - dates[0]).toBe(14 * 24 * 60 * 60 * 1000);
  });

  it('builds biweekly installment dates', () => {
    const dates = calcInstallmentDates('2026-01-05', 3, 'quinzenal', 1);
    expect(dates).toHaveLength(3);
    expect(dates[1] - dates[0]).toBe(15 * 24 * 60 * 60 * 1000);
    expect(dates[2] - dates[0]).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('starts from a later installment index', () => {
    const fromStart = calcInstallmentDates('2026-01-15', 4, 'mensal', 1);
    const fromSecond = calcInstallmentDates('2026-01-15', 4, 'mensal', 2);
    expect(fromSecond).toHaveLength(3);
    expect(fromSecond).toHaveLength(fromStart.length - 1);
    expect(fromSecond[0].getTime()).toBe(fromStart[0].getTime());
    expect(fromSecond[1].getTime()).toBe(fromStart[1].getTime());
  });

  it('returns empty list without frequency', () => {
    expect(calcInstallmentDates('2026-01-15', 3, '', 1)).toEqual([]);
    expect(calcInstallmentDates('2026-01-15', 3, null, 1)).toEqual([]);
  });

  it('returns empty list when total is 1 or less', () => {
    expect(calcInstallmentDates('2026-01-15', 1, 'mensal', 1)).toEqual([]);
    expect(calcInstallmentDates('2026-01-15', 0, 'mensal', 1)).toEqual([]);
  });

  it('returns empty list without due date', () => {
    expect(calcInstallmentDates('', 3, 'mensal', 1)).toEqual([]);
    expect(calcInstallmentDates(null, 3, 'mensal', 1)).toEqual([]);
  });
});
