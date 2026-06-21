import { EMISSION_FACTORS as EF } from '../constants/emissionFactors';
import { INDIA_AVERAGES } from '../constants/indiaAverages';
import { getGridFactor } from '../constants/stateGridFactors';

const MONTHS_ABR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Map form diet key -> EF key
const DIET_KEY = {
  veg:       'foodVeg',
  eggetarian:'foodEggetarian',
  nonveg:    'foodNonVeg',
  heavymeat: 'foodHeavyMeat',
};

// Monthly emission calculation
export function calcEmissions(f) {
  const gridFactor = f.state ? getGridFactor(f.state) : EF.electricity;
  const evFactor   = EF.ev * (gridFactor / EF.electricity);
  const vehicleEF  = f.vehicle === 'ev' ? evFactor : (EF[f.vehicle] ?? EF.petrolBike);

  const elec      = +f.electricity * gridFactor;
  const lpg       = +f.lpg         * EF.lpg;
  const transport = +f.km          * vehicleEF;
  const diet      = EF[DIET_KEY[f.diet]] ?? EF.foodNonVeg;
  const phone     = EF.smartphone  * +f.smartphone * 30;
  const lap       = EF.laptop      * +f.laptop      * 30;
  const total     = elec + lpg + transport + diet + phone + lap;
  return {
    electricity: +elec.toFixed(2),
    lpg:         +lpg.toFixed(2),
    transport:   +transport.toFixed(2),
    diet:        +diet.toFixed(2),
    smartphone:  +phone.toFixed(2),
    laptop:      +lap.toFixed(2),
    total:       +total.toFixed(2),
    gridFactor:  +gridFactor.toFixed(4),
    state:       f.state || '',
  };
}

// Daily emission calculation
export function calcDailyEmissions(f) {
  const gridFactor = f.state ? getGridFactor(f.state) : EF.electricity;
  const evFactor   = EF.ev * (gridFactor / EF.electricity);
  const vehicleEF  = f.vehicle === 'ev' ? evFactor : (EF[f.vehicle] ?? EF.petrolBike);

  const elec      = +f.electricity * gridFactor;
  const transport = +f.km          * vehicleEF;
  // Daily diet is 1/30th of monthly diet
  const diet      = (EF[DIET_KEY[f.diet]] ?? EF.foodNonVeg) / 30;
  const phone     = EF.smartphone  * +f.smartphone;
  const lap       = EF.laptop      * +f.laptop;
  const lpg       = 0; // We assume no daily LPG direct input, maybe they use induction or we ignore for daily
  const total     = elec + transport + diet + phone + lap;
  return {
    electricity: +elec.toFixed(2),
    lpg:         0,
    transport:   +transport.toFixed(2),
    diet:        +diet.toFixed(2),
    smartphone:  +phone.toFixed(2),
    laptop:      +lap.toFixed(2),
    total:       +total.toFixed(2),
    gridFactor:  +gridFactor.toFixed(4),
    state:       f.state || '',
  };
}

export function calculateAnnual(monthly) {
  return +(monthly * 12).toFixed(2);
}

export function monthLabel(offsetMonths = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() - offsetMonths);
  return MONTHS_ABR[d.getMonth()] + " '" + String(d.getFullYear()).slice(2);
}

export function validateForm(f) {
  const e = {};
  const num = (v, label, max) => {
    if (v === '' || isNaN(v)) return `Enter a valid number for ${label}`;
    if (+v < 0)              return `${label} cannot be negative`;
    if (max && +v > max)     return `${label} seems too high (max ${max})`;
    return null;
  };
  const fields = [
    ['electricity', 'Electricity (kWh)', 9999],
    ['lpg',         'LPG cylinders',      20],
    ['km',          'Distance (km)',    15000],
    ['smartphone',  'Smartphone hrs',      24],
    ['laptop',      'Laptop hrs',          24],
  ];
  fields.forEach(([k, l, m]) => { 
    if (f[k] !== undefined) {
      const msg = num(f[k], l, m); if (msg) e[k] = msg; 
    }
  });
  if (f.smartphone !== undefined && f.laptop !== undefined && !e.smartphone && !e.laptop && (+f.smartphone + +f.laptop) > 24)
    e.laptop = 'Combined screen time cannot exceed 24 hrs/day';
  return e;
}

export function validateDailyForm(f) {
  const e = {};
  const num = (v, label, max) => {
    if (v === '' || isNaN(v)) return `Enter a valid number for ${label}`;
    if (+v < 0)              return `${label} cannot be negative`;
    if (max && +v > max)     return `${label} seems too high (max ${max})`;
    return null;
  };
  const fields = [
    ['electricity', 'Daily Electricity (kWh)', 100],
    ['km',          'Daily Distance (km)',    1000],
    ['smartphone',  'Smartphone hrs',      24],
    ['laptop',      'Laptop hrs',          24],
  ];
  fields.forEach(([k, l, m]) => { 
    if (f[k] !== undefined) {
      const msg = num(f[k], l, m); if (msg) e[k] = msg; 
    }
  });
  if (f.smartphone !== undefined && f.laptop !== undefined && !e.smartphone && !e.laptop && (+f.smartphone + +f.laptop) > 24)
    e.laptop = 'Combined screen time cannot exceed 24 hrs/day';
  return e;
}

export function localInsight(emissions, form) {
  const CAT_LABELS = {
    electricity: 'electricity', lpg: 'LPG gas',
    transport: 'transport', diet: 'diet',
    smartphone: 'smartphone usage', laptop: 'laptop usage',
  };
  const keys = Object.keys(CAT_LABELS).filter(k => emissions[k] !== undefined && emissions[k] > 0);
  if (keys.length === 0) return "You have no significant emissions recorded. Keep up the good work!";
  const topKey = keys.map(k => ({ k, v: emissions[k] }))
    .sort((a, b) => b.v - a.v)[0].k;
  const topLabel = CAT_LABELS[topKey];
  const tips = {
    electricity: "Switch your geyser to a solar water heater and set your AC to 24 degrees C - together these can save 30+ kg CO2 each month.",
    lpg:         "Consider an induction cooktop powered by green electricity; India's solar capacity means induction is now cleaner than LPG in most states.",
    transport:   "Replace 3 car trips per week with metro or BRTS; in most Indian cities this alone can cut transport emissions by 40%.",
    diet:        "Introducing one millets-and-vegetables day per week (a traditional Indian practice) can reduce your dietary footprint by about 22 kg CO2/month.",
    smartphone:  "Charging devices during daylight hours when solar generation peaks, and enabling battery saver mode, reduces grid draw significantly.",
    laptop:      "Switching your laptop charger off at the mains overnight and enabling power-saving mode can collectively save several kg CO2 monthly.",
  };
  const generic = `Your ${topLabel} is your largest source at ${emissions[topKey]} kg CO2 - targeting it first will give you the fastest results.`;
  return `${generic} ${tips[topKey] || 'Small consistent changes in daily habits compound into significant annual reductions.'}`;
}
