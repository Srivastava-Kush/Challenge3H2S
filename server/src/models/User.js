import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  uid:         { type: String, required: true, unique: true, index: true },
  email:       String,
  displayName: String,
  photoURL:    String,
  isAnonymous: { type: Boolean, default: false },
  // Indian state for state-wise grid emission factor
  state:       { type: String, default: '' },
  // Preferences
  targetMonthlyKg: Number,
  vehicle:     String,
  diet:        String,
}, { timestamps: true })

export default mongoose.model('User', userSchema)
