import express from "express";
import {
  createonemeet,
  findallmeet,
  findonemeet,
  deleteonemeet,
} from "../controller/meet.controller.js";

const router = express.Router();

router.post("/", createonemeet);
router.get("/all/:id", findallmeet);
router.get("/:id", findonemeet);
router.delete("/:id", deleteonemeet);

export default router;
