import { INDIA_AVERAGES } from '../constants/indiaAverages'
import { APPLIANCES } from '../constants/applianceData'
import { calculateGreenScore, getScoreLabel } from '../utils/greenScore'
import { calculatePercentile } from '../utils/percentile'
import { calculateAnnual } from '../utils/calculations'
import { CAT_META, POTENTIAL_SAVINGS } from '../constants/actionItems'
import { STATE_GRID_FACTORS } from '../constants/stateGridFactors'

const TOTAL_APPLIANCE_KWH = APPLIANCES.reduce((s, a) => s + a.estimatedMonthlyKwh, 0)

/* ── helpers ────────────────────────────────────────────── */
function scoreColor(score) {
  return score >= 67 ? '#16a34a' : score >= 34 ? '#d97706' : '#dc2626'
}

function diffArrow(user, benchmark) {
  const pct = (((user - benchmark) / benchmark) * 100).toFixed(0)
  const above = user > benchmark
  return { pct: Math.abs(pct), above }
}

/* ── Section 1: Summary Cards ───────────────────────────── */
function SummaryCards({ emissions, annualCO2, score, scoreLabel }) {
  const scoreCol = scoreColor(score)
  const monthlyCol =
    emissions.total <= INDIA_AVERAGES.monthly * 0.7 ? '#16a34a'
    : emissions.total <= INDIA_AVERAGES.monthly     ? '#65a30d'
    : emissions.total <= INDIA_AVERAGES.monthly * 1.5 ? '#d97706'
    : '#dc2626'

  const cards = [
    {
      icon: '🌍',
      value: `${emissions.total} kg`,
      label: 'Monthly CO₂',
      sub: 'carbon dioxide',
      color: monthlyCol,
      ariaLabel: `Monthly CO2: ${emissions.total} kilograms`,
    },
    {
      icon: '📅',
      value: `${annualCO2} kg`,
      label: 'Annual CO₂',
      sub: 'projected',
      color: '#3b82f6',
      ariaLabel: `Annual CO2 projection: ${annualCO2} kilograms`,
    },
    {
      icon: '♻️',
      value: `${score} / 100`,
      label: 'Green Score',
      sub: scoreLabel,
      color: scoreCol,
      ariaLabel: `Green Score: ${score} out of 100 — ${scoreLabel}`,
    },
    {
      icon: '💰',
      value: `~${POTENTIAL_SAVINGS} kg`,
      label: 'Potential Savings',
      sub: 'per month max',
      color: '#0891b2',
      ariaLabel: `Maximum potential monthly savings: ${POTENTIAL_SAVINGS} kilograms CO2`,
    },
  ]

  return (
    <div className="summary-cards" role="region" aria-label="Carbon footprint summary">
      {cards.map(c => (
        <div key={c.label} className="summary-card" aria-label={c.ariaLabel}>
          <div className="summary-card-icon" aria-hidden="true">{c.icon}</div>
          <div className="summary-card-value" style={{ color: c.color }}>{c.value}</div>
          <div className="summary-card-label">{c.label}</div>
          <div className="summary-card-sub">{c.sub}</div>
        </div>
      ))}
    </div>
  )
}

