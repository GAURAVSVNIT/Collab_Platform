import mongoose, { Schema } from "mongoose";

const projectSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  workspace: {
    type: Schema.Types.ObjectId,
    ref: "Workspace",
    required: true
  },
  manager: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  team: [{
    user: {
      type: Schema.Types.ObjectId,
      ref: "User"
    },
    role: {
      type: String,
      enum: ["lead", "developer", "designer", "tester", "client"],
      default: "developer"
    }
  }],
  status: {
    type: String,
    enum: ["planning", "active", "on-hold", "completed", "cancelled"],
    default: "planning"
  },
  priority: {
    type: String,
    enum: ["low", "medium", "high", "critical"],
    default: "medium"
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  budget: {
    allocated: { type: Number, default: 0 },
    spent: { type: Number, default: 0 }
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  tags: [String],
  attachments: [{
    name: String,
    url: String,
    type: String,
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User"
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Indexes
projectSchema.index({ workspace: 1 });
projectSchema.index({ manager: 1 });
projectSchema.index({ status: 1 });

export const Project = mongoose.model("Project", projectSchema);
