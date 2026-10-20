import { Router } from "express";

import {
  getReservation,
  confirmReservation,
  cancelReservation
} from "../controllers/reservation.controller.js";

import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

// ============================================================
// RESERVATION
// ============================================================

router.get(
  "/reservations/:reservationId",
  requireAuth,
  getReservation
);

router.post(
  "/reservations/:reservationId/confirm",
  requireAuth,
  confirmReservation
);

router.post(
  "/reservations/:reservationId/cancel",
  requireAuth,
  cancelReservation
);

export default router;