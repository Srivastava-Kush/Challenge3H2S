import React, { useState, useCallback, useRef, useEffect, useMemo, Suspense } from 'react'
import AuthModal from './components/AuthModal'
import UserMenu from './components/UserMenu'
import Profile from './components/Profile'
import { useAuth } from './context/AuthContext'
import { INDIA_AVERAGES } from './constants/indiaAverages'
import { calcEmissions, calcDailyEmissions, validateForm, validateDailyForm } from './utils/calculations'
import { ACTIONS, CAT_META } from './constants/actionItems'
import { STATES_LIST, getGridFactor } from './constants/stateGridFactors'
import { calculateGreenScore } from './utils/greenScore'
import { calculatePercentile } from './utils/percentile'
import { api } from './utils/api'
const BillUpload = React.lazy(() => import('./components/BillUpload'))
import DashboardComponent from './components/Dashboard'
import HistorySectionComponent from './components/HistorySection'
import WhatIfSimulatorComponent from './components/WhatIfSimulator'
import PredictionModelSectionComponent from './components/PredictionModelSection'
import AICoach from './components/AICoach'

const Dashboard = React.memo(DashboardComponent)
const HistorySection = React.memo(HistorySectionComponent)
const WhatIfSimulator = React.memo(WhatIfSimulatorComponent)
const PredictionModelSection = React.memo(PredictionModelSectionComponent)

const INDIA_AVG = INDIA_AVERAGES.monthly

/* ── State + grid factor picker ─────────────────────────────── */
function StateField({ state, onChange }) {
  const gf = getGridFactor(state || '')
  const color = gf < 0.5 ? '#16a34a' : gf < 0.8 ? '#d97706' : '#dc2626'
  return (
    <div className="field">
      <label htmlFor="state" className="field-label">Your state
        <span style={{ fontWeight: 400, color: 'var(--slate-400)', fontSize: '0.82em' }}>
          {' '}— for accurate grid emission factor
        </span>
      </label>
      <select id="state" name="state" value={state} onChange={e => onChange(e.target.value)}
        className="field-input">
        <option value="">— National average —</option>
        {STATES_LIST.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <p className="field-hint" style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        Grid factor: <strong style={{ color }}>{gf.toFixed(3)} kg CO₂/kWh</strong>
        {state && <span style={{ color: 'var(--slate-400)' }}>· CEA 2022-23</span>}
      </p>
    </div>
  )
}

/* ── Generic form primitives ────────────────────────────────── */
function Field({ id, label, required, hint, error, children }) {
  return (
    <div className="field">
      <label htmlFor={id} className="field-label">
        {label}{required && <span className="req" aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="field-hint">{hint}</p>}
      {error && <p id={`${id}-err`} className="field-error" role="alert">{error}</p>}
    </div>
  )
}

function NumberInput({ id, name, value, onChange, onBlur, error, min = 0, max, step = '0.1', ...rest }) {
  return (
    <input
      type="number" id={id} name={name || id}
      value={value} onChange={onChange} onBlur={onBlur}
      min={min} max={max} step={step}
      aria-required="true"
      aria-invalid={!!error}
      aria-describedby={error ? `${id}-err` : rest.hint ? `${id}-hint` : undefined}
      className={`field-input${error ? ' field-input--error' : ''}`}
    />
  )
}

function ProgBar({ value, max, color }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="prog-bar-track">
      <div className="prog-bar-fill" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  )
}

/* ── Benchmark meter ────────────────────────────────────────── */
function BenchmarkMeter({ total }) {
  const ratio = total / INDIA_AVG
  const pct = (ratio * 100).toFixed(0)
  const diff = Math.abs(total - INDIA_AVG).toFixed(1)
  const isAbove = total > INDIA_AVG
  const lvl = total <= INDIA_AVG * 0.7 ? 'excellent'
    : total <= INDIA_AVG ? 'good'
      : total <= INDIA_AVG * 1.5 ? 'moderate'
        : 'high'
  const msgs = {
    excellent: '🌟 Excellent! Well below the national average.',
    good: "✅ Good job! You're below the Indian average.",
    moderate: '⚠️ Moderate footprint. Room to improve.',
    high: '🔴 High footprint. Significant action recommended.',
  }
  const barColors = { excellent: '#22c55e', good: '#84cc16', moderate: '#f59e0b', high: '#ef4444' }

  return (
    <div className={`benchmark benchmark--${lvl}`}
      role="region"
      aria-label={`Your monthly carbon footprint is ${total} kg CO2, which is ${pct} percent of the Indian average`}>
      <div className="benchmark-header">
        <div>
          <div className="benchmark-total">
            {total} <span className="benchmark-unit">kg CO&#8322;/month</span>
          </div>
          <div className="benchmark-message">{msgs[lvl]}</div>
        </div>
        <div className="benchmark-badge" aria-hidden="true">
          <div className="benchmark-pct">{pct}%</div>
          <div className="benchmark-sub">of India avg.</div>
        </div>
      </div>
      <div className="benchmark-bar-track" aria-hidden="true">
        <div className="benchmark-bar-fill" style={{
          width: `${Math.min(100, (ratio / 2) * 100)}%`,
          backgroundColor: barColors[lvl],
        }} />
        <div className="benchmark-mark" style={{ left: '50%' }}>
          <div className="benchmark-mark-line" />
          <div className="benchmark-mark-label">{INDIA_AVG} kg avg</div>
        </div>
      </div>
      <div className="benchmark-footer">
        You are <strong>{diff} kg</strong> {isAbove ? 'above' : 'below'} the Indian national average ({INDIA_AVG} kg/month)
      </div>
    </div>
  )
}

