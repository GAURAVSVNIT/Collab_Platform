import { Router } from "express";
import {
  getAllIntegrations,
  getIntegration,
  createIntegration,
  updateIntegration,
  deleteIntegration,
  syncIntegration,
  getIntegrationStatus,
  getSyncLogs,
  getSyncStats,
  retryFailedSync,
  pauseIntegration,
  resumeIntegration,
  testIntegration
} from "../controller/integration.controller.js";
import {
  handleSlackWebhook,
  handleGitHubWebhook,
  handleJiraWebhook,
  handleTrelloWebhook,
  handleFigmaWebhook,
  handleGoogleWebhook
} from "../controller/webhook.controller.js";
// import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// Integration CRUD routes
router.route("/")
  .get(getAllIntegrations)
  .post(createIntegration);

router.route("/:integrationId")
  .get(getIntegration)
  .patch(updateIntegration)
  .delete(deleteIntegration);

// Integration management routes
router.route("/:integrationId/sync").post(syncIntegration);
router.route("/:integrationId/status").get(getIntegrationStatus);
router.route("/:integrationId/pause").post(pauseIntegration);
router.route("/:integrationId/resume").post(resumeIntegration);
router.route("/:integrationId/test").post(testIntegration);

// Sync management routes
router.route("/:integrationId/logs").get(getSyncLogs);
router.route("/:integrationId/stats").get(getSyncStats);
router.route("/:integrationId/retry").post(retryFailedSync);

// Webhook routes (no auth required for external services)
router.route("/webhooks/slack").post(handleSlackWebhook);
router.route("/webhooks/github").post(handleGitHubWebhook);
router.route("/webhooks/jira").post(handleJiraWebhook);
router.route("/webhooks/trello").post(handleTrelloWebhook);
router.route("/webhooks/figma").post(handleFigmaWebhook);
router.route("/webhooks/google").post(handleGoogleWebhook);

export default router;
