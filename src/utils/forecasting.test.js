import { describe, it, expect } from 'vitest';
import {
  linearRegression,
  holtSmoothing,
  buildForecast,
  trendSummary,
} from './forecasting';

// ─────────────────────────────────────────────────────────────────────────────
// linearRegression
// ─────────────────────────────────────────────────────────────────────────────
describe('linearRegression', () => {
  it('returns null for fewer than 2 data points', () => {
    expect(linearRegression([])).toBeNull();
    expect(linearRegression([100])).toBeNull();
  });

  it('computes slope and intercept for 2 points', () => {
    // y = 0, 10 → slope = 10, intercept = 0
    const result = linearRegression([0, 10]);
    expect(result).not.toBeNull();
    expect(result.slope).toBeCloseTo(10, 1);
    expect(result.intercept).toBeCloseTo(0, 1);
  });

  it('computes slope and intercept for a flat line', () => {
    const result = linearRegression([50, 50, 50, 50]);
    expect(result.slope).toBeCloseTo(0, 2);
    expect(result.intercept).toBeCloseTo(50, 1);
  });

  it('computes slope for a strictly increasing trend', () => {
    const result = linearRegression([100, 120, 140, 160]);
    expect(result.slope).toBeGreaterThan(0);
    expect(result.slope).toBeCloseTo(20, 0);
  });

  it('computes negative slope for a decreasing trend', () => {
    const result = linearRegression([200, 180, 160, 140]);
    expect(result.slope).toBeLessThan(0);
  });

  it('returns numeric slope and intercept', () => {
    const result = linearRegression([100, 150, 130, 170]);
    expect(typeof result.slope).toBe('number');
    expect(typeof result.intercept).toBe('number');
    expect(Number.isFinite(result.slope)).toBe(true);
    expect(Number.isFinite(result.intercept)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// holtSmoothing
// ─────────────────────────────────────────────────────────────────────────────
describe('holtSmoothing', () => {
  it('returns null for fewer than 2 data points', () => {
    expect(holtSmoothing([])).toBeNull();
    expect(holtSmoothing([100])).toBeNull();
  });

  it('returns level and trend for 2 data points', () => {
    const result = holtSmoothing([100, 120]);
    expect(result).toHaveProperty('level');
    expect(result).toHaveProperty('trend');
    expect(Number.isFinite(result.level)).toBe(true);
    expect(Number.isFinite(result.trend)).toBe(true);
  });

  it('returns positive trend for increasing series', () => {
    const result = holtSmoothing([100, 120, 140, 160, 180]);
    expect(result.trend).toBeGreaterThan(0);
  });

  it('returns negative trend for decreasing series', () => {
    const result = holtSmoothing([200, 180, 160, 140, 120]);
    expect(result.trend).toBeLessThan(0);
  });

  it('trend is near zero for a flat series', () => {
    const result = holtSmoothing([150, 150, 150, 150, 150]);
    expect(Math.abs(result.trend)).toBeLessThan(1);
  });

  it('works with custom alpha and beta parameters', () => {
    const result = holtSmoothing([100, 110, 120], 0.7, 0.5);
    expect(result).not.toBeNull();
    expect(Number.isFinite(result.level)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildForecast
// ─────────────────────────────────────────────────────────────────────────────
describe('buildForecast', () => {
  const history3 = [{ co2: 100 }, { co2: 120 }, { co2: 140 }];
  const history2 = [{ co2: 100 }, { co2: 130 }];

  it('returns empty array for null or undefined history', () => {
    expect(buildForecast(null)).toEqual([]);
    expect(buildForecast(undefined)).toEqual([]);
  });

  it('returns empty array for fewer than 2 history points', () => {
    expect(buildForecast([])).toEqual([]);
    expect(buildForecast([{ co2: 100 }])).toEqual([]);
  });

  it('returns 6 forecast points by default', () => {
    const result = buildForecast(history3);
    expect(result).toHaveLength(6);
  });

  it('returns the specified number of forecast points', () => {
    const result = buildForecast(history3, 3);
    expect(result).toHaveLength(3);
  });

  it('each forecast point has required keys', () => {
    const result = buildForecast(history3);
    result.forEach(point => {
      expect(point).toHaveProperty('month');
      expect(point).toHaveProperty('predicted');
      expect(point).toHaveProperty('lower');
      expect(point).toHaveProperty('upper');
      expect(point).toHaveProperty('method');
    });
  });

  it('uses Holt ETS method when 3+ data points are available', () => {
    const result = buildForecast(history3);
    expect(result[0].method).toBe('Holt ETS');
  });

  it('uses OLS method when exactly 2 data points are available', () => {
    const result = buildForecast(history2);
    expect(result[0].method).toBe('OLS');
  });

  it('all predicted values are non-negative', () => {
    const result = buildForecast(history3);
    result.forEach(point => {
      expect(point.predicted).toBeGreaterThanOrEqual(0);
    });
  });

  it('confidence band: lower <= predicted <= upper', () => {
    const result = buildForecast(history3);
    result.forEach(point => {
      expect(point.lower).toBeLessThanOrEqual(point.predicted);
      expect(point.upper).toBeGreaterThanOrEqual(point.predicted);
    });
  });

  it('confidence band grows wider with each future month', () => {
    const result = buildForecast(history3);
    const band0 = result[0].upper - result[0].lower;
    const band5 = result[5].upper - result[5].lower;
    // Uncertainty should increase further into the future
    expect(band5).toBeGreaterThan(band0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// trendSummary
// ─────────────────────────────────────────────────────────────────────────────
describe('trendSummary', () => {
  it('returns null for fewer than 2 history points', () => {
    expect(trendSummary(null)).toBeNull();
    expect(trendSummary([])).toBeNull();
    expect(trendSummary([{ co2: 100 }])).toBeNull();
  });

  it('returns slopePerMonth, direction, method', () => {
    const result = trendSummary([{ co2: 100 }, { co2: 120 }, { co2: 140 }]);
    expect(result).toHaveProperty('slopePerMonth');
    expect(result).toHaveProperty('direction');
    expect(result).toHaveProperty('method');
  });

  it('reports "up" direction for increasing emissions', () => {
    const result = trendSummary([{ co2: 100 }, { co2: 130 }, { co2: 160 }]);
    expect(result.direction).toBe('up');
  });

  it('reports "down" direction for decreasing emissions', () => {
    const result = trendSummary([{ co2: 200 }, { co2: 170 }, { co2: 140 }]);
    expect(result.direction).toBe('down');
  });

  it('reports "flat" direction for stable emissions', () => {
    const result = trendSummary([{ co2: 150 }, { co2: 150 }, { co2: 151 }]);
    expect(result.direction).toBe('flat');
  });

  it('uses Holt ETS for 3+ points', () => {
    const result = trendSummary([{ co2: 100 }, { co2: 120 }, { co2: 140 }]);
    expect(result.method).toBe('Holt ETS');
  });

  it('uses OLS for exactly 2 points', () => {
    const result = trendSummary([{ co2: 100 }, { co2: 130 }]);
    expect(result.method).toBe('OLS');
  });

  it('slope is a finite number', () => {
    const result = trendSummary([{ co2: 100 }, { co2: 120 }, { co2: 140 }]);
    expect(Number.isFinite(result.slopePerMonth)).toBe(true);
  });
});
