// Authenticated API client — wraps fetch with Firebase ID token
import { auth } from '../config/firebase'

const BASE    = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const TIMEOUT = 10_000 // 10 seconds

async function authFetch(path, options = {}, firebaseUser) {
  let token = null
  try {
    const u = firebaseUser ?? auth.currentUser
    if (u) token = await u.getIdToken()
  } catch {
    // Non-fatal — continue as unauthenticated
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }

  // Abort after TIMEOUT ms to prevent hanging requests
  const controller = new AbortController()
  const timeoutId  = setTimeout(() => controller.abort(), TIMEOUT)

  try {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || `Server error (HTTP ${res.status})`)
    }
    return res.json()
  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name === 'AbortError') {
      throw new Error('Request timed out — backend may be unavailable. Check that the server is running.')
    }
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      throw new Error('Cannot reach the server. Check your network connection and that the backend is running.')
    }
    throw err
  }
}

export const api = {
  // ─── Auth ────────────────────────────────────────────────
  upsertProfile: (data, user) =>
    authFetch('/auth/profile', { method: 'POST', body: JSON.stringify(data) }, user),
  getProfile: () => authFetch('/auth/profile'),

  // ─── History ─────────────────────────────────────────────
  getHistory: (params = '') => authFetch(`/history${params}`),
  saveSubmission: (data) =>
    authFetch('/history', { method: 'POST', body: JSON.stringify(data) }),
  clearHistory: () => authFetch('/history', { method: 'DELETE' }),

  // ─── AI (Gemini via backend) ──────────────────────────────
  getCoachAdvice: (data) =>
    authFetch('/ai/coach', { method: 'POST', body: JSON.stringify(data) }),
  getChallenges: (data) =>
    authFetch('/ai/challenges', { method: 'POST', body: JSON.stringify(data) }),
}
