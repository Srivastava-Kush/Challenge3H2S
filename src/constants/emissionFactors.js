// Sources: CEA 2022-23, IPCC 2006 GL, ICCT India, MoRTH 2022, FAO/WRI, PPAC India
export const EMISSION_FACTORS = {
  // Electricity — state-wise factors in stateGridFactors.js; this is the national fallback
  electricity:      0.82,   // kg CO2/kWh  (CEA v18 national grid avg)
  // LPG cooking
  lpg:              42.3,   // kg CO2/cylinder (14.2 kg × 2.983 kg CO2/kg; IPCC 2006 GL Vol.2 Table 2.2)
  // Road transport (ICCT India 2021 + MoRTH 2022 fleet averages)
  petrolBike:       0.089,  // kg CO2/km — 2-wheeler petrol (~45 km/L → 0.089)
  petrolCar:        0.171,  // kg CO2/km — petrol car
  dieselCar:        0.198,  // kg CO2/km — diesel car
  cngBike:          0.042,  // kg CO2/km — CNG 2-wheeler (ICCT, 2.35 kg CO2/kg CNG)
  cngCar:           0.120,  // kg CO2/km — CNG car/auto (~8 km/kg CNG)
  ev:               0.022,  // kg CO2/km — EV charged from national grid (will be updated by state factor)
  // Diet (Poore & Nemecek 2018 Science, adapted to Indian portions)
  foodVeg:          45,     // kg CO2/month
  foodEggetarian:   60,     // kg CO2/month
  foodNonVeg:       99,     // kg CO2/month
  foodHeavyMeat:    150,    // kg CO2/month
  // Digital devices (IEA 2022 device energy + grid factor)
  smartphone:       0.003,  // kg CO2 per hr/day × 30 days
  laptop:           0.05,   // kg CO2 per hr/day × 30 days
};
