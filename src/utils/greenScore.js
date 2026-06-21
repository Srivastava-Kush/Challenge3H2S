// Linear scale: 0 kg = score 100, 316 kg = score 0
const MAX_CO2 = 316;

export function calculateGreenScore(totalMonthly) {
  if (totalMonthly <= 0)        return 100;
  if (totalMonthly >= MAX_CO2)  return 0;
  return Math.round(100 - (totalMonthly / MAX_CO2) * 100);
}

export function getScoreLabel(score) {
  if (score >= 80) return 'Climate Hero';
  if (score >= 60) return 'Sustainability Champion';
  if (score >= 40) return 'Eco Explorer';
  if (score >= 20) return 'Green Beginner';
  return 'Carbon Heavy';
}
