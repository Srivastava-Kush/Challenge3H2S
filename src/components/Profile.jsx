import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../utils/api'

import ProfileAnalytics from './ProfileAnalytics'

export default function Profile({ onBack }) {
  const { user } = useAuth()
  const [profile, setProfile] = useState({
    displayName: user?.displayName || '',
    vehicle: 'petrolBike',
    diet: 'nonveg',
    state: '',
    targetMonthlyKg: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [view, setView] = useState('analytics') // 'analytics' or 'form'

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    api.getProfile().then(p => {
      if (p) {
        setProfile(prev => ({ ...prev, ...p, displayName: p.displayName || user.displayName || '' }))
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [user])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMsg(null)
    try {
      await api.upsertProfile({
        ...profile,
        targetMonthlyKg: profile.targetMonthlyKg ? Number(profile.targetMonthlyKg) : null
      })
      setMsg({ type: 'success', text: 'Profile updated successfully!' })
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to update profile' })
    }
    setSaving(false)
  }

  if (loading) return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--slate-500)' }}>
      <div className="spinner" aria-hidden="true" />
      Loading profile…
    </div>
  )

  if (!user) {
    return (
      <div className="card">
        <h2 className="card-title">Profile</h2>
        <p>Please sign in to view and edit your profile.</p>
        <button className="calc-btn" onClick={onBack} style={{ marginTop: '1rem' }}>Back to Home</button>
      </div>
    )
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="card-title" style={{ margin: 0 }}>Your Profile</h2>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#16a34a', cursor: 'pointer', fontWeight: 600 }}>← Back to Dashboard</button>
      </div>
      {/* Tab selector */}
      <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
        <button onClick={() => setView('analytics')} style={{ marginRight: '0.5rem', padding: '0.4rem 0.8rem', background: view === 'analytics' ? '#16a34a' : '#e2e8f0', color: view === 'analytics' ? 'white' : 'black', border: 'none', borderRadius: '4px' }}>Analytics</button>
        <button onClick={() => setView('form')} style={{ padding: '0.4rem 0.8rem', background: view === 'form' ? '#16a34a' : '#e2e8f0', color: view === 'form' ? 'white' : 'black', border: 'none', borderRadius: '4px' }}>Edit Profile</button>
      </div>
      {view === 'analytics' ? (
        <ProfileAnalytics user={user} onBack={onBack} />
      ) : (
        <form onSubmit={handleSave} className="form-grid" style={{ marginTop: '2rem' }}>
          <div className="field">
            <label className="field-label">Vehicle Type</label>
            <select className="field-input" value={profile.vehicle} onChange={e => setProfile({ ...profile, vehicle: e.target.value })}>
              <option value="petrolBike">Two-wheeler — Petrol (bike / scooter)</option>
              <option value="cngBike">Two-wheeler — CNG</option>
              <option value="petrolCar">Four-wheeler — Petrol (car / SUV)</option>
              <option value="dieselCar">Four-wheeler — Diesel (car / SUV)</option>
              <option value="cngCar">Four-wheeler — CNG (car / auto)</option>
              <option value="ev">Electric vehicle</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label">Dietary Pattern</label>
            <select className="field-input" value={profile.diet} onChange={e => setProfile({ ...profile, diet: e.target.value })}>
              <option value="veg">Vegetarian (no meat, no eggs)</option>
              <option value="eggetarian">Eggetarian (veg + eggs)</option>
              <option value="nonveg">Non-vegetarian (occasional meat / fish)</option>
              <option value="heavymeat">Heavy meat (daily meat consumption)</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label">Target Monthly Emission (kg CO2)</label>
            <input type="number" className="field-input" value={profile.targetMonthlyKg} onChange={e => setProfile({ ...profile, targetMonthlyKg: e.target.value })} placeholder="e.g. 150" />
          </div>
          <div style={{ gridColumn: '1 / -1', marginTop: '1rem' }}>
            <button type="submit" className="calc-btn" disabled={saving}>
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
            {msg && (
              <p role="alert" style={{
                color: msg.type === 'error' ? 'var(--red-500)' : 'var(--green-700)',
                marginTop: '1rem',
                fontWeight: 500,
                fontSize: '0.9rem',
                padding: '8px 12px',
                borderRadius: 6,
                background: msg.type === 'error' ? '#fef2f2' : '#f0fdf4',
                border: `1px solid ${msg.type === 'error' ? '#fca5a5' : '#86efac'}`,
              }}>
                {msg.type === 'error' ? '⚠️' : '✅'} {msg.text}
              </p>
            )}
          </div>
        </form>
      )}
    </div>
  )
}

