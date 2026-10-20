import express from "express";

import {
  startAllocation
} from "../controllers/allocation.controller.js";

import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";

const router = express.Router();

router.post(
  "/drops/:dropId/allocate",
  requireAuth,
  requireRole("ADMIN"),
  startAllocation
);

export default router;