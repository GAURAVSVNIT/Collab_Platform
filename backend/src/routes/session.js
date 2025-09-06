import express from "express";
import {
  createonesession,
  findallsession,
  findonesession,
  deleteonesession,
  deleteallsession
} from "../controller/session.controller.js";

const router = express.Router();

// Create a new session
router.post("/", createonesession);

// Find all sessions for a meeting
router.get("/all/:id", findallsession);

// Retrieve one session by id
router.get("/:id", findonesession);

// Delete a single session
router.delete("/:id", deleteonesession);

// Delete all sessions for a specific meeting/session
router.delete("/all/:id", deleteallsession);

export default router;
