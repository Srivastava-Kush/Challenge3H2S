// Normal distribution CDF approximation (Abramowitz & Stegun)
function normalCDF(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const poly =
    t * (0.319381530 +
    t * (-0.356563782 +
    t * (1.781477937 +
    t * (-1.821255978 +
    t * 1.330274429))));
  const pdf = Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  const cdf = 1 - pdf * poly;
  return x >= 0 ? cdf : 1 - cdf;
}

const MEAN = 158;
const STD  = 45;

/**
 * Returns what percentage of Indian users the person is cleaner than.
 * e.g. 80 means the user emits less than 80% of Indians.
 */
export function calculatePercentile(userMonthly) {
  const z = (userMonthly - MEAN) / STD;
  // P(X < userMonthly) = fraction of Indians who emit MORE → percentile of cleanliness
  const fractionBelow = normalCDF(z);      // fraction emitting less than user
  const cleanerThan   = 1 - fractionBelow; // fraction user is cleaner than
  return Math.round(Math.max(0, Math.min(100, cleanerThan * 100)));
}
