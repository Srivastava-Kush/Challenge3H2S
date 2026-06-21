import { describe, it, expect } from 'vitest';
import { calculatePercentile } from './percentile';

// ─────────────────────────────────────────────────────────────────────────────
// calculatePercentile
// Mean = 158 kg, SD = 45 kg (Indian CO₂ distribution)
// Returns what % of Indians the user is cleaner than
// ─────────────────────────────────────────────────────────────────────────────
describe('calculatePercentile', () => {
  it('returns a number', () => {
    const result = calculatePercentile(100);
    expect(typeof result).toBe('number');
  });

  it('returns value between 0 and 100 inclusive', () => {
    [0, 50, 100, 158, 200, 300, 400].forEach(kg => {
      const result = calculatePercentile(kg);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });
  });

  it('returns an integer (Math.round applied)', () => {
    const result = calculatePercentile(158);
    expect(Number.isInteger(result)).toBe(true);
  });

  it('user at mean (158 kg) is cleaner than ~50% of Indians', () => {
    // At z=0, they are at the 50th percentile, so cleaner than 50%
    const result = calculatePercentile(158);
    expect(result).toBeCloseTo(50, 5);
  });

  it('user with very low emissions is cleaner than most Indians', () => {
    // 0 kg → very low, cleaner than ~100% of people
    const result = calculatePercentile(0);
    expect(result).toBeGreaterThan(90);
  });

  it('user with very high emissions is cleaner than very few Indians', () => {
    // 400 kg is more than 5 SD above mean
    const result = calculatePercentile(400);
    expect(result).toBeLessThan(10);
  });

  it('lower emissions means higher percentile (cleaner than more people)', () => {
    const low    = calculatePercentile(50);
    const medium = calculatePercentile(158);
    const high   = calculatePercentile(250);
    expect(low).toBeGreaterThan(medium);
    expect(medium).toBeGreaterThan(high);
  });

  it('user 1 SD below mean (~113 kg) is cleaner than ~84% of Indians', () => {
    // P(X < 158-45) = P(z < -1) ≈ 16% → cleaner than 84%
    const result = calculatePercentile(113);
    expect(result).toBeGreaterThan(75);
    expect(result).toBeLessThan(95);
  });

  it('user 1 SD above mean (~203 kg) is cleaner than ~16% of Indians', () => {
    // P(X > 203) ≈ 16%
    const result = calculatePercentile(203);
    expect(result).toBeGreaterThan(5);
    expect(result).toBeLessThan(25);
  });

  it('handles extreme negative values gracefully (returns near 100)', () => {
    const result = calculatePercentile(-100);
    expect(result).toBe(100);
  });

  it('clamps result to 0 minimum', () => {
    const result = calculatePercentile(10000);
    expect(result).toBeGreaterThanOrEqual(0);
  });
});
