import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'
import { calcEmissions } from '../utils/calculations'
import { calculateGreenScore } from '../utils/greenScore'
import { CAT_META } from '../constants/actionItems'

const MONTHLY_RUPEE_RATE = 2   // Rs per kg CO2 saved (per prompt spec)

const DIET_OPTIONS = [
  { value: 'veg',       label: 'Vegetarian' },
  { value: 'eggetarian',label: 'Eggetarian' },
  { value: 'nonveg',    label: 'Non-vegetarian' },
  { value: 'heavymeat', label: 'Heavy meat' },
]

const PRESETS = [
  {
    label: 'Go Vegetarian', icon: '🥗',
    apply: () => ({ diet: 'veg' }),
  },
  {
    label: 'Switch to EV', icon: '⚡',
    apply: () => ({ isEV: true }),
  },
  {
    label: 'Work From Home', icon: '🏠',
    apply: () => ({ kmPct: 80 }),
  },
  {
    label: 'Install Solar', icon: '☀️',
    apply: () => ({ electricityPct: 60 }),
  },
  {
    label: 'Full Green', icon: '🌿',
    apply: () => ({ diet: 'veg', isEV: true, kmPct: 50, electricityPct: 60, devicePct: 30 }),
  },
]

function SliderRow({ label, value, min, max, unit, onChange }) {
  return (
    <div className="slider-row">
      <div className="slider-label-row">
        <label className="slider-label">{label}</label>
        <span className="slider-value">{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} value={value}
        onChange={e => onChange(+e.target.value)}
        className="slider-input"
        aria-label={`${label}: ${value}${unit}`}
      />
      <div className="slider-range-labels">
        <span>{min}{unit}</span><span>{max}{unit}</span>
      </div>
    </div>
  )
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <label className="toggle-row" aria-label={label}>
      <span className="toggle-label">{label}</span>
      <div className="toggle-track" role="switch" aria-checked={checked}>
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
          className="sr-only" />
        <div className={`toggle-knob ${checked ? 'toggle-knob--on' : ''}`} />
      </div>
    </label>
  )
}

