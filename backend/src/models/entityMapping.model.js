import mongoose from "mongoose";

const mappingSchema = new mongoose.Schema({
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
  entityType: {
    type: String,
    required: true,
    enum: ["task", "message", "file", "comment", "user", "project", "workspace"]
  },
  internalId: {
    type: String,
    required: true
  },
  externalId: {
    type: String,
    required: true
  },
  externalUrl: {
    type: String
  },
  bidirectional: {
    type: Boolean,
    default: true
  },
  lastSynced: {
    type: Date,
    default: Date.now
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Compound indexes to ensure unique mappings
mappingSchema.index({ integrationId: 1, entityType: 1, internalId: 1 }, { unique: true });
mappingSchema.index({ integrationId: 1, entityType: 1, externalId: 1 }, { unique: true });
mappingSchema.index({ workspaceId: 1, platform: 1, entityType: 1 });

export default function(mongoose) {
  return mongoose.model("EntityMapping", mappingSchema);
}
