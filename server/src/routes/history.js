import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import Submission from '../models/Submission.js'

const router = Router()

// GET /api/history — all submissions for the logged-in user
// Optionally query ?type=daily or ?type=monthly
router.get('/', requireAuth, async (req, res) => {
  try {
    const query = { uid: req.uid }
    if (req.query.type) {
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