/* ── Category breakdown ─────────────────────────────────────── */
function Breakdown({ emissions }) {
  const cats = Object.entries(CAT_META)
    .map(([k, m]) => ({ k, ...m, val: emissions[k] }))
    .sort((a, b) => b.val - a.val)
  const total = emissions.total

  return (
    <div role="list" aria-label="Emissions by category">
      {cats.map(({ k, label, icon, color, val }) => {
        const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0
        return (
          <div key={k} className="cat-row" role="listitem"
            aria-label={`${label}: ${val} kg CO2 — ${pct}% of total`}>
            <div className="cat-info">
              <span aria-hidden="true" className="cat-icon">{icon}</span>
              <span className="cat-label">{label}</span>
            </div>
            <div>
              <ProgBar value={val} max={total} color={color} />
            </div>
            <div className="cat-values">
              <span className="cat-kg">{val} kg</span>
              <span className="cat-pct">{pct}%</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Trend chart (pure SVG) ────────────────────────── */
const TrendChart = React.memo(function TrendChart({ data, xKey = 'month', baselineValue = INDIA_AVG, baselineLabel = 'India avg' }) {
  const [tip, setTip] = useState(null)
  const W = 560, H = 220, ML = 52, MR = 20, MT = 14, MB = 36
  const cw = W - ML - MR, ch = H - MT - MB

  if (!data || data.length === 0) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--slate-500)' }}>No data available yet. Please calculate to see trends.</div>
  }

  const allVals = data.flatMap(d => [d.co2, baselineValue])
  const minV = Math.max(0, Math.min(...allVals) * 0.82)
  const maxV = Math.max(...allVals) * 1.14

  const xPos = i => ML + (i / Math.max(1, data.length - 1)) * cw
  const yPos = v => MT + ch - ((v - minV) / (maxV - minV)) * ch

  const linePath = data.map((d, i) =>
    `${i === 0 ? 'M' : 'L'}${xPos(i).toFixed(1)},${yPos(d.co2).toFixed(1)}`
  ).join(' ')
  const avgY = yPos(baselineValue).toFixed(1)
  const tickVals = Array.from({ length: 5 }, (_, i) => minV + ((maxV - minV) / 4) * i)

  return (
    <div className="chart-wrap" role="img"
      aria-label={`Line chart: your CO2 footprint vs ${baselineLabel} of ${baselineValue.toFixed(1)} kg`}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}
        onMouseLeave={() => setTip(null)}>
        {tickVals.map((v, i) => (
          <line key={i} x1={ML} x2={ML + cw} y1={yPos(v)} y2={yPos(v)} stroke="#e2e8f0" strokeWidth="1" />
        ))}
        <line x1={ML} x2={ML + cw} y1={avgY} y2={avgY} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6 3" />
        <text x={ML + cw - 4} y={+avgY - 5} fontSize="10" fill="#64748b" textAnchor="end">
          {baselineLabel} {baselineValue.toFixed(1)} kg
        </text>
        <line x1={ML} x2={ML} y1={MT} y2={MT + ch} stroke="#e2e8f0" strokeWidth="1" />
        {tickVals.map((v, i) => (
          <text key={i} x={ML - 6} y={yPos(v) + 4} fontSize="10" fill="#64748b" textAnchor="end">
            {Math.round(v)}
          </text>
        ))}
        <text x={12} y={MT + ch / 2} fontSize="10" fill="#94a3b8"
          textAnchor="middle" transform={`rotate(-90, 12, ${MT + ch / 2})`}>
          kg CO2
        </text>
        <line x1={ML} x2={ML + cw} y1={MT + ch} y2={MT + ch} stroke="#e2e8f0" strokeWidth="1" />
        {data.map((d, i) => (
          <text key={i} x={xPos(i)} y={MT + ch + 18} fontSize="10" fill="#64748b" textAnchor="middle">
            {d[xKey]}
          </text>
        ))}
        <path d={linePath} fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <g key={i} onMouseEnter={() => setTip({ i, d })} style={{ cursor: 'crosshair' }}>
            <circle cx={xPos(i)} cy={yPos(d.co2)} r={12} fill="transparent" />
            <circle cx={xPos(i)} cy={yPos(d.co2)} r={4} fill="#16a34a" stroke="#fff" strokeWidth="1.5" />
          </g>
        ))}
        {tip && (() => {
          const tx = xPos(tip.i), ty = yPos(tip.d.co2)
          const bx = Math.min(tx - 10, W - ML - 110), by = Math.max(MT, ty - 44)
          return (
            <g pointerEvents="none">
              <rect x={bx} y={by} width={108} height={36} rx={6}
                fill="white" stroke="#e2e8f0" strokeWidth="1"
                style={{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,.12))' }} />
              <text x={bx + 8} y={by + 14} fontSize="11" fontWeight="600" fill="#1e293b">{tip.d[xKey]}</text>
              <text x={bx + 8} y={by + 28} fontSize="11" fill="#16a34a">{tip.d.co2} kg CO2</text>
            </g>
          )
        })()}
      </svg>
      <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 12, color: '#64748b' }}>
        <span>
          <svg width="20" height="10" style={{ verticalAlign: 'middle', marginRight: 4 }}>
            <line x1="0" y1="5" x2="20" y2="5" stroke="#16a34a" strokeWidth="2.5" />
            <circle cx="10" cy="5" r="3" fill="#16a34a" />
          </svg>
          Your footprint
        </span>
        <span>
          <svg width="20" height="10" style={{ verticalAlign: 'middle', marginRight: 4 }}>
            <line x1="0" y1="5" x2="20" y2="5" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="5 3" />
          </svg>
          {baselineLabel}
        </span>
      </div>
    </div>
  )
})

