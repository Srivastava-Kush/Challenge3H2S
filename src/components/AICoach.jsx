import { useState, useCallback } from 'react'
import { CAT_META } from '../constants/actionItems'
import { EMISSION_FACTORS as EF } from '../constants/emissionFactors'
import { calculatePercentile } from '../utils/percentile'
import { calculateGreenScore, getScoreLabel } from '../utils/greenScore'
import { api } from '../utils/api'

/* ─── Cost savings helper ───────────────────────────────────── */
// Rates: 1 kWh = 8 Rs, 1 LPG cylinder = 950 Rs, 1 litre petrol = 100 Rs
function categorySavingsRupees(kgSaved, cat) {
  switch (cat) {
    case 'electricity': return Math.round(kgSaved / EF.electricity * 8)
    case 'lpg':         return Math.round(kgSaved / EF.lpg * 950)
    case 'transport':   return Math.round(kgSaved / 2.3 * 100)   // ~2.3 kg CO2/litre petrol
    default:            return Math.round(kgSaved * 10)
  }
}

/* ─── Section parser: splits "HEADER\ncontent" blocks ──────── */
function parseSections(text, headers) {
  const result = {}
  headers.forEach((h, i) => {
    const next  = headers[i + 1]
    const start = text.indexOf(h)
    if (start === -1) { result[h] = ''; return }
    const end   = next ? text.indexOf(next) : text.length
    result[h]   = text.slice(start + h.length, end !== -1 ? end : text.length).trim()
  })
  return result
}

/* ─── Feature 1: AI Sustainability Coach ───────────────────── */
const COACH_HEADERS = ['SUMMARY', 'TOP SOURCES', 'RECOMMENDATIONS', 'MONTHLY CHALLENGE']
const COACH_ICONS   = { SUMMARY: '📊', 'TOP SOURCES': '🔍', RECOMMENDATIONS: '✅', 'MONTHLY CHALLENGE': '🎯' }

function CoachCard({ header, content }) {
  const lines = content.split('\n').filter(Boolean)
  return (
    <div className="coach-card">
      <div className="coach-card-header">
        <span aria-hidden="true">{COACH_ICONS[header]}</span>
        <h4 className="coach-card-title">{header.charAt(0) + header.slice(1).toLowerCase()}</h4>
      </div>
      <div className="coach-card-body">
        {lines.map((l, i) => <p key={i} className="coach-card-line">{l}</p>)}
      </div>
    </div>
  )
}

function CoachSection({ emissions, form }) {
  const [text,    setText]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const fetch_ = useCallback(async () => {
    setLoading(true); setError(null); setText(null)
    const pct    = Math.round(calculatePercentile(emissions.total))
    const score  = calculateGreenScore(emissions.total)
    const persona = getScoreLabel(score)

    try {
      const data = await api.getCoachAdvice({ emissions, form, percentile: pct, greenScore: score, persona })
      setText(data.text)
    } catch (err) {
      setError(`Could not reach AI backend: ${err.message}. Make sure the server is running.`)
    } finally {
      setLoading(false)
    }
  }, [emissions, form])

  const sections = text ? parseSections(text, COACH_HEADERS) : null

  return (
    <div>
      <p className="ai-section-desc">
        Personalised advice based on your full profile — green score, percentile ranking, and climate persona.
      </p>
      {!text && !loading && (
        <button className="ai-btn" onClick={fetch_}
          aria-label="Get AI Sustainability Coach advice">
          ✨ Get Coach Advice
        </button>
      )}
      {loading && (
        <div className="ai-loading" role="status" aria-live="polite">
          <div className="spinner" aria-hidden="true" /> Gemini is analysing your profile…
        </div>
      )}
      {error && <p className="ai-error" role="alert">{error}</p>}
      {sections && (
        <div>
          <div className="coach-cards-grid">
            {COACH_HEADERS.map(h => sections[h] && (
              <CoachCard key={h} header={h} content={sections[h]} />
            ))}
          </div>
          <button className="ai-refresh-btn" onClick={fetch_} aria-label="Refresh AI advice">
            Refresh advice
          </button>
        </div>
      )}
    </div>
  )
}

/* ─── Feature 2: Monthly Challenge Generator ────────────────── */
const CHALLENGE_LEVELS = ['EASY', 'MEDIUM', 'AMBITIOUS']

