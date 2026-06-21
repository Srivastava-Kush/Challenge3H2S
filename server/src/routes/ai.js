import { Router } from 'express'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { requireAuth } from '../middleware/auth.js'
import Submission from '../models/Submission.js'
import User from '../models/User.js'

const router = Router()

// Simple in-memory cache to prevent duplicate Gemini API calls for identical requests
const aiCache = new Map()

function setCache(key, value) {
  if (aiCache.size > 1000) {
    const firstKey = aiCache.keys().next().value
    aiCache.delete(firstKey)
  }
  aiCache.set(key, value)
}

function getModel() {
  const key = process.env.GEMINI_API_KEY
  if (!key || key.startsWith('PLACEHOLDER')) {
    throw new Error(
      'Gemini API key not configured. Add your GEMINI_API_KEY to server/.env — ' +
      'get one free at https://aistudio.google.com/apikey'
    )
  }
  const genAI = new GoogleGenerativeAI(key)
  return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
}

// POST /api/ai/coach — AI Sustainability Coach (history-aware + personalised)
router.post('/coach', requireAuth, async (req, res) => {
  try {
    const { emissions, form, percentile, greenScore, persona } = req.body

    // Pull user profile + last 6 submissions for personalisation
    const [history, userProfile] = await Promise.all([
      Submission.find({ uid: req.uid }).sort({ createdAt: -1 }).limit(6).lean(),
      User.findOne({ uid: req.uid }).lean(),
    ])

    // Build trend narrative
    let trendInfo = 'First submission — no historical trend yet.'
    if (history.length >= 2) {
      const oldest  = history[history.length - 1]
      const delta   = (history[0].total - oldest.total).toFixed(1)
      const dir     = history[0].total > oldest.total ? '↑ increasing' : '↓ decreasing'
      const bestCat = Object.entries(oldest.categories ?? {})
        .sort((a, b) => b[1] - a[1])[0]?.[0]
      trendInfo = `Over ${history.length} months: ${dir} by ${Math.abs(delta)} kg. ` +
        `Highest category historically: ${bestCat ?? 'unknown'}.`
    }

    // Best category to target
    const topCat = Object.entries({
      electricity: emissions.electricity, lpg: emissions.lpg,
      transport: emissions.transport, diet: emissions.diet,
    }).sort((a, b) => b[1] - a[1])[0]

    // State-specific tip
    const stateCtx = form.state
      ? `User is in ${form.state} (grid factor ${(emissions.gridFactor ?? 0.82).toFixed(3)} kg CO₂/kWh).`
      : 'State not specified (using national average grid factor).'

    const prompt = `You are an expert sustainability coach for Indian households. Be specific, data-driven, and culturally relevant.

USER PROFILE:
- Monthly CO₂: ${emissions.total} kg total
- Breakdown: electricity ${emissions.electricity} kg, LPG ${emissions.lpg} kg, transport ${emissions.transport} kg, diet ${emissions.diet} kg, devices ${+(emissions.smartphone + emissions.laptop).toFixed(2)} kg
- Green Score: ${greenScore}/100 · Cleaner than ${percentile}% of Indians
- Climate Persona: ${persona}
- Vehicle: ${form.vehicle} · Diet: ${form.diet}
- ${stateCtx}
- Top emission category: ${topCat[0]} (${topCat[1]} kg)
- ${trendInfo}
${userProfile?.targetMonthlyKg ? `- Personal target: ${userProfile.targetMonthlyKg} kg/month` : ''}

Respond with EXACTLY these 4 labelled sections (no preamble, no extra text):
SUMMARY
(2 sentences about their current status and the single biggest opportunity, using their actual kg figures)
TOP SOURCES
• [category] — [X] kg ([Y]% of total) — [one-line why]
• [second highest]
• [third highest]
RECOMMENDATIONS
• [specific action tailored to their vehicle/diet/state] — saves ~[X] kg and ₹[Y]/month
• [second action]
• [third action]
MONTHLY CHALLENGE
([one 30-day challenge specific to their top emission category and Indian context])`

    const cacheKey = `coach_${req.uid}_${emissions.total}_${topCat[0]}_${greenScore}`
    if (aiCache.has(cacheKey)) {
      return res.json({ text: aiCache.get(cacheKey) })
    }

    const model = getModel()
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    setCache(cacheKey, text)
    res.json({ text })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/ai/challenges — Personalised Challenge Generator (history-aware)
router.post('/challenges', requireAuth, async (req, res) => {
  try {
    const { emissions } = req.body

    const history = await Submission.find({ uid: req.uid })
      .sort({ createdAt: -1 }).lean()
    const accepted = history.flatMap(h => h.acceptedChallenges ?? [])
    const alreadyTried = accepted.length > 0
      ? `Already tried: ${[...new Set(accepted)].join(', ')}.`
      : 'No previous challenges recorded.'

    const prompt = `You are an Indian sustainability coach. Generate 3 personalised 30-day challenges.

User: Monthly CO₂ = ${emissions.total} kg. Submissions: ${history.length}. ${alreadyTried}

Generate one challenge at each difficulty level. Use EXACTLY this format (no other text):
EASY
Name: <challenge name>
Description: <one practical sentence for Indian users>
CO2 Saving: <number> kg
Money Saving: Rs <number>
Duration: 30 days

MEDIUM
Name: <challenge name>
Description: <one practical sentence>
CO2 Saving: <number> kg
Money Saving: Rs <number>
Duration: 30 days

AMBITIOUS
Name: <challenge name>
Description: <one practical sentence>
CO2 Saving: <number> kg
Money Saving: Rs <number>
Duration: 30 days`

    const cacheKey = `challenges_${req.uid}_${emissions.total}_${history.length}`
    if (aiCache.has(cacheKey)) {
      return res.json({ text: aiCache.get(cacheKey) })
    }

    const model = getModel()
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    setCache(cacheKey, text)
    res.json({ text })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
