// State-wise CO2 emission factors for electricity grid (kg CO2/kWh)
// Source: CEA CO2 Baseline Database for Indian Power Sector, Version 18 (2022-23)
// URL: https://cea.nic.in/cdm-co2-baseline-database/
export const STATE_GRID_FACTORS = {
  'Andhra Pradesh':   0.748,
  'Arunachal Pradesh':0.209,
  'Assam':            0.583,
  'Bihar':            0.987,
  'Chhattisgarh':     1.049,
  'Delhi':            0.717,
  'Goa':              0.673,
  'Gujarat':          0.762,
  'Haryana':          0.834,
  'Himachal Pradesh': 0.149,
  'Jharkhand':        1.027,
  'Karnataka':        0.627,
  'Kerala':           0.441,
  'Madhya Pradesh':   0.967,
  'Maharashtra':      0.735,
  'Manipur':          0.157,
  'Meghalaya':        0.399,
  'Mizoram':          0.070,
  'Nagaland':         0.156,
  'Odisha':           0.956,
  'Punjab':           0.613,
  'Rajasthan':        0.846,
  'Sikkim':           0.064,
  'Tamil Nadu':       0.762,
  'Telangana':        0.791,
  'Tripura':          0.638,
  'Uttar Pradesh':    0.871,
  'Uttarakhand':      0.393,
  'West Bengal':      0.813,
  'Jammu & Kashmir':  0.301,
  'Ladakh':           0.180,
  'Puducherry':       0.762,
  'National Average': 0.820,
}

export const STATES_LIST = Object.keys(STATE_GRID_FACTORS).filter(s => s !== 'National Average').sort()

export function getGridFactor(state) {
  return STATE_GRID_FACTORS[state] ?? STATE_GRID_FACTORS['National Average']
}
