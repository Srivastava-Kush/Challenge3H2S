import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY

// Detect placeholder / missing config so the app runs without real Firebase keys
export const FIREBASE_ENABLED = !!apiKey && apiKey !== 'PLACEHOLDER' && apiKey.startsWith('AIza')

let auth

if (FIREBASE_ENABLED) {
  const app = initializeApp({
    apiKey,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId:  import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId:      import.meta.env.VITE_FIREBASE_APP_ID,
  })
  auth = getAuth(app)
} else {
  // Stub so imports don't crash — AuthContext checks FIREBASE_ENABLED before calling any method
  auth = { currentUser: null, onAuthStateChanged: () => () => {} }
}

export { auth }
export default auth
