import admin from 'firebase-admin'

const raw = process.env.FIREBASE_SERVICE_ACCOUNT

export const FIREBASE_ADMIN_ENABLED =
  !!raw && !raw.startsWith('PLACEHOLDER') && raw.trim().startsWith('{')

if (!admin.apps.length && FIREBASE_ADMIN_ENABLED) {
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) })
}

export const auth = FIREBASE_ADMIN_ENABLED ? admin.auth() : null
export default admin
