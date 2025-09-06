import mongoose from "mongoose";

const integrationSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Workspace",
    required: true
  },
  platform: {
    type: String,
    required: true,
    enum: ["slack", "github", "jira", "figma", "trello", "google_workspace"]
  },
  name: {
    type: String,
    required: true
  },
  config: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  accessToken: {
    type: String,
    required: true
  },
  refreshToken: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  syncSettings: {
    bidirectional: {
      type: Boolean,
      default: true
    },
    syncFrequency: {
      type: String,
      enum: ["realtime", "hourly", "daily", "weekly"],
      default: "realtime"
    },
    autoSync: {
      type: Boolean,
      default: true
    },
    syncTypes: [{
      type: String,
      enum: ["tasks", "messages", "files", "comments", "users", "projects"]
    }]
  },
  lastSync: {
    type: Date,
    default: Date.now
  },
  syncStatus: {
    type: String,
    enum: ["success", "error", "pending", "paused"],
    default: "pending"
  },
  errorLog: [{
    timestamp: Date,
    error: String,
    details: mongoose.Schema.Types.Mixed
  }],
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes for performance
integrationSchema.index({ workspaceId: 1, platform: 1 });
integrationSchema.index({ isActive: 1, syncStatus: 1 });
integrationSchema.index({ "syncSettings.autoSync": 1, "syncSettings.syncFrequency": 1 });

export default function(mongoose) {
  return mongoose.model("Integration", integrationSchema);
}
