import mongoose from "mongoose";

const syncLogSchema = new mongoose.Schema({
  integrationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Integration",
    required: true
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Workspace",
    required: true
  },
  platform: {
    type: String,
    required: true
  },
  syncType: {
    type: String,
    required: true,
    enum: ["import", "export", "bidirectional"]
  },
  operation: {
    type: String,
    required: true,
    enum: ["create", "update", "delete", "sync"]
  },
  entityType: {
    type: String,
    required: true,
    enum: ["task", "message", "file", "comment", "user", "project", "workspace"]
  },
  entityId: {
    type: String,
    required: true
  },
  externalId: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ["success", "error", "pending", "skipped"],
    default: "pending"
  },
  direction: {
    type: String,
    enum: ["to_external", "from_external"],
    required: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed
  },
  error: {
    message: String,
    stack: String,
    code: String
  },
  retryCount: {
    type: Number,
    default: 0
  },
  processingTime: {
    type: Number // in milliseconds
  }
}, {
  timestamps: true
});

// Indexes for performance
syncLogSchema.index({ integrationId: 1, createdAt: -1 });
syncLogSchema.index({ workspaceId: 1, platform: 1, createdAt: -1 });
syncLogSchema.index({ status: 1, retryCount: 1 });
syncLogSchema.index({ entityType: 1, entityId: 1 });

export default function(mongoose) {
  return mongoose.model("SyncLog", syncLogSchema);
}
