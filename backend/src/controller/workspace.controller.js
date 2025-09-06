import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Workspace } from "../models/workspace.model.js";
import { User } from "../models/user.model.js";

// Create a new workspace
const createWorkspace = asyncHandler(async (req, res) => {
  const { name, description, settings } = req.body;

  if (!name?.trim()) {
    throw new ApiError(400, "Workspace name is required");
  }

  // Check if workspace with same name exists for this user
  const existingWorkspace = await Workspace.findOne({
    name: name.trim(),
    owner: req.user._id
  });

  if (existingWorkspace) {
    throw new ApiError(409, "Workspace with this name already exists");
  }

  const workspace = await Workspace.create({
    name: name.trim(),
    description: description?.trim(),
    owner: req.user._id,
    members: [{
      user: req.user._id,
      role: "manager",
      permissions: {
        canEdit: true,
        canDelete: true,
        canInvite: true,
        canManageRoles: true
      }
    }],
    settings: settings || {}
  });

  const populatedWorkspace = await Workspace.findById(workspace._id)
    .populate("owner", "username fullName avatar")
    .populate("members.user", "username fullName avatar");

  return res.status(201).json(
    new ApiResponse(201, populatedWorkspace, "Workspace created successfully")
  );
});

// Get user's workspaces
const getUserWorkspaces = asyncHandler(async (req, res) => {
  const workspaces = await Workspace.find({
    $or: [
      { owner: req.user._id },
      { "members.user": req.user._id }
    ],
    isActive: true
  })
  .populate("owner", "username fullName avatar")
  .populate("members.user", "username fullName avatar")
  .sort({ updatedAt: -1 });

  return res.status(200).json(
    new ApiResponse(200, workspaces, "Workspaces retrieved successfully")
  );
});

// Get workspace by ID
const getWorkspaceById = asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;

  const workspace = await Workspace.findById(workspaceId)
    .populate("owner", "username fullName avatar")
    .populate("members.user", "username fullName avatar");

  if (!workspace) {
    throw new ApiError(404, "Workspace not found");
  }

  // Check if user has access to this workspace
  const hasAccess = workspace.owner._id.toString() === req.user._id.toString() ||
    workspace.members.some(member => member.user._id.toString() === req.user._id.toString());

  if (!hasAccess) {
    throw new ApiError(403, "Access denied to this workspace");
  }

  return res.status(200).json(
    new ApiResponse(200, workspace, "Workspace retrieved successfully")
  );
});

// Update workspace
const updateWorkspace = asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const { name, description, settings } = req.body;

  const workspace = await Workspace.findById(workspaceId);

  if (!workspace) {
    throw new ApiError(404, "Workspace not found");
  }

  // Check if user has permission to edit
  const userMember = workspace.members.find(
    member => member.user.toString() === req.user._id.toString()
  );

  if (!userMember || !userMember.permissions.canEdit) {
    throw new ApiError(403, "You don't have permission to edit this workspace");
  }

  if (name?.trim()) workspace.name = name.trim();
  if (description !== undefined) workspace.description = description?.trim();
  if (settings) workspace.settings = { ...workspace.settings, ...settings };

  await workspace.save();

  const updatedWorkspace = await Workspace.findById(workspaceId)
    .populate("owner", "username fullName avatar")
    .populate("members.user", "username fullName avatar");

  return res.status(200).json(
    new ApiResponse(200, updatedWorkspace, "Workspace updated successfully")
  );
});

// Invite user to workspace
const inviteToWorkspace = asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const { email, role = "developer" } = req.body;

  if (!email?.trim()) {
    throw new ApiError(400, "Email is required");
  }

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    throw new ApiError(404, "Workspace not found");
  }

  // Check if user has permission to invite
  const userMember = workspace.members.find(
    member => member.user.toString() === req.user._id.toString()
  );

  if (!userMember || !userMember.permissions.canInvite) {
    throw new ApiError(403, "You don't have permission to invite users");
  }

  // Find user by email
  const userToInvite = await User.findOne({ email: email.trim() });
  if (!userToInvite) {
    throw new ApiError(404, "User with this email not found");
  }

  // Check if user is already a member
  const existingMember = workspace.members.find(
    member => member.user.toString() === userToInvite._id.toString()
  );

  if (existingMember) {
    throw new ApiError(409, "User is already a member of this workspace");
  }

  // Set permissions based on role
  let permissions = {
    canEdit: true,
    canDelete: false,
    canInvite: false,
    canManageRoles: false
  };

  if (role === "manager") {
    permissions = {
      canEdit: true,
      canDelete: true,
      canInvite: true,
      canManageRoles: true
    };
  } else if (role === "client" || role === "viewer") {
    permissions = {
      canEdit: false,
      canDelete: false,
      canInvite: false,
      canManageRoles: false
    };
  }

  workspace.members.push({
    user: userToInvite._id,
    role,
    permissions
  });

  await workspace.save();

  const updatedWorkspace = await Workspace.findById(workspaceId)
    .populate("owner", "username fullName avatar")
    .populate("members.user", "username fullName avatar");

  return res.status(200).json(
    new ApiResponse(200, updatedWorkspace, "User invited successfully")
  );
});

// Remove user from workspace
const removeFromWorkspace = asyncHandler(async (req, res) => {
  const { workspaceId, userId } = req.params;

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    throw new ApiError(404, "Workspace not found");
  }

  // Check if user has permission to manage roles
  const userMember = workspace.members.find(
    member => member.user.toString() === req.user._id.toString()
  );

  if (!userMember || !userMember.permissions.canManageRoles) {
    throw new ApiError(403, "You don't have permission to remove users");
  }

  // Can't remove the owner
  if (workspace.owner.toString() === userId) {
    throw new ApiError(400, "Cannot remove workspace owner");
  }

  workspace.members = workspace.members.filter(
    member => member.user.toString() !== userId
  );

  await workspace.save();

  const updatedWorkspace = await Workspace.findById(workspaceId)
    .populate("owner", "username fullName avatar")
    .populate("members.user", "username fullName avatar");

  return res.status(200).json(
    new ApiResponse(200, updatedWorkspace, "User removed successfully")
  );
});

// Delete workspace
const deleteWorkspace = asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    throw new ApiError(404, "Workspace not found");
  }

  // Only owner can delete workspace
  if (workspace.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Only workspace owner can delete the workspace");
  }

  await Workspace.findByIdAndDelete(workspaceId);

  return res.status(200).json(
    new ApiResponse(200, {}, "Workspace deleted successfully")
  );
});

export {
  createWorkspace,
  getUserWorkspaces,
  getWorkspaceById,
  updateWorkspace,
  inviteToWorkspace,
  removeFromWorkspace,
  deleteWorkspace
};
