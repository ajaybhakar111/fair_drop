import express from "express";

import {
  createDrop,
  getEventDrops,
  updateDrop,
  deleteDrop,
  openDrop,
  closeDrop
} from "../controllers/admin-drop.controller.js";

import {
  requireAuth
} from "../middleware/auth.middleware.js";

import {
  requireRole
} from "../middleware/role.middleware.js";

const router = express.Router();


// ============================================================
// ADMIN DROP ROUTES
// ============================================================

router.post(
  "/admin/events/:eventId/drops",
  requireAuth,
  requireRole("ADMIN"),
  createDrop
);

router.get(
  "/admin/events/:eventId/drops",
  requireAuth,
  requireRole("ADMIN"),
  getEventDrops
);

router.patch(
  "/admin/drops/:dropId",
  requireAuth,
  requireRole("ADMIN"),
  updateDrop
);

router.delete(
  "/admin/drops/:dropId",
  requireAuth,
  requireRole("ADMIN"),
  deleteDrop
);
// ============================================================
// OPEN DROP
// ============================================================

router.post(
  "/admin/drops/:dropId/open",
  requireAuth,
  requireRole("ADMIN"),
  openDrop
);


// ============================================================
// CLOSE DROP
// ============================================================

router.post(
  "/admin/drops/:dropId/close",
  requireAuth,
  requireRole("ADMIN"),
  closeDrop
);
export default router;