/* ── Section 2: Green Score Gauge (SVG semicircle) ───────── */
function GreenScoreGauge({ score, label }) {
  const cx = 100, cy = 110, R = 85, SW = 16

  // angle in standard math (π at score=0, 0 at score=100)
  const toRad = s => Math.PI * (1 - s / 100)
  const pt = s => {
    const a = toRad(s)
    return [+(cx + R * Math.cos(a)).toFixed(2), +(cy - R * Math.sin(a)).toFixed(2)]
  }

  // sweep=1: clockwise in SVG screen coords = upper arc from left to right
  const arcD = (s1, s2) => {
    const [x1, y1] = pt(s1)
    const [x2, y2] = pt(s2)
    return `M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`
  }

  // Needle
  const na = toRad(score)
  const nl = R - SW / 2 - 3
  const [nx, ny] = [+(cx + nl * Math.cos(na)).toFixed(2), +(cy - nl * Math.sin(na)).toFixed(2)]
  const col = scoreColor(score)

  return (
    <div style={{ textAlign: 'center' }}>
      <svg viewBox="0 0 200 120" role="img"
        aria-label={`Green Score gauge: ${score} out of 100 — ${label}`}
        style={{ width: '100%', maxWidth: 280, display: 'block', margin: '0 auto' }}>

        {/* Background track (two 90° halves to avoid 180° degenerate arc) */}
        <path d={arcD(0, 50)}   fill="none" stroke="#e2e8f0" strokeWidth={SW + 3} strokeLinecap="butt" />
        <path d={arcD(50, 99.9)} fill="none" stroke="#e2e8f0" strokeWidth={SW + 3} strokeLinecap="butt" />

        {/* Color zones */}
        <path d={arcD(0, 33)}    fill="none" stroke="#fca5a5" strokeWidth={SW} strokeLinecap="butt" />
        <path d={arcD(33, 67)}   fill="none" stroke="#fde68a" strokeWidth={SW} strokeLinecap="butt" />
        <path d={arcD(67, 99.9)} fill="none" stroke="#86efac" strokeWidth={SW} strokeLinecap="butt" />

        {/* Active score overlay */}
        {score > 0 && (
          <path d={arcD(0, Math.min(score, 99.9))}
            fill="none" stroke={col} strokeWidth={SW - 5} strokeLinecap="round" />
        )}

        {/* Needle */}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={7} fill="#1e293b" />
        <circle cx={cx} cy={cy} r={3.5} fill="white" />

        {/* Score text */}
        <text x={cx} y={cy - 28} textAnchor="middle" fontSize="32" fontWeight="800" fill={col}
          aria-hidden="true">{score}</text>
        <text x={cx} y={cy - 12} textAnchor="middle" fontSize="10" fill="#64748b" aria-hidden="true">
          / 100
        </text>

        {/* Zone endpoint labels */}
        <text x={cx - R - 1} y={cy + 18} fontSize="9" fill="#94a3b8" textAnchor="middle" aria-hidden="true">0</text>
        <text x={cx + R + 1} y={cy + 18} fontSize="9" fill="#94a3b8" textAnchor="middle" aria-hidden="true">100</text>

        {/* Zone colour legend dots */}
        <circle cx={30}  cy={cy + 14} r={4} fill="#ef4444" aria-hidden="true" />
        <text   x={37}   y={cy + 18} fontSize="8.5" fill="#64748b" aria-hidden="true">Low (0-33)</text>
        <circle cx={86}  cy={cy + 14} r={4} fill="#f59e0b" aria-hidden="true" />
        <text   x={93}   y={cy + 18} fontSize="8.5" fill="#64748b" aria-hidden="true">Mid</text>
        <circle cx={119} cy={cy + 14} r={4} fill="#22c55e" aria-hidden="true" />
        <text   x={126}  y={cy + 18} fontSize="8.5" fill="#64748b" aria-hidden="true">High (67-100)</text>
      </svg>
      <p className="gauge-label" style={{ color: col }} aria-hidden="true">{label}</p>
    </div>
  )
}

