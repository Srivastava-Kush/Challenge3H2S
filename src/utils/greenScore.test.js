import { describe, it, expect } from 'vitest';
import { calculateGreenScore, getScoreLabel } from './greenScore';

// ─────────────────────────────────────────────────────────────────────────────
// calculateGreenScore
// ─────────────────────────────────────────────────────────────────────────────
describe('calculateGreenScore', () => {
  it('returns 100 for zero emissions', () => {
    expect(calculateGreenScore(0)).toBe(100);
  });

  it('returns 100 for negative emissions (treated as zero)', () => {
    expect(calculateGreenScore(-10)).toBe(100);
  });

  it('returns 0 for maximum emissions (316 kg)', () => {
    expect(calculateGreenScore(316)).toBe(0);
  });

  it('returns 0 for emissions above maximum', () => {
    expect(calculateGreenScore(500)).toBe(0);
  });

  it('returns ~50 for mid-range emissions (158 kg)', () => {
    // 158 / 316 = 50%
    expect(calculateGreenScore(158)).toBeCloseTo(50, 0);
  });

  it('returns a value between 0 and 100 for normal emissions', () => {
    const score = calculateGreenScore(100);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('score decreases as emissions increase', () => {
    const low  = calculateGreenScore(50);
    const mid  = calculateGreenScore(150);
    const high = calculateGreenScore(250);
    expect(low).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(high);
  });

  it('returns an integer (Math.round applied)', () => {
    const score = calculateGreenScore(100);
    expect(Number.isInteger(score)).toBe(true);
  });

  it('returns exactly 100 at 0 kg', () => {
    expect(calculateGreenScore(0)).toBe(100);
  });

  it('returns a value close to 68 for 100 kg (100/316 = ~32% penalty → 68)', () => {
    expect(calculateGreenScore(100)).toBeCloseTo(68, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getScoreLabel
// ─────────────────────────────────────────────────────────────────────────────
describe('getScoreLabel', () => {
  it('returns "Climate Hero" for score 80-100', () => {
    expect(getScoreLabel(100)).toBe('Climate Hero');
    expect(getScoreLabel(80)).toBe('Climate Hero');
    expect(getScoreLabel(85)).toBe('Climate Hero');
  });

  it('returns "Sustainability Champion" for score 60-79', () => {
    expect(getScoreLabel(79)).toBe('Sustainability Champion');
    expect(getScoreLabel(60)).toBe('Sustainability Champion');
    expect(getScoreLabel(70)).toBe('Sustainability Champion');
  });

  it('returns "Eco Explorer" for score 40-59', () => {
    expect(getScoreLabel(59)).toBe('Eco Explorer');
    expect(getScoreLabel(40)).toBe('Eco Explorer');
    expect(getScoreLabel(50)).toBe('Eco Explorer');
  });

  it('returns "Green Beginner" for score 20-39', () => {
    expect(getScoreLabel(39)).toBe('Green Beginner');
    expect(getScoreLabel(20)).toBe('Green Beginner');
    expect(getScoreLabel(30)).toBe('Green Beginner');
  });

  it('returns "Carbon Heavy" for score below 20', () => {
    expect(getScoreLabel(19)).toBe('Carbon Heavy');
    expect(getScoreLabel(0)).toBe('Carbon Heavy');
    expect(getScoreLabel(10)).toBe('Carbon Heavy');
  });

  it('all 5 labels are distinct strings', () => {
    const labels = [
      getScoreLabel(90),
      getScoreLabel(65),
      getScoreLabel(45),
      getScoreLabel(25),
      getScoreLabel(5),
    ];
    expect(new Set(labels).size).toBe(5);
  });

  it('returns a string for any score', () => {
    [0, 25, 50, 75, 100].forEach(score => {
      expect(typeof getScoreLabel(score)).toBe('string');
    });
  });
});
