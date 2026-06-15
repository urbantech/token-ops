import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatTokens,
  formatNumber,
  formatPercent,
  formatLatency,
  millicentsToUsd,
  calcChangePercent,
  trendDirection,
  getDateRange,
} from '../utils';

// Refs #11

describe('formatCurrency', () => {
  it('formats with default 2 decimals', () => {
    expect(formatCurrency(12.5)).toBe('$12.50');
  });

  it('formats with custom decimals', () => {
    expect(formatCurrency(0.00123, { decimals: 4 })).toBe('$0.0012');
  });

  it('formats in compact mode for large amounts', () => {
    expect(formatCurrency(1500, { compact: true })).toBe('$1.5k');
  });

  it('formats in compact mode for small amounts', () => {
    expect(formatCurrency(0.005, { compact: true })).toBe('$0.0050');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });
});

describe('formatTokens', () => {
  it('formats millions', () => {
    expect(formatTokens(1_500_000)).toBe('1.50M');
  });

  it('formats thousands', () => {
    expect(formatTokens(42_500)).toBe('42.5K');
  });

  it('formats small numbers', () => {
    expect(formatTokens(999)).toBe('999');
  });
});

describe('formatNumber', () => {
  it('formats with default 0 decimals', () => {
    expect(formatNumber(1234)).toBe('1,234');
  });

  it('formats with custom decimals', () => {
    expect(formatNumber(1234.567, 2)).toBe('1,234.57');
  });
});

describe('formatPercent', () => {
  it('formats with default 1 decimal', () => {
    expect(formatPercent(45.678)).toBe('45.7%');
  });

  it('formats with custom decimals', () => {
    expect(formatPercent(45.678, 0)).toBe('46%');
  });
});

describe('formatLatency', () => {
  it('formats milliseconds', () => {
    expect(formatLatency(150)).toBe('150ms');
  });

  it('formats seconds', () => {
    expect(formatLatency(2500)).toBe('2.50s');
  });
});

describe('millicentsToUsd', () => {
  it('converts millicents to USD', () => {
    expect(millicentsToUsd(100_000)).toBe(1);
  });

  it('converts zero', () => {
    expect(millicentsToUsd(0)).toBe(0);
  });
});

describe('calcChangePercent', () => {
  it('calculates positive change', () => {
    expect(calcChangePercent(150, 100)).toBe(50);
  });

  it('calculates negative change', () => {
    expect(calcChangePercent(50, 100)).toBe(-50);
  });

  it('handles zero previous value', () => {
    expect(calcChangePercent(100, 0)).toBe(100);
  });

  it('handles both zero', () => {
    expect(calcChangePercent(0, 0)).toBe(0);
  });
});

describe('trendDirection', () => {
  it('returns up for positive change', () => {
    expect(trendDirection(150, 100)).toBe('up');
  });

  it('returns down for negative change', () => {
    expect(trendDirection(50, 100)).toBe('down');
  });

  it('returns flat for negligible change', () => {
    expect(trendDirection(100.0001, 100)).toBe('flat');
  });
});

describe('getDateRange', () => {
  it('returns start and end date strings', () => {
    const range = getDateRange(7);
    expect(range.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(range.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('start is before end', () => {
    const range = getDateRange(30);
    expect(new Date(range.start).getTime()).toBeLessThan(new Date(range.end).getTime());
  });
});
