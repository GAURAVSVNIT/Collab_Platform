import mongoose, { Schema } from "mongoose";

const documentSchema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: Schema.Types.Mixed, // Will store Notion-like blocks
    default: {}
  },
  workspace: {
    type: Schema.Types.ObjectId,
    ref: "Workspace",
    required: true
  },
  author: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  collaborators: [{
    user: {
      type: Schema.Types.ObjectId,
      ref: "User"
    },
    permission: {
      type: String,
      enum: ["view", "comment", "edit"],
      default: "view"
    },
    lastAccessed: {
      type: Date,
      default: Date.now
    }
  }],
  version: {
    type: Number,
    default: 1
  },
  status: {
    type: String,
    enum: ["draft", "review", "published", "archived"],
    default: "draft"
  },
  tags: [String],
  isTemplate: {
    type: Boolean,
    default: false
  },
  parentDocument: {
    type: Schema.Types.ObjectId,
    ref: "Document"
  }
}, {
  timestamps: true
});

// Indexes
documentSchema.index({ workspace: 1 });
documentSchema.index({ author: 1 });
documentSchema.index({ title: "text", tags: "text" });

export const Document = mongoose.model("Document", documentSchema);
