import { describe, it, expect, beforeAll } from 'vitest';
import {
  trainModel,
  predict,
  getModelMetrics,
  DIET_IDX,
  VEHICLE_EF_MAP,
  INPUT_LABELS,
} from './predictionModel';

// ─────────────────────────────────────────────────────────────────────────────
// trainModel
// ─────────────────────────────────────────────────────────────────────────────
describe('trainModel', () => {
  let beta;
  beforeAll(() => {
    beta = trainModel();
  });

  it('returns an array of 9 coefficients (intercept + 8 features)', () => {
    expect(Array.isArray(beta)).toBe(true);
    expect(beta).toHaveLength(9);
  });

  it('all coefficients are finite numbers', () => {
    beta.forEach(coef => {
      expect(Number.isFinite(coef)).toBe(true);
    });
  });

  it('is deterministic — same result on repeated calls', () => {
    const beta2 = trainModel();
    beta.forEach((coef, i) => {
      expect(coef).toBeCloseTo(beta2[i], 6);
    });
  });

  it('electricity coefficient is positive (more electricity → more CO₂)', () => {
    // beta[1] is electricity coefficient
    expect(beta[1]).toBeGreaterThan(0);
  });

  it('km×vehicleEF interaction coefficient is positive', () => {
    // beta[8] is the interaction term
    expect(beta[8]).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// predict
// ─────────────────────────────────────────────────────────────────────────────
describe('predict', () => {
  let beta;
  beforeAll(() => {
    beta = trainModel();
  });

  const inputs = [200, 1, 300, VEHICLE_EF_MAP.petrolCar, DIET_IDX.nonveg, 4, 6];

  it('returns a non-negative number', () => {
    const result = predict(inputs, beta);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(typeof result).toBe('number');
  });

  it('returns a finite number', () => {
    const result = predict(inputs, beta);
    expect(Number.isFinite(result)).toBe(true);
  });

  it('higher electricity input → higher predicted CO₂', () => {
    const lowElec  = predict([100, 1, 300, VEHICLE_EF_MAP.petrolBike, DIET_IDX.veg, 4, 4], beta);
    const highElec = predict([500, 1, 300, VEHICLE_EF_MAP.petrolBike, DIET_IDX.veg, 4, 4], beta);
    expect(highElec).toBeGreaterThan(lowElec);
  });

  it('higher km → higher predicted CO₂', () => {
    const lowKm  = predict([200, 1,   50, VEHICLE_EF_MAP.petrolCar, DIET_IDX.nonveg, 4, 4], beta);
    const highKm = predict([200, 1, 2000, VEHICLE_EF_MAP.petrolCar, DIET_IDX.nonveg, 4, 4], beta);
    expect(highKm).toBeGreaterThan(lowKm);
  });

  it('EV produces lower emissions than diesel car for same km', () => {
    const ev     = predict([200, 1, 500, VEHICLE_EF_MAP.ev,        DIET_IDX.nonveg, 4, 4], beta);
    const diesel = predict([200, 1, 500, VEHICLE_EF_MAP.dieselCar, DIET_IDX.nonveg, 4, 4], beta);
    expect(ev).toBeLessThan(diesel);
  });

  it('veg diet produces lower CO₂ than heavy meat diet', () => {
    const veg    = predict([200, 1, 300, VEHICLE_EF_MAP.petrolBike, DIET_IDX.veg,       4, 4], beta);
    const meat   = predict([200, 1, 300, VEHICLE_EF_MAP.petrolBike, DIET_IDX.heavymeat, 4, 4], beta);
    expect(veg).toBeLessThan(meat);
  });

  it('result is rounded to 2 decimal places', () => {
    const result = predict(inputs, beta);
    const decimals = String(result).split('.')[1]?.length ?? 0;
    expect(decimals).toBeLessThanOrEqual(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getModelMetrics
// ─────────────────────────────────────────────────────────────────────────────
describe('getModelMetrics', () => {
  let beta;
  beforeAll(() => {
    beta = trainModel();
  });

  it('returns r2 and r2Pct properties', () => {
    const metrics = getModelMetrics(beta);
    expect(metrics).toHaveProperty('r2');
    expect(metrics).toHaveProperty('r2Pct');
  });

  it('R² is between 0 and 1', () => {
    const { r2 } = getModelMetrics(beta);
    expect(r2).toBeGreaterThanOrEqual(0);
    expect(r2).toBeLessThanOrEqual(1);
  });

  it('R² is above 0.90 — model quality assertion', () => {
    // With the interaction term km×vehicleEF, R² should exceed 90%
    const { r2 } = getModelMetrics(beta);
    expect(r2).toBeGreaterThan(0.90);
  });

  it('R² percentage is r2 × 100', () => {
    const { r2, r2Pct } = getModelMetrics(beta);
    expect(r2Pct).toBeCloseTo(r2 * 100, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Constants — DIET_IDX, VEHICLE_EF_MAP, INPUT_LABELS
// ─────────────────────────────────────────────────────────────────────────────
describe('DIET_IDX', () => {
  it('has all 4 diet types', () => {
    expect(DIET_IDX).toHaveProperty('veg');
    expect(DIET_IDX).toHaveProperty('eggetarian');
    expect(DIET_IDX).toHaveProperty('nonveg');
    expect(DIET_IDX).toHaveProperty('heavymeat');
  });

  it('indices are ordered: veg < eggetarian < nonveg < heavymeat', () => {
    expect(DIET_IDX.veg).toBeLessThan(DIET_IDX.eggetarian);
    expect(DIET_IDX.eggetarian).toBeLessThan(DIET_IDX.nonveg);
    expect(DIET_IDX.nonveg).toBeLessThan(DIET_IDX.heavymeat);
  });
});

describe('VEHICLE_EF_MAP', () => {
  it('contains all 6 vehicle types', () => {
    ['petrolBike', 'petrolCar', 'dieselCar', 'ev', 'cngBike', 'cngCar'].forEach(v =>
      expect(VEHICLE_EF_MAP).toHaveProperty(v)
    );
  });

  it('all emission factors are positive', () => {
    Object.values(VEHICLE_EF_MAP).forEach(ef => {
      expect(ef).toBeGreaterThan(0);
    });
  });

  it('EV has the lowest emission factor', () => {
    const minEF = Math.min(...Object.values(VEHICLE_EF_MAP));
    expect(VEHICLE_EF_MAP.ev).toBe(minEF);
  });

  it('dieselCar has a higher EF than petrolBike', () => {
    expect(VEHICLE_EF_MAP.dieselCar).toBeGreaterThan(VEHICLE_EF_MAP.petrolBike);
  });
});

describe('INPUT_LABELS', () => {
  it('has 9 labels (intercept + 8 features)', () => {
    expect(INPUT_LABELS).toHaveLength(9);
  });

  it('first label is Intercept', () => {
    expect(INPUT_LABELS[0]).toBe('Intercept');
  });

  it('all labels are non-empty strings', () => {
    INPUT_LABELS.forEach(label => {
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    });
  });
});
