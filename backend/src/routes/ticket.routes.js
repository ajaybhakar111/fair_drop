import express from "express";

import {
  generateTickets,
  getMyTickets,
  getTicketById
} from "../controllers/ticket.controller.js";

import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";

const router = express.Router();

// Admin: generate tickets
router.post(
  "/events/:eventId/tickets",
  requireAuth,
  requireRole("ADMIN"),
  generateTickets
);

// User: my tickets
router.get(
  "/my",
  requireAuth,
  getMyTickets
);

// User: single ticket
router.get(
  "/:ticketId",
  requireAuth,
  getTicketById
);

export default router;