function ChallengeCard({ data, onAccept, accepted }) {
  const colors = { EASY: '#22c55e', MEDIUM: '#f59e0b', AMBITIOUS: '#8b5cf6' }
  const col    = colors[data.level] ?? '#64748b'
  return (
    <div className={`challenge-card ${accepted ? 'challenge-card--accepted' : ''}`}
      style={{ borderColor: col }}
      role="article" aria-label={`${data.level} challenge: ${data.name}`}>
      <div className="challenge-level" style={{ background: col }}>{data.level}</div>
      <h4 className="challenge-name">{data.name}</h4>
      <p className="challenge-desc">{data.description}</p>
      <div className="challenge-meta">
        <span>💚 {data.co2Saving} kg CO₂/month</span>
        <span>₹{data.moneySaving}/month</span>
        <span>⏱ {data.duration}</span>
      </div>
      {!accepted
        ? <button className="accept-btn" onClick={() => onAccept(data)} style={{ borderColor: col, color: col }}>
            Accept Challenge
          </button>
        : <div className="accepted-badge" style={{ color: col }}>✓ Challenge Accepted!</div>
      }
    </div>
  )
}

function parseChallenges(text) {
  return CHALLENGE_LEVELS.map(lvl => {
    const start = text.indexOf(lvl)
    if (start === -1) return null
    const nextIdx = CHALLENGE_LEVELS.map(l => text.indexOf(l)).filter(i => i > start)
    const end   = nextIdx.length ? Math.min(...nextIdx) : text.length
    const block = text.slice(start + lvl.length, end).trim()
    // Extract fields using simple line parsing
    const getField = (pattern, fallback = '') => {
      const m = block.match(pattern)
      return m ? m[1].trim() : fallback
    }
    return {
      level:       lvl,
      name:        getField(/name[:\-]?\s*(.+)/i, `${lvl} Challenge`),
      description: getField(/description[:\-]?\s*(.+)/i, block.split('\n')[0] || ''),
      co2Saving:   getField(/co2 saving[:\-]?\s*([\d.]+)/i, '?'),
      moneySaving: getField(/money saving[:\-]?\s*(?:rs\.?|₹)?\s*([\d]+)/i, '?'),
      duration:    getField(/duration[:\-]?\s*(.+)/i, '30 days'),
    }
  }).filter(Boolean)
}

