import mongoose from 'mongoose'

const submissionSchema = new mongoose.Schema({
  uid:       { type: String, required: true, index: true },
  // Format: "YYYY-MM-DD" for daily, "YYYY-MM" (or "Jun '26") for monthly
  date:      { type: String, required: true },
  // Distinguish between daily and monthly calculations
  type:      { type: String, enum: ['daily', 'monthly'], required: true, default: 'monthly' },
  // Computed values
  total:     { type: Number, required: true },
  categories: {
    electricity: { type: Number, default: 0 },
    lpg:         { type: Number, default: 0 },
    transport:   { type: Number, default: 0 },
    diet:        { type: Number, default: 0 },
    smartphone:  { type: Number, default: 0 },
    laptop:      { type: Number, default: 0 },
  },
  greenScore:  Number,
  percentile:  Number,
  // Raw form inputs for re-calculation & what-if simulator context
  formInputs: {
    electricity: Number,
    lpg:         Number,
    km:          Number, // daily or monthly km depending on type
    vehicle:     String,
    diet:        String,
    smartphone:  Number,
    laptop:      Number,
    state:       String,
  },
  state:       String,
  gridFactor:  Number,
  // Accepted challenge names stored per submission
  acceptedChallenges: [String],
}, { timestamps: true })

// One entry per user per date per type — upsert on save
submissionSchema.index({ uid: 1, date: 1, type: 1 }, { unique: true })

export default mongoose.model('Submission', submissionSchema)
