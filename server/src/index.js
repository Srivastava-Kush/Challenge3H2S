import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import { connectDB } from './config/db.js'
import authRoutes from './routes/auth.js'
import historyRoutes from './routes/history.js'
import aiRoutes from './routes/ai.js'

dotenv.config()

// Warn about placeholder env values so the user gets a clear message at startup
const MISSING = []
if (!process.env.MONGODB_URI || process.env.MONGODB_URI.startsWith('PLACEHOLDER'))
  MISSING.push('MONGODB_URI')
if (!process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT.startsWith('PLACEHOLDER'))
  MISSING.push('FIREBASE_SERVICE_ACCOUNT')
if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.startsWith('PLACEHOLDER'))
  MISSING.push('GEMINI_API_KEY')
if (MISSING.length) {
  console.warn(`\n⚠️  Placeholder values detected in .env for: ${MISSING.join(', ')}`)
  console.warn('   See server/.env.example and SETUP.md for setup instructions.\n')
}

const app = express()

app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3456',
  credentials: true,
}))
app.use(express.json({ limit: '1mb' }))

// General rate limit: 100 req per 15 min
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false }))
// AI endpoints: 20 req per min (Gemini has free-tier quota)
app.use('/api/ai/', rateLimit({ windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false }))

app.use('/api/auth',    authRoutes)
app.use('/api/history', historyRoutes)
app.use('/api/ai',      aiRoutes)

// Health check (no auth required)
app.get('/health', (_, res) => res.json({ status: 'ok', ts: new Date().toISOString() }))

// 404 fallthrough
app.use((_, res) => res.status(404).json({ error: 'Not found' }))

// Global error handler
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

const PORT = process.env.PORT || 5000
if (process.env.NODE_ENV !== 'test') {
  connectDB()
    .catch(err => console.error('MongoDB connection error:', err.message))

  // Always start the server even if MongoDB isn't connected
  // (AI and auth routes work without DB; history routes will return 503)
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
    if (MISSING.length) {
      console.log('   Configure the missing keys in server/.env to enable all features.')
    }
  })
}

export default app
