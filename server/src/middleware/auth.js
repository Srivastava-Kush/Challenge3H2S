import { auth, FIREBASE_ADMIN_ENABLED } from '../config/firebase.js'

export async function requireAuth(req, res, next) {
  // When Firebase Admin is not configured, accept any request in dev mode
  // with a synthetic uid derived from the Authorization header (or 'dev-user')
  if (!FIREBASE_ADMIN_ENABLED) {
    const header = req.headers.authorization
    req.uid = header?.startsWith('Bearer ') ? `dev-${header.slice(7, 17)}` : 'dev-user'
    req.userRecord = { uid: req.uid }
    return next()
  }

  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' })
  }
  try {
    const token = header.split(' ')[1]
    const decoded = await auth.verifyIdToken(token)
    req.uid = decoded.uid
    req.userRecord = decoded
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}
