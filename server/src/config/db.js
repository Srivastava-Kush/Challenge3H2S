import mongoose from 'mongoose'

/**
 * Drop stale indexes left over from old schema versions.
 * This runs once after connection and is safe to call on every startup
 * (dropIndex is a no-op if the index doesn't exist).
 */
async function dropStaleIndexes() {
  try {
    const db = mongoose.connection.db
    const collections = await db.listCollections({ name: 'submissions' }).toArray()
    if (collections.length === 0) return // collection doesn't exist yet

    const col = db.collection('submissions')
    const indexes = await col.indexes()
    const stale = ['uid_1_month_1', 'uid_1_month_1_type_1']

    for (const staleName of stale) {
      if (indexes.find(i => i.name === staleName)) {
        await col.dropIndex(staleName)
        console.log(`🧹  Dropped stale index: ${staleName}`)
      }
    }
  } catch (err) {
    // Non-fatal — log and continue
    console.warn('⚠️  Index cleanup warning:', err.message)
  }
}

export async function connectDB() {
  const uri = process.env.MONGODB_URI
  if (!uri || uri.startsWith('PLACEHOLDER')) {
    console.warn('⚠️  MongoDB not configured (MONGODB_URI is placeholder). History endpoints will error.')
    return  // Server still starts; routes will fail gracefully when mongoose is disconnected
  }
  const conn = await mongoose.connect(uri)
  console.log(`MongoDB connected: ${conn.connection.host}`)

  // Clean up any stale indexes from old schema versions
  await dropStaleIndexes()
}