/* ── Action checklist ───────────────────────────────────────── */
const ActionList = React.memo(function ActionList() {
  const [checked, setChecked] = useState({})
  const saved = ACTIONS.filter(a => checked[a.id]).reduce((s, a) => s + a.saving, 0)

  return (
    <div>
      {saved > 0 && (
        <div className="action-savings" aria-live="polite" aria-atomic="true">
          Recycling: If you take these actions, you could save <strong>{saved} kg CO2/month</strong>
        </div>
      )}
      <p className="actions-intro">Tick the actions you are willing to try:</p>
      <ul className="action-items" role="list">
        {ACTIONS.map(a => (
          <li key={a.id} role="listitem">
            <label className="action-label" htmlFor={`act-${a.id}`}>
              <input
                type="checkbox" id={`act-${a.id}`}
                checked={!!checked[a.id]}
                onChange={e => setChecked(c => ({ ...c, [a.id]: e.target.checked }))}
                className="action-check"
                aria-label={`${a.label} — saves approximately ${a.saving} kg CO2 per month`}
              />
              <span aria-hidden="true" className="action-icon">{a.icon}</span>
              <span className="action-text">{a.label}</span>
              <span className="action-save" aria-hidden="true">-{a.saving} kg</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
})


/* ── Calculator form ────────────────────────────────────────── */
function CalcForm({ onCalc, defaults = {} }) {
  const [f, setF] = useState({
    electricity: defaults.electricity ?? '',
    lpg: defaults.lpg ?? '',
    km: defaults.km ?? '',
    vehicle: defaults.vehicle || 'petrolBike',
    diet: defaults.diet || 'nonveg',
    smartphone: defaults.smartphone ?? '',
    laptop: defaults.laptop ?? '',
    state: defaults.state || '',
  })
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})

  useEffect(() => {
    setF({
      electricity: defaults.electricity ?? '',
      lpg: defaults.lpg ?? '',
      km: defaults.km ?? '',
      vehicle: defaults.vehicle || 'petrolBike',
      diet: defaults.diet || 'nonveg',
      smartphone: defaults.smartphone ?? '',
      laptop: defaults.laptop ?? '',
      state: defaults.state || '',
    })
    setErrors({})
    setTouched({})
  }, [defaults])

  const touch = name => setTouched(t => ({ ...t, [name]: true }))

  const handle = e => {
    const { name, value } = e.target
    const nf = { ...f, [name]: value }
    setF(nf)
    if (touched[name]) setErrors(validateForm(nf))
  }

  const blur = e => {
    touch(e.target.name)
    setErrors(validateForm({ ...f, [e.target.name]: e.target.value }))
  }

  const submit = e => {
    e.preventDefault()
    const touchAll = { electricity: true, lpg: true, km: true, smartphone: true, laptop: true }
    setTouched(touchAll)
    const errs = validateForm(f)
    setErrors(errs)
    if (!Object.keys(errs).length) onCalc(f, calcEmissions(f))
  }

  return (
    <form onSubmit={submit} noValidate aria-label="Monthly carbon footprint input form">
      <div className="form-grid">

        <section className="form-section" aria-labelledby="sec-energy">
          <h2 id="sec-energy" className="form-section-title">⚡ Energy Usage</h2>

          <StateField state={f.state} onChange={val => setF(nf => ({ ...nf, state: val }))} />

          <Field id="electricity" label="Electricity consumed (kWh)" required
            hint="Found on your BESCOM / MSEDCL / TNEB bill" error={errors.electricity}>
            <NumberInput id="electricity" value={f.electricity} onChange={handle} onBlur={blur}
              error={errors.electricity} max={9999} />
          </Field>
          <Suspense fallback={<div style={{padding: '1rem', textAlign: 'center', fontSize: '0.9rem', color: '#64748b'}}>Loading scanner...</div>}>
            <BillUpload
              fieldType="electricity"
              label="electricity bill"
              onValueExtracted={val => {
                const nf = { ...f, electricity: val }
                setF(nf)
                setTouched(t => ({ ...t, electricity: true }))
                setErrors(validateForm(nf))
              }}
            />
          </Suspense>

          <Field id="lpg" label="LPG cylinders used" required
            hint="14.2 kg domestic cylinders per month" error={errors.lpg}>
            <NumberInput id="lpg" value={f.lpg} onChange={handle} onBlur={blur}
              error={errors.lpg} max={20} step="0.5" />
          </Field>
          <Suspense fallback={<div style={{padding: '1rem', textAlign: 'center', fontSize: '0.9rem', color: '#64748b'}}>Loading scanner...</div>}>
            <BillUpload
              fieldType="lpg"
              label="LPG receipt"
              onValueExtracted={val => {
                const nf = { ...f, lpg: val }
                setF(nf)
                setTouched(t => ({ ...t, lpg: true }))
                setErrors(validateForm(nf))
              }}
            />
          </Suspense>
        </section>

        <section className="form-section" aria-labelledby="sec-transport">
          <h2 id="sec-transport" className="form-section-title">🚗 Transport</h2>
          <Field id="km" label="Distance driven (km/month)" required
            hint="Total kilometres by personal vehicle only" error={errors.km}>
            <NumberInput id="km" value={f.km} onChange={handle} onBlur={blur}
              error={errors.km} max={15000} />
          </Field>
          <Field id="vehicle" label="Vehicle type" required>
            <select id="vehicle" name="vehicle" value={f.vehicle} onChange={handle}
              className="field-input" aria-required="true">
              <option value="petrolBike">Two-wheeler — Petrol (bike / scooter)</option>
              <option value="cngBike">Two-wheeler — CNG</option>
              <option value="petrolCar">Four-wheeler — Petrol (car / SUV)</option>
              <option value="dieselCar">Four-wheeler — Diesel (car / SUV)</option>
              <option value="cngCar">Four-wheeler — CNG (car / auto)</option>
              <option value="ev">Electric vehicle (EV — uses your state grid factor)</option>
            </select>
          </Field>
        </section>

        <section className="form-section" aria-labelledby="sec-diet">
          <h2 id="sec-diet" className="form-section-title">🍽️ Diet</h2>
          <Field id="diet" label="Dietary pattern" required
            hint="Your typical food choices over the month">
            <select id="diet" name="diet" value={f.diet} onChange={handle}
              className="field-input" aria-required="true">
              <option value="veg">Vegetarian (no meat, no eggs)</option>
              <option value="eggetarian">Eggetarian (veg + eggs)</option>
              <option value="nonveg">Non-vegetarian (occasional meat / fish)</option>
              <option value="heavymeat">Heavy meat (daily meat consumption)</option>
            </select>
          </Field>
        </section>

        <section className="form-section" aria-labelledby="sec-devices">
          <h2 id="sec-devices" className="form-section-title">📱 Digital Devices</h2>
          <Field id="smartphone" label="Smartphone (hrs / day)" required
            hint="Average daily active screen time" error={errors.smartphone}>
            <NumberInput id="smartphone" value={f.smartphone} onChange={handle} onBlur={blur}
              error={errors.smartphone} max={24} step="0.5" />
          </Field>
          <Field id="laptop" label="Laptop (hrs / day)" required
            hint="Average daily work + personal use" error={errors.laptop}>
            <NumberInput id="laptop" value={f.laptop} onChange={handle} onBlur={blur}
              error={errors.laptop} max={24} step="0.5" />
          </Field>
        </section>

      </div>

      <button type="submit" className="calc-btn">
        🌍 Calculate My Monthly Footprint
      </button>
    </form>
  )
}

function CalcFormDaily({ onCalc, defaults = {} }) {
  const [f, setF] = useState({
    electricity: '', km: '',
    vehicle: defaults.vehicle || 'petrolBike',
    diet: defaults.diet || 'nonveg',
    smartphone: '', laptop: '',
    state: defaults.state || '',
  })
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})

  const touch = name => setTouched(t => ({ ...t, [name]: true }))

  const handle = e => {
    const { name, value } = e.target
    const nf = { ...f, [name]: value }
    setF(nf)
    if (touched[name]) setErrors(validateDailyForm(nf))
  }

  const blur = e => {
    touch(e.target.name)
    setErrors(validateDailyForm({ ...f, [e.target.name]: e.target.value }))
  }

  const submit = e => {
    e.preventDefault()
    const touchAll = { electricity: true, km: true, smartphone: true, laptop: true }
    setTouched(touchAll)
    const errs = validateDailyForm(f)
    setErrors(errs)
    if (!Object.keys(errs).length) onCalc(f, calcDailyEmissions(f))
  }

  return (
    <form onSubmit={submit} noValidate aria-label="Daily carbon footprint input form">
      <div className="form-grid">

        <section className="form-section" aria-labelledby="sec-energy">
          <h2 id="sec-energy" className="form-section-title">⚡ Daily Energy Usage</h2>
          <StateField state={f.state} onChange={val => setF(nf => ({ ...nf, state: val }))} />
          <Field id="electricity" label="Electricity consumed today (kWh)" required
            hint="Approximate daily usage" error={errors.electricity}>
            <NumberInput id="electricity" value={f.electricity} onChange={handle} onBlur={blur}
              error={errors.electricity} max={100} />
          </Field>
        </section>

        <section className="form-section" aria-labelledby="sec-transport">
          <h2 id="sec-transport" className="form-section-title">🚗 Daily Transport</h2>
          <Field id="km" label="Distance driven today (km)" required
            hint="Total kilometres by personal vehicle today" error={errors.km}>
            <NumberInput id="km" value={f.km} onChange={handle} onBlur={blur}
              error={errors.km} max={1000} />
          </Field>
          <Field id="vehicle" label="Vehicle type" required>
            <select id="vehicle" name="vehicle" value={f.vehicle} onChange={handle}
              className="field-input" aria-required="true">
              <option value="petrolBike">Two-wheeler — Petrol (bike / scooter)</option>
              <option value="cngBike">Two-wheeler — CNG</option>
              <option value="petrolCar">Four-wheeler — Petrol (car / SUV)</option>
              <option value="dieselCar">Four-wheeler — Diesel (car / SUV)</option>
              <option value="cngCar">Four-wheeler — CNG (car / auto)</option>
              <option value="ev">Electric vehicle (EV)</option>
            </select>
          </Field>
        </section>

        <section className="form-section" aria-labelledby="sec-diet">
          <h2 id="sec-diet" className="form-section-title">🍽️ Diet</h2>
          <Field id="diet" label="Dietary pattern" required
            hint="Your typical food choices today">
            <select id="diet" name="diet" value={f.diet} onChange={handle}
              className="field-input" aria-required="true">
              <option value="veg">Vegetarian (no meat, no eggs)</option>
              <option value="eggetarian">Eggetarian (veg + eggs)</option>
              <option value="nonveg">Non-vegetarian (occasional meat / fish)</option>
              <option value="heavymeat">Heavy meat (daily meat consumption)</option>
            </select>
          </Field>
        </section>

        <section className="form-section" aria-labelledby="sec-devices">
          <h2 id="sec-devices" className="form-section-title">📱 Digital Devices</h2>
          <Field id="smartphone" label="Smartphone (hrs today)" required
            hint="Active screen time today" error={errors.smartphone}>
            <NumberInput id="smartphone" value={f.smartphone} onChange={handle} onBlur={blur}
              error={errors.smartphone} max={24} step="0.5" />
          </Field>
          <Field id="laptop" label="Laptop (hrs today)" required
            hint="Work + personal use today" error={errors.laptop}>
            <NumberInput id="laptop" value={f.laptop} onChange={handle} onBlur={blur}
              error={errors.laptop} max={24} step="0.5" />
          </Field>
        </section>

      </div>

      <button type="submit" className="calc-btn">
        🌍 Calculate My Daily Footprint
      </button>
    </form>
  )
}

