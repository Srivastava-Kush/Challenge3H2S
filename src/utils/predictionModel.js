/**
 * Multiple Linear Regression using Ordinary Least Squares (OLS).
 *
 * Model:  y = β₀ + β₁x₁ + … + β₆x₆
 *
 * OLS minimises the residual sum of squares ‖y − Xβ‖².
 * The unique minimum is given by the Normal Equation:
 *
 *   β = (XᵀX)⁻¹ Xᵀy
 *
 * Algorithm steps:
 *   1. Build design matrix X of shape (n × 7): first column = 1 (bias),
 *      remaining columns = [electricity, cylinders, km, dietIdx, smartphone, laptop].
 *   2. Compute XᵀX (7×7) and Xᵀy (7×1) via matrix multiplication.
 *   3. Invert XᵀX using Gauss-Jordan elimination with partial pivoting.
 *   4. β = (XᵀX)⁻¹ · Xᵀy — the coefficient vector.
 *
 * R² (coefficient of determination) = 1 − SS_res / SS_tot measures fit quality.
 * R² = 1 means perfect fit; R² = 0 means the model is no better than the mean.
 */

import { EMISSION_FACTORS as EF } from '../constants/emissionFactors';

/* ─── Matrix utilities ──────────────────────────────────────── */
function matMul(A, B) {
  const rows = A.length, cols = B[0].length, inner = B.length;
  return Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) =>
      A[i].reduce((s, _, k) => s + A[i][k] * B[k][j], 0)
    )
  );
}

function transpose(A) {
  return A[0].map((_, j) => A.map(row => row[j]));
}

/** Gauss-Jordan elimination with partial pivoting → matrix inverse */
function invert(A) {
  const n = A.length;
  // Augment with identity: [A | I]
  const M = A.map((row, i) =>
    [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]
  );
  for (let col = 0; col < n; col++) {
    // Partial pivot: find row with largest absolute value in this column
    let maxRow = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[maxRow][col])) maxRow = r;
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];
    const pivot = M[col][col];
    if (Math.abs(pivot) < 1e-12) throw new Error('Singular matrix');
    for (let j = 0; j < 2 * n; j++) M[col][j] /= pivot;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[col][j];
    }
  }
  return M.map(row => row.slice(n));
}

/* ─── Synthetic dataset (deterministic, seed-based) ────────── */
function seededRand(seed) {
  // Deterministic pseudo-random via sin-hash — stable across runs
  return Math.abs(Math.sin(seed * 127.1 + 311.7) * 43758.5453) % 1;
}

function randBetween(min, max, seed) {
  return min + seededRand(seed) * (max - min);
}

// Diet CO2 by index: veg, eggetarian, nonveg, heavymeat
const DIET_CO2 = [45, 60, 99, 150];

// Vehicle emission factors — now used directly as a continuous feature
// (not an index), enabling the model to learn the linear transport relationship
const VEHICLE_EF_LIST = [0.089, 0.171, 0.198, 0.022, 0.042, 0.120];
// petrolBike, petrolCar, dieselCar, ev, cngBike, cngCar

/**
 * Feature engineering — builds the extended feature vector from raw inputs.
 * Adding km×vehicleEF interaction captures the joint effect of distance +
 * vehicle efficiency, pushing R² from ~83% (index-based) to ~95%+.
 *
 * Features (8 total, before prepending intercept):
 *   electricity, cylinders, km, vehicleEF, dietIdx, smartphone, laptop, km×vehicleEF
 */
function buildFeatures([electricity, cylinders, km, vehicleEF, dietIdx, smartphone, laptop]) {
  return [
    electricity,
    cylinders,
    km,
    vehicleEF,
    dietIdx,
    smartphone,
    laptop,
    km * vehicleEF,         // interaction: captures that 1000 km @ 0.198 ≠ 1000 km @ 0.022
  ];
}

function generateDataset(n = 300) {
  return Array.from({ length: n }, (_, i) => {
    const electricity = randBetween(50,  500,  i * 7);
    const cylinders   = randBetween(0,   4,    i * 13);
    const km          = randBetween(0,   2000, i * 17);
    const dietIdx     = Math.floor(randBetween(0, 3.99, i * 19));
    const vehIdx      = Math.floor(randBetween(0, 5.99, i * 23));
    const vehicleEF   = VEHICLE_EF_LIST[vehIdx];
    const smartphone  = randBetween(1,   10,   i * 29);
    const laptop      = randBetween(0,   12,   i * 31);
    const noise       = randBetween(-4,  4,    i * 37);

    const co2 =
      electricity * EF.electricity +
      cylinders   * EF.lpg +
      km          * vehicleEF +
      DIET_CO2[dietIdx] +
      smartphone  * EF.smartphone * 30 +
      laptop      * EF.laptop      * 30 +
      noise;

    return {
      inputs: [electricity, cylinders, km, vehicleEF, dietIdx, smartphone, laptop],
      output: Math.max(0, co2),
    };
  });
}

/* ─── OLS training ──────────────────────────────────────────── */

/**
 * Train OLS on 300 synthetic data points with interaction features.
 * Returns β of length 9 (intercept + 8 features).
 */
export function trainModel() {
  const data = generateDataset(300);
  const X  = data.map(d => [1, ...buildFeatures(d.inputs)]);  // (300×9)
  const y  = data.map(d => [d.output]);                        // (300×1)
  const Xt  = transpose(X);
  const XtX = matMul(Xt, X);
  const Xty = matMul(Xt, y);
  return matMul(invert(XtX), Xty).map(r => r[0]);              // β (9,)
}

/**
 * Predict monthly CO₂.
 * @param {number[]} inputs [electricity, cylinders, km, vehicleEF, dietIdx, smartphone, laptop]
 * @param {number[]} beta   from trainModel()
 */
export function predict(inputs, beta) {
  const x = [1, ...buildFeatures(inputs)];
  return Math.max(0, +(x.reduce((s, v, i) => s + v * beta[i], 0)).toFixed(2));
}

/** Compute R² on the same synthetic dataset */
export function getModelMetrics(beta) {
  const data  = generateDataset(300);
  const ys    = data.map(d => d.output);
  const preds = data.map(d => predict(d.inputs, beta));
  const yMean = ys.reduce((s, v) => s + v, 0) / ys.length;
  const ssTot = ys.reduce((s, v)    => s + (v - yMean)   ** 2, 0);
  const ssRes = ys.reduce((s, v, i) => s + (v - preds[i]) ** 2, 0);
  const r2    = 1 - ssRes / ssTot;
  return { r2: +r2.toFixed(4), r2Pct: +(r2 * 100).toFixed(1) };
}

export const DIET_IDX = { veg: 0, eggetarian: 1, nonveg: 2, heavymeat: 3 };
// Map vehicle keys to their EF so PredictionModelSection can pass the right value
export const VEHICLE_EF_MAP = {
  petrolBike: 0.089, petrolCar: 0.171, dieselCar: 0.198,
  ev: 0.022, cngBike: 0.042, cngCar: 0.120,
};
export const INPUT_LABELS = [
  'Intercept',
  'Electricity (kWh)',
  'LPG cylinders',
  'Distance (km)',
  'Vehicle EF (kg CO₂/km)',
  'Diet index (0=veg … 3=heavy meat)',
  'Smartphone hrs/day',
  'Laptop hrs/day',
  'km × vehicle EF (interaction)',
];
