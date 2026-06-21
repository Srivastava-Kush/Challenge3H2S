// ProfileAnalytics.jsx – renders user info and analytics using the app's CSS system
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../utils/api'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { INDIA_AVERAGES } from '../constants/indiaAverages'

export default function ProfileAnalytics() {
  const { user } = useAuth()
  const [data, setData]       = useState({ userInfo: null, daily: [], monthly: [] })
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    const fetchAll = async () => {
      setError(null)
      try {
        const [profile, daily, monthly] = await Promise.all([
          api.getProfile(),
          api.getHistory('?type=daily'),
          api.getHistory('?type=monthly'),
        ])
        setData({ userInfo: profile, daily, monthly })
      } catch (e) {
        setError('Could not load analytics data. ' + (e.message || 'Please try again.'))
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [user])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '1.5rem 0', color: 'var(--slate-500)' }}>
        <div className="spinner" aria-hidden="true" />
        Loading analytics…
      </div>
    )
  }

  if (!user) return null

  if (error) {
    return (
      <div role="alert" style={{
        background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8,
        padding: '12px 16px', color: '#dc2626', fontSize: '0.9rem',
      }}>
        ⚠️ {error}
      </div>
    )
  }

  const { userInfo, daily, monthly } = data

  const avgMonthly     = monthly.length ? (monthly.reduce((a, b) => a + b.total, 0) / monthly.length).toFixed(1) : '—'
  const highestMonthly = monthly.length ? Math.max(...monthly.map(m => m.total)).toFixed(1) : '—'
  const lowestMonthly  = monthly.length ? Math.min(...monthly.map(m => m.total)).toFixed(1) : '—'
  const totalRecords   = monthly.length + daily.length

  // Last 6 months for trend chart
  const sixMonthData = monthly.slice(-6).map(m => ({
    month: m.date?.slice(0, 7) ?? m.month ?? m.date,
    total: m.total,
  }))

  // Last 14 daily entries for bar chart
  const recentDaily = daily.slice(-14).map(d => ({
    date: (() => {
      try { return new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) }
      catch { return d.date }
    })(),
    total: d.total,
  }))

  const joinedDate = (() => {
    try { return new Date(user.metadata?.creationTime || '').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) }
    catch { return 'Unknown' }
  })()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem' }}>

      {/* ── User Info ── */}
      <div style={{ background: 'var(--slate-50)', border: '1px solid var(--slate-200)', borderRadius: 10, padding: '16px 20px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--slate-700)', marginBottom: 12 }}>👤 User Info</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.9rem', color: 'var(--slate-600)' }}>
          <div><strong>Name:</strong> {userInfo?.displayName || user.displayName || '—'}</div>
          <div><strong>Email:</strong> {user.email}</div>
          <div><strong>Joined:</strong> {joinedDate}</div>
        </div>
      </div>

      {/* ── Monthly Stats ── */}
      <div style={{ background: 'var(--slate-50)', border: '1px solid var(--slate-200)', borderRadius: 10, padding: '16px 20px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--slate-700)', marginBottom: 12 }}>📊 Monthly Summary</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Avg Monthly', value: avgMonthly !== '—' ? `${avgMonthly} kg` : '—' },
            { label: 'Highest Month', value: highestMonthly !== '—' ? `${highestMonthly} kg` : '—' },
            { label: 'Lowest Month', value: lowestMonthly !== '—' ? `${lowestMonthly} kg` : '—' },
            { label: 'Total Records', value: totalRecords },
          ].map(s => (
            <div key={s.label} className="summary-card" style={{ textAlign: 'left' }}>
              <div className="summary-card-label">{s.label}</div>
              <div className="summary-card-value" style={{ fontSize: '1.1rem', color: 'var(--slate-800)' }}>{s.value}</div>
            </div>
          ))}
        </div>

        {monthly.length === 0 ? (
          <p className="history-empty">No monthly records yet. Calculate your first monthly footprint to see trends.</p>
        ) : (
          <>
            <h4 className="chart-sub-title">6-Month CO₂ Trend</h4>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={sixMonthData} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit=" kg" />
                <Tooltip formatter={v => [`${v} kg CO₂`, 'Monthly CO₂']} />
                <ReferenceLine
                  y={INDIA_AVERAGES.monthly}
                  stroke="#94a3b8"
                  strokeDasharray="5 3"
                  label={{ value: `Avg ${INDIA_AVERAGES.monthly} kg`, fontSize: 10, fill: '#94a3b8', position: 'insideTopRight' }}
                />
                <Line type="monotone" dataKey="total" stroke="#d97706" strokeWidth={2.5}
                  dot={{ r: 4, fill: '#d97706' }} activeDot={{ r: 6 }} name="Monthly CO₂" />
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      {/* ── Daily Analytics ── */}
      <div style={{ background: 'var(--slate-50)', border: '1px solid var(--slate-200)', borderRadius: 10, padding: '16px 20px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--slate-700)', marginBottom: 12 }}>📅 Daily Analytics</h3>
        {daily.length === 0 ? (
          <p className="history-empty">No daily records yet. Log your daily footprint to see your history here.</p>
        ) : (
          <>
            <div style={{ fontSize: '0.88rem', color: 'var(--slate-600)', marginBottom: 12 }}>
              Latest daily emission: <strong>{daily[daily.length - 1]?.total ?? '—'} kg</strong>
              &nbsp;·&nbsp; {daily.length} record{daily.length !== 1 ? 's' : ''} total
            </div>
            <h4 className="chart-sub-title">Last 14 Daily Entries</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={recentDaily} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} unit=" kg" />
                <Tooltip formatter={v => [`${v} kg CO₂`, 'Daily CO₂']} />
                <Bar dataKey="total" fill="#16a34a" name="Daily CO₂" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

    </div>
  )
}
