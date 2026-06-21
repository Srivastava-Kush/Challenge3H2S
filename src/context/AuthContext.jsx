import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from 'firebase/auth'
import { auth, FIREBASE_ENABLED } from '../config/firebase'
import { api } from '../utils/api'

const AuthContext = createContext(null)
const provider   = new GoogleAuthProvider()

/* ── Minimal loading splash so the app never shows a blank page ── */
function AuthLoadingSplash() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--green-50)',
      gap: '1rem',
    }}>
      <div style={{ fontSize: '3rem' }}>🌿</div>
      <div className="spinner" style={{ width: 28, height: 28 }} aria-hidden="true" />
      <p style={{ color: 'var(--slate-500)', fontSize: '0.9rem', margin: 0 }}>
        Loading India Carbon Tracker…
      </p>
    </div>
  )
}

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)

  const syncProfile = useCallback(async (firebaseUser) => {
    try {
      await api.upsertProfile({
        displayName: firebaseUser.displayName,
        email:       firebaseUser.email,
        photoURL:    firebaseUser.photoURL,
        isAnonymous: firebaseUser.isAnonymous,
      }, firebaseUser)
    } catch {
      // Non-fatal: backend may be unavailable in pure frontend dev mode
    }
  }, [])

  useEffect(() => {
    if (!FIREBASE_ENABLED) {
      setUser(null)
      setLoading(false)
      return
    }

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)
        await syncProfile(firebaseUser)
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    return unsub
  }, [syncProfile])

  const signInWithGoogle = useCallback(async () => {
    if (!FIREBASE_ENABLED) throw new Error('Firebase not configured — set real keys in .env')
    const result = await signInWithPopup(auth, provider)
    return result.user
  }, [])

  const logout = useCallback(async () => {
    if (!FIREBASE_ENABLED) return
    await signOut(auth)
    setUser(null)
  }, [])

  // Show a non-blank loading screen while Firebase resolves auth state
  if (loading) return <AuthLoadingSplash />

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, logout, firebaseEnabled: FIREBASE_ENABLED }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
