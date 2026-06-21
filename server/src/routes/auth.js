import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import User from '../models/User.js'

const router = Router()

// Upsert user profile on sign-in (call once after Firebase auth)
router.post('/profile', requireAuth, async (req, res) => {
  try {
    const { displayName, email, photoURL, isAnonymous, state, vehicle, diet, targetMonthlyKg } = req.body
    const user = await User.findOneAndUpdate(
      { uid: req.uid },
      { $set: { uid: req.uid, displayName, email, photoURL, isAnonymous, state, vehicle, diet, targetMonthlyKg } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
    res.json(user)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get current user profile
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.uid }).lean()
    res.json(user ?? {})
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
