import mongoose, { Schema } from "mongoose";

const workspaceSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  owner: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  members: [{
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    role: {
      type: String,
      enum: ["manager", "developer", "designer", "client", "viewer"],
      default: "developer"
    },
    permissions: {
      canEdit: { type: Boolean, default: true },
      canDelete: { type: Boolean, default: false },
      canInvite: { type: Boolean, default: false },
      canManageRoles: { type: Boolean, default: false }
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  settings: {
    isPublic: { type: Boolean, default: false },
    allowGuestAccess: { type: Boolean, default: false },
    theme: { type: String, default: "light" },
    timezone: { type: String, default: "UTC" }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for better performance
workspaceSchema.index({ owner: 1 });
workspaceSchema.index({ "members.user": 1 });
workspaceSchema.index({ name: 1, owner: 1 });

export const Workspace = mongoose.model("Workspace", workspaceSchema);