/* ── Section 3: Category Breakdown (sorted highest first) ── */
function CategoryBreakdown({ emissions }) {
  const cats = Object.entries(CAT_META)
    .map(([k, m]) => ({ k, ...m, val: emissions[k] ?? 0 }))
    .sort((a, b) => b.val - a.val)
  const total = emissions.total || 1

  return (
    <div role="list" aria-label="Emissions breakdown by category">
      {cats.map(({ k, label, icon, color, val }) => {
        const pct = ((val / total) * 100).toFixed(1)
        return (
          <div key={k} className="cat-row" role="listitem"
            aria-label={`${label}: ${val} kg CO2, ${pct}% of total`}>
            <div className="cat-info">
              <span aria-hidden="true" className="cat-icon">{icon}</span>
              <span className="cat-label">{label}</span>
            </div>
            <div className="cat-bar-wrap">
              <div className="prog-bar-track">
                <div className="prog-bar-fill" style={{ width: `${pct}%`, backgroundColor: color }} />
              </div>
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

/* ── Section 4: India Benchmarking Cards ─────────────────── */
function BenchmarkingCards({ total }) {
  const benchmarks = [
    { label: 'National Avg', value: INDIA_AVERAGES.monthly, icon: '🇮🇳', desc: 'India average' },
    { label: 'Urban Avg',    value: INDIA_AVERAGES.urban,   icon: '🏙️',  desc: 'Urban India' },
    { label: 'Rural Avg',    value: INDIA_AVERAGES.rural,   icon: '🌾',  desc: 'Rural India' },
  ]

  return (
    <div className="bench-cards" role="region" aria-label="Benchmarking against India averages">
      {benchmarks.map(b => {
        const { pct, above } = diffArrow(total, b.value)
        return (
          <div key={b.label} className="bench-card"
            aria-label={`vs ${b.label} (${b.value} kg): you are ${pct}% ${above ? 'above' : 'below'}`}>
            <div className="bench-card-icon" aria-hidden="true">{b.icon}</div>
            <div className="bench-card-title">{b.label}</div>
            <div className="bench-card-avg">{b.value} kg/mo</div>
            <div className={`bench-card-diff ${above ? 'bench-above' : 'bench-below'}`} aria-hidden="true">
              {above ? '↑' : '↓'} {pct}% {above ? 'above' : 'below'}
            </div>
            <div className="bench-card-desc">{b.desc}</div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Section 5: Percentile Banner ────────────────────────── */
function PercentileBanner({ total }) {
  const pct = Math.round(calculatePercentile(total))
  const barPct = Math.min(100, Math.max(0, pct))

  return (
    <div className={`percentile-banner ${pct >= 50 ? 'percentile-banner--good' : 'percentile-banner--avg'}`}
      role="region" aria-label={`You are cleaner than ${pct}% of Indian users`}>
      <p className="percentile-headline" aria-live="polite">
        You are cleaner than <strong>{pct}%</strong> of Indian users
      </p>
      <div className="percentile-bar-track" role="progressbar"
        aria-valuenow={barPct} aria-valuemin={0} aria-valuemax={100}
        aria-label={`${pct}th percentile`}>
        <div className="percentile-bar-fill" style={{ width: `${barPct}%` }} />
      </div>
      <p className="percentile-footnote">
        Based on a normal distribution (mean 158 kg, std 45 kg) from CEA & MoRTH data
      </p>
    </div>
  )
}

/* ── Section 6: Smart Appliance Analyzer ─────────────────── */
function ApplianceAnalyzer({ electricityKwh }) {
  if (!electricityKwh || electricityKwh <= 0) {
    return (
      <p className="appliance-empty">
        Enter your monthly electricity consumption above to see the appliance breakdown.
      </p>
    )
  }

  const appliances = APPLIANCES.map(a => {
    const estKwh = +(electricityKwh * (a.estimatedMonthlyKwh / TOTAL_APPLIANCE_KWH)).toFixed(1)
    const estCo2 = +(estKwh * 0.82).toFixed(2)
    const isHigh = estKwh > a.estimatedMonthlyKwh * 0.85
    return { ...a, estKwh, estCo2, isHigh }
  })

  return (
    <div className="appliance-wrap" role="region" aria-label="Smart appliance energy breakdown">
      <p className="appliance-note">
        Estimated distribution of your {electricityKwh} kWh across typical appliances
      </p>
      <table className="appliance-table" aria-label="Appliance usage estimates">
        <thead>
          <tr>
            <th scope="col">Appliance</th>
            <th scope="col">Est. kWh/mo</th>
            <th scope="col">CO₂ kg</th>
            <th scope="col">Tip</th>
          </tr>
        </thead>
        <tbody>
          {appliances.map(a => (
            <tr key={a.name} className={a.isHigh ? 'appliance-row--high' : ''}
              aria-label={`${a.name}: ${a.estKwh} kWh, ${a.estCo2} kg CO2${a.isHigh ? ' — high usage' : ''}`}>
              <td>
                <span className="appliance-name">{a.name}</span>
                {a.isHigh && <span className="appliance-badge" aria-label="High usage">⚠️</span>}
              </td>
              <td>
                <div className="appliance-kwh-bar-wrap">
                  <div className="appliance-kwh-bar"
                    style={{ width: `${Math.min(100, (a.estKwh / electricityKwh) * 100 * 3)}%` }} />
                  <span>{a.estKwh}</span>
                </div>
              </td>
              <td>{a.estCo2}</td>
              <td className="appliance-tip">{a.isHigh ? a.upgradeRecommendation : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="appliance-footer">
        Saving potential if you upgrade high-use appliances:{' '}
        <strong>
          {appliances.filter(a => a.isHigh).reduce((s, a) => s + a.potentialSaving, 0)} kg CO₂/month
        </strong>
      </p>
    </div>
  )
}

/* ── Section 7: Climate Persona ──────────────────────────── */
const PERSONAS = {
  ecoWarrior: {
    name: 'Eco Warrior',
    description:
      'You are living very sustainably by Indian standards. Your carbon footprint is among the lowest in the country — keep championing renewable energy, public transport, and plant-rich diets.',
    emoji: '🌿',
    bg: '#f0fdf4',
    border: '#86efac',
  },
  consciousCommuter: {
    name: 'Conscious Commuter',
    description:
      'Transport is your biggest emissions source. Switching to metro, BRTS, or carpooling 3 days a week — or an EV — could cut your footprint by 30 kg or more per month.',
    emoji: '🚗',
    bg: '#eff6ff',
    border: '#93c5fd',
  },
  energySaver: {
    name: 'Energy Saver',
    description:
      'Home electricity is your largest impact area. Upgrading to 5-star appliances, setting your AC to 24°C, and installing a solar water heater can make a big difference.',
    emoji: '⚡',
    bg: '#fffbeb',
    border: '#fde68a',
  },
  digitalMinimalist: {
    name: 'Digital Minimalist',
    description:
      'Device usage drives most of your footprint. Reducing screen time by 2 hours a day, enabling power-saving mode, and charging during solar hours (10 am–4 pm) all help.',
    emoji: '📱',
    bg: '#faf5ff',
    border: '#d8b4fe',
  },
  sustainabilityExplorer: {
    name: 'Sustainability Explorer',
    description:
      'Your food choices and cooking fuel account for a large share of your footprint. Introducing one millet-and-vegetable day per week and trying an induction cooktop are great first steps.',
    emoji: '🌱',
    bg: '#f0fdfa',
    border: '#99f6e4',
  },
}

function getPersona(emissions) {
  if (emissions.total < 100) return PERSONAS.ecoWarrior

  const cats = [
    { key: 'transport',   val: emissions.transport },
    { key: 'electricity', val: emissions.electricity },
    { key: 'devices',     val: (emissions.smartphone || 0) + (emissions.laptop || 0) },
  ]
  const top = cats.sort((a, b) => b.val - a.val)[0].key

  if (top === 'transport')   return PERSONAS.consciousCommuter
  if (top === 'electricity') return PERSONAS.energySaver
  if (top === 'devices')     return PERSONAS.digitalMinimalist
  return PERSONAS.sustainabilityExplorer
}

function ClimatePersona({ emissions }) {
  const p = getPersona(emissions)
  return (
    <div className="persona-card" style={{ background: p.bg, borderColor: p.border }}
      role="region" aria-label={`Your climate persona: ${p.name}`}>
      <div className="persona-emoji" aria-hidden="true">{p.emoji}</div>
      <div className="persona-body">
        <h3 className="persona-name">{p.name}</h3>
        <p className="persona-desc">{p.description}</p>
      </div>
    </div>
  )
}

/* ── Grid factor info bar ────────────────────────────────── */
function GridFactorBar({ emissions }) {
  const gf    = emissions.gridFactor ?? 0.820
  const state = emissions.state || ''
  const nat   = STATE_GRID_FACTORS['National Average']
  const diff  = gf - nat
  const color = gf < 0.5 ? '#16a34a' : gf < 0.82 ? '#65a30d' : gf < 1.0 ? '#d97706' : '#dc2626'
  const tier  = gf < 0.5 ? 'Very clean grid' : gf < 0.82 ? 'Cleaner than average' : gf < 1.0 ? 'Average–dirty' : 'High-carbon grid'
  return (
    <div className="grid-factor-bar" role="note" aria-label={`Grid emission factor: ${gf} kg CO2 per kWh`}>
      <span className="grid-factor-icon" style={{ color }} aria-hidden="true">⚡</span>
      <span className="grid-factor-label">
        {state ? <strong>{state}</strong> : 'National average'} grid:
      </span>
      <span className="grid-factor-value" style={{ color }}>
        <strong>{gf.toFixed(3)}</strong> kg CO₂/kWh
      </span>
      <span className="grid-factor-tier" style={{ color }}>{tier}</span>
      {state && (
        <span className="grid-factor-diff" style={{ color: diff < 0 ? '#16a34a' : '#dc2626' }}>
          {diff < 0 ? `${Math.abs(diff).toFixed(3)} below` : `${diff.toFixed(3)} above`} national avg
        </span>
      )}
    </div>
  )
}

/* ── Dashboard root ──────────────────────────────────────── */
export default function Dashboard({ emissions, form }) {
  const score = calculateGreenScore(emissions.total)
  const label = getScoreLabel(score)
  const annualCO2 = calculateAnnual(emissions.total)

  return (
    <div className="dashboard">
      {/* 1 — Summary Cards */}
      <SummaryCards
        emissions={emissions}
        annualCO2={annualCO2}
        score={score}
        scoreLabel={label}
      />

      {/* 2 — Green Score Gauge */}
      <div className="card">
        <h2 className="results-title">♻️ Green Score</h2>
        <GreenScoreGauge score={score} label={label} />
      </div>

      {/* 3 — Category Breakdown + grid factor context */}
      <div className="card">
        <h2 className="results-title">🗂️ Breakdown by Category</h2>
        <GridFactorBar emissions={emissions} />
        <CategoryBreakdown emissions={emissions} />
      </div>

      {/* 4 — India Benchmarking */}
      <div className="card">
        <h2 className="results-title">📊 India Benchmarking</h2>
        <BenchmarkingCards total={emissions.total} />
      </div>

      {/* 5 — Percentile Banner */}
      <PercentileBanner total={emissions.total} />

      {/* 6 — Smart Appliance Analyzer */}
      <div className="card">
        <h2 className="results-title">📊 Smart Appliance Analyzer</h2>
        <ApplianceAnalyzer electricityKwh={+form.electricity || 0} />
      </div>

      {/* 7 — Climate Persona */}
      <div className="card">
        <h2 className="results-title">🌟 Your Climate Persona</h2>
        <ClimatePersona emissions={emissions} />
      </div>
    </div>
  )
}