/* ── Results section ────────────────────────────────────────── */
function Results({ emissions, form, mode, graphData, currentAvg, onClearHistory, syncingHistory }) {
  const { user } = useAuth()
  const [graphType, setGraphType] = useState(mode)

  const normalizedMonthlyHistory = useMemo(() => {
    return graphData.monthly.map(d => ({
      month:      d.date || d.month,
      co2:        d.total,
      timestamp:  new Date(d.createdAt ?? d.timestamp ?? Date.now()).getTime(),
      categories: d.categories,
    }));
  }, [graphData.monthly])

  return (
    <div role="region" aria-label="Carbon footprint results">
      <div className="card" style={{ background: '#f0fdf4', border: '1px solid #16a34a', marginBottom: '2rem' }}>
        <h3 style={{ margin: '0 0 0.5rem 0', color: '#166534' }}>✅ {mode === 'daily' ? "Today's" : "Monthly"} Emission Recorded</h3>
        <p style={{ margin: 0 }}>
          {user ? 'Your emission record has been saved.' : 'Guest calculation complete (not saved).'}
        </p>
        {mode === 'daily' && currentAvg && (
          <p style={{ marginTop: '0.5rem', fontWeight: 500 }}>Your average daily emission this month is {currentAvg.toFixed(1)} kg CO2.</p>
        )}
      </div>

      <Dashboard emissions={emissions} form={form} />
      <HistorySection history={normalizedMonthlyHistory} onClear={onClearHistory} syncing={syncingHistory} />
      
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 className="results-title" style={{ margin: 0 }}>📈 Emission Trends</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }} role="group" aria-label="Select trend view">
            <button 
              id="btn-trend-daily"
              onClick={() => setGraphType('daily')}
              aria-pressed={graphType === 'daily'}
              style={{ padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid #cbd5e1', background: graphType === 'daily' ? '#16a34a' : '#fff', color: graphType === 'daily' ? '#fff' : '#475569', cursor: 'pointer' }}>
              Daily
            </button>
            <button 
              id="btn-trend-monthly"
              onClick={() => setGraphType('monthly')}
              aria-pressed={graphType === 'monthly'}
              style={{ padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid #cbd5e1', background: graphType === 'monthly' ? '#16a34a' : '#fff', color: graphType === 'monthly' ? '#fff' : '#475569', cursor: 'pointer' }}>
              Monthly
            </button>
          </div>
        </div>
        
        {graphType === 'monthly' && graphData.monthly.length < 2 && (
          <div style={{ background: '#fffbeb', padding: '1rem', borderRadius: '6px', marginBottom: '1rem', color: '#b45309' }}>
            Calculate for previous months to see your 6-month trend.
          </div>
        )}
        
        {graphType === 'monthly' ? (
          <TrendChart 
            data={graphData.monthly.map(d => {
              try {
                return { month: new Date(d.date).toLocaleString('en-IN', { month: 'short', year: '2-digit' }), co2: d.total }
              } catch { return { month: d.date, co2: d.total } }
            })}
            xKey="month" 
            baselineValue={INDIA_AVG} 
            baselineLabel="India avg/mo" 
          />
        ) : (
          <TrendChart 
            data={graphData.daily.map(d => {
              try {
                return { date: new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), co2: d.total }
              } catch { return { date: d.date, co2: d.total } }
            })}
            xKey="date" 
            baselineValue={INDIA_AVG / 30} 
            baselineLabel="India avg/day" 
          />
        )}
      </div>
      
      <WhatIfSimulator emissions={emissions} form={form} />
      <PredictionModelSection currentEmissions={emissions} form={form} />
      <div className="card">
        <h2 className="results-title">🎯 Actions You Can Take</h2>
        <ActionList />
      </div>
      <AICoach emissions={emissions} form={form} />
    </div>
  )
}

/* ── Root App ───────────────────────────────────────────────── */
export default function App() {
  const { user, firebaseEnabled } = useAuth()
  const [showAuth, setShowAuth] = useState(false)
  const [profile, setProfile] = useState({})
  const [view, setView] = useState('home')
  const [mode, setMode] = useState('daily')
  const [historyData, setHistoryData] = useState({ daily: [], monthly: [] })
  
  const [transientDaily, setTransientDaily] = useState(null)
  const [transientMonthly, setTransientMonthly] = useState(null)
  const [syncingHistory, setSyncingHistory] = useState(false)

  // Error / status banners
  const [fetchError, setFetchError]     = useState(null)
  const [saveError,  setSaveError]      = useState(null)
  const [clearError, setClearError]     = useState(null)
  const [saveSuccess, setSaveSuccess]   = useState(false)

  // Custom period selection states (Phase 2)
  const [chooseCustomPeriod, setChooseCustomPeriod] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(() => String(new Date().getMonth() + 1).padStart(2, '0'))
  const [selectedYear, setSelectedYear] = useState(() => String(new Date().getFullYear()))

  // Prefill defaults for CalcForm
  const [prefillData, setPrefillData] = useState(null)

  // Duplicate prompt modal overlay
  const [existingPrompt, setExistingPrompt] = useState(null)
  const [isUpdatingRecord, setIsUpdatingRecord] = useState(false)
  const [iconFailed, setIconFailed] = useState(false)

  // Override viewed calculation
  const [viewedCalculation, setViewedCalculation] = useState(null)

  const resultRef = useRef(null)

  // Reset states when switching mode
  useEffect(() => {
    setViewedCalculation(null)
    setPrefillData(null)
    setIsUpdatingRecord(false)
    setChooseCustomPeriod(false)
    setSelectedMonth(String(new Date().getMonth() + 1).padStart(2, '0'))
    setSelectedYear(String(new Date().getFullYear()))
  }, [mode])

  // Show Auth Modal automatically on initial load if user is not signed in
  useEffect(() => {
    if (firebaseEnabled && !user) {
      setShowAuth(true)
    }
  }, [user, firebaseEnabled])

  // Fetch actual history and profile when user is authenticated
  const fetchData = useCallback(async () => {
    if (!firebaseEnabled || !user) return
    setSyncingHistory(true)
    setFetchError(null)
    try {
      const p = await api.getProfile()
      if (p?.vehicle || p?.diet || p?.state) setProfile(p)
      
      const daily = await api.getHistory('?type=daily')
      const monthly = await api.getHistory('?type=monthly')
      setHistoryData({ daily, monthly })
    } catch (e) {
      setFetchError('Could not load your data from the server. ' + (e.message || 'Please try refreshing.'))
    } finally {
      setSyncingHistory(false)
    }
  }, [user, firebaseEnabled])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const activeDaily = useMemo(() => {
    if (user && historyData.daily.length > 0) {
      return historyData.daily[historyData.daily.length - 1]
    }
    return transientDaily
  }, [user, historyData.daily, transientDaily])

  const activeMonthly = useMemo(() => {
    if (user && historyData.monthly.length > 0) {
      return historyData.monthly[historyData.monthly.length - 1]
    }
    return transientMonthly
  }, [user, historyData.monthly, transientMonthly])

  const activeCalc = viewedCalculation || (mode === 'daily' ? activeDaily : activeMonthly)

  const activeEmissions = useMemo(() => {
    if (!activeCalc) return null
    return {
      total: activeCalc.total,
      electricity: activeCalc.categories?.electricity ?? 0,
      lpg: activeCalc.categories?.lpg ?? 0,
      transport: activeCalc.categories?.transport ?? 0,
      diet: activeCalc.categories?.diet ?? 0,
      smartphone: activeCalc.categories?.smartphone ?? 0,
      laptop: activeCalc.categories?.laptop ?? 0,
      gridFactor: activeCalc.gridFactor,
      state: activeCalc.state,
    }
  }, [activeCalc])

  const activeForm = useMemo(() => {
    if (!activeCalc) return null
    return {
      electricity: activeCalc.formInputs?.electricity ?? '',
      lpg: activeCalc.formInputs?.lpg ?? '',
      km: activeCalc.formInputs?.km ?? '',
      vehicle: activeCalc.formInputs?.vehicle ?? '',
      diet: activeCalc.formInputs?.diet ?? '',
      smartphone: activeCalc.formInputs?.smartphone ?? '',
      laptop: activeCalc.formInputs?.laptop ?? '',
      state: activeCalc.formInputs?.state ?? '',
    }
  }, [activeCalc])

  const resultsGraphData = useMemo(() => {
    const daily = (user && historyData.daily.length > 0)
      ? historyData.daily
      : (transientDaily ? [transientDaily] : []);
      
    const monthly = (user && historyData.monthly.length > 0)
      ? historyData.monthly
      : (transientMonthly ? [transientMonthly] : []);

    return { daily, monthly };
  }, [user, historyData.daily, historyData.monthly, transientDaily, transientMonthly]);

  const currentMonthAvg = useMemo(() => {
    const dailyData = resultsGraphData.daily;
    if (!dailyData.length) return 0;
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const currentMonthData = dailyData.filter(d => {
      const date = new Date(d.date);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });
    if (currentMonthData.length === 0) return 0;
    const total = currentMonthData.reduce((acc, curr) => acc + curr.total, 0);
    return total / currentMonthData.length;
  }, [resultsGraphData.daily])

  const handleClearHistory = useCallback(async () => {
    setClearError(null)
    if (user) {
      try {
        await api.clearHistory()
      } catch (e) {
        setClearError('Failed to clear cloud history: ' + (e.message || 'Please try again.'))
        return
      }
    }
    setHistoryData({ daily: [], monthly: [] })
    setTransientDaily(null)
    setTransientMonthly(null)
    setViewedCalculation(null)
  }, [user])

  const handleToggleCustomPeriod = useCallback(() => {
    setChooseCustomPeriod(c => {
      const newVal = !c
      if (!newVal) {
        setSelectedMonth(String(new Date().getMonth() + 1).padStart(2, '0'))
        setSelectedYear(String(new Date().getFullYear()))
      }
      return newVal
    })
    setPrefillData(null)
    setIsUpdatingRecord(false)
    setViewedCalculation(null)
  }, [])

  const saveCalculation = useCallback(async (calculatedData, form) => {
    setSaveError(null)
    setSaveSuccess(false)
    if (user) {
      try {
        await api.saveSubmission(calculatedData)
        await fetchData()
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 4000)
      } catch (err) {
        setSaveError('Failed to save your record: ' + (err.message || 'Please try again.'))
      }

      try {
        await api.upsertProfile({
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          vehicle: form.vehicle,
          diet: form.diet,
          state: form.state || '',
        })
      } catch {}
    } else {
      if (mode === 'daily') {
        setTransientDaily(calculatedData)
      } else {
        setTransientMonthly(calculatedData)
      }
    }

    setViewedCalculation(null)
    setPrefillData(null)
    setIsUpdatingRecord(false)

    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }, [user, mode, fetchData])

  const handleCalc = useCallback(async (form, emissions) => {
    const dateStr = mode === 'daily' 
      ? new Date().toISOString().split('T')[0] // YYYY-MM-DD
      : (chooseCustomPeriod ? `${selectedYear}-${selectedMonth}` : new Date().toISOString().slice(0, 7))

    const calculatedData = {
      date: dateStr,
      type: mode,
      total: emissions.total,
      categories: {
        electricity: emissions.electricity,
        lpg: emissions.lpg,
        transport: emissions.transport,
        diet: emissions.diet,
        smartphone: emissions.smartphone,
        laptop: emissions.laptop,
      },
      greenScore: calculateGreenScore(emissions.total),
      percentile: Math.round(calculatePercentile(emissions.total)),
      formInputs: {
        electricity: +form.electricity,
        lpg: form.lpg ? +form.lpg : 0,
        km: +form.km,
        vehicle: form.vehicle,
        diet: form.diet,
        smartphone: +form.smartphone,
        laptop: +form.laptop,
        state: form.state || '',
      },
      gridFactor: emissions.gridFactor,
      state: form.state || '',
    }

    // Duplicate Check
    if (mode === 'monthly' && !isUpdatingRecord) {
      const recordsSource = user ? historyData.monthly : (transientMonthly ? [transientMonthly] : [])
      const existing = recordsSource.find(d => d.date === dateStr && d.type === 'monthly')
      if (existing) {
        setExistingPrompt({ existing, calculatedData })
        return
      }
    }

    await saveCalculation(calculatedData, form)
  }, [user, mode, chooseCustomPeriod, selectedYear, selectedMonth, historyData.monthly, transientMonthly, isUpdatingRecord, saveCalculation])

  return (
    <div className="app">
      <header className="app-header" role="banner">
        <div className="header-icon" aria-hidden="true" onClick={() => setView('home')} style={{cursor: 'pointer', display: 'flex', alignItems: 'center'}}>
          {!iconFailed ? (
            <img 
              src="/favicon.ico" 
              alt="Logo" 
              style={{ width: '2.8rem', height: '2.8rem', objectFit: 'contain' }} 
              onError={() => setIconFailed(true)} 
            />
          ) : (
            '🌿'
          )}
        </div>
        <div style={{ flex: 1 }}>
          <h1 className="app-title" onClick={() => setView('home')} style={{cursor: 'pointer'}}>India Carbon Footprint Tracker</h1>
          <p className="app-subtitle">
            Estimate your CO&#8322; using real Indian emission factors · Benchmark against national average
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {user && (
            <button onClick={() => setView('profile')} style={{ background: 'none', border: '1px solid #cbd5e1', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' }}>
              Profile
            </button>
          )}
          <UserMenu onSignInClick={() => setShowAuth(true)} />
        </div>
      </header>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}

      {existingPrompt && (
        <div className="auth-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} role="dialog" aria-modal="true" aria-label="Emission Record Exists">
          <div className="auth-modal" style={{ maxWidth: '420px', padding: '2rem' }}>
            <h2 className="auth-modal-title" style={{ fontSize: '1.4rem', marginBottom: '1rem' }}>📅 Record Already Exists</h2>
            <p className="auth-modal-desc" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
              An emissions record for <strong>{existingPrompt.existing.date}</strong> already exists in your history. What would you like to do?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
              <button 
                className="calc-btn" 
                onClick={() => {
                  setViewedCalculation(existingPrompt.existing)
                  setExistingPrompt(null)
                }}
                style={{ width: '100%', padding: '0.75rem' }}
              >
                🔍 View Existing Record
              </button>
              <button 
                className="calc-btn" 
                onClick={() => {
                  setPrefillData(existingPrompt.existing.formInputs)
                  const [yr, mo] = existingPrompt.existing.date.split('-')
                  if (yr && mo) {
                    setSelectedYear(yr)
                    setSelectedMonth(mo)
                    setChooseCustomPeriod(true)
                  }
                  setIsUpdatingRecord(true)
                  setExistingPrompt(null)
                }}
                style={{ width: '100%', padding: '0.75rem', background: '#d97706', borderColor: '#d97706' }}
              >
                ✏️ Update Existing Record
              </button>
              <button 
                className="auth-skip-btn" 
                onClick={() => setExistingPrompt(null)}
                style={{ width: '100%', marginTop: '0.5rem' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {!firebaseEnabled && (
        <div className="demo-banner" role="note">
          <span>Guest mode — calculations are not saved. Add Firebase keys in <code>.env</code> to enable sign-in and cloud history.</span>
        </div>
      )}
      {firebaseEnabled && !user && !showAuth && (
        <div className="signin-banner" role="note">
          <span>Sign in to sync your history across devices and get personalised AI coaching.</span>
          <button className="signin-banner-btn" onClick={() => setShowAuth(true)}>Sign In</button>
        </div>
      )}

      {/* Status / error banners */}
      {fetchError && (
        <div role="alert" style={{
          background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626',
          borderRadius: 8, padding: '10px 16px', margin: '0 0 12px',
          fontSize: '0.86rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12
        }}>
          <span>⚠️ {fetchError}</span>
          <button onClick={() => setFetchError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontWeight: 700, fontSize: '1rem' }} aria-label="Dismiss">✕</button>
        </div>
      )}
      {saveError && (
        <div role="alert" style={{
          background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626',
          borderRadius: 8, padding: '10px 16px', margin: '0 0 12px',
          fontSize: '0.86rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12
        }}>
          <span>⚠️ {saveError}</span>
          <button onClick={() => setSaveError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontWeight: 700, fontSize: '1rem' }} aria-label="Dismiss">✕</button>
        </div>
      )}
      {clearError && (
        <div role="alert" style={{
          background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626',
          borderRadius: 8, padding: '10px 16px', margin: '0 0 12px',
          fontSize: '0.86rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12
        }}>
          <span>⚠️ {clearError}</span>
          <button onClick={() => setClearError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontWeight: 700, fontSize: '1rem' }} aria-label="Dismiss">✕</button>
        </div>
      )}
      {saveSuccess && (
        <div role="status" aria-live="polite" style={{
          background: '#f0fdf4', border: '1px solid #86efac', color: '#166534',
          borderRadius: 8, padding: '10px 16px', margin: '0 0 12px', fontSize: '0.86rem'
        }}>
          ✅ Emission record saved successfully.
        </div>
      )}
      {user && syncingHistory && (
        <div role="status" aria-live="polite" style={{
          background: 'var(--slate-50)', border: '1px solid var(--slate-200)', color: 'var(--slate-500)',
          borderRadius: 8, padding: '8px 16px', margin: '0 0 12px', fontSize: '0.84rem',
          display: 'flex', alignItems: 'center', gap: 8
        }}>
          <div className="spinner" style={{ width: 14, height: 14 }} aria-hidden="true" />
          Loading your data…
        </div>
      )}

      <main id="main-content">
        {view === 'profile' ? (
          <Profile onBack={() => setView('home')} />
        ) : (
          <>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 className="card-title" style={{ margin: 0 }}>Enter Your Data</h2>
                <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '4px' }} role="group" aria-label="Select calculation mode">
                  <button 
                    id="btn-mode-daily"
                    onClick={() => { setMode('daily'); }}
                    aria-pressed={mode === 'daily'}
                    style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', background: mode === 'daily' ? '#fff' : 'transparent', boxShadow: mode === 'daily' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontWeight: mode === 'daily' ? 600 : 400, cursor: 'pointer' }}>
                    Daily Emission
                  </button>
                  <button 
                    id="btn-mode-monthly"
                    onClick={() => { setMode('monthly'); }}
                    aria-pressed={mode === 'monthly'}
                    style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', background: mode === 'monthly' ? '#fff' : 'transparent', boxShadow: mode === 'monthly' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontWeight: mode === 'monthly' ? 600 : 400, cursor: 'pointer' }}>
                    Monthly Emission
                  </button>
                </div>
              </div>

              {mode === 'monthly' && (
                <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
                  <button 
                    type="button"
                    onClick={handleToggleCustomPeriod}
                    style={{ background: 'none', border: '1px solid #16a34a', color: '#16a34a', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}
                  >
                    {chooseCustomPeriod ? '📅 Use Current Month' : '📅 Add Previous Month Data'}
                  </button>

                  {chooseCustomPeriod && (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <select 
                        value={selectedMonth} 
                        onChange={e => {
                          setSelectedMonth(e.target.value)
                          setViewedCalculation(null)
                        }}
                        style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                        aria-label="Select month"
                      >
                        <option value="01">January</option>
                        <option value="02">February</option>
                        <option value="03">March</option>
                        <option value="04">April</option>
                        <option value="05">May</option>
                        <option value="06">June</option>
                        <option value="07">July</option>
                        <option value="08">August</option>
                        <option value="09">September</option>
                        <option value="10">October</option>
                        <option value="11">November</option>
                        <option value="12">December</option>
                      </select>
                      <select 
                        value={selectedYear} 
                        onChange={e => {
                          setSelectedYear(e.target.value)
                          setViewedCalculation(null)
                        }}
                        style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                        aria-label="Select year"
                      >
                        {Array.from({ length: 11 }, (_, i) => 2026 - i).map(yr => (
                          <option key={yr} value={String(yr)}>{yr}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {isUpdatingRecord && (
                    <span style={{ fontSize: '0.85rem', color: '#d97706', fontWeight: 500 }}>
                      ✏️ Updating record for {chooseCustomPeriod ? `${selectedYear}-${selectedMonth}` : 'Current Month'}
                    </span>
                  )}
                </div>
              )}
              
              {mode === 'daily' ? (
                <CalcFormDaily onCalc={handleCalc} defaults={profile} />
              ) : (
                <CalcForm onCalc={handleCalc} defaults={prefillData || profile} />
              )}
            </div>

            {activeCalc && (
              <div ref={resultRef}>
                <Results
                  emissions={activeEmissions}
                  form={activeForm}
                  mode={mode}
                  graphData={resultsGraphData}
                  currentAvg={currentMonthAvg}
                  onClearHistory={handleClearHistory}
                  syncingHistory={syncingHistory}
                />
              </div>
            )}
          </>
        )}
      </main>

      <footer className="app-footer" role="contentinfo" aria-label="Data sources and attributions">
        <p>
          Powered by Google Gemini · Data sources: CEA 2022-23 · ICCT India Two-Wheeler Study · MoRTH 2022 · FAO/WRI Food Systems ·
          India avg = {INDIA_AVG} kg CO&#8322;/person/month
        </p>
      </footer>
    </div>
  )
}
