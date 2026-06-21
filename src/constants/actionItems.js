export const ACTIONS = [
  { id: 'led',         label: 'Replace all bulbs with LEDs',              saving: 5,  icon: '💡', cat: 'electricity' },
  { id: 'ac24',        label: 'Set AC thermostat to 24 degrees C',        saving: 14, icon: '❄️', cat: 'electricity' },
  { id: 'solar_wh',    label: 'Install a solar water heater',             saving: 15, icon: '☀️', cat: 'electricity' },
  { id: 'star5',       label: 'Upgrade to 5-star rated appliances',       saving: 8,  icon: '⭐', cat: 'electricity' },
  { id: 'transit',     label: 'Use metro / BRTS 3 times per week',        saving: 28, icon: '🚌', cat: 'transport'   },
  { id: 'carpool',     label: 'Carpool to work daily',                    saving: 32, icon: '🤝', cat: 'transport'   },
  { id: 'cycle',       label: 'Cycle for trips under 3 km',               saving: 20, icon: '🚲', cat: 'transport'   },
  { id: 'veg_day',     label: 'One plant-based day per week',             saving: 22, icon: '🥗', cat: 'diet'        },
  { id: 'local_food',  label: 'Buy locally grown seasonal produce',       saving: 8,  icon: '🌾', cat: 'diet'        },
  { id: 'induction',   label: 'Use induction cooktop instead of LPG',     saving: 10, icon: '🍳', cat: 'lpg'         },
  { id: 'unplug',      label: 'Unplug chargers and devices overnight',    saving: 3,  icon: '🔌', cat: 'devices'     },
  { id: 'screen_less', label: 'Reduce screen time by 2 hrs/day',          saving: 4,  icon: '📵', cat: 'devices'     },
]

export const CAT_META = {
  electricity: { label: 'Electricity', icon: '⚡', color: '#f59e0b' },
  lpg:         { label: 'LPG Gas',     icon: '🔥', color: '#ef4444' },
  transport:   { label: 'Transport',   icon: '🚗', color: '#3b82f6' },
  diet:        { label: 'Diet',        icon: '🍽️', color: '#22c55e' },
  smartphone:  { label: 'Smartphone',  icon: '📱', color: '#8b5cf6' },
  laptop:      { label: 'Laptop',      icon: '💻', color: '#6366f1' },
}

export const POTENTIAL_SAVINGS = ACTIONS.reduce((s, a) => s + a.saving, 0)