function ChallengeSection({ emissions }) {
  const [text,      setText]      = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [accepted,  setAccepted]  = useState({})

  const fetch_ = useCallback(async () => {
    setLoading(true); setError(null); setText(null)
    try {
      const data = await api.getChallenges({ emissions })
      setText(data.text)
    } catch (err) {
      setError(`Could not reach AI backend: ${err.message}. Make sure the server is running.`)
    } finally {
      setLoading(false)
    }
  }, [emissions])

  const handleAccept = challenge => {
    setAccepted(a => ({ ...a, [challenge.level]: true }))
    // Save to localStorage
    try {
      const existing = JSON.parse(localStorage.getItem('acceptedChallenges') || '[]')
      existing.push({ ...challenge, acceptedAt: Date.now() })
      localStorage.setItem('acceptedChallenges', JSON.stringify(existing))
    } catch {}
  }

  const challenges = text ? parseChallenges(text) : []

  return (
    <div>
      <p className="ai-section-desc">
        Get 3 personalised 30-day challenges tailored to your emissions profile.
      </p>
      {!text && !loading && (
        <button className="ai-btn" onClick={fetch_}
          aria-label="Generate personalised monthly challenges">
          🎯 Generate Challenges
        </button>
      )}
      {loading && (
        <div className="ai-loading" role="status" aria-live="polite">
          <div className="spinner" aria-hidden="true" /> Gemini is generating your challenges…
        </div>
      )}
      {error && <p className="ai-error" role="alert">{error}</p>}
      {challenges.length > 0 && (
        <div className="challenge-cards-row">
          {challenges.map(c => (
            <ChallengeCard key={c.level} data={c}
              onAccept={handleAccept} accepted={!!accepted[c.level]} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Feature 3: Cost Savings Calculator ───────────────────── */
const ACTIONS_SAVINGS = [
  { label: 'Replace bulbs with LEDs',         kgSaved: 5,  cat: 'electricity' },
  { label: 'AC at 24°C',                       kgSaved: 14, cat: 'electricity' },
  { label: 'Solar water heater',               kgSaved: 15, cat: 'electricity' },
  { label: '5-star appliances',                kgSaved: 8,  cat: 'electricity' },
  { label: 'Metro/BRTS 3×/week',               kgSaved: 28, cat: 'transport'   },
  { label: 'Carpool to work',                  kgSaved: 32, cat: 'transport'   },
  { label: 'Cycle for trips <3 km',            kgSaved: 20, cat: 'transport'   },
  { label: 'One plant-based day/week',         kgSaved: 22, cat: 'diet'        },
  { label: 'Locally grown seasonal produce',   kgSaved: 8,  cat: 'diet'        },
  { label: 'Induction cooktop instead of LPG', kgSaved: 10, cat: 'lpg'         },
  { label: 'Unplug devices overnight',         kgSaved: 3,  cat: 'electricity' },
  { label: 'Reduce screen time 2 hrs/day',     kgSaved: 4,  cat: 'electricity' },
]

function CostSavingsCalculator() {
  const [checked, setChecked] = useState({})
  const selected = ACTIONS_SAVINGS.filter(a => checked[a.label])
  const totalKg  = selected.reduce((s, a) => s + a.kgSaved, 0)
  const totalRs  = selected.reduce((s, a) => s + categorySavingsRupees(a.kgSaved, a.cat), 0)
  const annualRs = totalRs * 12

  return (
    <div>
      <p className="ai-section-desc">
        Tick actions you plan to take to see your potential rupee savings.
        Rates: ₹8/kWh electricity · ₹950/LPG cylinder · ₹100/litre petrol.
      </p>
      <ul className="savings-list" role="list">
        {ACTIONS_SAVINGS.map(a => (
          <li key={a.label} role="listitem">
            <label className="savings-row">
              <input type="checkbox" checked={!!checked[a.label]}
                onChange={e => setChecked(c => ({ ...c, [a.label]: e.target.checked }))}
                aria-label={`${a.label}: saves ${a.kgSaved} kg CO₂ and ₹${categorySavingsRupees(a.kgSaved, a.cat)}/month`}
              />
              <span className="savings-label">{a.label}</span>
              <span className="savings-co2">−{a.kgSaved} kg</span>
              <span className="savings-rupees">₹{categorySavingsRupees(a.kgSaved, a.cat)}/mo</span>
            </label>
          </li>
        ))}
      </ul>
      {totalKg > 0 && (
        <div className="savings-total" role="status" aria-live="polite">
          <div className="savings-total-row">
            <span>Monthly CO₂ saved:</span> <strong>{totalKg} kg</strong>
          </div>
          <div className="savings-total-row">
            <span>Monthly rupee savings:</span> <strong>₹{totalRs.toLocaleString()}</strong>
          </div>
          <div className="savings-total-row savings-annual">
            <span>Annual rupee savings:</span>
            <strong className="savings-annual-value">₹{annualRs.toLocaleString()}</strong>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Root AICoach ──────────────────────────────────────────── */
export default function AICoach({ emissions, form }) {
  const [tab, setTab] = useState('coach')
  const TABS = [
    { id: 'coach',    label: '✨ AI Coach' },
    { id: 'challenge',label: '🎯 Challenges' },
    { id: 'savings',  label: '₹ Savings Calc' },
  ]

  return (
    <div className="card" role="region" aria-label="AI-powered sustainability features">
      <h2 className="results-title">🤖 AI Sustainability Suite</h2>
      <div className="ai-tabs" role="tablist">
        {TABS.map(t => (
          <button key={t.id} role="tab"
            aria-selected={tab === t.id}
            className={`ai-tab ${tab === t.id ? 'ai-tab--active' : ''}`}
            onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label={TABS.find(t => t.id === tab)?.label} style={{ marginTop: 16 }}>
        {tab === 'coach'     && <CoachSection  emissions={emissions} form={form} />}
        {tab === 'challenge' && <ChallengeSection emissions={emissions} />}
        {tab === 'savings'   && <CostSavingsCalculator />}
      </div>
    </div>
  )
}
