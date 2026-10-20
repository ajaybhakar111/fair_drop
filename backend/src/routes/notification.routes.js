import express from "express";

import {
  getMyNotifications,
  markNotificationAsRead
} from "../controllers/notification.controller.js";

import { requireAuth } from "../middleware/auth.middleware.js";

const router = express.Router();


// ============================================================
// GET MY NOTIFICATIONS
// ============================================================

router.get(
  "/notifications",
  requireAuth,
  getMyNotifications
);


// ============================================================
// MARK NOTIFICATION AS READ
// ============================================================

router.patch(
  "/notifications/:notificationId/read",
  requireAuth,
  markNotificationAsRead
);


export default router;