/**
 * Forecasting utilities for monthly CO₂ history.
 *
 * Two methods are available:
 *  1. linearRegression  — OLS on the full history; good for steady trends.
 *  2. holtSmoothing     — Holt's double exponential smoothing (level + trend);
 *     weights recent data more heavily. Better for short, noisy histories.
 *
 * buildForecast() chooses holtSmoothing when ≥3 points are available,
 * falling back to linear regression for exactly 2 points.
 */

/* ─── 1. Linear regression (OLS) ───────────────────────────── */
export function linearRegression(ys) {
  const n = ys.length;
  if (n < 2) return null;
  const sumX  = (n - 1) * n / 2;
  const sumX2 = (n - 1) * n * (2 * n - 1) / 6;
  const sumY  = ys.reduce((s, v) => s + v, 0);
  const sumXY = ys.reduce((s, v, i) => s + i * v, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n };
  const slope     = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope: +slope.toFixed(4), intercept: +intercept.toFixed(4) };
}

/* ─── 2. Holt's double exponential smoothing ────────────────── */
/**
 * Holt's linear method (additive trend, no seasonality).
 *
 * Equations:
 *   Level:   L_t = α·y_t + (1−α)·(L_{t−1} + B_{t−1})
 *   Trend:   B_t = β·(L_t − L_{t−1}) + (1−β)·B_{t−1}
 *   Forecast: F_{t+h} = L_t + h·B_t
 *
 * α ∈ (0,1): level smoothing — higher = more responsive
 * β ∈ (0,1): trend smoothing — lower = smoother trend
 *
 * Initialisation: L_0 = y_0, B_0 = (y_{n-1} − y_0) / (n−1)
 */
export function holtSmoothing(ys, alpha = 0.4, beta = 0.2) {
  const n = ys.length;
  if (n < 2) return null;
  let L = ys[0];
  let B = (ys[n - 1] - ys[0]) / (n - 1);
  for (let t = 1; t < n; t++) {
    const prevL = L;
    L = alpha * ys[t] + (1 - alpha) * (L + B);
    B = beta  * (L - prevL) + (1 - beta) * B;
  }
  return { level: L, trend: B };
}

/* ─── Month label helper ────────────────────────────────────── */
const MONTHS_ABR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function futureMonthLabel(offsetMonths) {
  const d = new Date();
  d.setMonth(d.getMonth() + offsetMonths);
  return MONTHS_ABR[d.getMonth()] + " '" + String(d.getFullYear()).slice(2);
}

/* ─── Confidence band width ─────────────────────────────────── */
// Base ±12% ± 3% per additional forecast month (uncertainty grows)
function bandPct(horizon) { return Math.min(0.30, 0.12 + horizon * 0.03); }

/**
 * Build 6-month forward forecast.
 * Uses Holt smoothing (≥3 pts) or linear regression (2 pts).
 * Returns [] if fewer than 2 history entries.
 *
 * @returns {{ month, predicted, lower, upper, method }[]}
 */
export function buildForecast(history, monthsAhead = 6) {
  if (!history || history.length < 2) return [];
  const ys = history.map(h => h.co2);

  if (ys.length >= 3) {
    // Holt smoothing — better for recent-biased extrapolation
    const { level, trend } = holtSmoothing(ys) ?? {};
    if (level == null) return [];
    return Array.from({ length: monthsAhead }, (_, i) => {
      const h = i + 1;
      const predicted = Math.max(0, +(level + h * trend).toFixed(1));
      const band = bandPct(h);
      return {
        month:     futureMonthLabel(h),
        predicted,
        lower:     +(predicted * (1 - band)).toFixed(1),
        upper:     +(predicted * (1 + band)).toFixed(1),
        method:    'Holt ETS',
      };
    });
  }

  // Fallback: linear regression for exactly 2 points
  const reg = linearRegression(ys);
  if (!reg) return [];
  return Array.from({ length: monthsAhead }, (_, i) => {
    const x = ys.length + i;
    const predicted = Math.max(0, +(reg.slope * x + reg.intercept).toFixed(1));
    const band = bandPct(i + 1);
    return {
      month:     futureMonthLabel(i + 1),
      predicted,
      lower:     +(predicted * (1 - band)).toFixed(1),
      upper:     +(predicted * (1 + band)).toFixed(1),
      method:    'OLS',
    };
  });
}

/** Returns { slopePerMonth, direction, method } */
export function trendSummary(history) {
  if (!history || history.length < 2) return null;
  const ys = history.map(h => h.co2);
  if (ys.length >= 3) {
    const { level, trend } = holtSmoothing(ys) ?? {};
    if (level == null) return null;
    return {
      slopePerMonth: +trend.toFixed(2),
      direction: trend < -0.5 ? 'down' : trend > 0.5 ? 'up' : 'flat',
      method: 'Holt ETS',
    };
  }
  const reg = linearRegression(ys);
  if (!reg) return null;
  return {
    slopePerMonth: +reg.slope.toFixed(2),
    direction: reg.slope < -0.5 ? 'down' : reg.slope > 0.5 ? 'up' : 'flat',
    method: 'OLS',
  };
}
