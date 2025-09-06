import { Router } from "express";
import {
  createWorkspace,
  getUserWorkspaces,
  getWorkspaceById,
  updateWorkspace,
  inviteToWorkspace,
  removeFromWorkspace,
  deleteWorkspace
} from "../controller/workspace.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware to all routes
router.use(verifyJWT);

// Workspace routes
router.route("/").get(getUserWorkspaces).post(createWorkspace);
router.route("/:workspaceId").get(getWorkspaceById).patch(updateWorkspace).delete(deleteWorkspace);
router.route("/:workspaceId/invite").post(inviteToWorkspace);
router.route("/:workspaceId/members/:userId").delete(removeFromWorkspace);

export default router;
