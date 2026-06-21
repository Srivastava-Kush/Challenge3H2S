import { useState, useEffect } from 'react'
import { trainModel, predict, getModelMetrics, DIET_IDX, VEHICLE_EF_MAP, INPUT_LABELS } from '../utils/predictionModel'
import { calcEmissions } from '../utils/calculations'

const CONFIDENCE_RANGE = 0.15  // ±15%

function MetricBadge({ r2Pct }) {
  const color = r2Pct >= 90 ? '#16a34a' : r2Pct >= 75 ? '#d97706' : '#dc2626'
  return (
    <div className="metric-badge" style={{ borderColor: color }} aria-label={`Model accuracy R² = ${r2Pct}%`}>
      <div className="metric-badge-label">Model R² Accuracy</div>
      <div className="metric-badge-value" style={{ color }}>{r2Pct}%</div>
      <div className="metric-badge-sub">on synthetic training data (200 pts)</div>
    </div>
  )
}

function CoeffChart({ beta }) {
  // Show feature importances (absolute coefficients normalised 0-100)
  // Skip intercept (index 0)
  const feats = beta.slice(1).map((b, i) => ({ label: INPUT_LABELS[i + 1], coef: b, abs: Math.abs(b) }))
  const maxAbs = Math.max(...feats.map(f => f.abs))

  return (
    <div className="coef-chart" aria-label="Feature importance from model coefficients">
      {feats.map(f => {
        const pct = maxAbs > 0 ? (f.abs / maxAbs) * 100 : 0
        return (
          <div key={f.label} className="coef-row">
            <div className="coef-label">{f.label}</div>
            <div className="coef-bar-wrap">
              <div className="coef-bar" style={{ width: `${pct.toFixed(1)}%`, background: f.coef > 0 ? '#ef4444' : '#16a34a' }} />
            </div>
            <div className="coef-value">{f.coef.toFixed(3)}</div>
          </div>
        )
      })}
      <p className="coef-legend">Red = increases CO₂ · Green = decreases CO₂ · Width = relative impact</p>
    </div>
  )
}

export default function PredictionModelSection({ currentEmissions, form }) {
  const [beta,    setBeta]    = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [inputs,  setInputs]  = useState({
    electricity: form.electricity || '',
    cylinders:   form.lpg         || '',
    km:          form.km          || '',
    vehicle:     form.vehicle     || 'petrolBike',
    diet:        form.diet        || 'nonveg',
    smartphone:  form.smartphone  || '',
    laptop:      form.laptop      || '',
  })
  const [predicted, setPredicted] = useState(null)

  // Train on mount
  useEffect(() => {
    const coeffs  = trainModel()
    const metrics = getModelMetrics(coeffs)
    setBeta(coeffs)
    setMetrics(metrics)
  }, [])

  const buildInp = (v) => [
    +v.electricity,
    +v.cylinders,
    +v.km,
    VEHICLE_EF_MAP[v.vehicle] ?? 0.089,
    DIET_IDX[v.diet] ?? 2,
    +v.smartphone,
    +v.laptop,
  ]

  const runPredict = () => {
    if (!beta) return
    setPredicted(predict(buildInp(inputs), beta))
  }

  const handleChange = e => {
    const nv = { ...inputs, [e.target.name]: e.target.value }
    setInputs(nv)
    if (beta) setPredicted(predict(buildInp(nv), beta))
  }

  useEffect(() => { if (beta) runPredict() }, [beta])  // eslint-disable-line react-hooks/exhaustive-deps

  const lower   = predicted !== null ? +(predicted * (1 - CONFIDENCE_RANGE)).toFixed(2) : null
  const upper   = predicted !== null ? +(predicted * (1 + CONFIDENCE_RANGE)).toFixed(2) : null
  const calcVal = currentEmissions.total

  return (
    <div className="card" role="region" aria-label="Prediction Model">
      <h2 className="results-title">🧮 ML Prediction Model (OLS Regression)</h2>
      <p className="pred-intro">
        A multiple linear regression model trained on 200 synthetic Indian household data points
        using the Ordinary Least Squares normal equation: <em>β = (XᵀX)⁻¹Xᵀy</em>.
        Adjust the inputs to predict CO₂ without re-submitting the main form.
      </p>

      {!beta && (
        <div className="pred-loading" role="status" aria-live="polite">
          <div className="spinner" aria-hidden="true" />
          <span>Training model…</span>
        </div>
      )}

      {metrics && <MetricBadge r2Pct={metrics.r2Pct} />}

      {beta && (
        <>
          <div className="pred-form-grid">
            {[
              { id: 'electricity', label: 'Electricity (kWh)', type: 'number', max: 9999 },
              { id: 'cylinders',   label: 'LPG cylinders',     type: 'number', max: 20   },
              { id: 'km',          label: 'Distance (km)',      type: 'number', max: 15000 },
              { id: 'smartphone',  label: 'Smartphone (hrs/d)', type: 'number', max: 24  },
              { id: 'laptop',      label: 'Laptop (hrs/d)',     type: 'number', max: 24  },
            ].map(f => (
              <div key={f.id} className="pred-field">
                <label htmlFor={`pred-${f.id}`} className="field-label">{f.label}</label>
                <input id={`pred-${f.id}`} name={f.id} type={f.type}
                  value={inputs[f.id]} onChange={handleChange}
                  min={0} max={f.max} step="0.1"
                  className="field-input" aria-label={f.label} />
              </div>
            ))}
            <div className="pred-field">
              <label htmlFor="pred-vehicle" className="field-label">Vehicle</label>
              <select id="pred-vehicle" name="vehicle" value={inputs.vehicle} onChange={handleChange}
                className="field-input">
                <option value="petrolBike">Petrol bike</option>
                <option value="cngBike">CNG bike</option>
                <option value="petrolCar">Petrol car</option>
                <option value="dieselCar">Diesel car</option>
                <option value="cngCar">CNG car</option>
                <option value="ev">Electric (EV)</option>
              </select>
            </div>
            <div className="pred-field">
              <label htmlFor="pred-diet" className="field-label">Diet</label>
              <select id="pred-diet" name="diet" value={inputs.diet} onChange={handleChange}
                className="field-input">
                <option value="veg">Vegetarian</option>
                <option value="eggetarian">Eggetarian</option>
                <option value="nonveg">Non-vegetarian</option>
                <option value="heavymeat">Heavy meat</option>
              </select>
            </div>
          </div>

          {/* Prediction vs Calculated */}
          {predicted !== null && (
            <div className="pred-result-row" role="region" aria-label="Prediction results">
              <div className="pred-result-card pred-result-card--model">
                <div className="pred-result-label">Model Prediction</div>
                <div className="pred-result-value">{predicted} kg</div>
                <div className="pred-result-range">
                  Range: {lower} – {upper} kg (±{Math.round(CONFIDENCE_RANGE * 100)}%)
                </div>
              </div>
              <div className="pred-result-card pred-result-card--calc">
                <div className="pred-result-label">Formula Calculation</div>
                <div className="pred-result-value">{calcVal} kg</div>
                <div className="pred-result-range">
                  Δ {Math.abs(predicted - calcVal).toFixed(2)} kg difference
                </div>
              </div>
            </div>
          )}

          <h3 className="chart-sub-title" style={{ marginTop: 20 }}>Feature Importance (β coefficients)</h3>
          <CoeffChart beta={beta} />
        </>
      )}
    </div>
  )
}
