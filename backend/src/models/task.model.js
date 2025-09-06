import mongoose, { Schema } from "mongoose";

const taskSchema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  project: {
    type: Schema.Types.ObjectId,
    ref: "Project",
    required: true
  },
  assignee: {
    type: Schema.Types.ObjectId,
    ref: "User"
  },
  reporter: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  status: {
    type: String,
    enum: ["backlog", "todo", "in-progress", "review", "testing", "done"],
    default: "backlog"
  },
  priority: {
    type: String,
    enum: ["lowest", "low", "medium", "high", "highest"],
    default: "medium"
  },
  type: {
    type: String,
    enum: ["story", "bug", "task", "epic", "subtask"],
    default: "task"
  },
  storyPoints: {
    type: Number,
    min: 0,
    max: 100
  },
  sprint: {
    type: Schema.Types.ObjectId,
    ref: "Sprint"
  },
  labels: [String],
  dueDate: Date,
  estimatedHours: Number,
  loggedHours: { type: Number, default: 0 },
  comments: [{
    author: {
      type: Schema.Types.ObjectId,
      ref: "User"
    },
    content: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
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
  }],
  subtasks: [{
    type: Schema.Types.ObjectId,
    ref: "Task"
  }],
  parentTask: {
    type: Schema.Types.ObjectId,
    ref: "Task"
  },
  position: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes
taskSchema.index({ project: 1 });
taskSchema.index({ assignee: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ sprint: 1 });

export const Task = mongoose.model("Task", taskSchema);
