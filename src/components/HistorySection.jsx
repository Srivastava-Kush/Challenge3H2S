import { useState, useCallback } from 'react'
import {
  LineChart, Line, BarChart, Bar, ComposedChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { buildForecast, trendSummary } from '../utils/forecasting'
import { CAT_META } from '../constants/actionItems'
import { INDIA_AVERAGES } from '../constants/indiaAverages'
import { api } from '../utils/api'
import { useAuth } from '../context/AuthContext'

const CAT_KEYS = ['electricity', 'lpg', 'transport', 'diet', 'smartphone', 'laptop']

/* ─── Improvement card ──────────────────────────────────────── */
function ImprovementCard({ history }) {
  if (history.length < 2) return null
  const first  = history[0].co2
  const latest = history[history.length - 1].co2
  const delta  = latest - first
  const pct    = Math.abs(((delta / first) * 100)).toFixed(1)
  const good   = delta < 0
  return (
    <div className={`improvement-card ${good ? 'improvement-card--good' : 'improvement-card--bad'}`}
      role="status" aria-live="polite">
      <span className="improvement-icon" aria-hidden="true">{good ? '📉' : '📈'}</span>
      <div>
        <div className="improvement-label">Since your first entry</div>
        <div className="improvement-value">
          {good ? 'Down' : 'Up'} {pct}%
          <span className="improvement-kg"> ({Math.abs(delta).toFixed(1)} kg/month)</span>
        </div>
        <div className="improvement-sub">
          {first.toFixed(1)} kg → {latest.toFixed(1)} kg
        </div>
      </div>
    </div>
  )
}

/* ─── Forecast table ────────────────────────────────────────── */
function ForecastTable({ forecastData }) {
  return (
    <table className="forecast-table" aria-label="6-month forecast">
      <thead>
        <tr>
          <th scope="col">Month</th>
          <th scope="col">Predicted CO₂</th>
          <th scope="col">Range (±15%)</th>
        </tr>
      </thead>
      <tbody>
        {forecastData.map(d => (
          <tr key={d.month}>
            <td>{d.month}</td>
            <td><strong>{d.predicted}</strong> kg</td>
            <td className="forecast-range">{d.lower} – {d.upper} kg</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* ─── Trend summary card ────────────────────────────────────── */
function TrendCard({ history }) {
  const trend = trendSummary(history)
  if (!trend) return null
  const { slopePerMonth, direction } = trend
  const color = direction === 'down' ? '#16a34a' : direction === 'up' ? '#dc2626' : '#64748b'
  const icon  = direction === 'down' ? '↘️' : direction === 'up' ? '↗️' : '→'
  const msg   = direction === 'down'
    ? `Improving! Decreasing by ${Math.abs(slopePerMonth)} kg/month on average.`
    : direction === 'up'
    ? `Increasing by ${slopePerMonth} kg/month on average. Try the What-If Simulator below.`
    : `Relatively stable (${slopePerMonth} kg/month change).`
  return (
    <div className="trend-summary-card" style={{ borderColor: color }}
      role="note" aria-label={`Trend: ${msg}`}>
      <span className="trend-icon" aria-hidden="true">{icon}</span>
      <p className="trend-msg" style={{ color }}>{msg}</p>
      <span className="trend-method" title="Forecasting algorithm">{trend.method}</span>
    </div>
  )
}

/* ─── Main HistorySection ───────────────────────────────────── */
export default function HistorySection({ history = [], onClear, syncing = false }) {
  const { user } = useAuth()
  const [confirmClear, setConfirmClear] = useState(false)
  const source = user ? 'cloud' : 'local'

  const handleClear = useCallback(async () => {
    if (onClear) {
      await onClear()
    }
    setConfirmClear(false)
  }, [onClear])

  if (history.length === 0) {
    return (
      <div className="card">
        <h2 className="results-title">📅 Emissions History</h2>
        <p className="history-empty">No history yet — submit the form each month to build your trend.</p>
      </div>
    )
  }

  const forecastData = buildForecast(history)

  // Combined data for forecast chart: historical + forecast (connected)
  const lastHist = history[history.length - 1]
  const combinedData = [
    ...history.map(d => ({ month: d.month, historical: d.co2 })),
    // Overlap point so lines connect
    { month: lastHist.month, forecast: lastHist.co2, forecastUpper: lastHist.co2 * 1.15, forecastLower: lastHist.co2 * 0.85 },
    ...forecastData.map(d => ({
      month:         d.month,
      forecast:      d.predicted,
      forecastUpper: d.upper,
      forecastLower: d.lower,
    })),
  ]

  // Stacked bar data (only entries with categories)
  const barData = history.filter(d => d.categories).map(d => ({
    month:       d.month,
    electricity: d.categories.electricity ?? 0,
    lpg:         d.categories.lpg ?? 0,
    transport:   d.categories.transport ?? 0,
    diet:        d.categories.diet ?? 0,
    smartphone:  d.categories.smartphone ?? 0,
    laptop:      d.categories.laptop ?? 0,
  }))

  return (
    <div className="card" role="region" aria-label="Emissions history and forecast">
      <div className="history-header">
        <h2 className="results-title">
          📅 Emissions History &amp; Forecast
          {syncing && <span className="history-syncing" aria-live="polite"> · syncing…</span>}
          {!syncing && source === 'cloud' && <span className="history-cloud-badge" title="Synced from cloud">☁️</span>}
        </h2>
        {!confirmClear ? (
          <button className="clear-btn" onClick={() => setConfirmClear(true)}
            aria-label="Clear all history data">
            Clear History
          </button>
        ) : (
          <div className="clear-confirm" role="alertdialog" aria-label="Confirm clear history">
            <span>Delete all history?</span>
            <button className="clear-btn--yes" onClick={handleClear}>Yes, delete</button>
            <button className="clear-btn--no"  onClick={() => setConfirmClear(false)}>Cancel</button>
          </div>
        )}
      </div>

      <ImprovementCard history={history} />
      <TrendCard history={history} />

      {/* Historical line chart */}
      <h3 className="chart-sub-title">Monthly CO₂ Trend</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={history.map(d => ({ month: d.month, co2: d.co2 }))} margin={{ top: 8, right: 20, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} unit=" kg" />
          <Tooltip formatter={v => [`${v} kg CO₂`, 'Monthly CO₂']} />
          <ReferenceLine y={INDIA_AVERAGES.monthly} stroke="#94a3b8" strokeDasharray="5 3"
            label={{ value: `Avg ${INDIA_AVERAGES.monthly} kg`, fontSize: 10, fill: '#94a3b8', position: 'insideTopRight' }} />
          <Line type="monotone" dataKey="co2" stroke="#16a34a" strokeWidth={2.5}
            dot={{ r: 4, fill: '#16a34a' }} activeDot={{ r: 6 }} name="Your CO₂" />
        </LineChart>
      </ResponsiveContainer>

      {/* Stacked bar chart */}
      {barData.length > 0 && (
        <>
          <h3 className="chart-sub-title" style={{ marginTop: 20 }}>Category Breakdown Over Time</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} margin={{ top: 8, right: 20, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit=" kg" />
              <Tooltip formatter={(v, name) => [`${v} kg`, CAT_META[name]?.label ?? name]} />
              <Legend formatter={name => CAT_META[name]?.label ?? name} wrapperStyle={{ fontSize: 11 }} />
              {CAT_KEYS.map(k => (
                <Bar key={k} dataKey={k} stackId="a" fill={CAT_META[k]?.color ?? '#94a3b8'} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </>
      )}

      {/* Forecast chart */}
      {forecastData.length > 0 && (
        <>
          <h3 className="chart-sub-title" style={{ marginTop: 20 }}>6-Month Forecast</h3>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={combinedData} margin={{ top: 8, right: 20, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit=" kg" />
              <Tooltip formatter={(v, name) => {
                if (name === 'historical') return [`${v} kg`, 'Actual CO₂']
                if (name === 'forecast')   return [`${v} kg`, 'Forecast']
                return [v, name]
              }} />
              <Legend formatter={name => name === 'historical' ? 'Actual' : name === 'forecast' ? 'Forecast (±15%)' : name}
                wrapperStyle={{ fontSize: 11 }} />
              {/* Confidence band: upper area then white mask for lower */}
              <Area type="monotone" dataKey="forecastUpper" fill="#fbbf24" stroke="none"
                fillOpacity={0.25} connectNulls={false} legendType="none" />
              <Area type="monotone" dataKey="forecastLower" fill="white"  stroke="none"
                fillOpacity={1}    connectNulls={false} legendType="none" />
              <Line type="monotone" dataKey="historical" stroke="#16a34a" strokeWidth={2.5}
                dot={{ r: 4 }} connectNulls={false} />
              <Line type="monotone" dataKey="forecast" stroke="#f59e0b" strokeWidth={2}
                strokeDasharray="6 3" dot={{ r: 4 }} connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>

          <ForecastTable forecastData={forecastData} />
        </>
      )}
    </div>
  )
}
