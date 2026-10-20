import express from "express";

import {
  joinDrop,
  getMyEntry
} from "../controllers/entry.controller.js";

import { requireAuth } from "../middleware/auth.middleware.js";

const router = express.Router();

// ============================================================
// JOIN DROP
// ============================================================

router.post(
  "/drops/:dropId/join",
  requireAuth,
  joinDrop
);

// ============================================================
// GET MY ENTRY
// ============================================================

router.get(
  "/drops/:dropId/my-entry",
  requireAuth,
  getMyEntry
);

export default router;