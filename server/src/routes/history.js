import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import Submission from '../models/Submission.js'

const router = Router()

// Allowlist for the ?type= query parameter — prevents arbitrary string injection into MongoDB
const ALLOWED_TYPES = new Set(['daily', 'monthly'])

// GET /api/history — all submissions for the logged-in user
// Optionally query ?type=daily or ?type=monthly
router.get('/', requireAuth, async (req, res) => {
  try {
    const query = { uid: req.uid }
    if (req.query.type) {
      if (!ALLOWED_TYPES.has(req.query.type)) {
        return res.status(400).json({ error: 'Invalid type parameter. Must be "daily" or "monthly".' })
      }
      query.type = req.query.type
    }
    const submissions = await Submission.find(query)
      .sort({ date: 1 })
      .lean()
    res.json(submissions)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/history — save or overwrite the current submission
router.post('/', requireAuth, async (req, res) => {
  try {
    const { date, type, total, categories, greenScore, percentile, formInputs, state, gridFactor } = req.body
    
    // Fallback for older clients that might still send "month"
    const actualDate = date || req.body.month
    const actualType = type || 'monthly'

    if (!actualDate || total == null) {
      return res.status(400).json({ error: 'date and total are required' })
    }
    if (typeof total !== 'number' || !Number.isFinite(total) || total < 0) {
      return res.status(400).json({ error: 'total must be a non-negative finite number' })
    }
    if (actualType && !ALLOWED_TYPES.has(actualType)) {
      return res.status(400).json({ error: 'type must be "daily" or "monthly"' })
    }
    const doc = await Submission.findOneAndUpdate(
      { uid: req.uid, date: actualDate, type: actualType },
      { $set: { uid: req.uid, date: actualDate, type: actualType, total, categories, greenScore, percentile, formInputs, state, gridFactor } },
      { upsert: true, new: true }
    )
    res.json(doc)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/history — clear all history for the user
router.delete('/', requireAuth, async (req, res) => {
  try {
    const result = await Submission.deleteMany({ uid: req.uid })
    res.json({ deleted: result.deletedCount })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
