import { describe, expect, it } from 'vitest';
import { differenceIcon, percentageDifference } from '../pages/relatorios-financeiros/PeriodComparisonReport';

describe('PeriodComparisonReport calculations', () => {
  it('formats percentage differences using the previous period as base', () => {
    expect(percentageDifference(150, 100)).toBe('50.0');
    expect(percentageDifference(75, 100)).toBe('-25.0');
    expect(percentageDifference(100, 0)).toBe('0.0');
  });

  it('identifies the direction of a period difference', () => {
    expect(differenceIcon(150, 100)).toBe('\u2191');
    expect(differenceIcon(75, 100)).toBe('\u2193');
    expect(differenceIcon(100, 100)).toBe('=');
  });
});
