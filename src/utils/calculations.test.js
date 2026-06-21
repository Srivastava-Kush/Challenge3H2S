import { describe, it, expect } from 'vitest';
import {
  calcEmissions,
  calcDailyEmissions,
  validateForm,
  validateDailyForm,
  localInsight,
  calculateAnnual,
  monthLabel,
} from './calculations';

// ─────────────────────────────────────────────────────────────────────────────
// calcEmissions — Monthly
// ─────────────────────────────────────────────────────────────────────────────
describe('calcEmissions (Monthly)', () => {
  const baseForm = {
    electricity: '100',
    lpg: '1',
    km: '200',
    vehicle: 'petrolBike',
    diet: 'veg',
    smartphone: '4',
    laptop: '6',
    state: '',
  };

  it('returns all required keys', () => {
    const result = calcEmissions(baseForm);
    ['total', 'electricity', 'lpg', 'transport', 'diet', 'smartphone', 'laptop', 'gridFactor', 'state'].forEach(k =>
      expect(result).toHaveProperty(k)
    );
  });

  it('calculates positive emissions for normal inputs', () => {
    const result = calcEmissions(baseForm);
    expect(result.electricity).toBeGreaterThan(0);
    expect(result.lpg).toBeGreaterThan(0);
    expect(result.transport).toBeGreaterThan(0);
    expect(result.diet).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThan(0);
  });

  it('returns zero electricity/transport/devices for all-zero inputs', () => {
    const form = { ...baseForm, electricity: '0', lpg: '0', km: '0', smartphone: '0', laptop: '0' };
    const result = calcEmissions(form);
    expect(result.electricity).toBe(0);
    expect(result.lpg).toBe(0);
    expect(result.transport).toBe(0);
    expect(result.smartphone).toBe(0);
    expect(result.laptop).toBe(0);
    // diet is always non-zero (even veg diet has a footprint)
    expect(result.total).toBeGreaterThan(0);
  });

  it('total equals sum of all categories', () => {
    const result = calcEmissions(baseForm);
    const catSum = +(result.electricity + result.lpg + result.transport + result.diet + result.smartphone + result.laptop).toFixed(2);
    expect(result.total).toBeCloseTo(catSum, 1);
  });

  it('uses state-specific grid factor when state is provided', () => {
    const withState    = calcEmissions({ ...baseForm, state: 'Maharashtra' });
    const withoutState = calcEmissions({ ...baseForm, state: '' });
    // Maharashtra grid factor differs from national average
    expect(withState.gridFactor).not.toEqual(withoutState.gridFactor);
  });

  it('all diet types produce distinct, ordered emission values', () => {
    const diets  = ['veg', 'eggetarian', 'nonveg', 'heavymeat'];
    const totals = diets.map(diet => calcEmissions({ ...baseForm, diet }).diet);
    expect(new Set(totals).size).toBe(4);
    // veg < eggetarian < nonveg < heavymeat
    expect(totals[0]).toBeLessThan(totals[1]);
    expect(totals[1]).toBeLessThan(totals[2]);
    expect(totals[2]).toBeLessThan(totals[3]);
  });

  it('higher km means higher transport emissions', () => {
    const low  = calcEmissions({ ...baseForm, km: '100' });
    const high = calcEmissions({ ...baseForm, km: '500' });
    expect(high.transport).toBeGreaterThan(low.transport);
  });

  it('EV has lower transport emissions than petrol car for same distance', () => {
    const ev     = calcEmissions({ ...baseForm, vehicle: 'ev',        state: 'Maharashtra', km: '500' });
    const petrol = calcEmissions({ ...baseForm, vehicle: 'petrolCar', state: 'Maharashtra', km: '500' });
    expect(ev.transport).toBeLessThan(petrol.transport);
  });

  it('dieselCar emits more than cngBike for same km', () => {
    const diesel = calcEmissions({ ...baseForm, vehicle: 'dieselCar', km: '300' });
    const cng    = calcEmissions({ ...baseForm, vehicle: 'cngBike',   km: '300' });
    expect(diesel.transport).toBeGreaterThan(cng.transport);
  });

  it('returns finite numbers', () => {
    const result = calcEmissions(baseForm);
    expect(Number.isFinite(result.total)).toBe(true);
    expect(Number.isFinite(result.electricity)).toBe(true);
  });

  it('state string is preserved in result', () => {
    const result = calcEmissions({ ...baseForm, state: 'Tamil Nadu' });
    expect(result.state).toBe('Tamil Nadu');
  });

  it('all 6 vehicle types produce valid non-negative results', () => {
    const vehicles = ['petrolBike', 'petrolCar', 'dieselCar', 'ev', 'cngBike', 'cngCar'];
    vehicles.forEach(vehicle => {
      const result = calcEmissions({ ...baseForm, vehicle, km: '200' });
      expect(result.transport).toBeGreaterThanOrEqual(0);
      expect(result.total).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// calcDailyEmissions — Daily
// ─────────────────────────────────────────────────────────────────────────────
describe('calcDailyEmissions (Daily)', () => {
  const baseForm = {
    electricity: '10',
    km: '20',
    vehicle: 'petrolBike',
    diet: 'nonveg',
    smartphone: '4',
    laptop: '4',
    state: 'Maharashtra',
  };

  it('returns all required keys', () => {
    const result = calcDailyEmissions(baseForm);
    ['total', 'electricity', 'lpg', 'transport', 'diet', 'smartphone', 'laptop', 'gridFactor'].forEach(k =>
      expect(result).toHaveProperty(k)
    );
  });

  it('lpg is always 0 in daily mode', () => {
    const result = calcDailyEmissions(baseForm);
    expect(result.lpg).toBe(0);
  });

  it('calculates positive electricity and transport', () => {
    const result = calcDailyEmissions(baseForm);
    expect(result.electricity).toBeGreaterThan(0);
    expect(result.transport).toBeGreaterThan(0);
  });

  it('more km → higher transport emissions', () => {
    const low  = calcDailyEmissions({ ...baseForm, km: '5' });
    const high = calcDailyEmissions({ ...baseForm, km: '50' });
    expect(high.transport).toBeGreaterThan(low.transport);
  });

  it('zero inputs produce zero non-diet emissions', () => {
    const form = { ...baseForm, electricity: '0', km: '0', smartphone: '0', laptop: '0' };
    const result = calcDailyEmissions(form);
    expect(result.electricity).toBe(0);
    expect(result.transport).toBe(0);
    expect(result.smartphone).toBe(0);
    expect(result.laptop).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateForm — Monthly validation
// ─────────────────────────────────────────────────────────────────────────────
describe('validateForm (Monthly)', () => {
  const validForm = { electricity: '100', lpg: '1', km: '200', smartphone: '4', laptop: '6' };

  it('returns empty errors object for valid inputs', () => {
    expect(validateForm(validForm)).toEqual({});
  });

  it('negative electricity is invalid', () => {
    const errors = validateForm({ ...validForm, electricity: '-10' });
    expect(errors.electricity).toMatch(/cannot be negative/);
  });

  it('LPG above max (20) is invalid', () => {
    const errors = validateForm({ ...validForm, lpg: '30' });
    expect(errors.lpg).toMatch(/seems too high/);
  });

  it('km above max (15000) is invalid', () => {
    const errors = validateForm({ ...validForm, km: '20000' });
    expect(errors.km).toMatch(/seems too high/);
  });

  it('smartphone above 24 is invalid', () => {
    const errors = validateForm({ ...validForm, smartphone: '25' });
    expect(errors.smartphone).toMatch(/seems too high/);
  });

  it('combined screen time over 24 hrs is invalid', () => {
    const errors = validateForm({ ...validForm, smartphone: '15', laptop: '12' });
    expect(errors.laptop).toMatch(/Combined screen time cannot exceed 24 hrs\/day/);
  });

  it('empty string triggers valid number error', () => {
    const errors = validateForm({ ...validForm, electricity: '' });
    expect(errors.electricity).toMatch(/valid number/);
  });

  it('non-numeric string triggers valid number error', () => {
    const errors = validateForm({ ...validForm, km: 'abc' });
    expect(errors.km).toMatch(/valid number/);
  });

  it('exactly 24 hrs combined screen time is valid', () => {
    const errors = validateForm({ ...validForm, smartphone: '12', laptop: '12' });
    expect(errors.laptop).toBeUndefined();
  });

  it('all-zero values are valid', () => {
    const errors = validateForm({ electricity: '0', lpg: '0', km: '0', smartphone: '0', laptop: '0' });
    expect(errors).toEqual({});
  });

  it('multiple simultaneous errors are all reported', () => {
    const errors = validateForm({ electricity: '-1', lpg: '25', km: '20000', smartphone: '25', laptop: '0' });
    expect(Object.keys(errors).length).toBeGreaterThan(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateDailyForm — Daily validation
// ─────────────────────────────────────────────────────────────────────────────
describe('validateDailyForm (Daily)', () => {
  const validForm = { electricity: '10', km: '30', smartphone: '4', laptop: '4' };

  it('returns empty errors for valid inputs', () => {
    expect(validateDailyForm(validForm)).toEqual({});
  });

  it('electricity over 100 is too high for daily', () => {
    const errors = validateDailyForm({ ...validForm, electricity: '150' });
    expect(errors.electricity).toMatch(/seems too high/);
  });

  it('km over 1000 is too high for daily', () => {
    const errors = validateDailyForm({ ...validForm, km: '1200' });
    expect(errors.km).toMatch(/seems too high/);
  });

  it('catches combined screen time over 24 hours', () => {
    const errors = validateDailyForm({ ...validForm, smartphone: '13', laptop: '13' });
    expect(errors.laptop).toMatch(/Combined screen time/);
  });

  it('negative km is invalid', () => {
    const errors = validateDailyForm({ ...validForm, km: '-5' });
    expect(errors.km).toMatch(/cannot be negative/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// calculateAnnual
// ─────────────────────────────────────────────────────────────────────────────
describe('calculateAnnual', () => {
  it('multiplies monthly by 12', () => {
    expect(calculateAnnual(100)).toBe(1200);
    expect(calculateAnnual(158)).toBe(1896);
  });

  it('handles zero correctly', () => {
    expect(calculateAnnual(0)).toBe(0);
  });

  it('returns a finite number', () => {
    const result = calculateAnnual(33.33);
    expect(typeof result).toBe('number');
    expect(Number.isFinite(result)).toBe(true);
  });

  it('result is approximately 12x the input', () => {
    expect(calculateAnnual(50)).toBeCloseTo(600, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// monthLabel
// ─────────────────────────────────────────────────────────────────────────────
describe('monthLabel', () => {
  it('returns a non-empty string', () => {
    const label = monthLabel(0);
    expect(typeof label).toBe('string');
    expect(label.length).toBeGreaterThan(0);
  });

  it('contains a recognised month abbreviation', () => {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const label = monthLabel(0);
    expect(months.some(m => label.startsWith(m))).toBe(true);
  });

  it('returns different labels for different offsets', () => {
    const current  = monthLabel(0);
    const lastYear = monthLabel(12);
    expect(current).not.toBe(lastYear);
  });

  it('works for large offsets (24 months ago)', () => {
    const label = monthLabel(24);
    expect(typeof label).toBe('string');
    expect(label.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// localInsight
// ─────────────────────────────────────────────────────────────────────────────
describe('localInsight', () => {
  it('returns a non-empty string', () => {
    const emissions = { electricity: 80, lpg: 20, transport: 30, diet: 15, smartphone: 5, laptop: 8, total: 158 };
    const result = localInsight(emissions, {});
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('identifies electricity as top category when it is highest', () => {
    const emissions = { electricity: 120, lpg: 10, transport: 20, diet: 15, smartphone: 2, laptop: 3, total: 170 };
    const result = localInsight(emissions, {});
    expect(result.toLowerCase()).toContain('electricity');
  });

  it('identifies transport as top category when it is highest', () => {
    const emissions = { electricity: 20, lpg: 5, transport: 150, diet: 15, smartphone: 2, laptop: 3, total: 195 };
    const result = localInsight(emissions, {});
    expect(result.toLowerCase()).toContain('transport');
  });

  it('identifies diet as top category when it is highest', () => {
    const emissions = { electricity: 10, lpg: 5, transport: 20, diet: 99, smartphone: 2, laptop: 3, total: 139 };
    const result = localInsight(emissions, {});
    expect(result.toLowerCase()).toContain('diet');
  });

  it('handles all-zero emissions gracefully', () => {
    const emissions = { electricity: 0, lpg: 0, transport: 0, diet: 0, smartphone: 0, laptop: 0, total: 0 };
    const result = localInsight(emissions, {});
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('includes the actual kg figure of the top category', () => {
    const emissions = { electricity: 99, lpg: 5, transport: 10, diet: 15, smartphone: 2, laptop: 3, total: 134 };
    const result = localInsight(emissions, {});
    expect(result).toContain('99');
  });
});
