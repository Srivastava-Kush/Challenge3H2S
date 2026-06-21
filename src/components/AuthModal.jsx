import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { FIREBASE_ENABLED } from '../config/firebase'

export default function AuthModal({ onClose }) {
  const { signInWithGoogle } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const handleGoogle = async () => {
    if (!FIREBASE_ENABLED) {
      setError('Firebase is not configured — add your keys to .env and restart. See SETUP.md.')
      return
    }
    setLoading(true); setError(null)
    try {
      await signInWithGoogle()
      onClose()
    } catch (err) {
      setError(err.code === 'auth/popup-closed-by-user'
        ? 'Sign-in cancelled.'
        : err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-overlay" role="dialog" aria-modal="true" aria-label="Sign in">
      <div className="auth-modal">
        <button className="auth-modal-close" onClick={onClose} aria-label="Close">✕</button>

        <div className="auth-modal-logo">🌱</div>
        <h2 className="auth-modal-title">
          {FIREBASE_ENABLED ? 'Save your progress' : 'Sign-in not configured'}
        </h2>
        {!FIREBASE_ENABLED && (
          <div className="auth-demo-notice" role="alert">
            <strong>Demo mode:</strong> Add your Firebase keys to <code>.env</code> and restart the dev server to enable sign-in.
            See <strong>SETUP.md</strong> for step-by-step instructions.
          </div>
        )}
        {FIREBASE_ENABLED && (
          <p className="auth-modal-desc">
            Sign in to sync your history across devices and get personalised AI coaching
            powered by Google Gemini.
          </p>
        )}

        <ul className="auth-benefits">
          <li>📊 History synced to the cloud</li>
          <li>🤖 AI Coach personalised to your trend</li>
          <li>🎯 Challenges that remember what you've tried</li>
          <li>📱 Access from any device</li>
        </ul>

        <button className="auth-google-btn" onClick={handleGoogle} disabled={loading}
          aria-label="Sign in with Google">
          {loading
            ? <span className="spinner" aria-hidden="true" />
            : <GoogleIcon />}
          {loading ? 'Signing in…' : 'Sign in with Google'}
        </button>

        {error && <p className="auth-error" role="alert">{error}</p>}

        <button className="auth-skip-btn" onClick={onClose}>
          Continue as guest
        </button>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.6 32.8 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.9z"/>
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.5 16.1 18.9 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.3 0-9.6-3.2-11.3-7.7L6 33.5C9.4 39.8 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.2 5.4l6.2 5.2C41.4 35.1 44 30 44 24c0-1.3-.1-2.7-.4-3.9z"/>
    </svg>
  )
}
