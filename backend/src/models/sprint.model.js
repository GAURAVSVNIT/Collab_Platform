import mongoose, { Schema } from "mongoose";

const sprintSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  goal: {
    type: String,
    trim: true
  },
  project: {
    type: Schema.Types.ObjectId,
    ref: "Project",
    required: true
  },
  status: {
    type: String,
    enum: ["planning", "active", "completed", "cancelled"],
    default: "planning"
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  capacity: {
    type: Number, // in story points or hours
    default: 0
  },
  velocity: {
    type: Number,
    default: 0
  },
  burndownData: [{
    date: Date,
    remainingWork: Number,
    idealRemaining: Number
  }],
  retrospective: {
    whatWentWell: [String],
    whatCouldImprove: [String],
    actionItems: [String]
  }
}, {
  timestamps: true
});

// Indexes
sprintSchema.index({ project: 1 });
sprintSchema.index({ status: 1 });

export const Sprint = mongoose.model("Sprint", sprintSchema);
