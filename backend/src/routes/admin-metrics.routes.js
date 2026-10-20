import express from "express";

import {
  getOverviewMetrics,
  getDropMetrics,
  getTrafficMetrics,
  getAbuseMetrics,
  getQueueMetrics,
  getSystemMetrics
} from "../controllers/metrics.controller.js";

import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";

const router = express.Router();


// Overview
router.get(
  "/admin/metrics/overview",
  requireAuth,
  requireRole("ADMIN"),
  getOverviewMetrics
);


// Specific drop
router.get(
  "/admin/metrics/drops/:dropId",
  requireAuth,
  requireRole("ADMIN"),
  getDropMetrics
);


// Traffic
router.get(
  "/admin/metrics/traffic",
  requireAuth,
  requireRole("ADMIN"),
  getTrafficMetrics
);


// Abuse
router.get(
  "/admin/metrics/abuse",
  requireAuth,
  requireRole("ADMIN"),
  getAbuseMetrics
);


// Queues
router.get(
  "/admin/metrics/queues",
  requireAuth,
  requireRole("ADMIN"),
  getQueueMetrics
);


// System
router.get(
  "/admin/metrics/system",
  requireAuth,
  requireRole("ADMIN"),
  getSystemMetrics
);

export default router;