export default function WhatIfSimulator({ emissions, form }) {
  const [electricityPct, setElectricityPct] = useState(0)
  const [kmPct,          setKmPct]          = useState(0)
  const [devicePct,      setDevicePct]      = useState(0)
  const [diet,           setDiet]           = useState(form.diet)
  const [isEV,           setIsEV]           = useState(form.vehicle === 'ev')
  const [publicTransport,setPublicTransport] = useState(false)

  const applyPreset = preset => {
    const p = preset.apply()
    if (p.diet            !== undefined) setDiet(p.diet)
    if (p.isEV            !== undefined) setIsEV(p.isEV)
    if (p.kmPct           !== undefined) setKmPct(p.kmPct)
    if (p.electricityPct  !== undefined) setElectricityPct(p.electricityPct)
    if (p.devicePct       !== undefined) setDevicePct(p.devicePct)
  }

  const adjustedForm = useMemo(() => {
    const ptReduction = publicTransport ? 0.4 : 0
    const totalKmPct  = Math.min(100, kmPct / 100 + ptReduction)
    return {
      ...form,
      electricity: +(+form.electricity * (1 - electricityPct / 100)).toFixed(1),
      km:          +(+form.km  * (1 - totalKmPct)).toFixed(1),
      vehicle:     isEV ? 'ev' : form.vehicle,
      diet,
      smartphone:  +(+form.smartphone * (1 - devicePct / 100)).toFixed(1),
      laptop:      +(+form.laptop      * (1 - devicePct / 100)).toFixed(1),
    }
  }, [form, electricityPct, kmPct, devicePct, diet, isEV, publicTransport])

  const adjusted     = useMemo(() => calcEmissions(adjustedForm), [adjustedForm])
  const savedMonthly = +(emissions.total - adjusted.total).toFixed(2)
  const savedYearly  = +(savedMonthly * 12).toFixed(2)
  const savedRupees  = Math.round(savedMonthly * MONTHLY_RUPEE_RATE)
  const pctReduction = emissions.total > 0
    ? +((savedMonthly / emissions.total) * 100).toFixed(1) : 0
  const newScore     = calculateGreenScore(adjusted.total)

  // Bar chart data: before vs after per category
  const CAT_KEYS = ['electricity', 'lpg', 'transport', 'diet', 'smartphone', 'laptop']
  const barData  = CAT_KEYS.map(k => ({
    category: CAT_META[k]?.label ?? k,
    Before:   emissions[k] ?? 0,
    After:    adjusted[k]  ?? 0,
    color:    CAT_META[k]?.color ?? '#94a3b8',
  }))

  // Biggest saving opportunity
  const biggestSavingCat = CAT_KEYS.reduce((best, k) => {
    const diff = (emissions[k] ?? 0) - (adjusted[k] ?? 0)
    return diff > (best.diff ?? 0) ? { k, diff } : best
  }, {})

  const hasChanges = savedMonthly > 0.1

  return (
    <div className="card" role="region" aria-label="What-If Scenario Simulator">
      <h2 className="results-title">🔮 What-If Scenario Simulator</h2>

      {/* Preset buttons */}
      <div className="preset-row" role="group" aria-label="Preset scenarios">
        {PRESETS.map(p => (
          <button key={p.label} className="preset-btn" onClick={() => applyPreset(p)}
            aria-label={`Apply preset: ${p.label}`}>
            <span aria-hidden="true">{p.icon}</span> {p.label}
          </button>
        ))}
      </div>

      <div className="simulator-grid">
        {/* Left: current */}
        <div className="sim-col sim-col--current">
          <h3 className="sim-col-title">Current</h3>
          <div className="sim-stat">
            <span className="sim-stat-label">Monthly CO₂</span>
            <span className="sim-stat-value">{emissions.total} kg</span>
          </div>
          <div className="sim-stat">
            <span className="sim-stat-label">Green Score</span>
            <span className="sim-stat-value">{calculateGreenScore(emissions.total)} / 100</span>
          </div>
          <div className="sim-stat">
            <span className="sim-stat-label">Electricity</span>
            <span className="sim-stat-value">{form.electricity} kWh</span>
          </div>
          <div className="sim-stat">
            <span className="sim-stat-label">Distance</span>
            <span className="sim-stat-value">{form.km} km</span>
          </div>
          <div className="sim-stat">
            <span className="sim-stat-label">Vehicle</span>
            <span className="sim-stat-value">{form.vehicle}</span>
          </div>
          <div className="sim-stat">
            <span className="sim-stat-label">Diet</span>
            <span className="sim-stat-value">{form.diet}</span>
          </div>
        </div>

        {/* Right: controls */}
        <div className="sim-col sim-col--adjust">
          <h3 className="sim-col-title">Adjust</h3>

          <SliderRow label="Electricity reduction" value={electricityPct}
            min={0} max={50} unit="%" onChange={setElectricityPct} />
          <SliderRow label="km driven reduction" value={kmPct}
            min={0} max={100} unit="%" onChange={setKmPct} />
          <SliderRow label="Device usage reduction" value={devicePct}
            min={0} max={50} unit="%" onChange={setDevicePct} />

          <div className="slider-row">
            <label className="slider-label" htmlFor="diet-select">Diet change</label>
            <select id="diet-select" value={diet} onChange={e => setDiet(e.target.value)}
              className="field-input" style={{ marginTop: 4 }}>
              {DIET_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <ToggleRow label="Switch to Electric Vehicle (EV)" checked={isEV} onChange={setIsEV} />
          <ToggleRow
            label="Use public transport 2 days/week (−40% transport)"
            checked={publicTransport} onChange={setPublicTransport} />
        </div>
      </div>

      {/* Results */}
      {hasChanges && (
        <div className="sim-results" role="region" aria-label="Scenario results">
          <div className="sim-result-grid">
            <div className="sim-result-card sim-result-card--green">
              <div className="sim-result-value">{adjusted.total} kg</div>
              <div className="sim-result-label">New Monthly CO₂</div>
            </div>
            <div className="sim-result-card sim-result-card--blue">
              <div className="sim-result-value">−{savedMonthly} kg</div>
              <div className="sim-result-label">Saved / month</div>
            </div>
            <div className="sim-result-card sim-result-card--purple">
              <div className="sim-result-value">−{savedYearly} kg</div>
              <div className="sim-result-label">Saved / year</div>
            </div>
            <div className="sim-result-card sim-result-card--amber">
              <div className="sim-result-value">₹{savedRupees}/mo</div>
              <div className="sim-result-label">Money saved</div>
            </div>
            <div className="sim-result-card sim-result-card--teal">
              <div className="sim-result-value">−{pctReduction}%</div>
              <div className="sim-result-label">Reduction</div>
            </div>
            <div className="sim-result-card sim-result-card--green">
              <div className="sim-result-value">{newScore} / 100</div>
              <div className="sim-result-label">New Green Score</div>
            </div>
          </div>
        </div>
      )}

      {/* Before/After bar chart */}
      <h3 className="chart-sub-title" style={{ marginTop: 20 }}>Before vs After by Category</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={barData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="category" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 11 }} unit=" kg" />
          <Tooltip formatter={(v, name) => [`${v} kg`, name]} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="Before" fill="#94a3b8" radius={[3,3,0,0]} />
          <Bar dataKey="After"  fill="#16a34a" radius={[3,3,0,0]}
            label={biggestSavingCat.k && ((props) => {
              const isMax = barData[props.index]?.category === CAT_META[biggestSavingCat.k]?.label
              if (!isMax || !hasChanges) return null
              return (
                <text x={props.x + props.width / 2} y={props.y - 6}
                  textAnchor="middle" fontSize={9} fill="#16a34a" fontWeight="700">
                  Best Impact
                </text>
              )
            })} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
